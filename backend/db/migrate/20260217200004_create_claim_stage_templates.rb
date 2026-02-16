class CreateClaimStageTemplates < ActiveRecord::Migration[7.1]
  def change
    create_table :claim_stage_templates do |t|
      t.bigint :tenant_id, null: false
      t.string :name, limit: 100, null: false
      t.text :description
      t.boolean :is_active, null: false, default: true
      t.integer :position, default: 0
      t.decimal :default_retainage_pct, precision: 5, scale: 2
      t.bigint :created_by_id
      t.bigint :updated_by_id

      t.timestamps
    end

    add_index :claim_stage_templates, [:tenant_id, :name], unique: true, name: "idx_claim_stage_templates_tenant_name"
    add_index :claim_stage_templates, :tenant_id

    create_table :claim_stage_template_lines do |t|
      t.bigint :tenant_id, null: false
      t.bigint :claim_stage_template_id, null: false
      t.string :name, limit: 100, null: false
      t.decimal :percentage, precision: 5, scale: 2, null: false
      t.integer :sequence_order, null: false, default: 0
      t.string :description
      t.decimal :retainage_percentage, precision: 5, scale: 2

      t.timestamps
    end

    add_index :claim_stage_template_lines, [:claim_stage_template_id, :sequence_order], name: "idx_cstl_template_sequence"
    add_index :claim_stage_template_lines, [:claim_stage_template_id, :name], unique: true, name: "idx_cstl_template_name"
    add_index :claim_stage_template_lines, :tenant_id
    add_foreign_key :claim_stage_template_lines, :claim_stage_templates

    # Seed default templates for each tenant
    reversible do |dir|
      dir.up do
        Tenant.find_each do |tenant|
          ActsAsTenant.with_tenant(tenant) do
            seed_default_templates(tenant)
          end
        end
      end
    end
  end

  private

  def seed_default_templates(tenant)
    # 5-Stage Residential
    residential = ClaimStageTemplate.create!(
      tenant: tenant,
      name: "5-Stage Residential",
      description: "Standard 5-stage progress claim for residential builds",
      position: 1
    )
    [
      { name: "Slab", percentage: 10.0, sequence_order: 1 },
      { name: "Frame", percentage: 20.0, sequence_order: 2 },
      { name: "Lock-up", percentage: 30.0, sequence_order: 3 },
      { name: "Fix-out", percentage: 25.0, sequence_order: 4 },
      { name: "Completion", percentage: 15.0, sequence_order: 5 },
    ].each do |line_attrs|
      residential.lines.create!(line_attrs.merge(tenant: tenant))
    end

    # 3-Stage Commercial
    commercial = ClaimStageTemplate.create!(
      tenant: tenant,
      name: "3-Stage Commercial",
      description: "Simple 3-stage progress claim for commercial projects",
      position: 2
    )
    [
      { name: "Mobilisation", percentage: 20.0, sequence_order: 1 },
      { name: "Progress", percentage: 50.0, sequence_order: 2 },
      { name: "Completion", percentage: 30.0, sequence_order: 3 },
    ].each do |line_attrs|
      commercial.lines.create!(line_attrs.merge(tenant: tenant))
    end
  rescue => e
    Rails.logger.warn "[ClaimStageTemplate Seed] Failed for tenant #{tenant.id}: #{e.message}"
  end
end
