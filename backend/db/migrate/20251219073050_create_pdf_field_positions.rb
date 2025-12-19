class CreatePdfFieldPositions < ActiveRecord::Migration[8.0]
  def change
    create_table :pdf_field_positions do |t|
      t.string :pdf_template_key, null: false
      t.string :field_key, null: false
      t.string :display_name
      t.integer :page, default: 1
      t.decimal :x, precision: 10, scale: 2
      t.decimal :y, precision: 10, scale: 2
      t.integer :font_size, default: 10
      t.string :test_value
      t.boolean :active, default: true

      t.timestamps

      t.index [:pdf_template_key, :field_key], unique: true
    end

    # Seed default positions from hardcoded values in PdfOverlayEngine
    reversible do |dir|
      dir.up do
        # QBCC Contract - 3 text overlay fields
        execute <<-SQL
          INSERT INTO pdf_field_positions (pdf_template_key, field_key, display_name, page, x, y, font_size, active, created_at, updated_at)
          VALUES
            ('qbcc_contract', 'weekends_holidays_overlay', 'C. Non-working days', 2, 548, 263, 10, true, NOW(), NOW()),
            ('qbcc_contract', 'total_completion_overlay', 'Total Completion (A+B+C)', 2, 410, 240, 10, true, NOW(), NOW()),
            ('qbcc_contract', 'item7_completion_overlay', 'Item 7 Completion Period', 2, 420, 152, 10, true, NOW(), NOW()),
            ('qbcc_general_conditions', 'contract_date', 'Contract Date', 1, 400, 50, 8, true, NOW(), NOW()),
            ('qbcc_general_conditions', 'job_reference', 'Job Reference', 1, 150, 50, 8, true, NOW(), NOW())
        SQL
      end
    end
  end
end
