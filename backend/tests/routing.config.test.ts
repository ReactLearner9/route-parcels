import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { processParcel } from '../src/core/parcel-processor.js';
import { sampleConfig } from './sample-config.js';

const approvalDbPath = resolve(process.cwd(), 'data', 'approval-config-db.json');
const routingDbPath = resolve(process.cwd(), 'data', 'routing-config-db.json');

beforeEach(async () => {
  await rm(approvalDbPath, { force: true });
  await rm(routingDbPath, { force: true });
});

describe('parcel routing core', () => {
  it('routes a parcel and accumulates approvals', () => {
    const result = processParcel(
      { id: 'P1', weight: 2, value: 2000, isFragile: true },
      sampleConfig
    );

    expect(result.route).toBe('REGULAR');
    expect(result.approvals).toEqual(['INSURANCE', 'FRAGILE_HANDLING']);
    expect(result.parcelId).toMatch(/^\d{6}S$/);
    expect(result.status).toBe('approval pending');
    expect(result.toBeRouted).toBe('REGULAR');
    expect(result.routedTo).toBe('n/a');
  });

  it('supports a newly configured department', () => {
    const config = {
      ...sampleConfig,
      rules: [
        {
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

    expect(result.route).toBe('REGULAR');
  });

  it('supports a newly configured approval', () => {
    const config = {
      ...sampleConfig,
      rules: [
        {
          type: 'approval',
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
    const approvalFile = new File([JSON.stringify({ rules: sampleConfig.rules.filter((rule) => rule.type === 'approval') })], 'approval.json', {
      type: 'application/json'
    });
    const routingFile = new File([JSON.stringify({ rules: sampleConfig.rules.filter((rule) => rule.type === 'route') })], 'routing.json', {
      type: 'application/json'
    });

    const validateResponse = await request(app)
      .post('/api/config/approval/validate')
      .attach('configFile', Buffer.from(await approvalFile.arrayBuffer()), 'approval.json');

    expect(validateResponse.status).toBe(200);
    expect(validateResponse.body.valid).toBe(true);

    const routingValidateResponse = await request(app)
      .post('/api/config/routing/validate')
      .attach('configFile', Buffer.from(await routingFile.arrayBuffer()), 'routing.json');

    expect(routingValidateResponse.status).toBe(200);
    expect(routingValidateResponse.body.valid).toBe(true);

    const applyResponse = await request(app)
      .post('/api/config/approval/apply')
      .attach('configFile', Buffer.from(await approvalFile.arrayBuffer()), 'approval.json');

    expect(applyResponse.status).toBe(200);
    expect(applyResponse.body.applied).toBe(true);
    expect(applyResponse.body.checksum).toBeTypeOf('string');

    const approvalDb = JSON.parse(await readFile(approvalDbPath, 'utf8'));
    const routingDb = JSON.parse(await readFile(routingDbPath, 'utf8'));
    expect(approvalDb.currentConfig).toBeDefined();
    expect(routingDb.currentConfig).toBeDefined();
    expect(approvalDb.currentConfig.rules).toHaveLength(2);
    expect(routingDb.currentConfig.rules).toHaveLength(4);
  });
});
