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
import truckChecksRouter from '../routes/truckChecks';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';

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
