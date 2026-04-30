import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

const allowedOrigins = new Set(
  env.CORS_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

export function corsGuard(request: Request, response: Response, next: NextFunction) {
  const origin = request.headers.origin;
  if (!origin) {
    next();
    return;
  }

  if (allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
    next();
    return;
  }

  response.status(403).json({ error: 'Origin not allowed' });
}
