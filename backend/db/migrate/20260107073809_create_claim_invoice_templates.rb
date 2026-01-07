# frozen_string_literal: true

class CreateClaimInvoiceTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :claim_invoice_templates do |t|
      t.string :name, null: false
      t.string :description
      t.string :style_key, null: false  # 'classic', 'modern', 'bold', 'minimal'
      t.boolean :is_default, default: false
      t.boolean :is_active, default: true

      # Template configuration
      t.string :primary_color, default: '#1e40af'      # Header/accent color
      t.string :secondary_color, default: '#64748b'    # Secondary text color
      t.string :font_family, default: 'Inter'          # Font family
      t.boolean :show_logo, default: true
      t.boolean :show_company_details, default: true
      t.boolean :show_bank_details, default: true
      t.boolean :show_payment_terms, default: true
      t.string :logo_position, default: 'left'         # 'left', 'center', 'right'
      t.string :header_style, default: 'standard'      # 'standard', 'banner', 'minimal'

      # Custom content
      t.text :header_text                              # Custom header/tagline
      t.text :footer_text                              # Terms, notes, etc.
      t.text :payment_instructions                     # Bank details, payment methods

      t.timestamps
    end

    add_index :claim_invoice_templates, :style_key
    add_index :claim_invoice_templates, :is_default, where: "is_default = true"

    # Add reference to sm_schedule_masters
    add_reference :sm_schedule_masters, :claim_invoice_template, foreign_key: { to_table: :claim_invoice_templates }, null: true
  end
end
