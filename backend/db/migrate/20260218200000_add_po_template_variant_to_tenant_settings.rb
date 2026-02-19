# frozen_string_literal: true

class AddPoTemplateVariantToTenantSettings < ActiveRecord::Migration[7.2]
  def change
    add_column :tenant_settings, :po_template_variant, :string, default: "classic", comment: "PO visual design variant (classic, modern, bold, compact, professional, construction, custom)"
    add_column :tenant_settings, :po_custom_template, :text, comment: "Custom HTML template for PO (used when po_template_variant is 'custom')"
  end
end
