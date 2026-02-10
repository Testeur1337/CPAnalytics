import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const isPostgres = databaseUrl.startsWith("postgres");
const provider = isPostgres ? "postgresql" : "sqlite";

const schemaSource = resolve(root, "prisma", `schema.${provider}.prisma`);
const schemaTarget = resolve(root, "prisma", "schema.prisma");
const migrationsSource = resolve(root, "prisma", `migrations_${provider}`);
const migrationsTarget = resolve(root, "prisma", "migrations");

cpSync(schemaSource, schemaTarget, { force: true });

if (existsSync(migrationsTarget)) {
  rmSync(migrationsTarget, { recursive: true, force: true });
}
mkdirSync(migrationsTarget, { recursive: true });
cpSync(migrationsSource, migrationsTarget, { recursive: true });

console.log(`[prisma] Prepared schema and migrations for ${provider}`);
