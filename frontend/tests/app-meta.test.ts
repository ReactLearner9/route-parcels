import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE } from '@/lib/app-meta';

describe('app meta', () => {
  it('exposes the project name and tagline', () => {
    expect(APP_NAME).toBe('Route Parcels');
    expect(APP_TAGLINE).toContain('TypeScript');
  });
});
