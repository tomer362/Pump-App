import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as NodePool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Postgres database.",
  );
}

/**
 * Neon's serverless driver speaks WebSocket/HTTP and only works against Neon
 * endpoints, so a plain local Postgres needs node-postgres instead. Pick by
 * host rather than NODE_ENV, so pointing local dev at a real Neon branch also
 * works without touching code.
 */
const isNeon = /\.neon\.tech|neon\.build/.test(connectionString);

/**
 * Reuse the pool across hot reloads in dev and across warm invocations on
 * Vercel. Without this, every module re-evaluation opens a new pool and Neon's
 * free tier runs out of connections quickly.
 */
const globalForDb = globalThis as unknown as {
  __pumpDb?: ReturnType<typeof createDb>;
};

function createDb() {
  if (isNeon) {
    return drizzleNeon(new NeonPool({ connectionString }), { schema });
  }
  return drizzleNode(new NodePool({ connectionString }), { schema });
}

export const db = globalForDb.__pumpDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.__pumpDb = db;

export { schema };
