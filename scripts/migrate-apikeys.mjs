#!/usr/bin/env node
/**
 * Hash any remaining plaintext API keys after the schema gains keyPrefix/keyLast4.
 * Safe to rerun. Usage: node scripts/migrate-apikeys.mjs
 */
import { PrismaClient } from "@prisma/client";
import { needsApiKeyMigration, storedApiKeyFields } from "../src/lib/shipos/api-keys.mjs";

const db = new PrismaClient();

try {
  const keys = await db.apiKey.findMany();
  let migrated = 0;
  for (const key of keys) {
    if (!needsApiKeyMigration(key)) continue;
    await db.apiKey.update({
      where: { id: key.id },
      data: storedApiKeyFields(key.key),
    });
    migrated += 1;
  }
  console.log(`API key migration complete. ${migrated} of ${keys.length} row(s) hashed.`);
} finally {
  await db.$disconnect();
}
