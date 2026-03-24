import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TEMPLATES = [
  { id: "quote", label: "Quote / Cotizacion" },
  { id: "report", label: "Report / Informe" },
  { id: "forgot-password", label: "Forgot Password / Reset" },
  { id: "partner-invite", label: "Partner Invite" },
  { id: "account-approved", label: "Account Approved" },
  { id: "account-rejected", label: "Account Rejected" },
] as const;

export default async function SuperadminEmailPreviewPage({
  searchParams,
}: {
  searchParams: { template?: string; locale?: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const template = TEMPLATES.some((t) => t.id === searchParams.template)
    ? (searchParams.template as (typeof TEMPLATES)[number]["id"])
    : "quote";
  const locale = searchParams.locale === "es" ? "es" : "en";
  const iframeSrc = `/api/superadmin/email-previews?template=${encodeURIComponent(template)}&locale=${locale}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Email Templates Preview</h1>
        <p className="text-sm text-muted-foreground">
          Vista visual real del HTML final que se envia por correo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/superadmin/emails/preview?template=${t.id}&locale=${locale}`}
            className={`rounded-sm border px-3 py-1.5 text-sm ${
              template === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/superadmin/emails/preview?template=${template}&locale=en`}
          className={`rounded-sm border px-3 py-1.5 text-sm ${
            locale === "en"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          English
        </Link>
        <Link
          href={`/superadmin/emails/preview?template=${template}&locale=es`}
          className={`rounded-sm border px-3 py-1.5 text-sm ${
            locale === "es"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          Espanol
        </Link>
      </div>

      <div className="rounded-md border border-border bg-card p-2">
        <iframe
          title="Email preview"
          src={iframeSrc}
          className="h-[860px] w-full rounded-sm border border-border bg-white"
        />
      </div>
    </div>
  );
}

