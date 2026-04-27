import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { processParcel } from '../src/core/parcel-processor.js';
import { sampleConfig } from './sample-config.js';

const dbPath = resolve(process.cwd(), 'data', 'config-db.json');

beforeEach(async () => {
  await rm(dbPath, { force: true });
});

describe('parcel routing core', () => {
  it('routes a parcel and accumulates approvals', () => {
    const result = processParcel(
      { id: 'P1', weight: 2, value: 2000, isFragile: true },
      sampleConfig
    );

    expect(result).toEqual({
      parcelId: 'P1',
      route: 'REGULAR',
      approvals: ['INSURANCE', 'FRAGILE_HANDLING']
    });
  });

  it('supports a newly configured department', () => {
    const config = {
      ...sampleConfig,
      rules: [
        {
          name: 'express-rule',
          type: 'route',
          priority: 20,
          when: { field: 'destinationCountry', operator: '==', value: 'DE' },
          action: { department: 'EXPRESS_EU' }
        },
        ...sampleConfig.rules
      ]
    };

    const result = processParcel(
      { id: 'P2', weight: 2, value: 50, destinationCountry: 'DE' },
      config
    );

    expect(result.route).toBe('EXPRESS_EU');
  });

  it('supports a newly configured approval', () => {
    const config = {
      ...sampleConfig,
      rules: [
        {
          name: 'customs-review',
          type: 'approval',
          priority: 60,
          when: { field: 'destinationCountry', operator: '==', value: 'BR' },
          action: { approval: 'CUSTOMS_REVIEW' }
        },
        ...sampleConfig.rules
      ]
    };

    const result = processParcel(
      { id: 'P3', weight: 2, value: 50, destinationCountry: 'BR' },
      config
    );

    expect(result.approvals).toContain('CUSTOMS_REVIEW');
  });
});

describe('config upload flow', () => {
  it('validates and applies a config file', async () => {
    const app = createApp();
    const configFile = new File([JSON.stringify(sampleConfig)], 'config.json', {
      type: 'application/json'
    });

    const validateResponse = await request(app)
      .post('/api/config/validate')
      .attach('configFile', Buffer.from(await configFile.arrayBuffer()), 'config.json');

    expect(validateResponse.status).toBe(200);
    expect(validateResponse.body.valid).toBe(true);

    const applyResponse = await request(app)
      .post('/api/config/apply')
      .attach('configFile', Buffer.from(await configFile.arrayBuffer()), 'config.json');

    expect(applyResponse.status).toBe(200);
    expect(applyResponse.body.applied).toBe(true);

    const db = JSON.parse(await readFile(dbPath, 'utf8'));
    expect(applyResponse.body.version).toBe(db.currentVersion);
    expect(db.currentVersion).toBeGreaterThan(0);
    expect(db.versions).toHaveLength(db.currentVersion);
  });
});
