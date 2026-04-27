import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { sampleConfig } from '../sample-config.js';

const dbPath = resolve(process.cwd(), 'data', 'config-db.json');
const parcelDbPath = resolve(process.cwd(), 'data', 'parcel-db.json');

beforeEach(async () => {
  await rm(dbPath, { force: true });
  await rm(parcelDbPath, { force: true });
});

async function applySampleConfig(app: ReturnType<typeof createApp>) {
  const configFile = new File([JSON.stringify(sampleConfig)], 'config.json', {
    type: 'application/json'
  });

  await request(app)
    .post('/api/config/apply')
    .attach('configFile', Buffer.from(await configFile.arrayBuffer()), 'config.json');
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

    expect(response.status).toBe(201);
    expect(response.body.fileId).toContain('single-');
    expect(response.body.result.route).toBe('REGULAR');
    expect(response.body.result.approvals).toEqual(['INSURANCE', 'FRAGILE_HANDLING']);

    const db = JSON.parse(await readFile(parcelDbPath, 'utf8'));
    expect(db.singles).toHaveLength(1);
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

    expect(response.status).toBe(201);
    expect(response.body.fileId).toContain('batch-');
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0].route).toBe('MAIL');
    expect(response.body.results[1].route).toBe('HEAVY');

    const db = JSON.parse(await readFile(parcelDbPath, 'utf8'));
    expect(db.batches).toHaveLength(1);
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

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('No routing config has been applied');
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
