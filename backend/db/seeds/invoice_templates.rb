# frozen_string_literal: true

# Seed default invoice templates
puts "Seeding Invoice Templates..."

# Default Progress Claim Invoice Template
InvoiceTemplate.find_or_create_by!(name: "Progress Claim Invoice") do |template|
  template.description = "Standard progress claim invoice for construction jobs"
  template.is_active = true
  template.is_default = true

  # Branding (can be customized per company)
  template.primary_color = "#1f2937"  # Gray-800
  template.accent_color = "#4f46e5"   # Indigo-600
  template.font_family = "Inter, sans-serif"

  # Layout
  template.paper_size = "A4"
  template.orientation = "portrait"
  template.margins = { top: 25, right: 20, bottom: 25, left: 20 }

  # Output naming
  template.output_naming_pattern = "Invoice_{invoice_number}_{date}"

  # Default terms and notes
  template.default_terms = <<~TERMS
    Payment Terms: 14 days from invoice date
    All work carried out in accordance with the contract
    Prices include GST unless otherwise stated
  TERMS

  template.default_notes = "Thank you for your business"

  template.footer_text = "ABN: [Your ABN] | License: [Your License Number]"

  # Bank details (to be customized)
  template.bank_name = "Commonwealth Bank"
  template.bank_bsb = "064-000"
  template.bank_account_number = "12345678"
  template.bank_account_name = "Your Company Pty Ltd"

  # Sections structure
  template.sections = [
    {
      "type" => "header",
      "visible" => true,
      "order" => 0,
      "content" => {
        "show_logo" => true,
        "logo_position" => "left",
        "logo_max_height" => 80,
        "show_company_name" => true,
        "show_company_address" => true,
        "show_company_abn" => true,
        "show_invoice_number" => true,
        "show_invoice_date" => true,
        "show_due_date" => true,
        "title" => "TAX INVOICE",
        "title_style" => "uppercase"
      }
    },
    {
      "type" => "client",
      "visible" => true,
      "order" => 1,
      "content" => {
        "label" => "Bill To",
        "show_company" => true,
        "show_name" => true,
        "show_address" => true,
        "show_email" => false,
        "show_phone" => false,
        "show_abn" => false
      }
    },
    {
      "type" => "job",
      "visible" => true,
      "order" => 2,
      "content" => {
        "label" => "Job Reference",
        "show_job_number" => true,
        "show_job_name" => true,
        "show_job_address" => true,
        "show_contract_value" => true,
        "show_claim_stage" => true
      }
    },
    {
      "type" => "line_items",
      "visible" => true,
      "order" => 3,
      "content" => {
        "columns" => ["description", "quantity", "unit_price", "amount"],
        "column_labels" => {
          "description" => "Description",
          "quantity" => "Qty",
          "unit_price" => "Unit Price",
          "amount" => "Amount"
        },
        "column_widths" => {
          "description" => "50%",
          "quantity" => "10%",
          "unit_price" => "20%",
          "amount" => "20%"
        },
        "show_headers" => true,
        "alternate_rows" => true,
        "row_bg_even" => "#f9fafb",
        "row_bg_odd" => "#ffffff"
      }
    },
    {
      "type" => "totals",
      "visible" => true,
      "order" => 4,
      "content" => {
        "show_subtotal" => true,
        "show_tax" => true,
        "show_total" => true,
        "show_amount_paid" => true,
        "show_amount_due" => true,
        "subtotal_label" => "Subtotal",
        "tax_label" => "GST (10%)",
        "total_label" => "Total (inc GST)",
        "paid_label" => "Amount Paid",
        "due_label" => "Amount Due",
        "currency_symbol" => "$",
        "highlight_due" => true
      }
    },
    {
      "type" => "payment",
      "visible" => true,
      "order" => 5,
      "content" => {
        "label" => "Payment Details",
        "show_bank_details" => true,
        "show_payment_reference" => true,
        "payment_reference_note" => "Please use invoice number as payment reference",
        "show_payment_terms" => true
      }
    },
    {
      "type" => "footer",
      "visible" => true,
      "order" => 6,
      "content" => {
        "show_terms" => true,
        "show_notes" => true,
        "show_footer_text" => true,
        "terms_label" => "Terms & Conditions",
        "notes_label" => "Notes"
      }
    }
  ]
end

# Simple Invoice Template (minimal)
InvoiceTemplate.find_or_create_by!(name: "Simple Invoice") do |template|
  template.description = "Minimal invoice template with essential information only"
  template.is_active = true
  template.is_default = false

  template.primary_color = "#374151"
  template.accent_color = "#059669"
  template.font_family = "system-ui, sans-serif"

  template.paper_size = "A4"
  template.orientation = "portrait"
  template.margins = { top: 20, right: 20, bottom: 20, left: 20 }

  template.output_naming_pattern = "{invoice_number}"

  template.default_terms = "Payment due within 14 days"
  template.footer_text = nil

  template.sections = [
    {
      "type" => "header",
      "visible" => true,
      "order" => 0,
      "content" => {
        "show_logo" => true,
        "show_company_name" => true,
        "show_company_address" => false,
        "show_invoice_number" => true,
        "show_invoice_date" => true,
        "show_due_date" => true,
        "title" => "INVOICE"
      }
    },
    {
      "type" => "client",
      "visible" => true,
      "order" => 1,
      "content" => {
        "label" => "To",
        "show_company" => true,
        "show_name" => true,
        "show_address" => false
      }
    },
    {
      "type" => "job",
      "visible" => false,
      "order" => 2,
      "content" => {}
    },
    {
      "type" => "line_items",
      "visible" => true,
      "order" => 3,
      "content" => {
        "columns" => ["description", "amount"],
        "show_headers" => true,
        "alternate_rows" => false
      }
    },
    {
      "type" => "totals",
      "visible" => true,
      "order" => 4,
      "content" => {
        "show_subtotal" => false,
        "show_tax" => true,
        "show_total" => true,
        "show_amount_due" => true
      }
    },
    {
      "type" => "payment",
      "visible" => true,
      "order" => 5,
      "content" => {
        "show_bank_details" => true,
        "show_payment_reference" => false
      }
    },
    {
      "type" => "footer",
      "visible" => false,
      "order" => 6,
      "content" => {}
    }
  ]
end

puts "Invoice Templates seeded: #{InvoiceTemplate.count} templates"
