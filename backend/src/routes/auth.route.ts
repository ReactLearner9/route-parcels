import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { authRateLimit } from "../middleware/rate-limit.js";
import {
  findUserByUsername,
  getAuthDb,
  hashPassword,
} from "../config/auth-store.js";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["admin", "operator"]).optional(),
});

export const authRouter = Router();
authRouter.use(authRateLimit);

authRouter.post("/register", async (request, response, next) => {
  try {
    const data = credentialsSchema.parse(request.body);
    const existing = await findUserByUsername(data.username);
    if (existing) {
      response.status(409).json({ error: "User already exists" });
      return;
    }

    const db = await getAuthDb();
    const user = {
      id: randomUUID(),
      username: data.username,
      passwordHash: hashPassword(data.password),
      role: data.role ?? "operator",
      createdAt: new Date().toISOString(),
    } as const;

    db.data.users.push(user);
    await db.write();

    response.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const data = credentialsSchema
      .pick({ username: true, password: true })
      .parse(request.body);
    const user = await findUserByUsername(data.username);

    if (!user || user.passwordHash !== hashPassword(data.password)) {
      response.status(401).json({ error: "Invalid credentials" });
      return;
    }

    response.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

