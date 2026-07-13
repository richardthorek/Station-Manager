#!/usr/bin/env ts-node

/**
 * Fetch the Emergency Management Facilities snapshot from the Digital Atlas
 * of Australia (Geoscience Australia) ArcGIS service and write the combined
 * multi-service CSV consumed by services/facilitiesParser.ts.
 *
 * ⚠️  REQUIRES INTERNET ACCESS TO services.ga.gov.au — run this from an
 *     operator machine, NOT from CI or a sandboxed agent environment (the
 *     dev sandbox blocks ga.gov.au). After fetching, upload with
 *     `npm run facilities:upload`.
 *
 * Output CSV header (normalized — the parser is header-driven but the fetch
 * script always writes this order):
 *   servicetype,objectid,layerid,x,y,facility_name,facility_operationalstatus,
 *   facility_address,abs_suburb,facility_state,abs_postcode
 *
 * Attribution: Emergency Management Facilities dataset © Geoscience Australia
 * (Digital Atlas of Australia), CC-BY. Sourced from state/territory emergency
 * management agencies via EMSINA.
 *
 * Usage:
 *   npm run facilities:fetch
 *   # optionally override the service root:
 *   EM_FACILITIES_SERVICE_URL=https://... npm run facilities:fetch
 */

import * as fs from 'fs';
import * as path from 'path';

const SERVICE_URL =
  process.env.EM_FACILITIES_SERVICE_URL ||
  'https://services.ga.gov.au/gis/rest/services/Emergency_Management_Facilities/MapServer';

/**
 * Source layer index → serviceType slug. Verify against `${SERVICE_URL}?f=json`
 * when refreshing — a GA layer renumbering is a one-line fix here (the CSV
 * carries the resolved slug, so runtime code never depends on layer ids).
 */
const LAYER_SERVICE_TYPES: Record<number, string> = {
  0: 'ambulance',
  1: 'metro-fire',
  2: 'other',
  3: 'police',
  4: 'rural-fire',
  5: 'ses',
};

const OUTPUT_PATH = path.join(__dirname, '../data/emergency-facilities.csv');
const PAGE_SIZE = 1000;

interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Case-insensitive attribute getter (GA layers vary in field casing). */
function attr(attributes: Record<string, unknown>, name: string): unknown {
  const key = Object.keys(attributes).find((k) => k.toLowerCase() === name.toLowerCase());
  return key !== undefined ? attributes[key] : undefined;
}

async function fetchLayerName(layerId: number): Promise<string> {
  const res = await fetch(`${SERVICE_URL}/${layerId}?f=json`);
  if (!res.ok) throw new Error(`Layer ${layerId} metadata request failed: ${res.status}`);
  const meta = (await res.json()) as { name?: string };
  return meta.name ?? `layer-${layerId}`;
}

async function fetchLayerFeatures(layerId: number): Promise<ArcGISFeature[]> {
  const features: ArcGISFeature[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      outSR: '4326',
      f: 'json',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    });
    const res = await fetch(`${SERVICE_URL}/${layerId}/query?${params}`);
    if (!res.ok) throw new Error(`Layer ${layerId} query failed: ${res.status}`);
    const page = (await res.json()) as { features?: ArcGISFeature[]; exceededTransferLimit?: boolean };
    const batch = page.features ?? [];
    features.push(...batch);
    if (batch.length < PAGE_SIZE && !page.exceededTransferLimit) break;
    offset += batch.length;
  }
  return features;
}

async function main(): Promise<void> {
  console.log(`🌐 Fetching Emergency Management Facilities from ${SERVICE_URL}`);
  const rows: string[] = [
    'servicetype,objectid,layerid,x,y,facility_name,facility_operationalstatus,facility_address,abs_suburb,facility_state,abs_postcode',
  ];

  for (const [layerIdStr, serviceType] of Object.entries(LAYER_SERVICE_TYPES)) {
    const layerId = Number(layerIdStr);
    const layerName = await fetchLayerName(layerId);
    console.log(`   📥 Layer ${layerId} (${layerName}) → ${serviceType} ...`);
    const features = await fetchLayerFeatures(layerId);
    let written = 0;
    for (const feature of features) {
      const a = feature.attributes;
      const objectid = attr(a, 'objectid');
      const name = attr(a, 'facility_name') ?? attr(a, 'name');
      const x = feature.geometry?.x ?? attr(a, 'x');
      const y = feature.geometry?.y ?? attr(a, 'y');
      if (objectid === undefined || !name || x === undefined || y === undefined) continue;
      rows.push(
        [
          serviceType,
          objectid,
          layerId,
          x,
          y,
          name,
          attr(a, 'facility_operationalstatus') ?? attr(a, 'operationalstatus') ?? '',
          attr(a, 'facility_address') ?? attr(a, 'address') ?? '',
          attr(a, 'abs_suburb') ?? attr(a, 'suburb') ?? '',
          attr(a, 'facility_state') ?? attr(a, 'state') ?? '',
          attr(a, 'abs_postcode') ?? attr(a, 'postcode') ?? '',
        ]
          .map(csvEscape)
          .join(','),
      );
      written++;
    }
    console.log(`      ✅ ${written} facilities`);
  }

  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rows.join('\n') + '\n', 'utf-8');
  console.log(`\n🎉 Wrote ${rows.length - 1} facilities to ${OUTPUT_PATH}`);
  console.log('   Next: npm run facilities:upload');
}

main().catch((error) => {
  console.error('❌ Fatal error fetching facilities snapshot:', error);
  process.exit(1);
});
