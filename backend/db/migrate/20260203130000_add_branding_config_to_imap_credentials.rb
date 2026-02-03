# Per-mailbox branding configuration (Feb 2026)
# SSoT: Each email account can have its own company branding for signatures
#
# Structure:
# {
#   "use_default": true,           # true = use company settings, false = use custom
#   "company_name": "TEEEM",       # Company name for signature
#   "logo_url": "https://...",     # Light logo (for light backgrounds)
#   "logo_dark": "https://...",    # Dark logo (for dark backgrounds)
#   "address": "160 Alperton Road",
#   "city_state": "Burbank QLD 4156",
#   "website": "https://teeem.au",
#   "brand_color": "#1a3c34",      # Primary brand color (hex)
#   "brand_color_foreground": "#ffffff" # Text color on brand (hex)
# }
#
# For MS365 mailboxes, branding is stored in:
# microsoft_credentials.sync_config["mailbox_branding"][email] = { same structure }
class AddBrandingConfigToImapCredentials < ActiveRecord::Migration[7.0]
  def change
    add_column :imap_credentials, :branding_config, :jsonb, default: { use_default: true }
  end
end
