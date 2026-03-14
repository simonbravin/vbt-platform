import { PendingContent } from "./PendingContent";

const SUPPORT_EMAIL = process.env.SUPERADMIN_EMAIL ?? "admin@visionbuildingtechs.com";

export default function PendingPage() {
  return <PendingContent supportEmail={SUPPORT_EMAIL} />;
}
