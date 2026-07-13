import { getFacilitiesParser } from '../services/facilitiesParser';
import {
  installFacilitiesFixture,
  removeFacilitiesFixture,
  restoreFacilitiesFixture,
} from './helpers/facilitiesFixture';

describe('FacilitiesParser', () => {
  let parser: ReturnType<typeof getFacilitiesParser>;

  beforeAll(() => {
    installFacilitiesFixture();
  });

  afterAll(() => {
    restoreFacilitiesFixture();
  });

  beforeEach(() => {
    parser = getFacilitiesParser();
    parser.resetForTesting();
  });

  it('loads the snapshot and reports availability', async () => {
    const loaded = await parser.loadData();
    expect(loaded).toBe(true);
    expect(parser.isDataAvailable()).toBe(true);
    expect(parser.getCount()).toBe(5);
  });

  it('builds a composite facilityKey per service type', async () => {
    await parser.loadData();
    const facility = parser.getByKey('rural-fire:101');
    expect(facility?.name).toBe('Bungendore Rural Fire Brigade');
    expect(parser.getByKey('ses:101')).toBeNull(); // objectid 101 only exists under rural-fire
  });

  it('filters search results by serviceType', async () => {
    await parser.loadData();
    const results = parser.search('bungendore', { serviceType: 'ses' });
    expect(results).toHaveLength(1);
    expect(results[0].facilityKey).toBe('ses:201');
  });

  it('AND-matches multi-token queries across name and service type', async () => {
    await parser.loadData();
    const results = parser.search('bungendore ses');
    expect(results.map((r) => r.facilityKey)).toContain('ses:201');
    expect(results.map((r) => r.facilityKey)).not.toContain('rural-fire:101');
  });

  it('scores exact postcode matches', async () => {
    await parser.loadData();
    const results = parser.search('2621');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.postcode === '2621')).toBe(true);
  });

  it('annotates distance when a location is provided via lookup', async () => {
    await parser.loadData();
    const results = parser.lookup('bungendore', -35.2, 149.4);
    expect(results[0].distance).toBeDefined();
    expect(results[0].distance).toBeLessThan(5);
  });

  it('falls back to nearest-facility lookup when no query is given', async () => {
    await parser.loadData();
    const results = parser.lookup(undefined, -35.2, 149.4, { limit: 2 });
    expect(results.length).toBe(2);
    expect(results[0].distance).toBeLessThanOrEqual(results[1].distance ?? Infinity);
  });

  it('gracefully degrades when the snapshot file is missing', async () => {
    removeFacilitiesFixture();
    const loaded = await parser.loadData();
    expect(loaded).toBe(false);
    expect(parser.isDataAvailable()).toBe(false);
    // restore for afterAll / any later test in this file
    installFacilitiesFixture();
  });
});
