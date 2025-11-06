import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema/index';
import { DEFAULT_DB_URL } from 'src/config';
export { schema };

export const db = drizzle(process.env.DATABASE_URL ?? DEFAULT_DB_URL);
