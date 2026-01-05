import { getRFSFacilitiesParser } from '../services/rfsFacilitiesParser';
import type { StationHierarchy } from '../types/stations';
import * as fs from 'fs';
import * as path from 'path';

// Check if the CSV file exists - it's gitignored due to size (2.2MB)
const csvPath = path.join(__dirname, '../data/rfs-facilities.csv');
const csvExists = fs.existsSync(csvPath);

// Skip all tests if CSV file doesn't exist (expected in CI/CD environments)
const describeOrSkip = csvExists ? describe : describe.skip;

describeOrSkip('RFS Facilities Parser', () => {
  let parser: ReturnType<typeof getRFSFacilitiesParser>;

  beforeAll(async () => {
    parser = getRFSFacilitiesParser();
    await parser.loadData();
  });

  describe('Data Loading', () => {
    it('should load fire service facilities data nationally', () => {
      const count = parser.getCount();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeGreaterThan(4000); // Should have 4400+ facilities nationally
    });

    it('should load facilities from multiple states', () => {
      const allStations = parser.getAllStations();
      expect(allStations.length).toBeGreaterThan(0);
      
      // Get unique states
      const states = new Set(allStations.map(s => s.state));
      
      // Should have multiple states (NSW, VIC, QLD, etc.)
      expect(states.size).toBeGreaterThan(1);
      
      // Common states that should be present
      const statesArray = Array.from(states);
      expect(statesArray.some(s => s.includes('VICTORIA'))).toBe(true);
      expect(statesArray.some(s => s.includes('NEW SOUTH WALES'))).toBe(true);
    });

    it('should parse station data correctly', () => {
      const allStations = parser.getAllStations();
      const station = allStations[0];
      
      expect(station).toHaveProperty('id');
      expect(station).toHaveProperty('name');
      expect(station).toHaveProperty('suburb');
      expect(station).toHaveProperty('state');
      expect(station).toHaveProperty('postcode');
      expect(station).toHaveProperty('latitude');
      expect(station).toHaveProperty('longitude');
      
      expect(typeof station.id).toBe('string');
      expect(typeof station.name).toBe('string');
      expect(typeof station.latitude).toBe('number');
      expect(typeof station.longitude).toBe('number');
      
      // State should be one of the Australian states/territories
      const validStates = ['NEW SOUTH WALES', 'VICTORIA', 'QUEENSLAND', 'SOUTH AUSTRALIA', 
                          'WESTERN AUSTRALIA', 'TASMANIA', 'NORTHERN TERRITORY', 
                          'AUSTRALIAN CAPITAL TERRITORY'];
      expect(validStates.includes(station.state)).toBe(true);
    });

    it('should apply 1:1 brigade-station naming', () => {
      const allStations = parser.getAllStations();
      
      // Most stations should have brigade name = station name
      const stationsWithBrigade = allStations.filter(s => s.brigade);
      expect(stationsWithBrigade.length).toBeGreaterThan(0);
      
      // Check that brigade matches name for most stations
      const matchingBrigades = stationsWithBrigade.filter(s => s.brigade === s.name);
      expect(matchingBrigades.length).toBeGreaterThan(stationsWithBrigade.length * 0.9);
    });
  });

  describe('Search Functionality', () => {
    it('should find stations by exact name match', () => {
      const results = parser.searchStations('BULLI');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('BULLI');
      expect(results[0].relevanceScore).toBeGreaterThan(0.9); // High score for exact match
    });

    it('should find stations by partial name match', () => {
      const results = parser.searchStations('fire');
      
      expect(results.length).toBeGreaterThan(0);
      const names = results.map(r => r.name.toLowerCase());
      expect(names.some(name => name.includes('fire'))).toBe(true);
    });

    it('should find stations by suburb', () => {
      const results = parser.searchStations('ballarat');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.suburb.toLowerCase().includes('ballarat') || r.name.toLowerCase().includes('ballarat'))).toBe(true);
    });

    it('should be case-insensitive', () => {
      const upperResults = parser.searchStations('BULLI');
      const lowerResults = parser.searchStations('bulli');
      const mixedResults = parser.searchStations('BuLLi');
      
      expect(upperResults.length).toBe(lowerResults.length);
      expect(upperResults.length).toBe(mixedResults.length);
      expect(upperResults[0].id).toBe(lowerResults[0].id);
    });

    it('should return empty array for non-matching query', () => {
      const results = parser.searchStations('xyzabc123nonexistent');
      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const results = parser.searchStations('');
      expect(results).toEqual([]);
    });

    it('should rank results by relevance', () => {
      const results = parser.searchStations('eng');
      
      expect(results.length).toBeGreaterThan(1);
      
      // Results should be sorted by relevance score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].relevanceScore).toBeGreaterThanOrEqual(results[i + 1].relevanceScore || 0);
      }
    });
  });

  describe('Geolocation Functionality', () => {
    it('should find closest stations to a location', () => {
      // Sydney coordinates
      const lat = -33.8688;
      const lon = 151.2093;
      
      const results = parser.getClosestStations(lat, lon, 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
      
      // All results should have distance
      results.forEach(result => {
        expect(result.distance).toBeDefined();
        expect(typeof result.distance).toBe('number');
        expect(result.distance).toBeGreaterThan(0);
      });
    });

    it('should sort results by distance ascending', () => {
      // Sydney coordinates
      const lat = -33.8688;
      const lon = 151.2093;
      
      const results = parser.getClosestStations(lat, lon, 20);
      
      expect(results.length).toBeGreaterThan(1);
      
      // Results should be sorted by distance ascending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].distance).toBeLessThanOrEqual(results[i + 1].distance || Infinity);
      }
    });

    it('should respect limit parameter', () => {
      const lat = -33.8688;
      const lon = 151.2093;
      
      const results5 = parser.getClosestStations(lat, lon, 5);
      const results10 = parser.getClosestStations(lat, lon, 10);
      
      expect(results5.length).toBe(5);
      expect(results10.length).toBe(10);
    });

    it('should calculate reasonable distances', () => {
      // Sydney coordinates
      const lat = -33.8688;
      const lon = 151.2093;
      
      const results = parser.getClosestStations(lat, lon, 10);
      
      // Closest stations should be within reasonable distance (< 100km)
      expect(results[0].distance).toBeLessThan(100);
      
      // Distance should increase as we go further
      expect(results[results.length - 1].distance).toBeGreaterThan(results[0].distance || 0);
    });

    it('should handle invalid coordinates gracefully', () => {
      const results = parser.getClosestStations(NaN, NaN, 10);
      expect(results).toEqual([]);
    });
  });

  describe('Combined Lookup', () => {
    it('should combine closest + search results', () => {
      const lat = -33.8688;
      const lon = 151.2093;
      const query = 'eng';
      
      const results = parser.lookup(query, lat, lon, 10);
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should have both distance and relevance scores
      const withDistance = results.filter(r => r.distance !== undefined);
      const withRelevance = results.filter(r => r.relevanceScore !== undefined);
      
      expect(withDistance.length).toBeGreaterThan(0);
      expect(withRelevance.length).toBeGreaterThan(0);
    });

    it('should deduplicate results', () => {
      const lat = -33.8688;
      const lon = 151.2093;
      const query = 'bulli'; // Search for a station that might also be in closest results
      
      const results = parser.lookup(query, lat, lon, 10);
      
      // Check for duplicate IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should work with only location', () => {
      const lat = -33.8688;
      const lon = 151.2093;
      
      const results = parser.lookup(undefined, lat, lon, 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
      expect(results[0].distance).toBeDefined();
    });

    it('should work with only query', () => {
      const query = 'bundanoon';
      
      const results = parser.lookup(query, undefined, undefined, 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relevanceScore).toBeDefined();
    });

    it('should return empty array when no parameters provided', () => {
      const results = parser.lookup(undefined, undefined, undefined, 10);
      expect(results).toEqual([]);
    });
  });
});
