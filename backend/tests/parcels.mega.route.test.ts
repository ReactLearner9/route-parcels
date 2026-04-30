import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const parcelDbPath = resolve(process.cwd(), 'data', 'parcel-db.json');
const megaImportApiKey = 'mega-import-demo-key';

beforeEach(async () => {
  await rm(parcelDbPath, { force: true });
});

describe('mega parcels route', () => {
  it('rejects requests without the mega import API key', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/parcels/mega')
      .attach(
        'batchFile',
        Buffer.from(JSON.stringify({ parcels: [{ weight: 1, value: 10 }] })),
        'batch.json'
      );

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
  });

  it('returns a validation report csv when validation fails', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/parcels/mega')
      .set('x-api-key', megaImportApiKey)
      .set('x-session-id', 'postman-large-batch')
      .field('importedBy', 'postman')
      .attach(
        'batchFile',
        Buffer.from(JSON.stringify({ parcels: [{ weight: -1, value: 10 }] })),
        'invalid-batch.json'
      );

    expect(response.status).toBe(422);
    expect(response.headers['x-mega-status']).toBe('validation_failed');
    expect(response.headers['x-record-count']).toBe('1');
    expect(response.headers['x-validation-issue-count']).toBeTruthy();
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('rowNo,field,reason');
  });

  it('returns a results csv without persisting records to lowdb', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/parcels/mega')
      .set('x-api-key', megaImportApiKey)
      .set('x-session-id', 'postman-large-batch')
      .field('importedBy', 'postman')
      .attach(
        'batchFile',
        Buffer.from(
          JSON.stringify({
            parcels: [
              { weight: 0.5, value: 10 },
              { weight: 12, value: 50 }
            ]
          })
        ),
        'mega-batch.json'
      );

    expect(response.status).toBe(200);
    expect(response.headers['x-mega-status']).toBe('processed');
    expect(response.headers['x-batch-id']).toMatch(/^\d{4}B$/);
    expect(response.headers['x-record-count']).toBe('2');
    expect(response.headers['x-validation-issue-count']).toBe('0');
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('batchId,parcelId,status,route,toBeRouted,routedTo,approvals');

    const counts = await request(app).get('/api/parcels/count');
    expect(counts.status).toBe(200);
    expect(counts.body.parcelCount).toBe(0);
    expect(counts.body.batchCount).toBe(0);
  });
});
