import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { DEFAULT_DB_URL } from 'src/config';

// eslint-disable-next-line
export default defineConfig({
  out: './src/db/migrations',
  schema: './src/db/schema/index.ts',
  migrations: {
    prefix: 'timestamp',
  },
  casing: 'camelCase',
  introspect: {
    casing: 'camel',
  },
  strict: true,
  dialect: 'sqlite',
  breakpoints: false,
  dbCredentials: {
    url: process.env.DATABASE_URL! ?? DEFAULT_DB_URL,
  },
});
