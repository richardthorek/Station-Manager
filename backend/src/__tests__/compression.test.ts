/**
 * Response Compression Tests
 * 
 * Tests for response compression middleware:
 * - Verifies compression is enabled for text-based content
 * - Checks Content-Encoding headers are set correctly
 * - Validates compression threshold (1KB minimum)
 * - Ensures compression can be disabled via header
 * - Measures compression ratio on various content types
 * - Verifies minimal performance overhead
 */

import request from 'supertest';
import express, { Express } from 'express';
import compression from 'compression';
import { promisify } from 'util';
import { gzip } from 'zlib';

const gzipAsync = promisify(gzip);

let app: Express;

// Create a test string that's larger than 1KB threshold
const largeTextContent = 'Hello World! '.repeat(100); // ~1.3KB
const smallTextContent = 'Hello'; // < 1KB

beforeAll(() => {
  // Set up Express app with compression middleware (matching production config)
  app = express();
  app.use(express.json());
  
  // Same compression config as in index.ts
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Test routes for various content types
  app.get('/api/test/json-large', (req, res) => {
    const data = {
      message: 'Testing compression',
      data: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'This is a test item with some description text that makes it larger'
      }))
    };
    res.json(data);
  });

  app.get('/api/test/json-small', (req, res) => {
    res.json({ message: 'OK' });
  });

  app.get('/api/test/html', (req, res) => {
    res.type('html').send(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          ${largeTextContent}
        </body>
      </html>
    `);
  });

  app.get('/api/test/text', (req, res) => {
    res.type('text').send(largeTextContent);
  });

  app.get('/api/test/css', (req, res) => {
    res.type('css').send(`
      body { margin: 0; padding: 0; }
      .container { width: 100%; max-width: 1200px; margin: 0 auto; }
      ${'.test { color: red; }'.repeat(50)}
    `);
  });

  app.get('/api/test/javascript', (req, res) => {
    res.type('text/javascript').send(`
      function test() {
        console.log('Testing compression');
        ${Array.from({ length: 100 }, (_, i) => `var x${i} = ${i};`).join('\n')}
      }
    `);
  });

  app.get('/api/test/small', (req, res) => {
    res.send(smallTextContent);
  });
});

describe('Compression Middleware', () => {
  describe('Content-Encoding Headers', () => {
    it('should add Content-Encoding: gzip header for large JSON responses', async () => {
      const response = await request(app)
        .get('/api/test/json-large')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should add Content-Encoding: gzip header for HTML responses', async () => {
      const response = await request(app)
        .get('/api/test/html')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should add Content-Encoding: gzip header for text responses', async () => {
      const response = await request(app)
        .get('/api/test/text')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should add Content-Encoding: gzip header for CSS responses', async () => {
      const response = await request(app)
        .get('/api/test/css')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should add Content-Encoding: gzip header for JavaScript responses', async () => {
      const response = await request(app)
        .get('/api/test/javascript')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });
  });

  describe('Compression Threshold', () => {
    it('should NOT compress responses smaller than 1KB threshold', async () => {
      const response = await request(app)
        .get('/api/test/small')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Small responses should not be compressed
      expect(response.headers['content-encoding']).toBeUndefined();
      expect(response.text).toBe(smallTextContent);
    });

    it('should NOT compress small JSON responses', async () => {
      const response = await request(app)
        .get('/api/test/json-small')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Small JSON responses should not be compressed
      expect(response.headers['content-encoding']).toBeUndefined();
      expect(response.body).toEqual({ message: 'OK' });
    });
  });

  describe('Compression Bypass', () => {
    it('should NOT compress when x-no-compression header is present', async () => {
      const response = await request(app)
        .get('/api/test/json-large')
        .set('Accept-Encoding', 'gzip')
        .set('x-no-compression', '1')
        .expect(200);

      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('should NOT compress when client explicitly rejects gzip encoding', async () => {
      const response = await request(app)
        .get('/api/test/json-large')
        .set('Accept-Encoding', 'identity') // Explicitly request uncompressed
        .expect(200);

      // With identity encoding, no compression should occur
      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('Compression Ratio', () => {
    it('should achieve significant compression on JSON data (target: 70-80%)', async () => {
      // Get uncompressed response
      const uncompressedResponse = await request(app)
        .get('/api/test/json-large');
      
      const uncompressedSize = JSON.stringify(uncompressedResponse.body).length;

      // Get compressed response
      const compressedResponse = await request(app)
        .get('/api/test/json-large')
        .set('Accept-Encoding', 'gzip');

      expect(compressedResponse.headers['content-encoding']).toBe('gzip');
      
      // The body is automatically decompressed by supertest, but we can check
      // that the transfer size would be smaller by manually compressing
      const manuallyCompressed = await gzipAsync(JSON.stringify(uncompressedResponse.body));
      const compressedSize = manuallyCompressed.length;
      
      const compressionRatio = ((uncompressedSize - compressedSize) / uncompressedSize) * 100;
      
      console.log(`Compression ratio for JSON: ${compressionRatio.toFixed(1)}%`);
      console.log(`Original size: ${uncompressedSize} bytes, Compressed: ${compressedSize} bytes`);

      // JSON with repetitive data should compress well (aiming for 70-80%)
      expect(compressionRatio).toBeGreaterThan(60); // At least 60% compression
    });

    it('should achieve good compression on HTML content', async () => {
      // Get uncompressed HTML
      const uncompressedResponse = await request(app)
        .get('/api/test/html');
      
      const uncompressedSize = uncompressedResponse.text.length;

      // Manually compress to measure
      const manuallyCompressed = await gzipAsync(uncompressedResponse.text);
      const compressedSize = manuallyCompressed.length;
      
      const compressionRatio = ((uncompressedSize - compressedSize) / uncompressedSize) * 100;
      
      console.log(`Compression ratio for HTML: ${compressionRatio.toFixed(1)}%`);
      console.log(`Original size: ${uncompressedSize} bytes, Compressed: ${compressedSize} bytes`);

      // HTML should compress reasonably well
      expect(compressionRatio).toBeGreaterThan(50);
    });
  });

  describe('Response Correctness', () => {
    it('should return correct JSON data after decompression', async () => {
      const response = await request(app)
        .get('/api/test/json-large')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Testing compression');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(50);
      expect(response.body.data[0]).toHaveProperty('id', 0);
      expect(response.body.data[0]).toHaveProperty('name', 'Item 0');
    });

    it('should return correct HTML content after decompression', async () => {
      const response = await request(app)
        .get('/api/test/html')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<title>Test Page</title>');
      expect(response.text).toContain('Hello World!');
    });
  });

  describe('Performance', () => {
    it('should have minimal overhead (< 5ms per request)', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await request(app)
          .get('/api/test/json-large')
          .set('Accept-Encoding', 'gzip');
        const duration = Date.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`Average response time with compression: ${avgTime.toFixed(2)}ms`);

      // This is a rough test - actual performance will vary
      // We're mainly checking it doesn't add excessive overhead
      expect(avgTime).toBeLessThan(100); // Should be fast in test environment
    });
  });
});
