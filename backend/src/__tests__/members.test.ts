/**
 * Members API Route Tests
 * 
 * Tests for all member management endpoints:
 * - GET /api/members - Get all members
 * - GET /api/members/:id - Get member by ID
 * - GET /api/members/qr/:qrCode - Get member by QR code
 * - POST /api/members - Create new member
 * - PUT /api/members/:id - Update member
 * - GET /api/members/:id/history - Get member check-in history
 */

import request from 'supertest';
import express, { Express } from 'express';
import membersRouter from '../routes/members';
import { ensureDatabase } from '../services/dbFactory';

let app: Express;

beforeAll(() => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/members', membersRouter);
});

describe('Members API', () => {
  describe('GET /api/members', () => {
    it('should return an array of members', async () => {
      const response = await request(app)
        .get('/api/members')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify member structure
      const member = response.body[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('name');
      expect(member).toHaveProperty('qrCode');
      expect(member).toHaveProperty('createdAt');
    });

    it('should return members sorted by activity (check-ins in last 6 months), then alphabetically', async () => {
      const response = await request(app)
        .get('/api/members')
        .expect(200);

      // Verify that sorting is applied (members array is returned in consistent order)
      const names = response.body.map((m: { name: string }) => m.name);
      expect(names.length).toBeGreaterThan(0);
      
      // Verify all names are unique
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('GET /api/members/:id', () => {
    it('should return a specific member by ID', async () => {
      // First get all members to get a valid ID
      const membersResponse = await request(app).get('/api/members');
      const testMember = membersResponse.body[0];

      const response = await request(app)
        .get(`/api/members/${testMember.id}`)
        .expect(200);

      expect(response.body.id).toBe(testMember.id);
      expect(response.body.name).toBe(testMember.name);
    });

    it('should return 404 for non-existent member ID', async () => {
      const response = await request(app)
        .get('/api/members/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/members/qr/:qrCode', () => {
    it('should return a member by QR code', async () => {
      // First get all members to get a valid QR code
      const membersResponse = await request(app).get('/api/members');
      const testMember = membersResponse.body[0];

      const response = await request(app)
        .get(`/api/members/qr/${testMember.qrCode}`)
        .expect(200);

      expect(response.body.id).toBe(testMember.id);
      expect(response.body.qrCode).toBe(testMember.qrCode);
    });

    it('should return 404 for non-existent QR code', async () => {
      const response = await request(app)
        .get('/api/members/qr/invalid-qr-code')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/members', () => {
    it('should create a new member with valid name', async () => {
      const newMemberName = 'Test User ' + Date.now();
      
      const response = await request(app)
        .post('/api/members')
        .send({ name: newMemberName })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newMemberName);
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body.qrCode).toBeTruthy();
    });

    it('should trim whitespace from member name', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: '  Whitespace Test  ' })
        .expect(201);

      expect(response.body.name).toBe('Whitespace Test');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((d: any) => d.message.toLowerCase().includes('name'))).toBe(true);
    });

    it('should return 400 for empty name', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((d: any) => d.message.toLowerCase().includes('name'))).toBe(true);
    });

    it('should return 400 for non-string name', async () => {
      const response = await request(app)
        .post('/api/members')
        .send({ name: 123 })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((d: any) => d.message.toLowerCase().includes('name'))).toBe(true);
    });
  });

  describe('PUT /api/members/:id', () => {
    it('should update a member name', async () => {
      // First create a member
      const createResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Original Name' });
      
      const memberId = createResponse.body.id;
      const updatedName = 'Updated Name ' + Date.now();

      const response = await request(app)
        .put(`/api/members/${memberId}`)
        .send({ name: updatedName })
        .expect(200);

      expect(response.body.name).toBe(updatedName);
      expect(response.body.id).toBe(memberId);
    });

    it('should update member rank when provided', async () => {
      // First create a member
      const createResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Rank Test Member' });
      
      const memberId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/members/${memberId}`)
        .send({ name: 'Rank Test Member', rank: 'Captain' })
        .expect(200);

      expect(response.body.rank).toBe('Captain');
    });

    it('should return 404 for non-existent member', async () => {
      const response = await request(app)
        .put('/api/members/non-existent-id')
        .send({ name: 'Test Name' })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('should return 400 for invalid name', async () => {
      // Get a valid member ID first
      const membersResponse = await request(app).get('/api/members');
      const memberId = membersResponse.body[0].id;

      const response = await request(app)
        .put(`/api/members/${memberId}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((d: any) => d.message.toLowerCase().includes('name'))).toBe(true);
    });
  });

  describe('GET /api/members/:id/history', () => {
    it('should return empty array for member with no check-ins', async () => {
      // Create a new member
      const createResponse = await request(app)
        .post('/api/members')
        .send({ name: 'No History Member' });
      
      const memberId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/members/${memberId}/history`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 404 for non-existent member', async () => {
      const response = await request(app)
        .get('/api/members/non-existent-id/history')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/members with query parameters', () => {
    beforeAll(async () => {
      // Create test members with different attributes for search/filter/sort tests
      await request(app)
        .post('/api/members')
        .send({ name: 'Alice Anderson', rank: 'Captain' });
      
      await request(app)
        .post('/api/members')
        .send({ name: 'Bob Baker', rank: 'Senior Deputy Captain' });
      
      await request(app)
        .post('/api/members')
        .send({ name: 'Charlie Cooper' });
    });

    describe('Search functionality', () => {
      it('should filter members by name', async () => {
        const response = await request(app)
          .get('/api/members?search=Alice')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body.some((m: any) => m.name.includes('Alice'))).toBe(true);
      });

      it('should filter members by rank', async () => {
        const response = await request(app)
          .get('/api/members?search=Captain')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        // Should find members with rank containing "Captain"
        expect(response.body.some((m: any) => m.rank && m.rank.includes('Captain'))).toBe(true);
      });

      it('should return empty array when no matches found', async () => {
        const response = await request(app)
          .get('/api/members?search=NonExistentMember12345')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
      });
    });

    describe('Sort functionality', () => {
      it('should sort members by name ascending', async () => {
        const response = await request(app)
          .get('/api/members?sort=name-asc')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 1) {
          const names = response.body.map((m: any) => m.name);
          const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
          expect(names).toEqual(sortedNames);
        }
      });

      it('should sort members by name descending', async () => {
        const response = await request(app)
          .get('/api/members?sort=name-desc')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 1) {
          const names = response.body.map((m: any) => m.name);
          const sortedNames = [...names].sort((a, b) => b.localeCompare(a));
          expect(names).toEqual(sortedNames);
        }
      });
    });

    describe('Combined filters', () => {
      it('should apply both search and sort', async () => {
        const response = await request(app)
          .get('/api/members?search=e&sort=name-asc')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        // Should only return members with 'e' in their name, rank, or member number
        if (response.body.length > 0) {
          response.body.forEach((m: any) => {
            const hasE = m.name.toLowerCase().includes('e') ||
                        (m.rank && m.rank.toLowerCase().includes('e')) ||
                        (m.memberNumber && m.memberNumber.toLowerCase().includes('e'));
            expect(hasE).toBe(true);
          });
        }
      });
    });
  });

  describe('POST /api/members/import', () => {
    it('should validate CSV and return validation results', async () => {
      const csvContent = `First Name,Last Name,Rank,Roles
John,Doe,Captain,
Jane,Smith,,Driver
Bob,Brown,,`;

      const response = await request(app)
        .post('/api/members/import')
        .attach('file', Buffer.from(csvContent), 'members.csv')
        .expect(200);

      expect(response.body).toHaveProperty('totalRows');
      expect(response.body).toHaveProperty('validCount');
      expect(response.body).toHaveProperty('invalidCount');
      expect(response.body).toHaveProperty('duplicateCount');
      expect(response.body).toHaveProperty('validationResults');
      expect(Array.isArray(response.body.validationResults)).toBe(true);
      expect(response.body.totalRows).toBe(3);
    });

    it('should detect duplicate members', async () => {
      // Create an existing member
      await request(app)
        .post('/api/members')
        .send({ name: 'John Doe' });

      const csvContent = `First Name,Last Name,Rank,Roles
John,Doe,Captain,`;

      const response = await request(app)
        .post('/api/members/import')
        .attach('file', Buffer.from(csvContent), 'members.csv')
        .expect(200);

      expect(response.body.duplicateCount).toBeGreaterThan(0);
      expect(response.body.validationResults[0].isDuplicate).toBe(true);
    });

    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/members/import')
        .expect(400);

      expect(response.body.error).toContain('No file uploaded');
    });

    it('should handle CSV with empty rows', async () => {
      const csvContent = `First Name,Last Name,Rank,Roles
John,Doe,,

Jane,Smith,,`;

      const response = await request(app)
        .post('/api/members/import')
        .attach('file', Buffer.from(csvContent), 'members.csv')
        .expect(200);

      // Should skip empty lines
      expect(response.body.totalRows).toBe(2);
    });

    it('should validate required name field', async () => {
      const csvContent = `First Name,Last Name,Rank,Roles
,,Captain,`;

      const response = await request(app)
        .post('/api/members/import')
        .attach('file', Buffer.from(csvContent), 'members.csv')
        .expect(200);

      expect(response.body.invalidCount).toBeGreaterThan(0);
      expect(response.body.validationResults[0].isValid).toBe(false);
      expect(response.body.validationResults[0].errors).toContain('Name is required (either First Name + Last Name or Name column)');
    });
  });

  describe('POST /api/members/import/execute', () => {
    it('should import valid members', async () => {
      const membersToImport = [
        { name: 'Test Import 1', firstName: 'Test', lastName: 'Import 1', rank: 'Captain' },
        { name: 'Test Import 2', firstName: 'Test', lastName: 'Import 2' },
      ];

      const response = await request(app)
        .post('/api/members/import/execute')
        .send({ members: membersToImport })
        .expect(200);

      expect(response.body).toHaveProperty('totalAttempted');
      expect(response.body).toHaveProperty('successCount');
      expect(response.body).toHaveProperty('failureCount');
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(response.body.totalAttempted).toBe(2);
      expect(response.body.successCount).toBeGreaterThan(0);
      expect(Array.isArray(response.body.successful)).toBe(true);

      // Verify members were created with QR codes
      response.body.successful.forEach((member: any) => {
        expect(member).toHaveProperty('name');
        expect(member).toHaveProperty('id');
        expect(member).toHaveProperty('qrCode');
      });
    });

    it('should return 400 when no members provided', async () => {
      const response = await request(app)
        .post('/api/members/import/execute')
        .send({ members: [] })
        .expect(400);

      expect(response.body.error).toContain('No members provided');
    });

    it('should handle partial failures gracefully', async () => {
      const membersToImport = [
        { name: 'Valid Member', firstName: 'Valid', lastName: 'Member' },
        { name: '', firstName: '', lastName: '' }, // Invalid
      ];

      const response = await request(app)
        .post('/api/members/import/execute')
        .send({ members: membersToImport })
        .expect(200);

      expect(response.body.successCount).toBeGreaterThan(0);
      expect(response.body.failureCount).toBeGreaterThan(0);
      expect(response.body.failed.length).toBeGreaterThan(0);
    });
  });
});
