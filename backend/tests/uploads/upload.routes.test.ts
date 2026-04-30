import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { sampleConfig } from '../sample-config.js';

const approvalDbPath = resolve(process.cwd(), 'data', 'approval-config-db.json');
const routingDbPath = resolve(process.cwd(), 'data', 'routing-config-db.json');
const parcelDbPath = resolve(process.cwd(), 'data', 'parcel-db.json');

beforeEach(async () => {
  await rm(approvalDbPath, { force: true });
  await rm(routingDbPath, { force: true });
  await rm(parcelDbPath, { force: true });
});

async function applySampleConfig(app: ReturnType<typeof createApp>) {
  const approvalFile = new File(
    [JSON.stringify({ rules: sampleConfig.rules.filter((rule) => rule.type === 'approval') })],
    'approval.json',
    {
      type: 'application/json'
    }
  );
  const routingFile = new File(
    [JSON.stringify({ rules: sampleConfig.rules.filter((rule) => rule.type === 'route') })],
    'routing.json',
    {
      type: 'application/json'
    }
  );

  await request(app)
    .post('/api/config/approval/apply')
    .attach('configFile', Buffer.from(await approvalFile.arrayBuffer()), 'approval.json');

  await request(app)
    .post('/api/config/routing/apply')
    .attach('configFile', Buffer.from(await routingFile.arrayBuffer()), 'routing.json');
}

describe('parcel upload flow', () => {
  it('routes a single parcel from json body', async () => {
    const app = createApp();
    await applySampleConfig(app);

    const response = await request(app)
      .post('/api/upload/single')
      .send({
        id: 'S1',
        weight: 2,
        value: 1500,
        isFragile: true,
        destinationCountry: 'DE'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approval pending');
    expect(response.body.result.parcelId).toMatch(/^\d{4}S$/);
    expect(response.body.batchId).toBeUndefined();
    expect(response.body.result.route).toBe('REGULAR');
    expect(response.body.result.approvals).toEqual(['INSURANCE', 'FRAGILE_HANDLING']);

    expect(response.body.batchId).toBeUndefined();
  });

  it('routes a batch upload from multipart form data', async () => {
    const app = createApp();
    await applySampleConfig(app);

    const batchPayload = {
      parcels: [
        { id: 'B1', weight: 0.5, value: 10 },
        { id: 'B2', weight: 12, value: 50, destinationCountry: 'BR' }
      ]
    };

    const response = await request(app)
      .post('/api/upload/batch')
      .attach('batchFile', Buffer.from(JSON.stringify(batchPayload)), 'batch.json');

    expect(response.status).toBe(200);
    expect(response.body.batchId).toMatch(/^\d{4}B$/);
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0].route).toBe('REGULAR');
    expect(response.body.results[1].route).toBe('HEAVY');

    expect(response.body.batchId).toMatch(/^\d{4}B$/);
    expect(response.body.results).toHaveLength(2);
  });

  it('rejects single parcel upload when no config has been applied', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/upload/single')
      .send({
        id: 'S2',
        weight: 2,
        value: 100
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('processed');
    expect(response.body.result.route).toBe('MANUAL_REVIEW');
  });

  it('rejects invalid single parcel payloads', async () => {
    const app = createApp();
    await applySampleConfig(app);

    const response = await request(app)
      .post('/api/upload/single')
      .send({
        id: '',
        weight: -1,
        value: 10
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('rejects batch uploads without a file', async () => {
    const app = createApp();
    await applySampleConfig(app);

    const response = await request(app).post('/api/upload/batch');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('batchFile is required');
  });

  it('rejects invalid batch json files', async () => {
    const app = createApp();
    await applySampleConfig(app);

    const response = await request(app)
      .post('/api/upload/batch')
      .attach('batchFile', Buffer.from('not-json'), 'batch.json');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });
});
