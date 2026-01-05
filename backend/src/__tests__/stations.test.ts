import request from 'supertest';
import express from 'express';
import stationsRouter from '../routes/stations';
import { getRFSFacilitiesParser } from '../services/rfsFacilitiesParser';

// Create a test Express app
const app = express();
app.use(express.json());
app.use('/api/stations', stationsRouter);

describe('Stations API', () => {
  beforeAll(async () => {
    // Ensure data is loaded before tests
    const parser = getRFSFacilitiesParser();
    await parser.loadData();
  });

  describe('GET /api/stations/lookup', () => {
    it('should return stations for search query', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'bulli' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('query', 'bulli');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.results.length).toBeGreaterThan(0);
    });

    it('should return closest stations for location', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ lat: -33.8688, lon: 151.2093 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('location');
      expect(response.body.location).toEqual({ lat: -33.8688, lon: 151.2093 });
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      // All results should have distance
      response.body.results.forEach((station: any) => {
        expect(station).toHaveProperty('distance');
        expect(typeof station.distance).toBe('number');
      });
    });

    it('should combine search and location results', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'eng', lat: -33.8688, lon: 151.2093 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('query', 'eng');
      expect(response.body).toHaveProperty('location');
      expect(response.body.results.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'station', limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeLessThanOrEqual(5);
    });

    it('should cap limit at 50', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'station', limit: 100 });

      expect(response.status).toBe(200);
      // Limit should be capped at 50
      expect(response.body.results.length).toBeLessThanOrEqual(50);
    });

    it('should default limit to 10', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ lat: -33.8688, lon: 151.2093 });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeLessThanOrEqual(10);
    });

    it('should return 400 if no parameters provided', async () => {
      const response = await request(app)
        .get('/api/stations/lookup');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if only lat provided', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ lat: -33.8688 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if only lon provided', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ lon: 151.2093 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle empty search query', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ q: '', lat: -33.8688, lon: 151.2093 });

      expect(response.status).toBe(200);
      // Should only return location results
      expect(response.body.results.length).toBeGreaterThan(0);
    });

    it('should handle invalid coordinates gracefully', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'bulli', lat: 'invalid', lon: 'invalid' });

      expect(response.status).toBe(200);
      // Should return search results only
      expect(response.body.results.length).toBeGreaterThan(0);
    });

    it('should return correct station structure', async () => {
      const response = await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'bulli' });

      expect(response.status).toBe(200);
      
      const station = response.body.results[0];
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
    });
  });

  describe('GET /api/stations/count', () => {
    it('should return station count', async () => {
      const response = await request(app)
        .get('/api/stations/count');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThan(0);
      expect(response.body.count).toBeGreaterThan(1000); // Should have 1500+ NSW facilities
    });
  });

  describe('Performance', () => {
    it('should respond in less than 200ms for search', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'station' });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('should respond in less than 200ms for location lookup', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/stations/lookup')
        .query({ lat: -33.8688, lon: 151.2093 });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('should respond in less than 200ms for combined lookup', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/stations/lookup')
        .query({ q: 'eng', lat: -33.8688, lon: 151.2093, limit: 20 });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });
});
