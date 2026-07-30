/**
 * Neon preflight via @vbt/db Prisma client (apps/web/.prisma/client).
 */
import { PrismaClient } from "../../../apps/web/.prisma/client";

async function main() {
  const host = process.env.DATABASE_URL?.match(/@([^/]+)\//)?.[1] ?? "unknown";
  console.log(JSON.stringify({ host, pooler: host.includes("pooler") }));

  const p = new PrismaClient();
  try {
    const tables = (await p.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY 1
    `)) as { table_name: string }[];
    const names = tables.map((t) => t.table_name);
    const dupes = names.filter((n) => /(_old|_backup|_v2|_bak)/i.test(n));
    const indexes = await p.$queryRawUnsafe(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN (
          'quotes','projects','sales','clients','inventory_levels',
          'inventory_transactions','documents','quote_items','warehouses',
          'organizations','catalog_pieces'
        )
      ORDER BY 1,2
    `);
    const counts = await p.$queryRawUnsafe(`
      SELECT 'quotes' AS t, COUNT(*)::int AS c FROM quotes
      UNION ALL SELECT 'projects', COUNT(*)::int FROM projects
      UNION ALL SELECT 'sales', COUNT(*)::int FROM sales
      UNION ALL SELECT 'clients', COUNT(*)::int FROM clients
      UNION ALL SELECT 'inventory_levels', COUNT(*)::int FROM inventory_levels
      UNION ALL SELECT 'quote_items', COUNT(*)::int FROM quote_items
      UNION ALL SELECT 'catalog_pieces', COUNT(*)::int FROM catalog_pieces
      UNION ALL SELECT 'organizations', COUNT(*)::int FROM organizations
    `);
    console.log(JSON.stringify({ tableCount: names.length, tables: names, dupes, indexes, counts }, null, 2));
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
