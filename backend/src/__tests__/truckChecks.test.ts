/**
 * Truck Checks API Route Tests
 * 
 * Tests for all truck check endpoints:
 * - Appliance management (GET, POST, PUT, DELETE /api/truck-checks/appliances)
 * - Checklist templates (GET, PUT /api/truck-checks/templates)
 * - Check runs (GET, POST /api/truck-checks/runs)
 * - Check results (GET, POST, PUT, DELETE /api/truck-checks/results)
 */

// Mock the index module to avoid starting the server
jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import truckChecksRouter from '../routes/truckChecks';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureVehicleTypeDatabase } from '../services/vehicleTypeDbFactory';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
function adminToken(organizationId: string, userId = 'u-' + organizationId): string {
  return jwt.sign({ userId, username: userId, role: 'admin', organizationId }, JWT_SECRET);
}

let app: Express;
let testApplianceId: string;
let testCheckRunId: string;

beforeAll(async () => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  
  // Mock Socket.io for WebSocket events
  app.set('io', {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  });
  
  app.use('/api/truck-checks', truckChecksRouter);
});

describe('Truck Checks API - Appliances', () => {
  describe('GET /api/truck-checks/appliances', () => {
    it('should return an array of appliances', async () => {
      const response = await request(app)
        .get('/api/truck-checks/appliances')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return appliances with correct structure', async () => {
      const response = await request(app)
        .get('/api/truck-checks/appliances')
        .expect(200);

      if (response.body.length > 0) {
        const appliance = response.body[0];
        expect(appliance).toHaveProperty('id');
        expect(appliance).toHaveProperty('name');
        expect(appliance).toHaveProperty('createdAt');
        expect(appliance).toHaveProperty('updatedAt');
      }
    });
  });

  describe('POST /api/truck-checks/appliances', () => {
    it('should create a new appliance', async () => {
      const newAppliance = {
        name: 'Test Fire Truck 1',
        description: 'Test appliance for unit tests'
      };

      const response = await request(app)
        .post('/api/truck-checks/appliances')
        .send(newAppliance)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', newAppliance.name);
      expect(response.body).toHaveProperty('description', newAppliance.description);

      // Store for later tests
      testApplianceId = response.body.id;
    });

    it('should create appliance even with minimal fields', async () => {
      const response = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'Minimal Appliance' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'Minimal Appliance');
    });
  });

  describe('GET /api/truck-checks/appliances/:id', () => {
    it('should return a specific appliance', async () => {
      // First create an appliance
      const createResponse = await request(app)
        .post('/api/truck-checks/appliances')
        .send({
          name: 'Test Appliance 2',
          description: 'Test description'
        });

      const applianceId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/truck-checks/appliances/${applianceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', applianceId);
      expect(response.body).toHaveProperty('name', 'Test Appliance 2');
    });

    it('should return 404 if appliance does not exist', async () => {
      const response = await request(app)
        .get('/api/truck-checks/appliances/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PUT /api/truck-checks/appliances/:id', () => {
    it('should update an appliance', async () => {
      // First create an appliance
      const createResponse = await request(app)
        .post('/api/truck-checks/appliances')
        .send({
          name: 'Original Name',
          description: 'Original description'
        });

      const applianceId = createResponse.body.id;

      const updates = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/truck-checks/appliances/${applianceId}`)
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty('id', applianceId);
      expect(response.body).toHaveProperty('name', 'Updated Name');
    });

    it('should return 404 if appliance does not exist', async () => {
      const response = await request(app)
        .put('/api/truck-checks/appliances/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/truck-checks/appliances/:id', () => {
    it('should delete an appliance', async () => {
      // First create an appliance
      const createResponse = await request(app)
        .post('/api/truck-checks/appliances')
        .send({
          name: 'To Be Deleted',
          description: 'Will be deleted'
        });

      const applianceId = createResponse.body.id;

      await request(app)
        .delete(`/api/truck-checks/appliances/${applianceId}`)
        .expect(204);

      // Verify it's gone
      await request(app)
        .get(`/api/truck-checks/appliances/${applianceId}`)
        .expect(404);
    });

    it('should return 404 if appliance does not exist', async () => {
      const response = await request(app)
        .delete('/api/truck-checks/appliances/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Truck Checks API - Templates', () => {
  let applianceId: string;

  beforeAll(async () => {
    // Create a test appliance for template tests
    const response = await request(app)
      .post('/api/truck-checks/appliances')
      .send({
        name: 'Template Test Appliance',
        description: 'For testing templates'
      });
    applianceId = response.body.id;
  });

  describe('GET /api/truck-checks/templates/:applianceId', () => {
    it('should return a template for an appliance', async () => {
      const response = await request(app)
        .get(`/api/truck-checks/templates/${applianceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('applianceId', applianceId);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should return 404 if template does not exist', async () => {
      const response = await request(app)
        .get('/api/truck-checks/templates/non-existent-appliance')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PUT /api/truck-checks/templates/:applianceId', () => {
    it('should update a template with new items', async () => {
      const updatedItems = [
        { id: '1', name: 'Check item 1', description: 'Test item 1', order: 1 },
        { id: '2', name: 'Check item 2', description: 'Test item 2', order: 2 }
      ];

      const response = await request(app)
        .put(`/api/truck-checks/templates/${applianceId}`)
        .send({ items: updatedItems })
        .expect(200);

      expect(response.body).toHaveProperty('applianceId', applianceId);
      expect(response.body).toHaveProperty('items');
      expect(response.body.items.length).toBe(2);
    });

    it('should return 400 if items array is missing', async () => {
      const response = await request(app)
        .put(`/api/truck-checks/templates/${applianceId}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 if items is not an array', async () => {
      const response = await request(app)
        .put(`/api/truck-checks/templates/${applianceId}`)
        .send({ items: 'not-an-array' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Truck Checks API - Check Runs', () => {
  let applianceId: string;
  let completedBy: string = 'test-member-id';
  let completedByName: string = 'Test Member';

  beforeAll(async () => {
    // Create a test appliance for check run tests
    const response = await request(app)
      .post('/api/truck-checks/appliances')
      .send({
        name: 'Check Run Test Appliance',
        description: 'For testing check runs'
      });
    applianceId = response.body.id;
  });

  describe('POST /api/truck-checks/runs', () => {
    it('should create a new check run', async () => {
      const response = await request(app)
        .post('/api/truck-checks/runs')
        .send({ 
          applianceId, 
          completedBy,
          completedByName 
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('applianceId', applianceId);
      expect(response.body).toHaveProperty('completedBy', completedBy);
      expect(response.body).toHaveProperty('status', 'in-progress');
      expect(response.body).toHaveProperty('joined', false);
      expect(response.body).toHaveProperty('contributors');

      testCheckRunId = response.body.id;
    });

    it('should join existing active check run', async () => {
      // First create a check run
      const createResponse = await request(app)
        .post('/api/truck-checks/runs')
        .send({ 
          applianceId, 
          completedBy: 'user1',
          completedByName: 'User One'
        });

      const runId = createResponse.body.id;

      // Try to create another for same appliance (should join)
      const response = await request(app)
        .post('/api/truck-checks/runs')
        .send({ 
          applianceId, 
          completedBy: 'user2',
          completedByName: 'User Two'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', runId);
      expect(response.body).toHaveProperty('joined', true);
      expect(response.body.contributors).toContain('User Two');
    });

    it('should return 400 if applianceId is missing', async () => {
      const response = await request(app)
        .post('/api/truck-checks/runs')
        .send({ completedBy })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 if completedBy is missing', async () => {
      const response = await request(app)
        .post('/api/truck-checks/runs')
        .send({ applianceId })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('GET /api/truck-checks/runs/:id', () => {
    it('should return a specific check run with results', async () => {
      // Create a check run
      const createResponse = await request(app)
        .post('/api/truck-checks/runs')
        .send({ applianceId, completedBy, completedByName });

      const runId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/truck-checks/runs/${runId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', runId);
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should return 404 if check run does not exist', async () => {
      const response = await request(app)
        .get('/api/truck-checks/runs/non-existent-run')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/truck-checks/runs', () => {
    it('should return all check runs', async () => {
      const response = await request(app)
        .get('/api/truck-checks/runs')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by applianceId', async () => {
      const response = await request(app)
        .get(`/api/truck-checks/runs?applianceId=${applianceId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((run: any) => {
        expect(run).toHaveProperty('applianceId', applianceId);
      });
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/truck-checks/runs?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter runs with issues', async () => {
      const response = await request(app)
        .get('/api/truck-checks/runs?withIssues=true')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('PUT /api/truck-checks/runs/:id/complete', () => {
    it('should complete a check run', async () => {
      // Create a check run
      const createResponse = await request(app)
        .post('/api/truck-checks/runs')
        .send({ applianceId, completedBy, completedByName });

      const runId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/truck-checks/runs/${runId}/complete`)
        .send({ additionalComments: 'All checks passed' })
        .expect(200);

      expect(response.body).toHaveProperty('id', runId);
      expect(response.body).toHaveProperty('status', 'completed');
      expect(response.body).toHaveProperty('endTime');
    });

    it('should return 404 if check run does not exist', async () => {
      const response = await request(app)
        .put('/api/truck-checks/runs/non-existent-run/complete')
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/truck-checks/runs/:id', () => {
    it('should cancel an in-progress run and cascade-delete its results', async () => {
      // Create an appliance + run + a result, then cancel the run.
      const applianceRes = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'Cancel Test Appliance' });
      const cancelApplianceId = applianceRes.body.id;

      const runRes = await request(app)
        .post('/api/truck-checks/runs')
        .send({ applianceId: cancelApplianceId, completedBy: 'tester' });
      const cancelRunId = runRes.body.id;

      await request(app)
        .post('/api/truck-checks/results')
        .send({ runId: cancelRunId, itemId: 'i1', itemName: 'Item 1', status: 'done' })
        .expect(201);

      await request(app)
        .delete(`/api/truck-checks/runs/${cancelRunId}`)
        .expect(204);

      // Run is gone…
      await request(app)
        .get(`/api/truck-checks/runs/${cancelRunId}`)
        .expect(404);

      // …and the appliance has no active run, so it's checkable again.
      const activeRes = await request(app)
        .post('/api/truck-checks/runs')
        .send({ applianceId: cancelApplianceId, completedBy: 'tester2' })
        .expect(201);
      expect(activeRes.body.joined).toBe(false);
    });

    it('should return 404 when cancelling a non-existent run', async () => {
      const response = await request(app)
        .delete('/api/truck-checks/runs/non-existent-run')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Truck Checks API - Check Results', () => {
  let applianceId: string;
  let runId: string;
  let resultId: string;

  beforeAll(async () => {
    // Create appliance and check run for result tests
    const applianceResponse = await request(app)
      .post('/api/truck-checks/appliances')
      .send({
        name: 'Results Test Appliance',
        description: 'For testing results'
      });
    applianceId = applianceResponse.body.id;

    const runResponse = await request(app)
      .post('/api/truck-checks/runs')
      .send({ 
        applianceId, 
        completedBy: 'test-member',
        completedByName: 'Test Member'
      });
    runId = runResponse.body.id;
  });

  describe('POST /api/truck-checks/results', () => {
    it('should create a check result', async () => {
      const result = {
        runId,
        itemId: 'item-1',
        itemName: 'Test Item',
        itemDescription: 'Test item description',
        status: 'done',
        comment: 'All good',
        completedBy: 'test-member'
      };

      const response = await request(app)
        .post('/api/truck-checks/results')
        .send(result)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('runId', runId);
      expect(response.body).toHaveProperty('itemId', 'item-1');
      expect(response.body).toHaveProperty('status', 'done');

      resultId = response.body.id;
    });

    it('should create a result when itemDescription is empty (optional)', async () => {
      // Regression: items legitimately have blank descriptions; the workflow
      // passes them through, so an empty itemDescription must NOT 400.
      const response = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-no-desc',
          itemName: 'No description item',
          itemDescription: '',
          status: 'done',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'done');
    });

    it('should create a result when itemDescription is omitted entirely', async () => {
      const response = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-omit-desc',
          itemName: 'Omitted description item',
          status: 'done',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/truck-checks/results')
        .send({ runId, status: 'done' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 if status is invalid', async () => {
      const response = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-2',
          itemName: 'Test',
          itemDescription: 'Test',
          status: 'invalid-status'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should accept all valid status values', async () => {
      const statuses = ['done', 'issue', 'skipped'];
      
      for (const status of statuses) {
        const response = await request(app)
          .post('/api/truck-checks/results')
          .send({
            runId,
            itemId: `item-${status}`,
            itemName: `Test ${status}`,
            itemDescription: 'Test',
            status
          })
          .expect(201);

        expect(response.body).toHaveProperty('status', status);
      }
    });
  });

  describe('PUT /api/truck-checks/results/:id', () => {
    it('should update a check result', async () => {
      // First create a result
      const createResponse = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-update',
          itemName: 'Test',
          itemDescription: 'Test',
          status: 'done'
        });

      const resultId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/truck-checks/results/${resultId}`)
        .send({
          status: 'issue',
          comment: 'Found a problem'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', resultId);
      expect(response.body).toHaveProperty('status', 'issue');
      expect(response.body).toHaveProperty('comment', 'Found a problem');
    });

    it('should return 400 if status is missing', async () => {
      const response = await request(app)
        .put(`/api/truck-checks/results/${resultId}`)
        .send({ comment: 'Comment without status' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 if status is invalid', async () => {
      const response = await request(app)
        .put(`/api/truck-checks/results/${resultId}`)
        .send({ status: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 if result does not exist', async () => {
      const response = await request(app)
        .put('/api/truck-checks/results/non-existent-result')
        .send({ status: 'done' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/truck-checks/results/:id', () => {
    it('should delete a check result', async () => {
      // First create a result
      const createResponse = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-delete',
          itemName: 'Test',
          itemDescription: 'Test',
          status: 'done'
        });

      const resultId = createResponse.body.id;

      await request(app)
        .delete(`/api/truck-checks/results/${resultId}`)
        .expect(204);
    });

    it('should return 404 if result does not exist', async () => {
      const response = await request(app)
        .delete('/api/truck-checks/results/non-existent-result')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Truck Checks API - Integration Tests', () => {
  it('should support complete check run workflow', async () => {
    // 1. Create appliance
    const applianceResponse = await request(app)
      .post('/api/truck-checks/appliances')
      .send({
        name: 'Integration Test Appliance',
        description: 'For integration testing'
      });
    const applianceId = applianceResponse.body.id;

    // 2. Create check run
    const runResponse = await request(app)
      .post('/api/truck-checks/runs')
      .send({ 
        applianceId, 
        completedBy: 'member1',
        completedByName: 'Member One'
      });
    const runId = runResponse.body.id;

    // 3. Add check results
    await request(app)
      .post('/api/truck-checks/results')
      .send({
        runId,
        itemId: 'item-1',
        itemName: 'Lights',
        itemDescription: 'Check all lights',
        status: 'done'
      })
      .expect(201);

    await request(app)
      .post('/api/truck-checks/results')
      .send({
        runId,
        itemId: 'item-2',
        itemName: 'Tires',
        itemDescription: 'Check tire pressure',
        status: 'issue',
        comment: 'Low pressure on rear left'
      })
      .expect(201);

    // 4. Get run with results
    const getRunResponse = await request(app)
      .get(`/api/truck-checks/runs/${runId}`)
      .expect(200);

    expect(getRunResponse.body.results).toHaveLength(2);

    // 5. Complete the run
    const completeResponse = await request(app)
      .put(`/api/truck-checks/runs/${runId}/complete`)
      .send({ additionalComments: 'Need to fix tire' })
      .expect(200);

    expect(completeResponse.body).toHaveProperty('status', 'completed');
  });
});

describe('Truck Checks API - Cross-brigade schema fields', () => {
  describe('Appliance vehicleType', () => {
    it('should persist vehicleType on create', async () => {
      const response = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'Tanker 1', description: 'Cat 7', vehicleType: 'cat7-tanker' })
        .expect(201);

      expect(response.body).toHaveProperty('vehicleType', 'cat7-tanker');
    });

    it('should update vehicleType', async () => {
      const created = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'Tanker 2', vehicleType: 'cat1-pumper' });

      const response = await request(app)
        .put(`/api/truck-checks/appliances/${created.body.id}`)
        .send({ name: 'Tanker 2', vehicleType: 'bulk-water' })
        .expect(200);

      expect(response.body).toHaveProperty('vehicleType', 'bulk-water');
    });

    it('should reject a vehicleType that is not a lowercase slug', async () => {
      const response = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'Bad Type', vehicleType: 'Cat 7 Tanker!' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should allow omitting vehicleType (backward compatible)', async () => {
      const response = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'No Type Appliance' })
        .expect(201);

      expect(response.body.vehicleType).toBeUndefined();
    });
  });

  describe('ChecklistItem itemCode and section', () => {
    let applianceId: string;

    beforeAll(async () => {
      const created = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'Template Schema Appliance' });
      applianceId = created.body.id;
    });

    it('should persist itemCode and section on template items', async () => {
      const items = [
        { id: '1', name: 'Engine Oil', description: 'Check oil level', order: 1, itemCode: 'fluid-levels', section: 'Engine Bay' },
        { id: '2', name: 'Tyres', description: 'Check tread', order: 2, itemCode: 'tyre-condition', section: 'Exterior' },
      ];

      const response = await request(app)
        .put(`/api/truck-checks/templates/${applianceId}`)
        .send({ items })
        .expect(200);

      expect(response.body.items[0]).toHaveProperty('itemCode', 'fluid-levels');
      expect(response.body.items[0]).toHaveProperty('section', 'Engine Bay');
      expect(response.body.items[1]).toHaveProperty('itemCode', 'tyre-condition');
    });

    it('should reject an itemCode that is not a lowercase slug', async () => {
      const items = [
        { id: '1', name: 'Engine Oil', description: 'Check oil level', order: 1, itemCode: 'Fluid Levels' },
      ];

      const response = await request(app)
        .put(`/api/truck-checks/templates/${applianceId}`)
        .send({ items })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('CheckResult itemCode and section (trend analysis)', () => {
    let runId: string;

    beforeAll(async () => {
      const appliance = await request(app)
        .post('/api/truck-checks/appliances')
        .send({ name: 'Result Schema Appliance', vehicleType: 'cat7-tanker' });
      const run = await request(app)
        .post('/api/truck-checks/runs')
        .send({ applianceId: appliance.body.id, completedBy: 'tester', completedByName: 'Tester' });
      runId = run.body.id;
    });

    it('should denormalise itemCode and section onto the result', async () => {
      const response = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-a',
          itemName: 'Tyres',
          itemDescription: 'Check tread',
          status: 'issue',
          comment: 'Worn',
          itemCode: 'tyre-condition',
          section: 'Exterior',
        })
        .expect(201);

      expect(response.body).toHaveProperty('itemCode', 'tyre-condition');
      expect(response.body).toHaveProperty('section', 'Exterior');

      // And it round-trips when fetching the run with results
      const run = await request(app).get(`/api/truck-checks/runs/${runId}`).expect(200);
      const stored = run.body.results.find((r: { itemId: string }) => r.itemId === 'item-a');
      expect(stored).toHaveProperty('itemCode', 'tyre-condition');
    });

    it('should reject a result itemCode that is not a lowercase slug', async () => {
      const response = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-b',
          itemName: 'Tyres',
          itemDescription: 'Check tread',
          status: 'done',
          itemCode: 'Tyre Condition',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should still accept results without itemCode (backward compatible)', async () => {
      const response = await request(app)
        .post('/api/truck-checks/results')
        .send({
          runId,
          itemId: 'item-c',
          itemName: 'Lights',
          itemDescription: 'Check lights',
          status: 'done',
        })
        .expect(201);

      expect(response.body.itemCode).toBeUndefined();
    });
  });
});

describe('Truck Checks API - Station isolation (TC-2)', () => {
  // Two brigades on the same deployment must not see each other's vehicles or runs.
  const STATION_A = 'station-iso-a';
  const STATION_B = 'station-iso-b';

  it('scopes appliances to the requesting station', async () => {
    const a = await request(app)
      .post('/api/truck-checks/appliances')
      .set('X-Station-Id', STATION_A)
      .send({ name: 'Iso Tanker A' })
      .expect(201);
    const b = await request(app)
      .post('/api/truck-checks/appliances')
      .set('X-Station-Id', STATION_B)
      .send({ name: 'Iso Tanker B' })
      .expect(201);

    const listA = await request(app)
      .get('/api/truck-checks/appliances')
      .set('X-Station-Id', STATION_A)
      .expect(200);
    const idsA = listA.body.map((x: { id: string }) => x.id);
    expect(idsA).toContain(a.body.id);
    expect(idsA).not.toContain(b.body.id); // B's vehicle must not leak into A
  });

  it('scopes check runs (and issues) to the requesting station', async () => {
    const appA = await request(app)
      .post('/api/truck-checks/appliances')
      .set('X-Station-Id', STATION_A)
      .send({ name: 'Iso Run Vehicle A' });

    const run = await request(app)
      .post('/api/truck-checks/runs')
      .set('X-Station-Id', STATION_A)
      .send({ applianceId: appA.body.id, completedBy: 'Alice', completedByName: 'Alice' })
      .expect(201);

    // Station B must not see station A's run.
    const runsB = await request(app)
      .get('/api/truck-checks/runs')
      .set('X-Station-Id', STATION_B)
      .expect(200);
    expect(runsB.body.map((r: { id: string }) => r.id)).not.toContain(run.body.id);

    // Station A does see it.
    const runsA = await request(app)
      .get('/api/truck-checks/runs')
      .set('X-Station-Id', STATION_A)
      .expect(200);
    expect(runsA.body.map((r: { id: string }) => r.id)).toContain(run.body.id);
  });
});

describe('Truck Checks API - Vehicle Types (TC-1)', () => {
  beforeEach(async () => {
    await ensureVehicleTypeDatabase().clear();
  });

  const standardItems = [
    { id: '', name: 'Tyre Condition', description: 'Check tread + pressure', order: 0 },
    { id: '', name: 'Pump Operation', description: 'Test pump', order: 1 },
  ];

  it('requires authentication to create a vehicle type', async () => {
    const res = await request(app)
      .post('/api/truck-checks/vehicle-types')
      .send({ name: 'Cat 1 Tanker', standardItems });
    expect(res.status).toBe(401);
  });

  it('creates a type with normalised, locked standard items', async () => {
    const res = await request(app)
      .post('/api/truck-checks/vehicle-types')
      .set('Authorization', `Bearer ${adminToken('org-1')}`)
      .send({ name: 'Cat 1 Tanker', standardItems, isStandard: true })
      .expect(201);
    expect(res.body.code).toBe('cat-1-tanker');
    expect(res.body.standardItems[0].itemCode).toBe('tyre-condition');
    expect(res.body.standardItems[0].isStandard).toBe(true);
    expect(res.body.isStandard).toBe(true);
  });

  it('lists the org’s own types plus shared standards', async () => {
    await request(app).post('/api/truck-checks/vehicle-types')
      .set('Authorization', `Bearer ${adminToken('org-1')}`)
      .send({ name: 'Org1 Private', standardItems: [] });
    await request(app).post('/api/truck-checks/vehicle-types')
      .set('Authorization', `Bearer ${adminToken('org-2')}`)
      .send({ name: 'Shared Std', standardItems: [], isStandard: true });
    await request(app).post('/api/truck-checks/vehicle-types')
      .set('Authorization', `Bearer ${adminToken('org-2')}`)
      .send({ name: 'Org2 Private', standardItems: [] });

    const res = await request(app)
      .get('/api/truck-checks/vehicle-types')
      .set('Authorization', `Bearer ${adminToken('org-1')}`)
      .expect(200);
    const names = res.body.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(['Org1 Private', 'Shared Std']); // not org-2's private type
  });

  it('blocks editing a vehicle type owned by another org (403)', async () => {
    const created = await request(app).post('/api/truck-checks/vehicle-types')
      .set('Authorization', `Bearer ${adminToken('org-1')}`)
      .send({ name: 'Owned by 1', standardItems: [], isStandard: true });

    const res = await request(app)
      .put(`/api/truck-checks/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken('org-2')}`)
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('validates the create body and 404s unknown ids', async () => {
    const tok = adminToken('org-1');
    expect((await request(app).post('/api/truck-checks/vehicle-types').set('Authorization', `Bearer ${tok}`).send({ standardItems: [] })).status).toBe(400);
    expect((await request(app).post('/api/truck-checks/vehicle-types').set('Authorization', `Bearer ${tok}`).send({ name: 'X', standardItems: 'nope' })).status).toBe(400);
    expect((await request(app).put('/api/truck-checks/vehicle-types/missing').set('Authorization', `Bearer ${tok}`).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete('/api/truck-checks/vehicle-types/missing').set('Authorization', `Bearer ${tok}`)).status).toBe(404);
  });

  it('updates and deletes a type the org owns', async () => {
    const tok = adminToken('org-1');
    const created = await request(app).post('/api/truck-checks/vehicle-types').set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Mine', code: 'Cat 9 Pumper', standardItems: [], category: 'pumper' });
    expect(created.body.code).toBe('cat-9-pumper');

    const updated = await request(app).put(`/api/truck-checks/vehicle-types/${created.body.id}`).set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Mine v2', description: 'updated' }).expect(200);
    expect(updated.body.name).toBe('Mine v2');

    await request(app).delete(`/api/truck-checks/vehicle-types/${created.body.id}`).set('Authorization', `Bearer ${tok}`).expect(204);
  });
});

describe('Truck Checks API - Effective checklist (TC-1)', () => {
  beforeEach(async () => {
    await ensureVehicleTypeDatabase().clear();
  });

  async function setupTypedAppliance() {
    const type = await request(app).post('/api/truck-checks/vehicle-types')
      .set('Authorization', `Bearer ${adminToken('org-1')}`)
      .send({ name: 'Cat 1', standardItems: [
        { id: '', name: 'Tyres', description: 'Check tyres', order: 0 },
        { id: '', name: 'Pump', description: 'Check pump', order: 1 },
      ] })
      .expect(201);

    const appliance = await request(app).post('/api/truck-checks/appliances')
      .send({ name: 'Tanker 7', vehicleTypeId: type.body.id, agencyId: 'RFS-1234', registration: 'AB12CD', make: 'Isuzu', model: 'FTS', year: 2019 })
      .expect(201);

    return { typeId: type.body.id, appliance: appliance.body };
  }

  it('persists vehicle identity fields on the appliance', async () => {
    const { appliance } = await setupTypedAppliance();
    expect(appliance.vehicleTypeId).toBeTruthy();
    expect(appliance.agencyId).toBe('RFS-1234');
    expect(appliance.registration).toBe('AB12CD');
    expect(appliance.make).toBe('Isuzu');
    expect(appliance.year).toBe(2019);
  });

  it('resolves the standard checklist (locked) for a typed appliance', async () => {
    const { appliance } = await setupTypedAppliance();
    const res = await request(app)
      .get(`/api/truck-checks/appliances/${appliance.id}/checklist`)
      .expect(200);
    expect(res.body.vehicleTypeName).toBe('Cat 1');
    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Tyres', 'Pump']);
    expect(res.body.items.every((i: { isStandard: boolean }) => i.isStandard)).toBe(true);
  });

  it('merges brigade custom items with the locked standard, in saved order', async () => {
    const { appliance } = await setupTypedAppliance();

    const save = await request(app)
      .put(`/api/truck-checks/appliances/${appliance.id}/checklist`)
      .send({
        customItems: [{ id: 'custom-hose', name: 'Brigade Hose Reel', description: 'Local fit-out', order: 0 }],
        // Put the custom item between the two standard items (keys: standard itemCode, custom id).
        itemOrder: ['tyres', 'custom-hose', 'pump'],
      })
      .expect(200);

    const names = save.body.items.map((i: { name: string }) => i.name);
    expect(names).toEqual(['Tyres', 'Brigade Hose Reel', 'Pump']);

    // Standard items remain flagged locked; the custom one is not.
    const hose = save.body.items.find((i: { name: string }) => i.name === 'Brigade Hose Reel');
    expect(hose.isStandard).toBe(false);
    const tyres = save.body.items.find((i: { name: string }) => i.name === 'Tyres');
    expect(tyres.isStandard).toBe(true);

    // Re-fetching returns the same merged, ordered checklist (persisted).
    const refetched = await request(app)
      .get(`/api/truck-checks/appliances/${appliance.id}/checklist`)
      .expect(200);
    expect(refetched.body.items.map((i: { name: string }) => i.name)).toEqual(['Tyres', 'Brigade Hose Reel', 'Pump']);
  });

  it('always includes standard items even if the saved order omits them (locked core)', async () => {
    const { appliance } = await setupTypedAppliance();
    await request(app)
      .put(`/api/truck-checks/appliances/${appliance.id}/checklist`)
      .send({ customItems: [], itemOrder: ['pump'] }) // omits 'tyres'
      .expect(200);

    const res = await request(app)
      .get(`/api/truck-checks/appliances/${appliance.id}/checklist`)
      .expect(200);
    const names = res.body.items.map((i: { name: string }) => i.name);
    expect(names).toContain('Tyres'); // standard item cannot be dropped
    expect(names).toContain('Pump');
  });

  it('falls back to the legacy template for an appliance with no vehicle type', async () => {
    const appliance = await request(app).post('/api/truck-checks/appliances').send({ name: 'Legacy Truck' }).expect(201);
    const res = await request(app).get(`/api/truck-checks/appliances/${appliance.body.id}/checklist`).expect(200);
    // No type → items come from the auto-seeded legacy template, none marked standard.
    expect(res.body.vehicleTypeName).toBeUndefined();
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i: { isStandard: boolean }) => i.isStandard === false)).toBe(true);
  });

  it('404s the checklist for an unknown appliance and 400s a bad overlay', async () => {
    expect((await request(app).get('/api/truck-checks/appliances/missing/checklist')).status).toBe(404);
    const appliance = await request(app).post('/api/truck-checks/appliances').send({ name: 'Overlay Truck' });
    expect((await request(app).put(`/api/truck-checks/appliances/${appliance.body.id}/checklist`).send({ customItems: 'nope' })).status).toBe(400);
    expect((await request(app).put('/api/truck-checks/appliances/missing/checklist').send({ customItems: [] })).status).toBe(404);
  });
});

describe('Truck Checks API - Template item id stability (TC-5)', () => {
  it('keeps an item id stable when re-saving with that id (old code regenerated it)', async () => {
    const appliance = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Stable Items Vehicle' })
      .expect(201);

    const first = await request(app)
      .put(`/api/truck-checks/templates/${appliance.body.id}`)
      .send({ items: [
        { id: 'seed-tyres', name: 'Tyres', description: 'Check tread', order: 0 },
        { id: 'seed-lights', name: 'Lights', description: 'Check lights', order: 1 },
      ] })
      .expect(200);
    const tyreId = first.body.items.find((i: { name: string }) => i.name === 'Tyres').id;

    // Re-save using the server-assigned ids (+ one new item). Existing ids must
    // be retained rather than churned to fresh uuids on every edit.
    const second = await request(app)
      .put(`/api/truck-checks/templates/${appliance.body.id}`)
      .send({ items: [
        { id: tyreId, name: 'Tyres', description: 'Check tread and pressure', order: 0 },
        { id: first.body.items[1].id, name: 'Lights', description: 'Check lights', order: 1 },
        { id: 'new-radio', name: 'Radio', description: 'Check radio', order: 2 },
      ] })
      .expect(200);
    const tyreIdAfter = second.body.items.find((i: { name: string }) => i.name === 'Tyres').id;

    expect(tyreIdAfter).toBe(tyreId); // stable across edits
  });
});

describe('Truck Checks API - Issue lifecycle (TC-4)', () => {
  async function recordIssue() {
    const appliance = await request(app).post('/api/truck-checks/appliances').send({ name: 'Issue Truck' }).expect(201);
    const run = await request(app).post('/api/truck-checks/runs')
      .send({ applianceId: appliance.body.id, completedBy: 'Alice', completedByName: 'Alice' }).expect(201);
    const result = await request(app).post('/api/truck-checks/results').send({
      runId: run.body.id, itemId: 'i1', itemName: 'Brakes', itemDescription: 'Check brakes',
      status: 'issue', comment: 'Spongy pedal',
    }).expect(201);
    return { applianceId: appliance.body.id, runId: run.body.id, resultId: result.body.id, result: result.body };
  }

  it('defaults a recorded issue to issueStatus "open"', async () => {
    const { result } = await recordIssue();
    expect(result.status).toBe('issue');
    expect(result.issueStatus).toBe('open');
  });

  it('lists outstanding issues with appliance context and filters by status', async () => {
    const { resultId } = await recordIssue();
    const open = await request(app).get('/api/truck-checks/issues').expect(200);
    const found = open.body.find((i: { id: string }) => i.id === resultId);
    expect(found).toBeTruthy();
    expect(found.applianceName).toBe('Issue Truck');
    expect(found.issueStatus).toBe('open');
  });

  it('moves an issue open → acknowledged → resolved and drops it from the outstanding feed', async () => {
    const { runId, resultId } = await recordIssue();

    const ack = await request(app).patch(`/api/truck-checks/results/${resultId}/issue`)
      .send({ runId, issueStatus: 'acknowledged', assignedTo: 'Equipment Officer' }).expect(200);
    expect(ack.body.issueStatus).toBe('acknowledged');
    expect(ack.body.assignedTo).toBe('Equipment Officer');

    const resolved = await request(app).patch(`/api/truck-checks/results/${resultId}/issue`)
      .send({ runId, issueStatus: 'resolved', issueNote: 'Bled brakes', resolvedBy: 'Mechanic' }).expect(200);
    expect(resolved.body.issueStatus).toBe('resolved');
    expect(resolved.body.resolvedBy).toBe('Mechanic');
    expect(resolved.body.resolvedAt).toBeTruthy();

    // Default feed (outstanding) excludes resolved; status=resolved includes it.
    const outstanding = await request(app).get('/api/truck-checks/issues').expect(200);
    expect(outstanding.body.find((i: { id: string }) => i.id === resultId)).toBeFalsy();
    const resolvedFeed = await request(app).get('/api/truck-checks/issues?status=resolved').expect(200);
    expect(resolvedFeed.body.find((i: { id: string }) => i.id === resultId)).toBeTruthy();
  });

  it('rejects an invalid issueStatus (400) and unknown result (404)', async () => {
    const { runId, resultId } = await recordIssue();
    expect((await request(app).patch(`/api/truck-checks/results/${resultId}/issue`).send({ runId, issueStatus: 'nope' })).status).toBe(400);
    expect((await request(app).patch(`/api/truck-checks/results/missing/issue`).send({ runId, issueStatus: 'resolved' })).status).toBe(404);
  });
});
