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

// Company details (could be moved to environment variables or settings)
const COMPANY_ADDRESS = "160 Alperton Road";
const COMPANY_CITY_STATE = "Burbank QLD 4156";
const COMPANY_WEBSITE = "tekna.com.au";

// Tekna logo as inline SVG data URI (white on transparent)
const TEKNA_LOGO_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 30'%3E%3Cpath fill='white' d='M0 8h6v2H4v15H2V10H0V8zm10 0h8v2h-6v5h5v2h-5v6h6v2h-8V8zm12 0h2v6l5-6h3l-5 6 6 11h-3l-4-8-2 2v6h-2V8zm12 0h2l5 11V8h2v17h-2l-5-11v11h-2V8zm14 0h4c3 0 5 2 5 5v7c0 3-2 5-5 5h-4V8zm2 2v13h2c2 0 3-1 3-3v-7c0-2-1-3-3-3h-2zm18-2h2l4 17h-2l-1-4h-4l-1 4h-2l4-17zm1 3l-1.5 8h3l-1.5-8z'/%3E%3Cpath fill='white' d='M95 4l8 11h-6l-5-7-5 7h-6l8-11z'/%3E%3C/svg%3E`;

/**
 * Generates HTML email signature matching Tekna branding
 * Adapts if job_title is not set (hides that line)
 */
export function generateEmailSignature(user: SignatureUserData): string {
  if (!user?.name) return "";

  const jobTitleLine = user.job_title
    ? `<tr><td style="color: white; font-size: 14px; padding-bottom: 12px;">${user.job_title}</td><td></td></tr>`
    : "";

  const mobileLine = user.mobile_phone
    ? `<br>${user.mobile_phone}`
    : "";

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
            <span style="color: white; font-weight: bold; font-size: 18px; letter-spacing: 2px;">▸ TEKNA</span>
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
            ${COMPANY_ADDRESS}<br>
            ${COMPANY_CITY_STATE}
          </td>
          <td style="color: white; font-size: 13px; padding-top: 12px; text-align: right; vertical-align: bottom;">
            ${COMPANY_WEBSITE}
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
