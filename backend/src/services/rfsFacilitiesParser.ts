import * as fs from 'fs';
import { logger } from './logger';
import * as path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import type { StationHierarchy, StationSearchResult } from '../types/stations';

/**
 * National Fire Service Facilities Parser
 * Parses the national Rural/Country Fire Service facilities dataset
 * Supports all Australian states and territories
 */
class RFSFacilitiesParser {
  private stations: StationHierarchy[] = [];
  private isLoaded = false;
  private loadSucceeded = false; // Track whether data was successfully loaded
  private readonly csvPath: string;
  private readonly blobContainerName = 'data-files';
  private readonly blobName = 'rfs-facilities.csv';

  constructor() {
    // In production (dist/), path is dist/services/../data/rfs-facilities.csv
    // In tests (src/), path is src/services/../data/rfs-facilities.csv
    this.csvPath = path.join(__dirname, '../data/rfs-facilities.csv');
  }

  /**
   * Download CSV file from Azure Blob Storage if not present locally
   * Returns true if file was downloaded successfully or already exists
   */
  private async downloadFromBlobStorage(): Promise<boolean> {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      logger.info('   ℹ️  Azure Storage not configured - skipping blob download');
      return false;
    }

    try {
      logger.info('   🌐 Attempting to download CSV from Azure Blob Storage...');
      
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(this.blobContainerName);
      const blobClient = containerClient.getBlobClient(this.blobName);
      
      // Check if blob exists with 30-second timeout
      const existsPromise = blobClient.exists();
      const exists = await this.withTimeout(existsPromise, 30000, 'blob exists check');
      if (!exists) {
        logger.info(`   ℹ️  Blob ${this.blobName} not found in container ${this.blobContainerName}`);
        return false;
      }

      // Create directory if it doesn't exist
      const dir = path.dirname(this.csvPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Download the blob to local file with 60-second timeout
      const downloadPromise = blobClient.downloadToFile(this.csvPath);
      await this.withTimeout(downloadPromise, 60000, 'blob download');
      logger.info(`   ✅ Downloaded CSV from blob storage to ${this.csvPath}`);
      return true;
    } catch (error) {
      logger.error('   ❌ Error downloading CSV from blob storage:', error);
      return false;
    }
  }

  /**
   * Wrap a promise with a timeout
   * Throws if the operation exceeds the timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      return result;
    } catch (error) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      throw error;
    }
  }

  /**
   * Load and parse the CSV file
   * Returns true if data was loaded, false if file not found (graceful degradation)
   */
  async loadData(): Promise<boolean> {
    if (this.isLoaded) {
      return this.loadSucceeded; // Return whether previous load was successful
    }

    try {
      // Check if file exists locally
      let fileExists = fs.existsSync(this.csvPath);
      
      // If file doesn't exist, try to download from blob storage
      if (!fileExists) {
        logger.info('   📂 CSV file not found locally, checking Azure Blob Storage...');
        fileExists = await this.downloadFromBlobStorage();
      }
      
      if (!fileExists) {
        logger.warn(`⚠️  CSV file not found at ${this.csvPath} - Station lookup features will be unavailable`);
        logger.warn(`   To enable station lookup, either:`);
        logger.warn(`   1. Upload rfs-facilities.csv to Azure Blob Storage container '${this.blobContainerName}'`);
        logger.warn(`   2. Download from atlas.gov.au and place at ${this.csvPath}`);
        // Dual-flag pattern: isLoaded=true prevents repeated warnings, loadSucceeded=false tracks actual status
        this.isLoaded = true; 
        this.loadSucceeded = false;
        return false;
      }

      const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = csvContent.split('\n');
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      // Load ALL facilities nationally (no state filter)
      this.stations = dataLines
        .map(line => this.parseCSVLine(line))
        .filter((station): station is StationHierarchy => station !== null);

      this.isLoaded = true;
      this.loadSucceeded = true;
      
      // Count by state for logging
      const byState = this.stations.reduce((acc, s) => {
        acc[s.state] = (acc[s.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      logger.info(`✅ Loaded ${this.stations.length} fire service facilities nationally from ${this.csvPath}`);
      logger.info(`   Breakdown by state: ${Object.entries(byState).map(([state, count]) => `${state}: ${count}`).join(', ')}`);
      return true;
    } catch (error) {
      logger.error('❌ Error loading fire service facilities CSV:', error);
      // Dual-flag pattern: isLoaded=true prevents repeated errors, loadSucceeded=false tracks actual status
      this.isLoaded = true;
      this.loadSucceeded = false;
      return false;
    }
  }

  /**
   * Parse a single CSV line into StationHierarchy
   * CSV fields (zero-indexed):
   * 0: X (longitude), 1: Y (latitude), 2: comment_, 3: objectid, 4: featuretype,
   * 5: descripton, 6: class, 7: facility_name, 8: facility_operationalstatus,
   * 9: facility_address, 10: abs_suburb, 11: facility_state, 12: abs_postcode, ...
   */
  private parseCSVLine(line: string): StationHierarchy | null {
    if (!line || line.trim() === '') {
      return null;
    }

    const fields = this.parseCSVFields(line);
    
    if (fields.length < 25) {
      return null;
    }

    const longitude = parseFloat(fields[0]); // X
    const latitude = parseFloat(fields[1]);  // Y
    const facilityName = fields[7];          // facility_name (index 7, not 8!)
    const operationalStatus = fields[8];     // facility_operationalstatus
    const suburb = fields[10];               // abs_suburb (index 10, not 11!)
    const state = fields[11];                // facility_state (index 11, not 12!)
    const postcode = fields[12];             // abs_postcode (index 12, not 13!)

    // Validate required fields
    if (!facilityName || !suburb || !state || isNaN(latitude) || isNaN(longitude)) {
      return null;
    }

    // Generate unique ID from name and location
    const id = this.generateStationId(facilityName, suburb, postcode);

    // Apply 1:1 brigade-station naming convention
    // Most stations have brigade name = station name
    const brigade = facilityName;

    return {
      id,
      name: facilityName,
      brigade,
      suburb,
      state,
      postcode: postcode || '',
      latitude,
      longitude,
      operationalStatus
    };
  }

  /**
   * Parse CSV fields handling quoted values properly
   * This handles commas inside quotes and escaped quotes
   */
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
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
      
      i++;
    }
    
    // Add last field
    fields.push(currentField.trim());
    
    return fields;
  }

  /**
   * Generate a unique station ID
   */
  private generateStationId(name: string, suburb: string, postcode: string): string {
    const normalized = `${name}-${suburb}-${postcode}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `station-${normalized}`;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 Latitude of point 1 (degrees)
   * @param lon1 Longitude of point 1 (degrees)
   * @param lat2 Latitude of point 2 (degrees)
   * @param lon2 Longitude of point 2 (degrees)
   * @returns Distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Search stations by text query (name, suburb)
   * @param query Search query string
   * @returns Matching stations with relevance scores
   */
  searchStations(query: string): StationSearchResult[] {
    if (!this.isLoaded) {
      throw new Error('RFS facilities data not loaded. Call loadData() first.');
    }

    if (!query || query.trim() === '') {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const results: StationSearchResult[] = [];

    for (const station of this.stations) {
      const nameMatch = station.name.toLowerCase().includes(searchTerm);
      const suburbMatch = station.suburb.toLowerCase().includes(searchTerm);
      const brigadeMatch = station.brigade?.toLowerCase().includes(searchTerm);

      if (nameMatch || suburbMatch || brigadeMatch) {
        // Calculate relevance score (0-1)
        let score = 0;
        
        // Exact name match gets highest score
        if (station.name.toLowerCase() === searchTerm) {
          score = 1.0;
        } else if (station.name.toLowerCase().startsWith(searchTerm)) {
          score = 0.9;
        } else if (nameMatch) {
          score = 0.7;
        } else if (station.suburb.toLowerCase() === searchTerm) {
          score = 0.8;
        } else if (suburbMatch) {
          score = 0.5;
        } else if (brigadeMatch) {
          score = 0.6;
        }

        results.push({
          ...station,
          relevanceScore: score
        });
      }
    }

    // Sort by relevance score descending
    return results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Get closest stations to a geographic location
   * @param latitude User latitude
   * @param longitude User longitude
   * @param limit Maximum number of results (default 10)
   * @returns Closest stations with distance information
   */
  getClosestStations(latitude: number, longitude: number, limit: number = 10): StationSearchResult[] {
    if (!this.isLoaded) {
      throw new Error('RFS facilities data not loaded. Call loadData() first.');
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      return [];
    }

    // Calculate distance for all stations
    const stationsWithDistance: StationSearchResult[] = this.stations.map(station => ({
      ...station,
      distance: this.calculateDistance(latitude, longitude, station.latitude, station.longitude)
    }));

    // Sort by distance ascending and return top N
    return stationsWithDistance
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity))
      .slice(0, limit);
  }

  /**
   * Combined lookup: closest stations + search results
   * @param query Optional search query
   * @param latitude Optional user latitude
   * @param longitude Optional user longitude
   * @param limit Maximum number of results per category (default 10)
   * @returns Combined and deduplicated results
   */
  lookup(
    query?: string,
    latitude?: number,
    longitude?: number,
    limit: number = 10
  ): StationSearchResult[] {
    if (!this.isLoaded) {
      throw new Error('RFS facilities data not loaded. Call loadData() first.');
    }

    const results: StationSearchResult[] = [];
    const seenIds = new Set<string>();

    // Get closest stations if location provided
    if (latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)) {
      const closest = this.getClosestStations(latitude, longitude, limit);
      for (const station of closest) {
        results.push(station);
        seenIds.add(station.id);
      }
    }

    // Get search results if query provided
    if (query && query.trim() !== '') {
      const searchResults = this.searchStations(query);
      
      // Add search results, skipping duplicates
      for (const station of searchResults.slice(0, limit)) {
        if (!seenIds.has(station.id)) {
          results.push(station);
          seenIds.add(station.id);
        }
      }
    }

    return results;
  }

  /**
   * Get all stations (for debugging/testing)
   */
  getAllStations(): StationHierarchy[] {
    return [...this.stations];
  }

  /**
   * Get total count of loaded stations
   */
  getCount(): number {
    return this.stations.length;
  }

  /**
   * Check if CSV data is available
   * Returns true if CSV data was successfully loaded, false otherwise
   */
  isDataAvailable(): boolean {
    return this.loadSucceeded && this.stations.length > 0;
  }
}

// Singleton instance
let parserInstance: RFSFacilitiesParser | null = null;

/**
 * Get the singleton parser instance
 */
export function getRFSFacilitiesParser(): RFSFacilitiesParser {
  if (!parserInstance) {
    parserInstance = new RFSFacilitiesParser();
  }
  return parserInstance;
}

export default RFSFacilitiesParser;
