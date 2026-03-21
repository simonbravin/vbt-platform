import { EntitiesClient } from "@/app/(dashboard)/admin/entities/EntitiesClient";

export default function SuperadminEntitiesPage() {
  return <EntitiesClient scope="platform" />;
}
