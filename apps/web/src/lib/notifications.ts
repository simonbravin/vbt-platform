/**
 * Maps ActivityLog rows to notification titleKey (i18n) and link for the bell dropdown.
 * Used by GET /api/saas/notifications.
 */
export type NotificationMappingInput = {
  action: string;
  entityType: string;
  entityId: string;
  organizationId: string | null;
  isSuperadmin: boolean;
};

export function getNotificationTitleKeyAndLink(input: NotificationMappingInput): {
  titleKey: string;
  link: string;
} {
  const { action, entityType, entityId, organizationId, isSuperadmin } = input;
  const normAction = action.toLowerCase();
  const normEntity = entityType.toLowerCase();

  // Superadmin-only: partner-level events -> partner detail
  if (isSuperadmin && organizationId && (normAction === "partner_created" || normAction === "partner_updated" || normAction === "partner_invite_sent" || normAction === "partner_onboarded")) {
    return {
      titleKey: `notifications.${normAction}`,
      link: `/superadmin/partners/${organizationId}`,
    };
  }

  // Territory: superadmin -> partner; partner -> settings
  if (normEntity === "partner_territory" || normAction === "territory_assigned" || normAction === "territory_removed") {
    const link = isSuperadmin && organizationId ? `/superadmin/partners/${organizationId}` : "/settings";
    return { titleKey: `notifications.${normAction}`, link };
  }

  // Quote
  if (normEntity === "quote" || normAction.includes("quote")) {
    const link = `/quotes/${entityId}`;
    const key =
      normAction === "quote_created"
        ? "notifications.quote_created"
        : normAction === "quote_accepted"
          ? "notifications.quote_accepted"
          : normAction === "quote_archived"
            ? "notifications.quote_archived"
            : normAction === "quote_deleted"
              ? "notifications.quote_deleted"
              : "notifications.quote_updated";
    return { titleKey: key, link };
  }

  // Project
  if (normEntity === "project" || normAction === "project_created") {
    return { titleKey: "notifications.project_created", link: `/projects/${entityId}` };
  }

  // Client
  if (normEntity === "client" || normAction === "client_created") {
    return { titleKey: "notifications.client_created", link: "/clients" };
  }

  // Org member (invite, role change)
  if (normEntity === "org_member" || normAction === "member_invited" || normAction === "member_role_changed") {
    const link = isSuperadmin && organizationId ? `/superadmin/partners/${organizationId}` : "/settings/team";
    return { titleKey: `notifications.${normAction}`, link };
  }

  // Engineering
  if (normEntity === "engineering_request" || normAction === "engineering_request_created") {
    return { titleKey: "notifications.engineering_request_created", link: "/engineering" };
  }

  // Document
  if (normEntity === "document" || normAction === "document_uploaded") {
    return { titleKey: "notifications.document_uploaded", link: "/documents" };
  }

  // Training
  if (normEntity === "training_enrollment" || normAction === "training_enrolled") {
    return { titleKey: "notifications.training_enrolled", link: "/training" };
  }

  // Fallback
  return {
    titleKey: "notifications.activity",
    link: isSuperadmin ? "/superadmin/activity" : "/dashboard",
  };
}
