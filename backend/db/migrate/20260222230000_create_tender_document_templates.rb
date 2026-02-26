# frozen_string_literal: true

class CreateTenderDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :tender_document_templates do |t|
      t.bigint :tenant_id, null: false
      t.string :name, null: false
      t.text :cover_letter_html
      t.text :terms_and_conditions_html
      t.text :base_specification_html
      t.text :acceptance_page_html
      t.text :notes_html
      t.integer :validity_days, default: 30
      t.boolean :is_default, default: true
      t.boolean :is_active, default: true
      t.timestamps
    end

    add_index :tender_document_templates, :tenant_id
  end
end
