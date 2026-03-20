/**
 * Localized HTML bodies for transactional emails (one language per message).
 * Subjects live in `email-config.ts`; layout primitives in `email-templates.ts`.
 */
import type { EmailLocale } from "./email-config";
import {
  buildVbtEmailHtml,
  emailPrimaryButton,
  emailTextLink,
  escapeHtml,
  VBT_EMAIL,
} from "./email-templates";

const BRAND_SUBTITLE = "Vision Building Technologies";

export function buildForgotPasswordEmailHtml(
  locale: EmailLocale,
  opts: { resetUrl: string; hours: number }
): string {
  const { resetUrl, hours } = opts;
  if (locale === "es") {
    return buildVbtEmailHtml({
      title: "Restablecer contraseña",
      subtitle: BRAND_SUBTITLE,
      preheader: `Enlace seguro · vence en ${hours} h`,
      bodyHtml: `
            <p style="margin: 0 0 18px 0;">Hola,</p>
            <p style="margin: 0 0 24px 0;">Solicitaste restablecer tu contraseña. Usá el botón para elegir una nueva. El enlace vence en <strong>${hours}</strong> hora(s).</p>
            <p style="margin: 0 0 20px 0;">${emailPrimaryButton(resetUrl, "Restablecer contraseña")}</p>
            <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">Si no fuiste vos, podés ignorar este correo.</p>
          `.trim(),
      footerText: "Este aviso fue enviado por la Plataforma VBT.",
    });
  }
  return buildVbtEmailHtml({
    title: "Reset your password",
    subtitle: BRAND_SUBTITLE,
    preheader: `Secure link · expires in ${hours} hour(s)`,
    bodyHtml: `
            <p style="margin: 0 0 18px 0;">Hi,</p>
            <p style="margin: 0 0 24px 0;">You requested a password reset. Use the button below to set a new password. This link expires in <strong>${hours}</strong> hour(s).</p>
            <p style="margin: 0 0 20px 0;">${emailPrimaryButton(resetUrl, "Reset password")}</p>
            <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">If you didn't request this, you can ignore this email.</p>
          `.trim(),
    footerText: "This notification was sent by the VBT Platform.",
  });
}

export type PartnerInviteEmailOptions = {
  partnerName: string;
  inviteeEmail: string;
  role: string;
  appUrl: string;
};

export function buildPartnerInviteEmailHtml(locale: EmailLocale, options: PartnerInviteEmailOptions): string {
  const { partnerName, role, appUrl } = options;
  if (locale === "es") {
    const bodyHtml = `
    <p style="margin: 0 0 18px 0;">Te sumaron a la organización partner <strong>${escapeHtml(partnerName)}</strong> con el rol <strong>${escapeHtml(role)}</strong>.</p>
    <p style="margin: 0 0 24px 0;">Iniciá sesión y seleccioná esta organización para empezar a trabajar.</p>
    <p style="margin: 0;">${emailPrimaryButton(appUrl, "Ingresar a Plataforma VBT")}</p>
  `.trim();
    return buildVbtEmailHtml({
      title: "Invitación a organización partner",
      subtitle: BRAND_SUBTITLE,
      preheader: `Rol: ${role} · ${partnerName}`,
      bodyHtml,
      footerText: "Esta invitación fue enviada por un administrador de la plataforma VBT.",
    });
  }
  const bodyHtml = `
    <p style="margin: 0 0 18px 0;">You have been added to the partner organization <strong>${escapeHtml(partnerName)}</strong> with the role <strong>${escapeHtml(role)}</strong>.</p>
    <p style="margin: 0 0 24px 0;">Sign in and switch to this organization to get started.</p>
    <p style="margin: 0;">${emailPrimaryButton(appUrl, "Sign in to VBT Platform")}</p>
  `.trim();
  return buildVbtEmailHtml({
    title: "Partner organization invitation",
    subtitle: BRAND_SUBTITLE,
    preheader: `Role: ${role} · ${partnerName}`,
    bodyHtml,
    footerText: "This invitation was sent by the VBT platform administrator.",
  });
}

export type PartnerInviteNewUserEmailOptions = {
  partnerName: string;
  inviteeEmail: string;
  role: string;
  acceptUrl: string;
};

export function buildPartnerInviteNewUserEmailHtml(
  locale: EmailLocale,
  options: PartnerInviteNewUserEmailOptions
): string {
  const { partnerName, role, acceptUrl } = options;
  if (locale === "es") {
    const bodyHtml = `
    <p style="margin: 0 0 18px 0;">Te invitaron a unirte a <strong>${escapeHtml(partnerName)}</strong> como <strong>${escapeHtml(role)}</strong>.</p>
    <p style="margin: 0 0 24px 0;">Creá tu cuenta con el botón de abajo. El enlace vence en <strong>7 días</strong>.</p>
    <p style="margin: 0;">${emailPrimaryButton(acceptUrl, "Crear cuenta")}</p>
  `.trim();
    return buildVbtEmailHtml({
      title: "Invitación al portal de partners",
      subtitle: BRAND_SUBTITLE,
      preheader: `Unite a ${partnerName} · enlace 7 días`,
      bodyHtml,
      footerText: "Esta invitación fue enviada por un administrador de la plataforma VBT.",
    });
  }
  const bodyHtml = `
    <p style="margin: 0 0 18px 0;">You've been invited to join <strong>${escapeHtml(partnerName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
    <p style="margin: 0 0 24px 0;">Create your account using the button below. The link is valid for <strong>7 days</strong>.</p>
    <p style="margin: 0;">${emailPrimaryButton(acceptUrl, "Create account")}</p>
  `.trim();
  return buildVbtEmailHtml({
    title: "Invitation to join partner portal",
    subtitle: BRAND_SUBTITLE,
    preheader: `Join ${partnerName} · 7-day link`,
    bodyHtml,
    footerText: "This invitation was sent by the VBT platform administrator.",
  });
}

export function buildAccountStatusEmailHtml(
  locale: EmailLocale,
  opts: {
    approved: boolean;
    appUrl: string;
    recipientGreeting: string;
    supportEmail: string;
  }
): string {
  const { approved, appUrl, recipientGreeting, supportEmail } = opts;
  const loginUrl = `${appUrl.replace(/\/$/, "")}/login`;
  const headerLine = locale === "es" ? "Vision Latam – Plataforma VBT" : "Vision Latam – VBT Platform";

  if (approved) {
    if (locale === "es") {
      return buildVbtEmailHtml({
        title: "¡Cuenta aprobada!",
        subtitle: headerLine,
        preheader: "Ya podés iniciar sesión en Plataforma VBT",
        bodyHtml: `
            <p style="margin: 0 0 18px 0;">Hola ${escapeHtml(recipientGreeting)},</p>
            <p style="margin: 0 0 24px 0;">Tu cuenta fue aprobada. Entrá con el botón para continuar.</p>
            <p style="margin: 0;">${emailPrimaryButton(loginUrl, "Iniciar sesión")}</p>
          `.trim(),
        footerText: "Este mensaje fue enviado por la Plataforma VBT.",
      });
    }
    return buildVbtEmailHtml({
      title: "Account approved!",
      subtitle: headerLine,
      preheader: "Your VBT Platform access is ready",
      bodyHtml: `
            <p style="margin: 0 0 18px 0;">Hi ${escapeHtml(recipientGreeting)},</p>
            <p style="margin: 0 0 24px 0;">Your account has been approved. Sign in below to get started.</p>
            <p style="margin: 0;">${emailPrimaryButton(loginUrl, "Sign in")}</p>
          `.trim(),
      footerText: "This message was sent by the VBT Platform.",
    });
  }

  if (locale === "es") {
    return buildVbtEmailHtml({
      title: "Solicitud de cuenta",
      subtitle: headerLine,
      preheader: "Contactá al equipo si necesitás más información",
      bodyHtml: `
            <p style="margin: 0 0 18px 0;">Hola ${escapeHtml(recipientGreeting)},</p>
            <p style="margin: 0;">Lamentablemente, tu solicitud no pudo ser aprobada en este momento. Para más información, escribinos a ${emailTextLink(`mailto:${supportEmail}`, supportEmail)}.</p>
          `.trim(),
      footerText: "Este mensaje fue enviado por la Plataforma VBT.",
    });
  }
  return buildVbtEmailHtml({
    title: "Account request",
    subtitle: headerLine,
    preheader: "Contact the team if you have questions",
    bodyHtml: `
            <p style="margin: 0 0 18px 0;">Hi ${escapeHtml(recipientGreeting)},</p>
            <p style="margin: 0;">Unfortunately, your account request could not be approved at this time. For more information, please contact ${emailTextLink(`mailto:${supportEmail}`, supportEmail)}.</p>
          `.trim(),
    footerText: "This message was sent by the VBT Platform.",
  });
}

export function buildQuoteSentEmailHtml(
  locale: EmailLocale,
  opts: {
    quoteNumber: string;
    quotedByName: string;
    projectName: string;
    clientName: string;
    totalPrice: number;
    optionalMessage: string | undefined;
    hasPdfAttachment: boolean;
  }
): string {
  const {
    quoteNumber,
    quotedByName,
    projectName,
    clientName,
    optionalMessage,
    hasPdfAttachment,
    totalPrice,
  } = opts;
  const numLocale = locale === "es" ? "es-AR" : "en-US";
  const totalStr = `$${Number(totalPrice).toLocaleString(numLocale, { minimumFractionDigits: 2 })}`;

  const labels =
    locale === "es"
      ? { quotedBy: "Cotizada por", project: "Proyecto", client: "Cliente", total: "Total" }
      : { quotedBy: "Quoted by", project: "Project", client: "Client", total: "Total" };

  const layoutTitle = locale === "es" ? "Cotización" : "Cost Quote";
  const heading = locale === "es" ? `Cotización ${quoteNumber}` : `Quote ${quoteNumber}`;
  const footer =
    locale === "es"
      ? "Esta cotización fue generada por la Plataforma VBT."
      : "This quote was generated by the VBT Platform.";
  const attachDesc =
    locale === "es"
      ? "Adjuntamos el PDF detallado de la cotización."
      : "Please find the detailed quote PDF attached to this email.";

  const bodyHtml = `
    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280;">${escapeHtml(heading)}</p>
    <p style="margin: 0 0 22px 0; color: #6b7280; font-size: 14px;">${escapeHtml(labels.quotedBy)}: <strong style="color: ${VBT_EMAIL.text};">${escapeHtml(quotedByName)}</strong></p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid ${VBT_EMAIL.border}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 14px 18px; background-color: #f9fafb; color: #6b7280; font-size: 13px; width: 38%; border-bottom: 1px solid ${VBT_EMAIL.border};">${escapeHtml(labels.project)}</td>
        <td style="padding: 14px 18px; font-weight: 600; color: ${VBT_EMAIL.text}; border-bottom: 1px solid ${VBT_EMAIL.border};">${escapeHtml(projectName)}</td>
      </tr>
      ${clientName ? `<tr><td style="padding: 14px 18px; background-color: #f9fafb; color: #6b7280; font-size: 13px; border-bottom: 1px solid ${VBT_EMAIL.border};">${escapeHtml(labels.client)}</td><td style="padding: 14px 18px; font-weight: 600; color: ${VBT_EMAIL.text}; border-bottom: 1px solid ${VBT_EMAIL.border};">${escapeHtml(clientName)}</td></tr>` : ""}
      <tr><td style="padding: 14px 18px; background-color: #f9fafb; color: #6b7280; font-size: 13px;">${escapeHtml(labels.total)}</td><td style="padding: 14px 18px; font-size: 22px; font-weight: 700; color: ${VBT_EMAIL.accent};">${totalStr}</td></tr>
    </table>
    ${optionalMessage ? `<div style="margin-top: 22px; padding: 18px; background-color: #f8fafc; border-radius: 8px; border-left: 3px solid ${VBT_EMAIL.accent};"><p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.55;">${escapeHtml(optionalMessage)}</p></div>` : ""}
  `.trim();

  return buildVbtEmailHtml({
    title: layoutTitle,
    subtitle: BRAND_SUBTITLE,
    preheader: `${heading} · ${projectName}`,
    bodyHtml,
    footerText: footer,
    attachmentDescription: hasPdfAttachment ? attachDesc : undefined,
  });
}

function buildReportFiltersLine(
  locale: EmailLocale,
  parts: {
    status?: string | null;
    countryCode: string;
    hasClientFilter: boolean;
    hasSearch: boolean;
    hasSoldRange: boolean;
  }
): string {
  const { status, countryCode, hasClientFilter, hasSearch, hasSoldRange } = parts;
  if (locale === "es") {
    const bits: string[] = [];
    bits.push(status ? `Estado ${escapeHtml(status)}` : "Todos los estados");
    if (countryCode) bits.push(`País ${escapeHtml(countryCode)}`);
    if (hasClientFilter) bits.push("Filtro por cliente");
    if (hasSearch) bits.push("Búsqueda");
    if (hasSoldRange) bits.push("Rango de fechas de venta");
    return `Filtros aplicados: ${bits.join(", ")}.`;
  }
  const bits: string[] = [];
  bits.push(status ? `Status ${escapeHtml(status)}` : "All statuses");
  if (countryCode) bits.push(`Country ${escapeHtml(countryCode)}`);
  if (hasClientFilter) bits.push("Client filter");
  if (hasSearch) bits.push("Search");
  if (hasSoldRange) bits.push("Sold date range");
  return `Filters applied: ${bits.join(", ")}.`;
}

export function buildProjectsReportEmailHtml(
  locale: EmailLocale,
  opts: {
    rowCount: number;
    filterParts: {
      status?: string | null;
      countryCode: string;
      hasClientFilter: boolean;
      hasSearch: boolean;
      hasSoldRange: boolean;
    };
  }
): string {
  const { rowCount, filterParts } = opts;
  const rowLabel =
    locale === "es"
      ? rowCount === 1
        ? "1 fila"
        : `${rowCount} filas`
      : rowCount === 1
        ? "1 row"
        : `${rowCount} rows`;

  const intro =
    locale === "es"
      ? `Adjuntamos el informe de proyectos (${rowLabel}).`
      : `Please find the projects report attached (${rowLabel}).`;

  const filterLine = buildReportFiltersLine(locale, filterParts);
  const attach =
    locale === "es"
      ? "El informe está adjunto como archivo CSV."
      : "The report is attached as a CSV file.";
  const title = locale === "es" ? "Informe de proyectos" : "Projects Report";

  return buildVbtEmailHtml({
    title,
    subtitle: BRAND_SUBTITLE,
    preheader: intro,
    bodyHtml: `
    <p style="margin: 0 0 18px 0;">${escapeHtml(intro)}</p>
    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.55;">${filterLine}</p>
  `.trim(),
    attachmentDescription: attach,
  });
}

export function buildSignupRequestAdminEmailHtml(
  locale: EmailLocale,
  opts: {
    applicantName: string;
    applicantEmail: string;
    adminUsersUrl: string;
  }
): string {
  const { applicantName, applicantEmail, adminUsersUrl } = opts;
  if (locale === "es") {
    return buildVbtEmailHtml({
      title: "Nueva solicitud de cuenta",
      subtitle: BRAND_SUBTITLE,
      preheader: `${applicantName} · ${applicantEmail}`,
      bodyHtml: `
            <p style="margin: 0 0 18px 0;">Se recibió una nueva solicitud de acceso a la plataforma.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <tr><td style="padding: 14px 18px; background-color: #f9fafb; font-size: 13px; color: #6b7280; width: 32%; border-bottom: 1px solid #e5e7eb;">Nombre</td><td style="padding: 14px 18px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(applicantName)}</td></tr>
              <tr><td style="padding: 14px 18px; background-color: #f9fafb; font-size: 13px; color: #6b7280;">Email</td><td style="padding: 14px 18px; font-weight: 600; color: #374151;">${escapeHtml(applicantEmail)}</td></tr>
            </table>
            <p style="margin: 0;">${emailPrimaryButton(adminUsersUrl, "Revisar en panel de admin")}</p>
          `.trim(),
      footerText: "Este aviso fue enviado por el flujo de registro de Plataforma VBT.",
    });
  }

  return buildVbtEmailHtml({
    title: "New account request",
    subtitle: BRAND_SUBTITLE,
    preheader: `${applicantName} · ${applicantEmail}`,
    bodyHtml: `
            <p style="margin: 0 0 18px 0;">Someone requested access to the platform.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <tr><td style="padding: 14px 18px; background-color: #f9fafb; font-size: 13px; color: #6b7280; width: 32%; border-bottom: 1px solid #e5e7eb;">Name</td><td style="padding: 14px 18px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(applicantName)}</td></tr>
              <tr><td style="padding: 14px 18px; background-color: #f9fafb; font-size: 13px; color: #6b7280;">Email</td><td style="padding: 14px 18px; font-weight: 600; color: #374151;">${escapeHtml(applicantEmail)}</td></tr>
            </table>
            <p style="margin: 0;">${emailPrimaryButton(adminUsersUrl, "Review in admin panel")}</p>
          `.trim(),
    footerText: "This notification was sent by the VBT Platform signup flow.",
  });
}
