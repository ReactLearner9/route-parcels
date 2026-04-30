import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const parcelDbPath = resolve(process.cwd(), 'data', 'parcel-db.json');

beforeEach(async () => {
  await rm(parcelDbPath, { force: true });
});

describe('parcels routes', () => {
  it('returns filtered records and counts', async () => {
    const app = createApp();
    const actor = `actor-${Date.now()}`;

    const singleResponse = await request(app)
      .post('/api/upload/single')
      .send({ id: 'P-SINGLE-1', weight: 2, value: 150, importedBy: actor });
    const singleParcelId = singleResponse.body.result.parcelId as string;

    const batchResponse = await request(app)
      .post('/api/upload/batch')
      .field('importedBy', actor)
      .attach(
        'batchFile',
        Buffer.from(
          JSON.stringify({
            parcels: [
              { id: 'P-BATCH-1', weight: 1, value: 10 },
              { id: 'P-BATCH-2', weight: 12, value: 20 }
            ]
          })
        ),
        'batch.json'
      );
    const batchId = batchResponse.body.batchId as string;

    const byParcel = await request(app).get(`/api/parcels?parcelId=${encodeURIComponent(singleParcelId)}`);
    expect(byParcel.status).toBe(200);
    expect(byParcel.body.records).toHaveLength(1);
    expect(byParcel.body.records[0].batchId).toBeNull();

    const byBatch = await request(app).get(`/api/parcels?batchId=${encodeURIComponent(batchId)}`);
    expect(byBatch.status).toBe(200);
    expect(byBatch.body.records).toHaveLength(2);
    expect(byBatch.body.records.every((record: { batchId: string | null }) => record.batchId === batchId)).toBe(true);

    expect(byParcel.body.records[0].importedBy).toBe(actor);

    const counts = await request(app).get('/api/parcels/count');
    expect(counts.status).toBe(200);
    expect(typeof counts.body.parcelCount).toBe('number');
    expect(typeof counts.body.batchCount).toBe('number');
  });
});
