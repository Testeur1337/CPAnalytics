export function ensureEnv() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.env.DATABASE_URL = "file:./prisma/dev.db";
  }

  if (!process.env.DATABASE_PROVIDER) {
    const current = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
    process.env.DATABASE_PROVIDER = current.startsWith("postgres") ? "postgresql" : "sqlite";
  }

  if (!process.env.IP_HASH_SALT) {
    throw new Error("IP_HASH_SALT is required");
  }
}
