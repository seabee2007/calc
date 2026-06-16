import path from 'node:path';
import dotenv from 'dotenv';

let loaded = false;

/** Load Node-only QA env vars. `.env.local` wins over `.env`. */
export function loadQaEnv(): void {
  if (loaded) return;

  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  loaded = true;
}
