/**
 * The integrity tests talk to the real database, so they need the same
 * DATABASE_URL the app uses. Loaded here rather than through the runner's
 * env handling because `lib/db` throws at module scope if it's missing, and
 * that happens the moment a test file is imported.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
