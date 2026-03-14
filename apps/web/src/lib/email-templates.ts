/**
 * Shared VBT email layout for notifications (statements, quotes, reports, invites, etc.).
 * Single source for colors/layout: change here to update all emails.
 * Estética: header #1a3a5c, acento #e87722, fondo #f8f9fa.
 */
export const VBT_EMAIL = {
  headerBg: "#1a3a5c",
  accent: "#e87722",
  bodyBg: "#f8f9fa",
  text: "#333",
  textMuted: "#6c757d",
  border: "#dee2e6",
} as const;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type VbtEmailOptions = {
  /** Main title in the header (e.g. "Account Statements") */
  title: string;
  /** Subtitle under the main title (e.g. "Vision Building Technologies") */
  subtitle?: string;
  /** HTML content for the body (already safe, or use escapeHtml for user content) */
  bodyHtml: string;
  /** Optional custom footer line; default generic VBT line */
  footerText?: string;
  /** If set, adds a line like "Please find the PDF attached." */
  attachmentDescription?: string;
};

export function buildVbtEmailHtml(options: VbtEmailOptions): string {
  const {
    title,
    subtitle = "Vision Building Technologies",
    bodyHtml,
    footerText = "This notification was sent by the VBT Cost Calculator.",
    attachmentDescription,
  } = options;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #e9ecef;">
  <div style="max-width: 600px; margin: 24px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="background-color: ${VBT_EMAIL.headerBg}; padding: 24px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">${escapeHtml(subtitle)}</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">${escapeHtml(title)}</p>
    </div>
    <div style="background-color: ${VBT_EMAIL.bodyBg}; padding: 24px; color: ${VBT_EMAIL.text}; font-size: 14px; line-height: 1.5;">
      ${bodyHtml}
      ${attachmentDescription ? `<p style="color: #555; font-size: 14px; margin-top: 20px;">${escapeHtml(attachmentDescription)}</p>` : ""}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid ${VBT_EMAIL.border};">
        <p style="color: ${VBT_EMAIL.textMuted}; font-size: 12px; margin: 0;">${escapeHtml(footerText)}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();
}

/** Partner invite: "You have been added to {partnerName}" */
export type PartnerInviteEmailOptions = {
  partnerName: string;
  inviteeEmail: string;
  role: string;
  appUrl: string;
};

export function buildPartnerInviteEmailHtml(options: PartnerInviteEmailOptions): string {
  const { partnerName, role, appUrl } = options;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">You have been added to the partner organization <strong>${escapeHtml(partnerName)}</strong> with the role <strong>${escapeHtml(role)}</strong>.</p>
    <p style="margin: 0 0 16px 0;">You can sign in and switch to this organization to start working.</p>
    <p style="margin: 0;">
      <a href="${escapeHtml(appUrl)}" style="display: inline-block; padding: 10px 20px; background-color: ${VBT_EMAIL.accent}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign in to VBT Cotizador</a>
    </p>
  `.trim();
  return buildVbtEmailHtml({
    title: "Partner organization invitation",
    subtitle: "Vision Building Technologies",
    bodyHtml,
    footerText: "This invitation was sent by the VBT platform administrator.",
  });
}

/** Partner invite for new users: "Create your account to join {partnerName}" */
export type PartnerInviteNewUserEmailOptions = {
  partnerName: string;
  inviteeEmail: string;
  role: string;
  acceptUrl: string;
};

export function buildPartnerInviteNewUserEmailHtml(options: PartnerInviteNewUserEmailOptions): string {
  const { partnerName, role, acceptUrl } = options;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">You have been invited to join the partner organization <strong>${escapeHtml(partnerName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
    <p style="margin: 0 0 16px 0;">Click the button below to create your account and get started. The link is valid for 7 days.</p>
    <p style="margin: 0;">
      <a href="${escapeHtml(acceptUrl)}" style="display: inline-block; padding: 10px 20px; background-color: ${VBT_EMAIL.accent}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Create account</a>
    </p>
  `.trim();
  return buildVbtEmailHtml({
    title: "Invitation to join partner portal",
    subtitle: "Vision Building Technologies",
    bodyHtml,
    footerText: "This invitation was sent by the VBT platform administrator.",
  });
}
