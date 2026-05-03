import * as dotenv from "dotenv";
import * as path from "path";
import { defineConfig } from "prisma/config";

// Force load from .env file, overriding system env vars
const envResult = dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: envResult.parsed?.DATABASE_URL ?? process.env["DATABASE_URL"],
  },
});
