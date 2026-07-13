import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Each Jest test file runs as its own module registry, but multiple test
 * files can run concurrently as separate OS processes and would otherwise
 * race on the same on-disk CSV path. Point each test file at its own unique
 * tmp file via EMERGENCY_FACILITIES_CSV_PATH_OVERRIDE (read by
 * services/facilitiesParser.ts's constructor) instead of writing into
 * src/data/.
 */
const csvPath = path.join(os.tmpdir(), `emergency-facilities-test-${process.pid}-${Date.now()}.csv`);
process.env.EMERGENCY_FACILITIES_CSV_PATH_OVERRIDE = csvPath;

export const FIXTURE_CSV = [
  'servicetype,objectid,layerid,x,y,facility_name,facility_operationalstatus,facility_address,abs_suburb,facility_state,abs_postcode',
  'rural-fire,101,4,149.4,-35.2,Bungendore Rural Fire Brigade,Operational,Malbon St,BUNGENDORE,NSW,2621',
  'rural-fire,102,4,151.2,-33.8,Sydney Rural Fire Brigade,Operational,George St,SYDNEY,NSW,2000',
  'ses,201,5,149.4,-35.2,Bungendore SES Unit,Operational,Malbon St,BUNGENDORE,NSW,2621',
  'metro-fire,301,1,151.2,-33.9,Sydney Fire Station 1,Operational,Bent St,SYDNEY,NSW,2000',
  'ambulance,401,0,153.0,-27.5,Brisbane Ambulance Station,Operational,Adelaide St,BRISBANE,QLD,4000',
].join('\n');

/** Install the small multi-service fixture CSV at this test file's unique tmp path. */
export function installFacilitiesFixture(): void {
  fs.writeFileSync(csvPath, FIXTURE_CSV, 'utf-8');
}

/** Remove this test file's fixture CSV (simulates the snapshot being unavailable). */
export function removeFacilitiesFixture(): void {
  fs.rmSync(csvPath, { force: true });
}

/** Back-compat alias — tears down by removing the tmp fixture (no real file to restore). */
export const restoreFacilitiesFixture = removeFacilitiesFixture;
