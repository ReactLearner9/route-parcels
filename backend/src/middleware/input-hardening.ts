import type { NextFunction, Request, Response } from 'express';

const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }
  if (isObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (blockedKeys.has(key)) continue;
      output[key] = sanitize(inner);
    }
    return output;
  }
  return value;
}

export function inputHardening(request: Request, _response: Response, next: NextFunction) {
  request.body = sanitize(request.body);
  next();
}
