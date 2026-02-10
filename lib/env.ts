export function ensureEnv() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./prisma/dev.db";
  }

  if (!process.env.IP_HASH_SALT) {
    throw new Error("IP_HASH_SALT is required");
  }
}
