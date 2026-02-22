# frozen_string_literal: true

# Migration: Create Quote Template System
#
# Creates the quote template system for RFQ workflows:
# 1. quote_templates - reusable templates (pick SM Trades + assign suppliers)
# 2. quote_template_trades - trades within a template
# 3. quote_template_trade_suppliers - suppliers assigned to each trade
# 4. Adds new columns to quote_trackers for status tracking, best price, PO creation
# 5. Registers new Foundation columns so they appear in TeeemTableView
#
# Pattern follows: PoTemplatePack → PoTemplateItem → PoTemplateLineItem
#
class CreateQuoteTemplateSystem < ActiveRecord::Migration[7.2]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 1: Create quote_templates table
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :quote_templates do |t|
      t.references :tenant, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.boolean :is_active, default: true, null: false
      t.integer :position, default: 0, null: false
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :updated_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :quote_templates, [:tenant_id, :name], unique: true

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 2: Create quote_template_trades table
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :quote_template_trades do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :quote_template, null: false, foreign_key: true
      t.references :sm_trade, null: false, foreign_key: true
      t.integer :position, default: 0, null: false
      t.text :default_instructions
      t.jsonb :required_document_types, default: []
      t.timestamps
    end

    add_index :quote_template_trades, [:quote_template_id, :sm_trade_id], unique: true,
              name: 'idx_qt_trades_template_trade'

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 3: Create quote_template_trade_suppliers table
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :quote_template_trade_suppliers do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :quote_template_trade, null: false, foreign_key: true
      t.references :supplier, null: false, foreign_key: { to_table: :contacts }
      t.references :contact_person, foreign_key: { to_table: :contact_persons }
      t.integer :position, default: 0, null: false
      t.boolean :is_preferred, default: false, null: false
      t.timestamps
    end

    add_index :quote_template_trade_suppliers, [:quote_template_trade_id, :supplier_id], unique: true,
              name: 'idx_qt_trade_suppliers_trade_supplier'

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 4: Add columns to quote_trackers for RFQ tracking
    # ═══════════════════════════════════════════════════════════════════════════
    add_column :quote_trackers, :status, :string, default: 'draft', null: false
    add_column :quote_trackers, :sent_at, :datetime
    add_reference :quote_trackers, :sent_by, foreign_key: { to_table: :users }
    add_column :quote_trackers, :is_best_price, :boolean, default: false, null: false
    add_reference :quote_trackers, :purchase_order, foreign_key: true
    add_reference :quote_trackers, :quote_template, foreign_key: true
    add_column :quote_trackers, :email_message_id, :string
    add_column :quote_trackers, :response_notes, :text
    add_column :quote_trackers, :timeframe, :string

    add_index :quote_trackers, :status
    add_index :quote_trackers, [:job_id, :sm_trade_id, :is_best_price],
              name: 'idx_quote_trackers_best_price'

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 5: Register new Foundation columns for quote_trackers
    # ═══════════════════════════════════════════════════════════════════════════
    foundation_result = execute("SELECT id FROM foundations WHERE slug = 'quote-tracker' LIMIT 1")
    if foundation_result.count.positive?
      foundation_id = foundation_result.first['id']

      # Get max position of existing columns
      max_pos_result = execute("SELECT COALESCE(MAX(position), 0) as max_pos FROM columns WHERE foundation_id = #{foundation_id}")
      next_pos = max_pos_result.first['max_pos'].to_i + 1

      # Look up foundations for lookups
      users_foundation = execute("SELECT id FROM foundations WHERE slug = 'user-management' LIMIT 1")
      users_foundation_id = users_foundation.count.positive? ? users_foundation.first['id'] : nil

      po_foundation = execute("SELECT id FROM foundations WHERE slug = 'purchase-orders' LIMIT 1")
      po_foundation_id = po_foundation.count.positive? ? po_foundation.first['id'] : nil

      new_columns = [
        { column_name: 'status', name: 'Status', column_type: 'single_line_text', position: next_pos },
        { column_name: 'sent_at', name: 'Sent At', column_type: 'datetime', position: next_pos + 1 },
        { column_name: 'sent_by_id', name: 'Sent By', column_type: 'lookup', position: next_pos + 2,
          lookup_foundation_id: users_foundation_id, lookup_display_column: 'name' },
        { column_name: 'is_best_price', name: 'Best Price', column_type: 'boolean', position: next_pos + 3 },
        { column_name: 'purchase_order_id', name: 'Purchase Order', column_type: 'lookup', position: next_pos + 4,
          lookup_foundation_id: po_foundation_id, lookup_display_column: 'purchase_order_number', has_ui: false },
        { column_name: 'response_notes', name: 'Response Notes', column_type: 'multiple_lines_text', position: next_pos + 5 },
        { column_name: 'timeframe', name: 'Timeframe', column_type: 'single_line_text', position: next_pos + 6 },
      ]

      new_columns.each do |col|
        lookup_fid = col[:lookup_foundation_id] ? col[:lookup_foundation_id] : 'NULL'
        lookup_dc = col[:lookup_display_column] ? "'#{col[:lookup_display_column]}'" : 'NULL'
        has_ui_val = col[:has_ui] == false ? false : true

        execute(<<-SQL.squish)
          INSERT INTO columns (
            foundation_id, column_name, name, column_type, position,
            lookup_foundation_id, lookup_display_column, has_ui,
            created_at, updated_at
          )
          VALUES (
            #{foundation_id},
            '#{col[:column_name]}',
            '#{col[:name]}',
            '#{col[:column_type]}',
            #{col[:position]},
            #{lookup_fid},
            #{lookup_dc},
            #{has_ui_val},
            NOW(), NOW()
          )
        SQL
      end

      puts "[CreateQuoteTemplateSystem] Added #{new_columns.length} new columns to quote-tracker Foundation"
    else
      puts "[CreateQuoteTemplateSystem] WARNING: quote-tracker Foundation not found, skipping column registration"
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 6: Create Foundation for quote_templates (for Settings admin)
    # ═══════════════════════════════════════════════════════════════════════════
    qt_foundation_id = execute(<<-SQL.squish).first['id']
      INSERT INTO foundations (
        name, singular_name, plural_name, database_table_name, model_class,
        slug, table_type, feature, searchable, is_live, has_ui, has_saved_views,
        created_at, updated_at
      )
      VALUES (
        'Quote Templates', 'Quote Template', 'Quote Templates', 'quote_templates', 'QuoteTemplate',
        'quote-templates', 'system', 'precon', true, true, false, false,
        NOW(), NOW()
      )
      RETURNING id
    SQL

    puts "[CreateQuoteTemplateSystem] Created quote-templates Foundation with id: #{qt_foundation_id}"

    # Create minimal Foundation columns for quote_templates
    qt_columns = [
      { column_name: 'name', name: 'Name', column_type: 'single_line_text', position: 1 },
      { column_name: 'description', name: 'Description', column_type: 'multiple_lines_text', position: 2 },
      { column_name: 'is_active', name: 'Active', column_type: 'boolean', position: 3 },
      { column_name: 'position', name: 'Position', column_type: 'number', position: 4 },
    ]

    qt_columns.each do |col|
      execute(<<-SQL.squish)
        INSERT INTO columns (
          foundation_id, column_name, name, column_type, position,
          has_ui, created_at, updated_at
        )
        VALUES (
          #{qt_foundation_id},
          '#{col[:column_name]}',
          '#{col[:name]}',
          '#{col[:column_type]}',
          #{col[:position]},
          true,
          NOW(), NOW()
        )
      SQL
    end

    puts "[CreateQuoteTemplateSystem] Created #{qt_columns.length} columns for quote-templates Foundation"
  end

  def down
    # Remove quote_templates Foundation columns + Foundation
    execute("DELETE FROM columns WHERE foundation_id = (SELECT id FROM foundations WHERE slug = 'quote-templates')")
    execute("DELETE FROM foundations WHERE slug = 'quote-templates'")

    # Remove new columns from quote-tracker Foundation
    foundation_result = execute("SELECT id FROM foundations WHERE slug = 'quote-tracker' LIMIT 1")
    if foundation_result.count.positive?
      foundation_id = foundation_result.first['id']
      %w[status sent_at sent_by_id is_best_price purchase_order_id response_notes timeframe].each do |col_name|
        execute("DELETE FROM columns WHERE foundation_id = #{foundation_id} AND column_name = '#{col_name}'")
      end
    end

    # Remove columns from quote_trackers table
    remove_index :quote_trackers, name: 'idx_quote_trackers_best_price', if_exists: true
    remove_index :quote_trackers, :status, if_exists: true
    remove_reference :quote_trackers, :quote_template
    remove_reference :quote_trackers, :purchase_order
    remove_reference :quote_trackers, :sent_by
    remove_column :quote_trackers, :timeframe
    remove_column :quote_trackers, :response_notes
    remove_column :quote_trackers, :email_message_id
    remove_column :quote_trackers, :is_best_price
    remove_column :quote_trackers, :sent_at
    remove_column :quote_trackers, :status

    # Drop new tables (reverse order)
    drop_table :quote_template_trade_suppliers
    drop_table :quote_template_trades
    drop_table :quote_templates
  end
end
