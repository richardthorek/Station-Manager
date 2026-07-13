/**
 * Emergency Services Facilities Parser
 *
 * Loads the combined multi-service snapshot of the Digital Atlas of Australia
 * "Emergency Management Facilities" dataset (rural/country fire, metro fire,
 * SES, ambulance, police, other) used by the public signup facility lookup
 * (GET /api/facilities/lookup).
 *
 * The snapshot is `emergency-facilities.csv`, produced by
 * scripts/fetchEmergencyFacilitiesSnapshot.ts with a normalized header
 * (servicetype, objectid, layerid first, then the Atlas columns), bundled at
 * src/data/ or downloaded from the `data-files` blob container — the same
 * pattern as rfsFacilitiesParser.ts, which remains untouched and continues to
 * serve the existing /api/stations/lookup (converging them is a queued
 * follow-up in docs/MASTER_PLAN.md).
 */

import * as fs from 'fs';
import * as path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { logger } from './logger';
import type { FacilityServiceType } from '../types';
import { isFacilityServiceType, type Facility, type FacilitySearchResult } from '../types/facilities';

export interface FacilitySearchOptions {
  serviceType?: FacilityServiceType;
  state?: string;
  limit?: number;
}

class FacilitiesParser {
  private facilities: Facility[] = [];
  private byKey: Map<string, Facility> = new Map();
  private isLoaded = false;
  private loadSucceeded = false;
  private readonly csvPath: string;
  private readonly blobContainerName = 'data-files';
  private readonly blobName = 'emergency-facilities.csv';

  constructor() {
    // Test-only override so parallel Jest workers can each point at their own
    // fixture file instead of racing on the same on-disk path.
    this.csvPath =
      process.env.EMERGENCY_FACILITIES_CSV_PATH_OVERRIDE ||
      path.join(__dirname, '../data/emergency-facilities.csv');
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  private async downloadFromBlobStorage(): Promise<boolean> {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      logger.info('Azure Storage not configured - skipping emergency-facilities blob download');
      return false;
    }
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(this.blobContainerName);
      const blobClient = containerClient.getBlobClient(this.blobName);

      const exists = await this.withTimeout(blobClient.exists(), 30000, 'blob exists check');
      if (!exists) {
        logger.info(`Blob ${this.blobName} not found in container ${this.blobContainerName}`);
        return false;
      }

      const dir = path.dirname(this.csvPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await this.withTimeout(blobClient.downloadToFile(this.csvPath), 60000, 'blob download');
      logger.info(`Downloaded emergency facilities CSV from blob storage to ${this.csvPath}`);
      return true;
    } catch (error) {
      logger.error('Error downloading emergency facilities CSV from blob storage', { error });
      return false;
    }
  }

  /**
   * Load and parse the snapshot. Graceful degradation: returns false (and the
   * lookup route 503s) when the snapshot is missing — same dual-flag pattern
   * as rfsFacilitiesParser.
   */
  async loadData(): Promise<boolean> {
    if (this.isLoaded) {
      return this.loadSucceeded;
    }

    try {
      let fileExists = fs.existsSync(this.csvPath);
      if (!fileExists) {
        logger.info('emergency-facilities.csv not found locally, checking Azure Blob Storage...');
        fileExists = await this.downloadFromBlobStorage();
      }

      if (!fileExists) {
        logger.warn(`emergency-facilities.csv not found at ${this.csvPath} - facility lookup unavailable`);
        logger.warn('Run `npm run facilities:fetch` then `npm run facilities:upload` (see scripts/README.md)');
        this.isLoaded = true;
        this.loadSucceeded = false;
        return false;
      }

      const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter((line) => line.trim() !== '');
      if (lines.length < 2) {
        logger.warn('emergency-facilities.csv is empty - facility lookup unavailable');
        this.isLoaded = true;
        this.loadSucceeded = false;
        return false;
      }

      // Header-driven column mapping — the fetch script writes a normalized
      // header, so a column reorder never silently mis-parses.
      const header = this.parseCSVFields(lines[0]).map((h) => h.toLowerCase());
      const col = (name: string): number => header.indexOf(name);
      const idx = {
        servicetype: col('servicetype'),
        objectid: col('objectid'),
        x: col('x'),
        y: col('y'),
        name: col('facility_name'),
        status: col('facility_operationalstatus'),
        suburb: col('abs_suburb'),
        state: col('facility_state'),
        postcode: col('abs_postcode'),
      };
      const required = [idx.servicetype, idx.objectid, idx.x, idx.y, idx.name, idx.state];
      if (required.some((i) => i < 0)) {
        logger.error('emergency-facilities.csv header missing required columns', { header });
        this.isLoaded = true;
        this.loadSucceeded = false;
        return false;
      }

      this.facilities = [];
      this.byKey.clear();
      for (const line of lines.slice(1)) {
        const fields = this.parseCSVFields(line);
        const serviceType = fields[idx.servicetype];
        const objectid = fields[idx.objectid];
        const longitude = parseFloat(fields[idx.x]);
        const latitude = parseFloat(fields[idx.y]);
        const name = fields[idx.name];
        const state = fields[idx.state];
        if (!isFacilityServiceType(serviceType) || !objectid || !name || !state || isNaN(latitude) || isNaN(longitude)) {
          continue;
        }
        const facility: Facility = {
          facilityKey: `${serviceType}:${objectid}`,
          objectid,
          serviceType,
          name,
          suburb: idx.suburb >= 0 ? fields[idx.suburb] ?? '' : '',
          state,
          postcode: idx.postcode >= 0 ? fields[idx.postcode] ?? '' : '',
          latitude,
          longitude,
          operationalStatus: idx.status >= 0 ? fields[idx.status] ?? '' : '',
        };
        this.facilities.push(facility);
        this.byKey.set(facility.facilityKey, facility);
      }

      this.isLoaded = true;
      this.loadSucceeded = this.facilities.length > 0;

      const byType = this.facilities.reduce((acc, f) => {
        acc[f.serviceType] = (acc[f.serviceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      logger.info(`Loaded ${this.facilities.length} emergency service facilities from ${this.csvPath}`);
      logger.info(`Breakdown by service: ${Object.entries(byType).map(([t, c]) => `${t}: ${c}`).join(', ')}`);
      return this.loadSucceeded;
    } catch (error) {
      logger.error('Error loading emergency facilities CSV', { error });
      this.isLoaded = true;
      this.loadSucceeded = false;
      return false;
    }
  }

  private parseCSVFields(line: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
      i++;
    }
    fields.push(currentField.trim());
    return fields;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Text search with optional service-type/state filters. Scoring: exact name
   * 1.0, name prefix 0.9, exact postcode 0.85, exact suburb 0.8, name substring
   * 0.7, suburb substring 0.5. Multi-token queries AND across name+suburb
   * ("bungendore ses" matches an SES facility in Bungendore).
   */
  search(query: string, opts: FacilitySearchOptions = {}): FacilitySearchResult[] {
    if (!this.isLoaded) {
      throw new Error('Emergency facilities data not loaded. Call loadData() first.');
    }
    const searchTerm = (query || '').toLowerCase().trim();
    if (!searchTerm) return [];
    const tokens = searchTerm.split(/\s+/);
    const limit = opts.limit ?? 10;
    const stateFilter = opts.state?.toLowerCase();

    const results: FacilitySearchResult[] = [];
    for (const facility of this.facilities) {
      if (opts.serviceType && facility.serviceType !== opts.serviceType) continue;
      if (stateFilter && facility.state.toLowerCase() !== stateFilter) continue;

      const name = facility.name.toLowerCase();
      const suburb = facility.suburb.toLowerCase();
      const haystack = `${name} ${suburb} ${facility.serviceType} ${facility.postcode}`;
      if (!tokens.every((t) => haystack.includes(t))) continue;

      let score = 0;
      if (name === searchTerm) score = 1.0;
      else if (name.startsWith(searchTerm)) score = 0.9;
      else if (facility.postcode === searchTerm) score = 0.85;
      else if (suburb === searchTerm) score = 0.8;
      else if (name.includes(searchTerm)) score = 0.7;
      else if (suburb.includes(searchTerm)) score = 0.5;
      else score = 0.4; // multi-token AND match across fields

      results.push({ ...facility, claimed: false, relevanceScore: score });
    }

    return results
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, limit);
  }

  /** Closest facilities to a point, with optional filters. */
  getClosest(latitude: number, longitude: number, opts: FacilitySearchOptions = {}): FacilitySearchResult[] {
    if (!this.isLoaded) {
      throw new Error('Emergency facilities data not loaded. Call loadData() first.');
    }
    if (isNaN(latitude) || isNaN(longitude)) return [];
    const limit = opts.limit ?? 10;
    const stateFilter = opts.state?.toLowerCase();

    return this.facilities
      .filter((f) => !opts.serviceType || f.serviceType === opts.serviceType)
      .filter((f) => !stateFilter || f.state.toLowerCase() === stateFilter)
      .map((f) => ({
        ...f,
        claimed: false,
        distance: this.calculateDistance(latitude, longitude, f.latitude, f.longitude),
      }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      .slice(0, limit);
  }

  /**
   * Combined lookup: query-first (typing overrides location), else nearest.
   * Distances are annotated whenever a location is provided.
   */
  lookup(
    query?: string,
    latitude?: number,
    longitude?: number,
    opts: FacilitySearchOptions = {},
  ): FacilitySearchResult[] {
    const lat = latitude !== undefined && !isNaN(latitude) ? latitude : null;
    const lon = longitude !== undefined && !isNaN(longitude) ? longitude : null;
    if (query && query.trim() !== '') {
      const results = this.search(query, opts);
      if (lat !== null && lon !== null) {
        for (const r of results) {
          r.distance = this.calculateDistance(lat, lon, r.latitude, r.longitude);
        }
      }
      return results;
    }
    if (lat !== null && lon !== null) {
      return this.getClosest(lat, lon, opts);
    }
    return [];
  }

  getByKey(facilityKey: string): Facility | null {
    return this.byKey.get(facilityKey) ?? null;
  }

  getCount(): number {
    return this.facilities.length;
  }

  isDataAvailable(): boolean {
    return this.loadSucceeded && this.facilities.length > 0;
  }

  /** Test hook: reset so a fresh fixture CSV can be loaded. */
  resetForTesting(): void {
    this.facilities = [];
    this.byKey.clear();
    this.isLoaded = false;
    this.loadSucceeded = false;
  }
}

let parserInstance: FacilitiesParser | null = null;

export function getFacilitiesParser(): FacilitiesParser {
  if (!parserInstance) {
    parserInstance = new FacilitiesParser();
  }
  return parserInstance;
}

export default FacilitiesParser;
