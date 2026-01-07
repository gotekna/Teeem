/**
 * Email Signature Generator
 * SSoT for generating branded email signatures from user data
 */

interface SignatureUserData {
  name: string;
  email: string;
  mobile_phone?: string;
  job_title?: string;
}

interface SignatureCompanyData {
  logo_dark?: string;  // White/light logo for dark backgrounds
  address?: string;
  city_state?: string;
  website?: string;
}

// Default company details (fallback if not in settings)
const DEFAULT_COMPANY = {
  address: "160 Alperton Road",
  city_state: "Burbank QLD 4156",
  website: "tekna.com.au",
};

/**
 * Generates HTML email signature matching Tekna branding
 * Adapts if job_title is not set (hides that line)
 * Uses logo_dark from company settings if available
 */
export function generateEmailSignature(
  user: SignatureUserData,
  company?: SignatureCompanyData
): string {
  if (!user?.name) return "";

  const jobTitleLine = user.job_title
    ? `<tr><td style="color: white; font-size: 14px; padding-bottom: 12px;">${user.job_title}</td><td></td></tr>`
    : "";

  const mobileLine = user.mobile_phone
    ? `<br>${user.mobile_phone}`
    : "";

  // Use logo_dark from company settings, or fallback to text
  const logoHtml = company?.logo_dark
    ? `<img src="${company.logo_dark}" alt="TEKNA" style="height: 28px; width: auto;" />`
    : `<span style="color: white; font-weight: bold; font-size: 18px; letter-spacing: 2px;">▸ TEKNA</span>`;

  const address = company?.address || DEFAULT_COMPANY.address;
  const cityState = company?.city_state || DEFAULT_COMPANY.city_state;
  const website = company?.website || DEFAULT_COMPANY.website;

  return `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="background-color: #1a3c34; border-radius: 4px; width: 400px; max-width: 100%; font-family: Arial, sans-serif;">
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
          <td colspan="2" style="color: white; font-size: 13px; padding-top: ${user.job_title ? '0' : '8px'};">
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

/**
 * Check if body already contains a signature
 */
export function hasSignature(body: string): boolean {
  return body.includes('background-color: #1a3c34') || body.includes('--<br>');
}
