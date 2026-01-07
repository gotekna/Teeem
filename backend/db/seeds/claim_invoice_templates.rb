# frozen_string_literal: true

# Seed default claim invoice templates
# Run with: rails db:seed:claim_invoice_templates
# Or: rails runner "load 'db/seeds/claim_invoice_templates.rb'"

puts "Seeding Claim Invoice Templates..."

templates = [
  {
    name: "Classic Professional",
    description: "Traditional business invoice with clean layout. Logo on left, company details prominent.",
    style_key: "classic",
    is_default: true,
    primary_color: "#1e40af",      # Blue
    secondary_color: "#64748b",    # Slate gray
    font_family: "Inter",
    logo_position: "left",
    header_style: "standard",
    show_logo: true,
    show_company_details: true,
    show_bank_details: true,
    show_payment_terms: true,
    footer_text: "Thank you for your business. Payment is due within 14 days of invoice date."
  },
  {
    name: "Modern Minimal",
    description: "Clean, contemporary design with lots of white space. Centered logo, subtle accents.",
    style_key: "modern",
    is_default: false,
    primary_color: "#0f172a",      # Dark slate
    secondary_color: "#94a3b8",    # Light slate
    font_family: "Inter",
    logo_position: "center",
    header_style: "minimal",
    show_logo: true,
    show_company_details: true,
    show_bank_details: true,
    show_payment_terms: true,
    footer_text: "Payment due within 14 days."
  },
  {
    name: "Bold Corporate",
    description: "Strong visual impact with colored header banner. Great for making statements.",
    style_key: "bold",
    is_default: false,
    primary_color: "#dc2626",      # Red
    secondary_color: "#1f2937",    # Dark gray
    font_family: "Inter",
    logo_position: "left",
    header_style: "banner",
    show_logo: true,
    show_company_details: true,
    show_bank_details: true,
    show_payment_terms: true,
    footer_text: "Progress claim for construction works as per contract."
  },
  {
    name: "Elegant Navy",
    description: "Sophisticated navy blue theme with gold accents. Professional and refined.",
    style_key: "classic",
    is_default: false,
    primary_color: "#1e3a5f",      # Navy
    secondary_color: "#b8860b",    # Gold
    font_family: "Inter",
    logo_position: "right",
    header_style: "standard",
    show_logo: true,
    show_company_details: true,
    show_bank_details: true,
    show_payment_terms: true,
    footer_text: "Thank you for choosing us for your construction project."
  },
  {
    name: "Simple & Clean",
    description: "No-frills invoice focusing on the essentials. Fast to read, easy to process.",
    style_key: "minimal",
    is_default: false,
    primary_color: "#374151",      # Gray
    secondary_color: "#9ca3af",    # Light gray
    font_family: "Inter",
    logo_position: "left",
    header_style: "minimal",
    show_logo: true,
    show_company_details: false,   # Minimal - hide extra details
    show_bank_details: true,
    show_payment_terms: false,
    footer_text: nil
  }
]

templates.each do |template_data|
  template = ClaimInvoiceTemplate.find_or_initialize_by(name: template_data[:name])
  template.assign_attributes(template_data)

  if template.save
    puts "  ✓ #{template.name} (#{template.style_key})"
  else
    puts "  ✗ #{template.name}: #{template.errors.full_messages.join(', ')}"
  end
end

puts "Done! Created #{ClaimInvoiceTemplate.count} templates."
