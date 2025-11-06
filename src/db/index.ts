import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema/index';
export { schema };

console.log('[DB]', process.env.DB_FILE_NAME);

export const db = drizzle(process.env.DB_FILE_NAME!);
