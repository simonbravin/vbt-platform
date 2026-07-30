import { PrismaClient } from "../../../apps/web/.prisma/client";

async function main() {
  const p = new PrismaClient();
  try {
    const rows = await p.$queryRawUnsafe(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE '%organization_id_created_at%'
          OR indexname LIKE '%organization_id_status%'
        )
      ORDER BY 1, 2
    `);
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
