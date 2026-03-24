import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TrainingProgramSessionsClient } from "./TrainingProgramSessionsClient";

export const dynamic = "force-dynamic";

export default async function SuperadminTrainingProgramPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return <TrainingProgramSessionsClient programId={params.id} />;
}
