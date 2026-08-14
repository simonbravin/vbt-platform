import fs from "fs";
import path from "path";

/** Load VBT brand logo as a data URL for @react-pdf/renderer Image. */
export function loadPdfLogoDataUrl(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "brand", "vision-logo.png"),
    path.join(process.cwd(), "apps", "web", "public", "brand", "vision-logo.png"),
  ];
  try {
    const logoPath = candidates.find((p) => fs.existsSync(p));
    if (!logoPath) return null;
    const b64 = fs.readFileSync(logoPath).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}
