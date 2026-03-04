import { requireAuth } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectLogsClient } from "./ProjectLogsClient";

export default async function ProjectLogsPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project activity</h1>
          <p className="text-gray-500 text-sm mt-0.5">Creation, updates, and deletions</p>
        </div>
      </div>
      <ProjectLogsClient />
    </div>
  );
}
