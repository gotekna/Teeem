# frozen_string_literal: true

class AddCompactAndConstructionClaimInvoiceTemplates < ActiveRecord::Migration[8.0]
  def up
    # Add compact and construction templates for all tenants that have existing claim_invoice_templates
    tenant_ids = execute("SELECT DISTINCT tenant_id FROM claim_invoice_templates").values.flatten

    tenant_ids.each do |tenant_id|
      # Only add if not already present
      compact_exists = execute("SELECT 1 FROM claim_invoice_templates WHERE tenant_id = #{tenant_id} AND style_key = 'compact' LIMIT 1").any?
      unless compact_exists
        execute <<~SQL
          INSERT INTO claim_invoice_templates (name, description, style_key, is_default, is_active, primary_color, secondary_color, font_family, show_logo, show_company_details, show_bank_details, show_payment_terms, logo_position, header_style, tenant_id, created_at, updated_at)
          VALUES ('Compact Efficient', 'Tight layout with small fonts. Maximises information density for quick review.', 'compact', false, true, '#1e40af', '#64748b', 'Inter', true, true, true, true, 'left', 'standard', #{tenant_id}, NOW(), NOW())
        SQL
      end

      construction_exists = execute("SELECT 1 FROM claim_invoice_templates WHERE tenant_id = #{tenant_id} AND style_key = 'construction' LIMIT 1").any?
      unless construction_exists
        execute <<~SQL
          INSERT INTO claim_invoice_templates (name, description, style_key, is_default, is_active, primary_color, secondary_color, font_family, show_logo, show_company_details, show_bank_details, show_payment_terms, logo_position, header_style, tenant_id, created_at, updated_at)
          VALUES ('Construction Industry', 'Prominent project details and site information. Yellow safety accent with contract progress tracking.', 'construction', false, true, '#1e3a5f', '#64748b', 'Inter', true, true, true, true, 'left', 'standard', #{tenant_id}, NOW(), NOW())
        SQL
      end
    end
  end

  def down
    execute("DELETE FROM claim_invoice_templates WHERE style_key IN ('compact', 'construction')")
  end
end
