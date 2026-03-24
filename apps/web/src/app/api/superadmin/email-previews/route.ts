import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildAccountStatusEmailHtml,
  buildForgotPasswordEmailHtml,
  buildPartnerInviteEmailHtml,
  buildProjectsReportEmailHtml,
  buildQuoteSentEmailHtml,
} from "@/lib/email-bodies";
import { parseEmailLocale } from "@/lib/email-config";

type TemplateKey =
  | "forgot-password"
  | "partner-invite"
  | "account-approved"
  | "account-rejected"
  | "quote"
  | "report";

function renderTemplate(template: TemplateKey, locale: "es" | "en"): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.visionlatam.com").replace(/\/$/, "");
  switch (template) {
    case "forgot-password":
      return buildForgotPasswordEmailHtml(locale, {
        resetUrl: `${appUrl}/reset-password?token=demo-token`,
        hours: 1,
      });
    case "partner-invite":
      return buildPartnerInviteEmailHtml(locale, {
        partnerName: "VBT Argentina SA",
        inviteeEmail: "usuario@partner.com",
        role: locale === "es" ? "Administrador" : "Admin",
        appUrl: `${appUrl}/dashboard`,
      });
    case "account-approved":
      return buildAccountStatusEmailHtml(locale, {
        approved: true,
        appUrl,
        recipientGreeting: locale === "es" ? "Juan Pérez" : "John Doe",
        supportEmail: "admin@visionlatam.com",
      });
    case "account-rejected":
      return buildAccountStatusEmailHtml(locale, {
        approved: false,
        appUrl,
        recipientGreeting: locale === "es" ? "Juan Pérez" : "John Doe",
        supportEmail: "admin@visionlatam.com",
      });
    case "quote":
      return buildQuoteSentEmailHtml(locale, {
        quoteNumber: "Q-2026-0142",
        quotedByName: "Simon Bravin",
        projectName: locale === "es" ? "Centro Logístico Norte" : "North Logistics Center",
        clientName: "ACME Construction",
        organizationName: "VBT Argentina SA",
        totalPrice: 248750,
        quoteUrl: `${appUrl}/quotes/demo`,
        optionalMessage:
          locale === "es"
            ? "Incluimos una alternativa opcional para reducir tiempos de entrega."
            : "We included an optional alternative to shorten lead times.",
        hasPdfAttachment: true,
      });
    case "report":
      return buildProjectsReportEmailHtml(locale, {
        rowCount: 42,
        organizationName: "VBT Argentina SA",
        generatedByName: "Leonardo Bravin",
        reportsUrl: `${appUrl}/reports`,
        filterParts: {
          status: "won",
          countryCode: "AR",
          hasClientFilter: true,
          hasSearch: true,
          hasSoldRange: true,
        },
      });
    default:
      return buildForgotPasswordEmailHtml(locale, {
        resetUrl: `${appUrl}/reset-password?token=demo-token`,
        hours: 1,
      });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const template = (url.searchParams.get("template") ?? "quote") as TemplateKey;
  const locale = parseEmailLocale(url.searchParams.get("locale"));
  const html = renderTemplate(template, locale);
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

