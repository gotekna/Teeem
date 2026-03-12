class AddNewClaimInvoiceTemplates < ActiveRecord::Migration[8.0]
  def up
    # Add 3 new invoice template styles for each tenant that has existing templates
    tenants_with_templates = ClaimInvoiceTemplate.distinct.pluck(:tenant_id)

    tenants_with_templates.each do |tenant_id|
      [
        {
          name: "Executive Dark",
          description: "Premium dark charcoal header with gold accents. Clean two-column layout. High-end look for luxury builds.",
          style_key: "executive",
          is_default: false,
          is_active: true,
          primary_color: "#c9a84c",
          secondary_color: "#6b7280",
          font_family: "Georgia",
          logo_position: "left",
          header_style: "standard",
          show_logo: true,
          show_company_details: true,
          show_bank_details: true,
          tenant_id: tenant_id
        },
        {
          name: "Skyline Gradient",
          description: "Bold gradient header with decorative circles. Progress bar showing contract completion. Modern and vibrant.",
          style_key: "skyline",
          is_default: false,
          is_active: true,
          primary_color: "#0ea5e9",
          secondary_color: "#6366f1",
          font_family: "Inter",
          logo_position: "left",
          header_style: "banner",
          show_logo: true,
          show_company_details: true,
          show_bank_details: true,
          tenant_id: tenant_id
        },
        {
          name: "Tradesman Receipt",
          description: "Narrow receipt-style with monospace font. Clear and no-nonsense. Perfect for trades and subcontractors.",
          style_key: "receipt",
          is_default: false,
          is_active: true,
          primary_color: "#16a34a",
          secondary_color: "#6b7280",
          font_family: "Courier New",
          logo_position: "center",
          header_style: "minimal",
          show_logo: true,
          show_company_details: true,
          show_bank_details: true,
          tenant_id: tenant_id
        }
      ].each do |attrs|
        ClaimInvoiceTemplate.find_or_create_by!(
          style_key: attrs[:style_key],
          tenant_id: attrs[:tenant_id]
        ) do |t|
          t.assign_attributes(attrs)
        end
      end
    end
  end

  def down
    ClaimInvoiceTemplate.where(style_key: %w[executive skyline receipt]).destroy_all
  end
end
