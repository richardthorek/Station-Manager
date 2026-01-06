/**
 * Station Constants Tests
 * 
 * Tests for station utility functions
 */

import {
  DEFAULT_STATION_ID,
  DEMO_STATION_ID,
  DEMO_BRIGADE_ID,
  isDemoStation,
  getEffectiveStationId,
  isDefaultStation,
} from '../constants/stations';

describe('Station Constants', () => {
  describe('isDemoStation', () => {
    it('should return true for demo station ID', () => {
      expect(isDemoStation(DEMO_STATION_ID)).toBe(true);
    });

    it('should return false for non-demo station ID', () => {
      expect(isDemoStation('other-station')).toBe(false);
      expect(isDemoStation(DEFAULT_STATION_ID)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDemoStation(undefined)).toBe(false);
    });
  });

  describe('getEffectiveStationId', () => {
    it('should return the provided station ID when defined', () => {
      expect(getEffectiveStationId('test-station')).toBe('test-station');
      expect(getEffectiveStationId(DEMO_STATION_ID)).toBe(DEMO_STATION_ID);
    });

    it('should return DEFAULT_STATION_ID when undefined', () => {
      expect(getEffectiveStationId(undefined)).toBe(DEFAULT_STATION_ID);
    });

    it('should return DEFAULT_STATION_ID when empty string', () => {
      expect(getEffectiveStationId('')).toBe(DEFAULT_STATION_ID);
    });
  });

  describe('isDefaultStation', () => {
    it('should return true for default station ID', () => {
      expect(isDefaultStation(DEFAULT_STATION_ID)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isDefaultStation(undefined)).toBe(true);
    });

    it('should return false for other station IDs', () => {
      expect(isDefaultStation('other-station')).toBe(false);
      expect(isDefaultStation(DEMO_STATION_ID)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have correct default station ID', () => {
      expect(DEFAULT_STATION_ID).toBe('default-station');
    });

    it('should have correct demo station ID', () => {
      expect(DEMO_STATION_ID).toBe('demo-station');
    });

    it('should have correct demo brigade ID', () => {
      expect(DEMO_BRIGADE_ID).toBe('demo-brigade');
    });
  });
});
