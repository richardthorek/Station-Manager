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
 * Source layer *name* → serviceType slug (not layer id/index — GA has
 * silently renumbered these layers before, which previously mislabeled
 * every fetched facility: layers 1-3 were POLICING_FACILITY/METRO_FIRE_
 * FACILITY/OTHER_EMERGENCY_MANAGEMENT_FACILITY in a different order than
 * this map assumed). Resolving by name is immune to reordering; an
 * unrecognized layer name fails loudly in main() instead of mislabeling.
 */
const LAYER_NAME_SERVICE_TYPES: Record<string, string> = {
  AMBULANCE_STATION: 'ambulance',
  OTHER_EMERGENCY_MANAGEMENT_FACILITY: 'other',
  POLICING_FACILITY: 'police',
  METRO_FIRE_FACILITY: 'metro-fire',
  RURAL_COUNTRY_FIRE_SERVICE_FACILITY: 'rural-fire',
  SES_FACILITY: 'ses',
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

async function fetchLayerList(): Promise<Array<{ id: number; name: string }>> {
  const res = await fetch(`${SERVICE_URL}?f=json`);
  if (!res.ok) throw new Error(`Service metadata request failed: ${res.status}`);
  const meta = (await res.json()) as { layers?: Array<{ id: number; name: string }> };
  return meta.layers ?? [];
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

  const layers = await fetchLayerList();
  const knownNames = new Set(Object.keys(LAYER_NAME_SERVICE_TYPES));
  const unrecognized = layers.filter((l) => !knownNames.has(l.name));
  if (unrecognized.length > 0) {
    throw new Error(
      `Unrecognized GA layer name(s), refusing to guess a serviceType: ${unrecognized
        .map((l) => `${l.id}:${l.name}`)
        .join(', ')}. Update LAYER_NAME_SERVICE_TYPES.`,
    );
  }

  for (const layer of layers) {
    const serviceType = LAYER_NAME_SERVICE_TYPES[layer.name];
    console.log(`   📥 Layer ${layer.id} (${layer.name}) → ${serviceType} ...`);
    const features = await fetchLayerFeatures(layer.id);
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
          layer.id,
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
