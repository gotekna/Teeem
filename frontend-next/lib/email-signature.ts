/**
 * Email Signature Generator
 * SSoT for generating branded email signatures from user data
 */

export interface SignatureUserData {
  name: string;
  email: string;
  mobile_phone?: string;
  job_title?: string;
}

export interface SignatureCompanyData {
  name?: string;       // Company name (used when no logo provided)
  logo_dark?: string;  // White/light logo for dark backgrounds
  logo_light?: string; // Dark/colored logo for light backgrounds
  address?: string;
  city_state?: string;
  website?: string;
  linkedin?: string;
  phone?: string;
  brand_color?: string;            // Primary brand color (hex)
  brand_color_foreground?: string; // Text color on brand background (hex)
}

// Default company details (fallback if not in company settings)
// These are used when company settings are not loaded or missing fields
const DEFAULT_COMPANY = {
  name: "Company",
  address: "",
  city_state: "",
  website: "",
  brand_color: "#1a3c34",
  brand_color_foreground: "#ffffff",
};

// ============================================================================
// Signature Styles Definition (SSoT)
// ============================================================================

export const SIGNATURE_STYLES = [
  {
    id: "modern-dark",
    name: "Modern Dark",
    description: "Dark teal branded box with white text",
  },
  {
    id: "modern-light",
    name: "Modern Light",
    description: "Light background with brand accent border",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Simple text with subtle separator",
  },
  {
    id: "classic",
    name: "Classic",
    description: "Traditional horizontal line separator",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Clean corporate card layout",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Bold gradient accent with modern typography",
  },
  {
    id: "compact",
    name: "Compact",
    description: "Single line, space-efficient format",
  },
  {
    id: "detailed",
    name: "Detailed",
    description: "Full contact information with structured layout",
  },
  {
    id: "social",
    name: "Social",
    description: "Includes LinkedIn profile link",
  },
  {
    id: "none",
    name: "No Signature",
    description: "Don't add automatic signature",
  },
] as const;

export type SignatureStyleId = (typeof SIGNATURE_STYLES)[number]["id"];

export const DEFAULT_SIGNATURE_STYLE: SignatureStyleId = "modern-dark";

// ============================================================================
// Signature Generators
// ============================================================================

/**
 * Generates HTML email signature based on the selected style
 */
export function generateSignatureByStyle(
  style: SignatureStyleId,
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  if (!user?.name || style === "none") return "";

  switch (style) {
    case "modern-dark":
      return generateModernDark(user, company);
    case "modern-light":
      return generateModernLight(user, company);
    case "minimal":
      return generateMinimal(user, company);
    case "classic":
      return generateClassic(user, company);
    case "professional":
      return generateProfessional(user, company);
    case "creative":
      return generateCreative(user, company);
    case "compact":
      return generateCompact(user, company);
    case "detailed":
      return generateDetailed(user, company);
    case "social":
      return generateSocial(user, company);
    default:
      return generateModernDark(user, company);
  }
}

/**
 * Original signature function - now wraps generateSignatureByStyle for backwards compatibility
 */
export function generateEmailSignature(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  return generateSignatureByStyle(DEFAULT_SIGNATURE_STYLE, user, company);
}

// ============================================================================
// Style 1: Modern Dark (Original/Default)
// Dark teal box with white text, logo right-aligned
// ============================================================================
function generateModernDark(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<tr><td style="color: white; font-size: 14px; padding-bottom: 12px;">${user.job_title}</td><td></td></tr>`
    : "";

  const mobileLine = user.mobile_phone ? `<br>${user.mobile_phone}` : "";

  const companyName = company?.name || DEFAULT_COMPANY.name;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;
  const logoHtml = company?.logo_dark
    ? `<img src="${company.logo_dark}" alt="${companyName}" style="height: 28px; width: auto;" />`
    : `<span style="color: white; font-weight: bold; font-size: 16px;">${companyName}</span>`;

  const address = company?.address || DEFAULT_COMPANY.address;
  const cityState = company?.city_state || DEFAULT_COMPANY.city_state;
  const website = company?.website || DEFAULT_COMPANY.website;

  return `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="background-color: ${brandColor}; border-radius: 4px; width: 400px; max-width: 100%; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 20px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="vertical-align: top; width: 60%;">
            <span style="color: white; font-weight: bold; font-size: 16px;">${user.name}</span>
          </td>
          <td style="vertical-align: top; text-align: right; width: 40%;">
            ${logoHtml}
          </td>
        </tr>
        ${jobTitleLine}
        <tr>
          <td colspan="2" style="color: white; font-size: 13px; padding-top: ${user.job_title ? "0" : "8px"};">
            ${user.email}${mobileLine}
          </td>
        </tr>
        <tr>
          <td style="color: white; font-size: 13px; padding-top: 12px;">
            ${address}<br>
            ${cityState}
          </td>
          <td style="color: white; font-size: 13px; padding-top: 12px; text-align: right; vertical-align: bottom;">
            ${website}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

// ============================================================================
// Style 2: Modern Light
// White/light gray box with dark text, colored accent bar on left
// ============================================================================
function generateModernLight(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<div style="color: #666666; font-size: 13px; margin-top: 2px;">${user.job_title}</div>`
    : "";

  const mobileLine = user.mobile_phone
    ? `<span style="color: #666666; margin-left: 12px;">${user.mobile_phone}</span>`
    : "";

  const companyName = company?.name || DEFAULT_COMPANY.name;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;
  const logoHtml = company?.logo_light
    ? `<img src="${company.logo_light}" alt="${companyName}" style="height: 24px; width: auto;" />`
    : `<span style="color: ${brandColor}; font-weight: bold; font-size: 14px;">${companyName}</span>`;

  const website = company?.website || DEFAULT_COMPANY.website;

  return `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 4px; width: 400px; max-width: 100%; font-family: Arial, sans-serif; border-left: 4px solid ${brandColor};">
  <tr>
    <td style="padding: 16px 20px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="vertical-align: top;">
            <div style="color: ${brandColor}; font-weight: bold; font-size: 15px;">${user.name}</div>
            ${jobTitleLine}
            <div style="margin-top: 10px;">
              <span style="color: ${brandColor}; font-size: 13px;">${user.email}</span>
              ${mobileLine}
            </div>
          </td>
          <td style="vertical-align: top; text-align: right; width: 100px;">
            ${logoHtml}
            <div style="color: #999999; font-size: 11px; margin-top: 8px;">${website}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

// ============================================================================
// Style 3: Minimal
// Just name, title, contact - no box, subtle styling
// ============================================================================
function generateMinimal(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<span style="color: #888888;">  •  ${user.job_title}</span>`
    : "";

  const mobileLine = user.mobile_phone
    ? ` | <span style="color: #333333;">${user.mobile_phone}</span>`
    : "";

  const website = company?.website || DEFAULT_COMPANY.website;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;

  return `
<br><br>
<div style="font-family: Arial, sans-serif; color: #333333; font-size: 13px; border-top: 1px solid #e0e0e0; padding-top: 12px; max-width: 400px;">
  <div style="font-weight: 600; color: ${brandColor};">${user.name}${jobTitleLine}</div>
  <div style="margin-top: 4px;">
    <span style="color: #333333;">${user.email}</span>${mobileLine}
  </div>
  <div style="margin-top: 4px; color: #888888; font-size: 12px;">${website}</div>
</div>
`.trim();
}

// ============================================================================
// Style 4: Classic
// Horizontal line separator, traditional email signature format
// ============================================================================
function generateClassic(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<div style="color: #666666; font-style: italic;">${user.job_title}</div>`
    : "";

  const contactLines = [user.email, user.mobile_phone]
    .filter(Boolean)
    .join(" | ");

  const address = company?.address || DEFAULT_COMPANY.address;
  const cityState = company?.city_state || DEFAULT_COMPANY.city_state;
  const website = company?.website || DEFAULT_COMPANY.website;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;

  return `
<br><br>
<div style="font-family: Georgia, serif; font-size: 13px; max-width: 400px;">
  <div style="border-bottom: 2px solid ${brandColor}; padding-bottom: 8px; margin-bottom: 8px;">
    <div style="font-weight: bold; color: ${brandColor}; font-size: 15px;">${user.name}</div>
    ${jobTitleLine}
  </div>
  <div style="color: #333333; line-height: 1.6;">
    <div>${contactLines}</div>
    <div style="margin-top: 4px;">${address}, ${cityState}</div>
    <div style="margin-top: 2px;"><a href="https://${website}" style="color: ${brandColor}; text-decoration: none;">${website}</a></div>
  </div>
</div>
`.trim();
}

// ============================================================================
// Style 5: Professional
// Clean gray box, structured layout with dividers
// ============================================================================
function generateProfessional(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<div style="color: #555555; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">${user.job_title}</div>`
    : "";

  const mobileLine = user.mobile_phone
    ? `<tr><td style="color: #666666; font-size: 12px; padding: 2px 0;"><strong>M:</strong> ${user.mobile_phone}</td></tr>`
    : "";

  const website = company?.website || DEFAULT_COMPANY.website;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;

  const companyName = company?.name || DEFAULT_COMPANY.name;
  const logoHtml = company?.logo_light
    ? `<img src="${company.logo_light}" alt="${companyName}" style="height: 32px; width: auto;" />`
    : `<span style="color: ${brandColor}; font-weight: bold; font-size: 16px;">${companyName}</span>`;

  return `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 4px; width: 400px; max-width: 100%; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 16px; border-right: 1px solid #e0e0e0;">
      <div style="font-weight: bold; color: ${brandColor}; font-size: 15px;">${user.name}</div>
      ${jobTitleLine}
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
        <tr><td style="color: #666666; font-size: 12px; padding: 2px 0;"><strong>E:</strong> ${user.email}</td></tr>
        ${mobileLine}
        <tr><td style="color: #666666; font-size: 12px; padding: 2px 0;"><strong>W:</strong> ${website}</td></tr>
      </table>
    </td>
    <td style="padding: 16px; text-align: center; vertical-align: middle; width: 100px;">
      ${logoHtml}
    </td>
  </tr>
</table>
`.trim();
}

// ============================================================================
// Style 6: Creative
// Gradient accent, bold typography, modern look
// ============================================================================
function generateCreative(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<div style="color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; opacity: 0.9;">${user.job_title}</div>`
    : "";

  const mobileLine = user.mobile_phone
    ? ` • ${user.mobile_phone}`
    : "";

  const website = company?.website || DEFAULT_COMPANY.website;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;

  return `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="width: 400px; max-width: 100%; font-family: Arial, sans-serif;">
  <tr>
    <td style="background-color: ${brandColor}; padding: 20px; border-radius: 8px 8px 0 0;">
      <div style="color: #ffffff; font-weight: bold; font-size: 18px; letter-spacing: 0.5px;">${user.name}</div>
      ${jobTitleLine}
    </td>
  </tr>
  <tr>
    <td style="background-color: #f8f9fa; padding: 14px 20px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
      <div style="font-size: 13px; color: #333333;">
        ${user.email}${mobileLine}
      </div>
      <div style="font-size: 12px; color: ${brandColor}; margin-top: 6px; font-weight: 600;">${website}</div>
    </td>
  </tr>
</table>
`.trim();
}

// ============================================================================
// Style 7: Compact
// Single-line format: Name | Title | Phone | Email
// ============================================================================
function generateCompact(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;
  const parts = [
    `<strong style="color: ${brandColor};">${user.name}</strong>`,
    user.job_title ? `<span style="color: #666666;">${user.job_title}</span>` : null,
    user.mobile_phone ? `<span style="color: #333333;">${user.mobile_phone}</span>` : null,
    `<span style="color: #333333;">${user.email}</span>`,
  ].filter(Boolean);

  const website = company?.website || DEFAULT_COMPANY.website;

  return `
<br><br>
<div style="font-family: Arial, sans-serif; font-size: 12px; border-top: 1px solid ${brandColor}; padding-top: 8px; max-width: 500px;">
  <div>${parts.join(' <span style="color: #cccccc;">|</span> ')}</div>
  <div style="color: #888888; font-size: 11px; margin-top: 4px;">${website}</div>
</div>
`.trim();
}

// ============================================================================
// Style 8: Detailed
// Full info card with all contact methods structured layout
// ============================================================================
function generateDetailed(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<div style="color: #666666; font-size: 13px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 10px;">${user.job_title}</div>`
    : "";

  const mobileRow = user.mobile_phone
    ? `<tr>
        <td style="color: #888888; font-size: 12px; padding: 3px 10px 3px 0; vertical-align: top;">Mobile</td>
        <td style="color: #333333; font-size: 12px; padding: 3px 0;">${user.mobile_phone}</td>
      </tr>`
    : "";

  const address = company?.address || DEFAULT_COMPANY.address;
  const cityState = company?.city_state || DEFAULT_COMPANY.city_state;
  const website = company?.website || DEFAULT_COMPANY.website;
  const phone = company?.phone;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;

  const phoneRow = phone
    ? `<tr>
        <td style="color: #888888; font-size: 12px; padding: 3px 10px 3px 0; vertical-align: top;">Office</td>
        <td style="color: #333333; font-size: 12px; padding: 3px 0;">${phone}</td>
      </tr>`
    : "";

  const companyName = company?.name || DEFAULT_COMPANY.name;
  const logoHtml = company?.logo_light
    ? `<img src="${company.logo_light}" alt="${companyName}" style="height: 40px; width: auto;" />`
    : `<span style="color: ${brandColor}; font-weight: bold; font-size: 18px;">${companyName}</span>`;

  return `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 6px; width: 420px; max-width: 100%; font-family: Arial, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
  <tr>
    <td style="padding: 16px;">
      <div style="font-weight: bold; color: ${brandColor}; font-size: 16px; margin-bottom: 4px;">${user.name}</div>
      ${jobTitleLine}
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="color: #888888; font-size: 12px; padding: 3px 10px 3px 0; vertical-align: top;">Email</td>
          <td style="color: #333333; font-size: 12px; padding: 3px 0;">${user.email}</td>
        </tr>
        ${mobileRow}
        ${phoneRow}
        <tr>
          <td style="color: #888888; font-size: 12px; padding: 3px 10px 3px 0; vertical-align: top;">Address</td>
          <td style="color: #333333; font-size: 12px; padding: 3px 0;">${address}<br>${cityState}</td>
        </tr>
        <tr>
          <td style="color: #888888; font-size: 12px; padding: 3px 10px 3px 0; vertical-align: top;">Web</td>
          <td style="color: #333333; font-size: 12px; padding: 3px 0;"><a href="https://${website}" style="color: ${brandColor}; text-decoration: none;">${website}</a></td>
        </tr>
      </table>
    </td>
    <td style="padding: 16px; text-align: right; vertical-align: top; border-left: 1px solid #f0f0f0;">
      ${logoHtml}
    </td>
  </tr>
</table>
`.trim();
}

// ============================================================================
// Style 9: Social
// Includes LinkedIn link with icon
// ============================================================================
function generateSocial(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  const jobTitleLine = user.job_title
    ? `<div style="color: #666666; font-size: 13px; margin-top: 2px;">${user.job_title}</div>`
    : "";

  const mobileLine = user.mobile_phone
    ? `<div style="color: #333333; font-size: 13px;">${user.mobile_phone}</div>`
    : "";

  const website = company?.website || DEFAULT_COMPANY.website;
  const linkedin = company?.linkedin;

  const linkedinHtml = linkedin
    ? `<a href="${linkedin}" style="display: inline-block; margin-top: 10px; color: #0a66c2; text-decoration: none; font-size: 12px;">
        <span style="display: inline-block; width: 16px; height: 16px; background-color: #0a66c2; color: white; border-radius: 3px; text-align: center; line-height: 16px; font-weight: bold; font-size: 11px; margin-right: 6px;">in</span>
        Connect on LinkedIn
      </a>`
    : "";

  const companyName = company?.name || DEFAULT_COMPANY.name;
  const brandColor = company?.brand_color || DEFAULT_COMPANY.brand_color;
  const logoHtml = company?.logo_light
    ? `<img src="${company.logo_light}" alt="${companyName}" style="height: 28px; width: auto;" />`
    : `<span style="color: ${brandColor}; font-weight: bold; font-size: 14px;">${companyName}</span>`;

  return `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="width: 400px; max-width: 100%; font-family: Arial, sans-serif;">
  <tr>
    <td style="border-left: 3px solid ${brandColor}; padding-left: 14px;">
      <div style="font-weight: bold; color: ${brandColor}; font-size: 15px;">${user.name}</div>
      ${jobTitleLine}
      <div style="margin-top: 8px;">
        <div style="color: #333333; font-size: 13px;">${user.email}</div>
        ${mobileLine}
      </div>
      ${linkedinHtml}
    </td>
    <td style="text-align: right; vertical-align: top; padding-left: 20px;">
      ${logoHtml}
      <div style="color: #888888; font-size: 11px; margin-top: 6px;">${website}</div>
    </td>
  </tr>
</table>
`.trim();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if body already contains a signature (any style)
 * Uses structural markers that work regardless of brand color
 */
export function hasSignature(body: string): boolean {
  // Check for various signature structural indicators (color-agnostic)
  return (
    body.includes('border-radius: 4px; width: 400px') || // Modern dark/light table
    body.includes('border-radius: 6px; width: 420px') || // Detailed table
    body.includes('border-radius: 8px 8px 0 0') || // Creative top header
    body.includes('border-left: 4px solid') || // Modern light accent
    body.includes('border-left: 3px solid') || // Social accent
    body.includes('font-family: Georgia, serif') || // Classic serif font
    body.includes('border-top: 1px solid') || // Compact/Minimal separator
    body.includes("--<br>") // Traditional text signature marker
  );
}

/**
 * Get signature style details by ID
 */
export function getSignatureStyleById(styleId: SignatureStyleId) {
  return SIGNATURE_STYLES.find((s) => s.id === styleId) || SIGNATURE_STYLES[0];
}
