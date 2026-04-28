import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { findUserByEmail, getAuthDb, hashPassword, seedUsers } from '../config/auth-store.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'operator']).optional()
});

export const authRouter = Router();

await seedUsers();

authRouter.post('/register', async (request, response, next) => {
  try {
    const data = credentialsSchema.parse(request.body);
    const existing = await findUserByEmail(data.email);
    if (existing) {
      response.status(409).json({ error: 'User already exists' });
      return;
    }

    const db = await getAuthDb();
    const user = {
      id: randomUUID(),
      name: data.name ?? data.email.split('@')[0],
      email: data.email,
      passwordHash: hashPassword(data.password),
      role: data.role ?? 'operator',
      createdAt: new Date().toISOString()
    } as const;

    db.data.users.push(user);
    await db.write();

    response.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const data = credentialsSchema.pick({ email: true, password: true }).parse(request.body);
    const user = await findUserByEmail(data.email);

    if (!user || user.passwordHash !== hashPassword(data.password)) {
      response.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    response.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/users', async (_request, response, next) => {
  try {
    const db = await getAuthDb();
    response.json(
      db.data.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }))
    );
  } catch (error) {
    next(error);
  }
});
