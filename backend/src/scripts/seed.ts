import { resetAndSeedBackend } from '../services/seed-service.js';

const result = await resetAndSeedBackend();
console.log(JSON.stringify(result, null, 2));
