import { createHash } from 'node:crypto';
import type { RoutingConfig } from '../core/config-types.js';
import { validateConfig } from '../core/rule-validator.js';
import { getConfigDb, type StoredConfigVersion, getCurrentConfig, makeConfigChangeId } from '../config/store.js';
import { getParcelDb, makeAuditId } from '../config/parcel-store.js';

type MulterFile = Express.Multer.File;

export function parseConfigFile(file: MulterFile): RoutingConfig {
  const text = file.buffer.toString('utf8');

  try {
    return validateConfig(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Config file must contain valid JSON');
    }

    throw error;
  }
}

export function checksumConfig(config: RoutingConfig) {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

export async function validateUploadedConfig(file: MulterFile) {
  const config = parseConfigFile(file);
  const checksum = checksumConfig(config);
  const parcelDb = await getParcelDb();

  parcelDb.data.audits.push({
    id: makeAuditId(),
    fileId: file.originalname,
    source: 'config',
    createdAt: new Date().toISOString(),
    step: 'validated',
    message: `Config file ${file.originalname} validated`,
    details: { checksum, ruleCount: config.rules.length }
  });
  await parcelDb.write();

  return {
    checksum,
    filename: file.originalname,
    rules: config.rules.length
  };
}

export async function applyUploadedConfig(file: MulterFile) {
  const config = parseConfigFile(file);
  const db = await getConfigDb();
  const parcelDb = await getParcelDb();
  const checksum = checksumConfig(config);
  const changeId = makeConfigChangeId();

  const version = db.data.currentVersion + 1;
  const record: StoredConfigVersion = {
    changeId,
    version,
    createdAt: new Date().toISOString(),
    checksum,
    config
  };

  db.data.currentVersion = version;
  db.data.versions.push(record);
  await db.write();

  parcelDb.data.audits.push({
    id: makeAuditId(),
    fileId: file.originalname,
    source: 'config',
    createdAt: new Date().toISOString(),
    step: 'config_applied',
    message: `Config file ${file.originalname} applied as version ${version}`,
    details: { version, checksum, changeId }
  });
  await parcelDb.write();

  return record;
}

export async function getConfigState() {
  const db = await getConfigDb();

  return {
    currentVersion: db.data.currentVersion,
    versions: db.data.versions
  };
}

export async function getAppliedConfig() {
  const current = await getCurrentConfig();
  return current?.config ?? null;
}
