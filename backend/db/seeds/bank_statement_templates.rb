# frozen_string_literal: true

# Bank Statement Templates - SSoT for PDF statement generation branding
#
# These templates define the visual styling for bank statements generated from Xero data.
# Colors and formats were researched from official bank sources (Dec 2024).
#
# Reference images are stored in SharePoint: Templates/Bank Statements/
# Use the format "Templates/Bank Statements/filename.pdf" for reference_image_path
#
# Sources:
# - NAB: https://bankstatementconverter.com/blog/posts/2021-09-24-nab-bank-statement-review/
# - Westpac: https://gel.westpacgroup.com.au/design-system/wbc/foundation/colour
# - CommBank: https://www.edigitalagency.com.au/logos/new-commonwealth-bank-logo-png/
# - ANZ: https://www.anz.com.au/business/accounts/transaction-accounts/your-statement/
# - BOQ: https://www.boq.com.au/personal/online-banking/estatements
# - Stripe: https://www.brandcolorcode.com/stripe

puts "Seeding Bank Statement Templates..."

templates = [
  {
    bank_code: "nab",
    bank_name: "NAB",
    primary_color: "C20000",      # Official Guardsman Red
    secondary_color: "000000",
    text_on_primary: "FFFFFF",
    account_type: "Business Everyday Account",
    date_format: "%-d %b %Y",     # "5 Jun 2024" - NAB style
    detection_patterns: ["nab", "national australia"],
    layout_style: "nab",
    reference_image_path: "Templates/Bank Statements/NAB.pdf",
    is_active: true
  },
  {
    bank_code: "westpac",
    bank_name: "Westpac",
    primary_color: "DA1710",      # Official GEL Design System red
    secondary_color: "1F1F1F",
    text_on_primary: "FFFFFF",
    account_type: "Westpac Business One",
    date_format: "%d/%m/%y",      # "05/06/24" - Westpac style
    detection_patterns: ["westpac"],
    layout_style: "westpac",
    reference_image_path: "Templates/Bank Statements/Westpac.pdf",
    is_active: true
  },
  {
    bank_code: "boq",
    bank_name: "Bank of Queensland",
    primary_color: "1B75BC",      # Official BOQ Denim Blue (from Brandfetch)
    secondary_color: "FEBD36",    # Official BOQ Sunglow Gold (from Brandfetch)
    text_on_primary: "FFFFFF",
    account_type: "Business Statement",
    date_format: "%d/%m/%Y",      # "05/06/2024" - BOQ style with full year
    detection_patterns: ["boq", "bank of queensland", "queensland"],
    layout_style: "boq",
    reference_image_path: "Templates/Bank Statements/BOQ.pdf",
    is_active: true
  },
  {
    bank_code: "commbank",
    bank_name: "Commonwealth Bank",
    primary_color: "FFCC00",      # Official CommBank Yellow
    secondary_color: "000000",
    text_on_primary: "000000",    # Black text on yellow
    account_type: "Business Account",
    date_format: "%d %b %Y",      # "05 Jun 2024" - CBA style
    detection_patterns: ["comm", "cba", "commonwealth"],
    layout_style: "commbank",
    reference_image_path: nil,    # Need CommBank reference
    is_active: true
  },
  {
    bank_code: "anz",
    bank_name: "ANZ",
    primary_color: "007DBA",      # Official Ocean Blue
    secondary_color: "000000",
    text_on_primary: "FFFFFF",
    account_type: "Business Account",
    date_format: "%d %b %Y",      # "05 Jun 2024" - ANZ style
    detection_patterns: ["anz"],
    layout_style: "anz",
    reference_image_path: nil,    # Need ANZ reference
    is_active: true
  },
  {
    bank_code: "stripe",
    bank_name: "Stripe",
    primary_color: "635BFF",      # Official Stripe Purple
    secondary_color: "0A2540",    # Official Downriver (dark blue)
    text_on_primary: "FFFFFF",
    account_type: "Payment Account",
    date_format: "%d %b %Y",      # "05 Jun 2024"
    detection_patterns: ["stripe"],
    layout_style: "default",      # Uses TEEEM layout with Stripe colors
    reference_image_path: nil,    # Uses TEEEM layout - no external reference
    is_active: true
  },
  {
    bank_code: "default",
    bank_name: "TEEEM",
    primary_color: "000000",      # TEEEM brand primary = black
    secondary_color: "0064D9",    # TEEEM brand accent blue
    text_on_primary: "FFFFFF",
    account_type: "Account",
    date_format: "%-d %b %Y",     # "5 Jun 2024"
    detection_patterns: [],        # Fallback - matches nothing
    layout_style: "default",
    reference_image_path: nil,    # Internal TEEEM brand - no external reference
    is_active: true
  }
]

created_count = 0
updated_count = 0

templates.each do |attrs|
  template = BankStatementTemplate.find_by(bank_code: attrs[:bank_code])

  if template
    template.update!(attrs)
    updated_count += 1
    puts "  Updated: #{attrs[:bank_name]} (#{attrs[:bank_code]})"
  else
    BankStatementTemplate.create!(attrs)
    created_count += 1
    puts "  Created: #{attrs[:bank_name]} (#{attrs[:bank_code]})"
  end
end

puts "Bank Statement Templates: #{created_count} created, #{updated_count} updated"
