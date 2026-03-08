/**
 * Shared VBT email layout for notifications (statements, quotes, reports, etc.).
 * Estética: header #1a3a5c, acento #e87722, fondo #f8f9fa.
 */

const VBT_HEADER_BG = "#1a3a5c";
const VBT_ACCENT = "#e87722";
const VBT_BODY_BG = "#f8f9fa";

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
    <div style="background-color: ${VBT_HEADER_BG}; padding: 24px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">${escapeHtml(subtitle)}</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">${escapeHtml(title)}</p>
    </div>
    <div style="background-color: ${VBT_BODY_BG}; padding: 24px; color: #333; font-size: 14px; line-height: 1.5;">
      ${bodyHtml}
      ${attachmentDescription ? `<p style="color: #555; font-size: 14px; margin-top: 20px;">${escapeHtml(attachmentDescription)}</p>` : ""}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #dee2e6;">
        <p style="color: #6c757d; font-size: 12px; margin: 0;">${escapeHtml(footerText)}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();
}
