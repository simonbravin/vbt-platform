/**
 * Shared VBT email layout for transactional messages.
 * Table-based wrapper for broad client support; accent bar + clear type hierarchy.
 */
export const VBT_EMAIL = {
  headerBg: "#1a3a5c",
  accent: "#e87722",
  bodyBg: "#ffffff",
  pageBg: "#eef1f5",
  text: "#374151",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  cardShadow: "0 4px 24px rgba(26, 58, 92, 0.1)",
} as const;

/** System stack for crisp rendering in Apple Mail, Gmail, Outlook.com */
export const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type VbtEmailOptions = {
  /** Main headline (large, in the colored header) */
  title: string;
  /** Small uppercase label above the headline (e.g. brand) */
  subtitle?: string;
  bodyHtml: string;
  footerText?: string;
  attachmentDescription?: string;
  /**
   * Hidden preview line in inbox (Gmail, Apple Mail). Defaults to a short slice of `title`.
   */
  preheader?: string;
};

function truncatePreheader(s: string, max = 100): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Primary action button (orange) — use for one main CTA per email */
export function emailPrimaryButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;background-color:${VBT_EMAIL.accent};color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;line-height:1.25;font-family:${EMAIL_FONT_STACK};">${escapeHtml(label)}</a>`;
}

/** Inline text link (accent color) */
export function emailTextLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${VBT_EMAIL.accent};font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>`;
}

export function buildVbtEmailHtml(options: VbtEmailOptions): string {
  const {
    title,
    subtitle = "Vision Building Technologies",
    bodyHtml,
    footerText = "This notification was sent by the VBT Platform.",
    attachmentDescription,
    preheader: preheaderOpt,
  } = options;

  const preheader = escapeHtml(truncatePreheader(preheaderOpt ?? title));
  const ff = EMAIL_FONT_STACK;

  const attachmentBlock = attachmentDescription
    ? `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
              <tr>
                <td style="padding:16px 18px;background-color:#f8fafc;border-radius:8px;border-left:3px solid ${VBT_EMAIL.accent};font-family:${ff};font-size:14px;line-height:1.55;color:#4b5563;">
                  ${escapeHtml(attachmentDescription)}
                </td>
              </tr>
            </table>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${VBT_EMAIL.pageBg};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${VBT_EMAIL.pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:${VBT_EMAIL.cardShadow};">
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background-color:${VBT_EMAIL.accent};">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:${VBT_EMAIL.headerBg};padding:28px 32px 32px 32px;">
              <p style="margin:0 0 10px;font-family:${ff};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">${escapeHtml(subtitle)}</p>
              <h1 style="margin:0;font-family:${ff};font-size:26px;font-weight:600;color:#ffffff;line-height:1.28;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 32px 32px;font-family:${ff};font-size:15px;line-height:1.65;color:${VBT_EMAIL.text};background-color:${VBT_EMAIL.bodyBg};">
              ${bodyHtml}
              ${attachmentBlock}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid ${VBT_EMAIL.border};">
                <tr>
                  <td style="padding-top:22px;">
                    <p style="margin:0;font-family:${ff};font-size:12px;line-height:1.55;color:${VBT_EMAIL.textMuted};">${escapeHtml(footerText)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-family:${ff};font-size:11px;line-height:1.4;color:#9ca3af;text-align:center;max-width:600px;">
          © Vision Building Technologies · Vision Latam
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}
