# frozen_string_literal: true

# Migration: Create Custom Quote System
#
# Creates the custom quote system for cost-centre-level quoting.
# Unlike QuoteTracker (which quotes at PO Task level), this supports:
# - Cost centre → PO cascading tree structure
# - Quote at CC level or PO level per cost centre
# - CC-level quote allocation breakdown to individual POs
# - Reusable templates with default suppliers
#
# Tables created:
# 1. custom_quote_templates - Reusable templates
# 2. custom_quote_template_lines - Template tree structure (CC → PO)
# 3. custom_quotes - Applied to a specific job
# 4. custom_quote_lines - Job-level tree (CC → PO)
# 5. custom_quote_suppliers - Supplier tracking per line
# 6. custom_quote_allocations - CC-level quote → PO breakdown
#
# Also creates:
# - WarehouseFolder tab entry (Custom Quotes under Estimating)
#
class CreateCustomQuoteSystem < ActiveRecord::Migration[8.0]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # Table 1: custom_quote_templates - Reusable templates
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :custom_quote_templates do |t|
      t.references :tenant, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.boolean :is_active, default: true, null: false
      t.integer :position, default: 0, null: false
      t.references :po_template_pack, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :updated_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :custom_quote_templates, [:tenant_id, :name], unique: true

    # ═══════════════════════════════════════════════════════════════════════════
    # Table 2: custom_quote_template_lines - Template tree (CC → PO)
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :custom_quote_template_lines do |t|
      t.references :custom_quote_template, null: false, foreign_key: true
      t.references :parent, foreign_key: { to_table: :custom_quote_template_lines }
      t.references :cost_centre, foreign_key: true
      t.references :sm_schedule_master, foreign_key: true
      t.string :name, null: false
      t.string :quote_level, null: false, default: 'po'
      t.integer :position, default: 0, null: false
      t.text :tender_description
      t.text :po_description
      t.text :default_instructions
      t.jsonb :default_supplier_ids, default: []
      t.timestamps
    end

    # Note: :parent_id index already created by t.references :parent above
    add_index :custom_quote_template_lines, [:custom_quote_template_id, :position],
              name: 'idx_cqtl_template_position'

    # ═══════════════════════════════════════════════════════════════════════════
    # Table 3: custom_quotes - Applied to a specific job
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :custom_quotes do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :custom_quote_template, foreign_key: true
      t.string :name, null: false
      t.string :status, null: false, default: 'draft'
      t.decimal :total_quoted, precision: 12, scale: 2, default: 0
      t.decimal :total_allocated, precision: 12, scale: 2, default: 0
      t.references :created_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :custom_quotes, [:tenant_id, :job_id]
    add_index :custom_quotes, :status

    # ═══════════════════════════════════════════════════════════════════════════
    # Table 4: custom_quote_lines - Job-level tree (CC → PO)
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :custom_quote_lines do |t|
      t.references :custom_quote, null: false, foreign_key: true
      t.references :parent, foreign_key: { to_table: :custom_quote_lines }
      t.references :cost_centre, foreign_key: true
      t.references :sm_schedule_master, foreign_key: true
      t.references :sm_task, foreign_key: { to_table: :sm_tasks }
      t.string :name, null: false
      t.string :quote_level, null: false, default: 'po'
      t.integer :position, default: 0, null: false
      t.text :tender_description
      t.text :po_description
      t.text :rfq_instructions
      t.decimal :budget_amount, precision: 12, scale: 2
      t.timestamps
    end

    # Note: :parent_id index already created by t.references :parent above
    add_index :custom_quote_lines, [:custom_quote_id, :position],
              name: 'idx_cql_quote_position'

    # ═══════════════════════════════════════════════════════════════════════════
    # Table 5: custom_quote_suppliers - Supplier tracking per line
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :custom_quote_suppliers do |t|
      t.references :custom_quote_line, null: false, foreign_key: true
      t.references :supplier, null: false, foreign_key: { to_table: :contacts }
      t.references :contact_person, foreign_key: { to_table: :contact_persons }
      t.string :contact_email
      t.string :status, null: false, default: 'draft'
      t.decimal :price_quoted, precision: 12, scale: 2
      t.string :quote_number
      t.date :date_sent
      t.date :date_received
      t.date :valid_to
      t.text :response_notes
      t.string :timeframe
      t.boolean :is_best_price, default: false, null: false
      t.references :sent_by, foreign_key: { to_table: :users }
      t.datetime :sent_at
      t.string :email_message_id
      t.references :purchase_order, foreign_key: true
      t.references :warehouse_document, foreign_key: true
      t.timestamps
    end

    add_index :custom_quote_suppliers, [:custom_quote_line_id, :supplier_id],
              unique: true, name: 'idx_cqs_line_supplier'
    add_index :custom_quote_suppliers, :status

    # ═══════════════════════════════════════════════════════════════════════════
    # Table 6: custom_quote_allocations - CC quote → PO breakdown
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :custom_quote_allocations do |t|
      t.references :custom_quote_supplier, null: false, foreign_key: true
      t.references :custom_quote_line, null: false, foreign_key: true
      t.decimal :allocated_amount, precision: 12, scale: 2, null: false
      t.text :notes
      t.references :purchase_order, foreign_key: true
      t.timestamps
    end

    add_index :custom_quote_allocations, [:custom_quote_supplier_id, :custom_quote_line_id],
              unique: true, name: 'idx_cqa_supplier_line'

    # ═══════════════════════════════════════════════════════════════════════════
    # WarehouseFolder tab: Custom Quotes under Estimating (per tenant)
    # ═══════════════════════════════════════════════════════════════════════════
    # Estimating tab has tab_key='jobs', parent_id IS NULL
    # We need to create the tab for ALL tenants (each has own warehouse folder tree)
    tenant_ids = execute("SELECT id FROM tenants").map { |r| r["id"] }

    tenant_ids.each do |tenant_id|
      # Find Estimating parent for this tenant
      estimating = execute(<<-SQL.squish)
        SELECT id FROM warehouse_folders
        WHERE tenant_id = #{tenant_id}
          AND tab_key = 'jobs'
          AND parent_id IS NULL
        LIMIT 1
      SQL

      next unless estimating.count.positive?
      estimating_id = estimating.first['id']

      # Check if already exists for this tenant
      existing = execute(<<-SQL.squish)
        SELECT id FROM warehouse_folders
        WHERE tenant_id = #{tenant_id}
          AND tab_key = 'custom-quotes'
        LIMIT 1
      SQL

      next if existing.count.positive?

      # Get max order_position among Estimating's children for this tenant
      max_pos = execute(<<-SQL.squish)
        SELECT COALESCE(MAX(order_position), 0) as max_pos
        FROM warehouse_folders
        WHERE tenant_id = #{tenant_id}
          AND parent_id = #{estimating_id}
      SQL
      next_pos = max_pos.first['max_pos'].to_i + 1

      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          tenant_id, warehouse_type, tab_key, display_name, parent_id, tab_group,
          order_position, enabled, is_system_tab, icon_name, component_name,
          warehouse_enabled,
          created_at, updated_at
        )
        VALUES (
          #{tenant_id},
          'job',
          'custom-quotes',
          'Custom Quotes',
          #{estimating_id},
          'documents',
          #{next_pos},
          true,
          true,
          'file-text',
          'JobCustomQuotesTab',
          false,
          NOW(), NOW()
        )
      SQL

      puts "[CreateCustomQuoteSystem] Created Custom Quotes tab for tenant #{tenant_id}"
    end
  end

  def down
    # Remove warehouse folder tabs
    execute("DELETE FROM warehouse_folders WHERE tab_key = 'custom-quotes' AND warehouse_type = 'job'")

    # Drop tables in reverse dependency order
    drop_table :custom_quote_allocations
    drop_table :custom_quote_suppliers
    drop_table :custom_quote_lines
    drop_table :custom_quotes
    drop_table :custom_quote_template_lines
    drop_table :custom_quote_templates
  end
end
