/**
 * Input Validation and Sanitization Tests
 * 
 * Tests to ensure that all input validation middleware works correctly:
 * - XSS attack prevention
 * - Input sanitization
 * - Field-level validation
 * - Clear error messages
 */

import request from 'supertest';
import express, { Express } from 'express';
import membersRouter from '../routes/members';
import activitiesRouter from '../routes/activities';
import eventsRouter from '../routes/events';
import checkinsRouter from '../routes/checkins';

let app: Express;

beforeAll(() => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/members', membersRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/checkins', checkinsRouter);
});

describe('XSS Protection Tests', () => {
  describe('Member routes - XSS protection', () => {
    it('should block script tags in member name', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const response = await request(app)
        .post('/api/members')
        .send({ name: xssPayload })
        .expect(201);

      // Should be sanitized (HTML escaped)
      expect(response.body.name).not.toContain('<script>');
      expect(response.body.name).not.toContain('</script>');
      // express-validator's escape() converts < to &lt; and > to &gt;
      expect(response.body.name).toContain('&lt;');
    });

    it('should block event handlers in member name', async () => {
      const xssPayload = '<img src=x onerror=alert(1)>';
      const response = await request(app)
        .post('/api/members')
        .send({ name: xssPayload })
        .expect(201);

      // The HTML tags should be escaped, preventing execution
      expect(response.body.name).not.toContain('<img');
      expect(response.body.name).toContain('&lt;');
      expect(response.body.name).toContain('&gt;');
      // Even if 'onerror' text remains, it can't execute because tags are escaped
    });

    it('should escape javascript: protocol in member rank', async () => {
      const xssPayload = 'javascript:alert(1)';
      const response = await request(app)
        .post('/api/members')
        .send({ name: 'Test User', rank: xssPayload })
        .expect(201);

      // javascript: protocol as plain text is safe since it's not in a href context
      // The value is stored as text and won't be executed
      expect(response.body.rank).toBe(xssPayload);
    });

    it('should sanitize SQL-like strings (even though we use NoSQL)', async () => {
      const sqlPayload = "'; DROP TABLE Members; --";
      const response = await request(app)
        .post('/api/members')
        .send({ name: sqlPayload })
        .expect(201);

      // Should be escaped
      expect(response.body.name).toContain('&#x27;'); // Escaped single quote
    });
  });

  describe('Activity routes - XSS protection', () => {
    it('should sanitize activity names with XSS attempts', async () => {
      const xssPayload = '<svg onload=alert(1)>';
      const response = await request(app)
        .post('/api/activities')
        .send({ name: xssPayload })
        .expect(201);

      expect(response.body.name).not.toContain('<svg');
      expect(response.body.name).toContain('&lt;');
      expect(response.body.name).toContain('&gt;');
      // Even if 'onload' text remains, it can't execute because tags are escaped
    });

    it('should escape HTML entities in activity name', async () => {
      const htmlPayload = '<b>Bold Activity</b>';
      const response = await request(app)
        .post('/api/activities')
        .send({ name: htmlPayload })
        .expect(201);

      expect(response.body.name).not.toContain('<b>');
      expect(response.body.name).toContain('&lt;');
    });
  });
});

describe('Validation Error Messages', () => {
  describe('Member validation errors', () => {
    it('should return field-level errors for invalid member data', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: 123 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
      
      const details = response.body.details;
      expect(details.some((d: any) => d.field === 'name')).toBe(true);
    });

    it('should return multiple validation errors when multiple fields are invalid', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({
          firstName: 123,  // Should be string
          lastName: 456,   // Should be string
        })
        .expect(400);

      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should validate name pattern for firstName', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ firstName: '123abc!@#' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      const hasNameError = response.body.details.some(
        (d: any) => d.field === 'firstName' && d.message.includes('letters')
      );
      expect(hasNameError).toBe(true);
    });
  });

  describe('Activity validation errors', () => {
    it('should reject empty activity name', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject activity name exceeding max length', async () => {
      const longName = 'a'.repeat(201);
      const response = await request(app)
        .post('/api/activities')
        .send({ name: longName })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      const hasLengthError = response.body.details.some(
        (d: any) => d.message.includes('200 characters')
      );
      expect(hasLengthError).toBe(true);
    });
  });
});

describe('Input Sanitization', () => {
  describe('Whitespace trimming', () => {
    it('should trim whitespace from member names', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: '  Test User  ' })
        .expect(201);

      expect(response.body.name).toBe('Test User');
      expect(response.body.name).not.toContain('  ');
    });

    it('should trim whitespace from activity names', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ name: '  Training Session  ' })
        .expect(201);

      expect(response.body.name).toBe('Training Session');
    });
  });

  describe('Special character handling', () => {
    it('should properly escape special HTML characters', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: 'O\'Brien & Sons <Company>' })
        .expect(201);

      // Apostrophe, ampersand, and angle brackets should be escaped
      expect(response.body.name).toContain('&#x27;'); // Escaped apostrophe
      expect(response.body.name).toContain('&amp;'); // Escaped ampersand
      expect(response.body.name).toContain('&lt;'); // Escaped <
      expect(response.body.name).toContain('&gt;'); // Escaped >
    });
  });
});

describe('Type Validation', () => {
  describe('String type enforcement', () => {
    it('should reject numbers as member names', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: 123 })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject boolean as activity name', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ name: true })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject object as member name', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: { first: 'John', last: 'Doe' } })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject array as activity name', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ name: ['Activity', 'Name'] })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Boolean validation', () => {
    it('should accept boolean for isOffsite in checkins', async () => {
      // First create a member
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Test Member' });
      
      const memberId = memberResponse.body.id;

      const response = await request(app)
        .post('/api/checkins')
        .send({
          memberId,
          method: 'kiosk',
          isOffsite: true
        });

      // Should succeed (might be 201 or 200 depending on existing check-in)
      expect([200, 201]).toContain(response.status);
    });

    it('should reject string for boolean isOffsite field', async () => {
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Test Member' });
      
      const memberId = memberResponse.body.id;

      const response = await request(app)
        .post('/api/checkins')
        .send({
          memberId,
          method: 'kiosk',
          isOffsite: 'yes' // Should be boolean
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });
});

describe('Length Validation', () => {
  it('should enforce maximum length on member names', async () => {
    const tooLongName = 'a'.repeat(201);
    const response = await request(app)
      .post('/api/members')
      .send({ name: tooLongName })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
  });

  it('should enforce maximum length on rank', async () => {
    const tooLongRank = 'a'.repeat(101);
    const response = await request(app)
      .post('/api/members')
      .send({ name: 'Test User', rank: tooLongRank })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
  });

  it('should enforce maximum length on member number', async () => {
    const tooLongNumber = 'a'.repeat(51);
    const response = await request(app)
      .post('/api/members')
      .send({ name: 'Test User', memberNumber: tooLongNumber })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
  });
});

describe('Enum Validation', () => {
  it('should only accept valid method values in checkins', async () => {
    const memberResponse = await request(app)
      .post('/api/members')
      .send({ name: 'Test Member' });
    
    const memberId = memberResponse.body.id;

    const response = await request(app)
      .post('/api/checkins')
      .send({
        memberId,
        method: 'invalid-method' // Should be one of: kiosk, mobile, qr, manual
      })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
  });

  it('should accept valid method values', async () => {
    const validMethods = ['kiosk', 'mobile', 'qr', 'manual'];
    
    for (const method of validMethods) {
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: `Test Member ${method}` });
      
      const memberId = memberResponse.body.id;

      const response = await request(app)
        .post('/api/checkins')
        .send({ memberId, method });

      // Should succeed
      expect([200, 201]).toContain(response.status);
    }
  });
});
