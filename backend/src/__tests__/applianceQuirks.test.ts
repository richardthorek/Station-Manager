/**
 * A1 inc 4 — Appliance agent-context fields (variant, inServiceDate, quirksNotes).
 *
 * Free-text brigade knowledge + build details the maintenance agent uses for
 * age/nuance. Additive; must round-trip through create and update.
 */

jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import truckChecksRouter from '../routes/truckChecks';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.set('io', { emit: jest.fn(), to: jest.fn().mockReturnThis() });
  app.use('/api/truck-checks', truckChecksRouter);
});

describe('Appliance agent-context fields', () => {
  it('persists variant/inServiceDate/quirksNotes on create and returns them on read', async () => {
    const created = await request(app)
      .post('/api/truck-checks/appliances')
      .send({
        name: 'Quirks Truck',
        variant: 'Isuzu FTS (BTM body)',
        inServiceDate: '2012-03-01',
        quirksNotes: 'Hatch sticks in cold; secondary pump primes slowly.',
      })
      .expect(201);

    expect(created.body.variant).toBe('Isuzu FTS (BTM body)');
    expect(created.body.inServiceDate).toBe('2012-03-01');
    expect(created.body.quirksNotes).toMatch(/primes slowly/);

    const read = await request(app)
      .get(`/api/truck-checks/appliances/${created.body.id}`).expect(200);
    expect(read.body.variant).toBe('Isuzu FTS (BTM body)');
    expect(read.body.quirksNotes).toMatch(/Hatch sticks/);
  });

  it('updates the agent-context fields', async () => {
    const created = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Quirks Truck 2' }).expect(201);
    expect(created.body.quirksNotes).toBeUndefined();

    const updated = await request(app)
      .put(`/api/truck-checks/appliances/${created.body.id}`)
      .send({ name: 'Quirks Truck 2', quirksNotes: 'Tank gauge reads 10% high.', variant: 'Hino' })
      .expect(200);

    expect(updated.body.quirksNotes).toBe('Tank gauge reads 10% high.');
    expect(updated.body.variant).toBe('Hino');
  });

  it('ignores non-string agent-context values', async () => {
    const created = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Quirks Truck 3', quirksNotes: 12345, variant: { x: 1 } }).expect(201);
    expect(created.body.quirksNotes).toBeUndefined();
    expect(created.body.variant).toBeUndefined();
  });
});
