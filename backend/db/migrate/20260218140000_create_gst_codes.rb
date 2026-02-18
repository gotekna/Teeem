class CreateGstCodes < ActiveRecord::Migration[7.2]
  def up
    create_table :gst_codes do |t|
      t.references :tenant, null: false, foreign_key: true
      t.string :code, null: false
      t.string :name, null: false
      t.decimal :rate, precision: 5, scale: 4, null: false, default: 0.0
      t.string :xero_tax_types
      t.boolean :active, default: true
      t.integer :position, default: 0
      t.timestamps
    end

    add_index :gst_codes, [:tenant_id, :code], unique: true

    # Seed default GST codes for all existing tenants
    Tenant.find_each do |tenant|
      execute <<-SQL
        INSERT INTO gst_codes (tenant_id, code, name, rate, xero_tax_types, active, position, created_at, updated_at)
        VALUES
          (#{tenant.id}, 'GST', 'GST 10%', 0.1000, 'INPUT,OUTPUT', true, 0, NOW(), NOW()),
          (#{tenant.id}, 'GST Free', 'GST Free 0%', 0.0000, 'INPUT2,OUTPUT2,BASEXCLUDED,EXEMPTINPUT,EXEMPTOUTPUT,NONE', true, 1, NOW(), NOW()),
          (#{tenant.id}, 'Input Taxed', 'Input Taxed 0%', 0.0000, 'INPUTTAXED', true, 2, NOW(), NOW())
      SQL
    end
  end

  def down
    drop_table :gst_codes
  end
end
