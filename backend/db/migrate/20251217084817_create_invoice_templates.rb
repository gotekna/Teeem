# frozen_string_literal: true

class CreateInvoiceTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :invoice_templates do |t|
      t.string :name, null: false
      t.text :description

      # Template structure - JSONB sections array
      # Each section: { type: "header"|"line_items"|"totals"|"payment"|"footer"|"custom",
      #                 content: {...}, visible: true, order: 0 }
      t.jsonb :sections, default: []

      # Branding
      t.string :logo_url
      t.string :primary_color, default: "#1f2937"
      t.string :accent_color, default: "#4f46e5"
      t.string :font_family, default: "Inter, sans-serif"

      # Layout
      t.string :paper_size, default: "A4"
      t.string :orientation, default: "portrait"
      t.jsonb :margins, default: { top: 20, right: 20, bottom: 20, left: 20 }

      # Output
      t.string :output_naming_pattern, default: "{invoice_number}_{date}"

      # Status
      t.boolean :is_active, default: true, null: false
      t.boolean :is_default, default: false, null: false

      # Footer/terms
      t.text :default_terms
      t.text :default_notes
      t.text :footer_text

      # Bank details for payment
      t.string :bank_name
      t.string :bank_bsb
      t.string :bank_account_number
      t.string :bank_account_name

      t.timestamps
    end

    add_index :invoice_templates, :is_active
    add_index :invoice_templates, :is_default
  end
end
