-- Mapear roles legacy (SUPERADMIN, ADMIN, SALES, VIEWER) a los valores que usa Prisma.
-- Debe ejecutarse después de 20250322000000 (ADD VALUE) para que los nuevos valores estén comprometidos.
UPDATE org_members SET role = 'org_admin'::"OrgMemberRole"   WHERE role::text IN ('SUPERADMIN', 'ADMIN');
UPDATE org_members SET role = 'sales_user'::"OrgMemberRole"  WHERE role::text = 'SALES';
UPDATE org_members SET role = 'viewer'::"OrgMemberRole"     WHERE role::text = 'VIEWER';
