import { prisma } from "../../src/index";

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' ORDER BY ordinal_position`
  );
  console.log("projects columns:", rows.map((r) => r.column_name).join(", "));
  const c = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' ORDER BY ordinal_position`
  );
  console.log("clients columns:", c.map((r) => r.column_name).join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
