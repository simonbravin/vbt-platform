import { requireModuleLayoutAccess } from "@/lib/module-layout-access";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleLayoutAccess("sales", {
    allowRoles: ["org_admin", "sales_user"],
  });
  return <>{children}</>;
}

