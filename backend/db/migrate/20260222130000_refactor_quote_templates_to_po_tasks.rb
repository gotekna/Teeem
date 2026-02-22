# frozen_string_literal: true

# Refactor Quote Templates from SM Trade-based to PO Task (SmScheduleMaster)-based grouping.
#
# Why: The user wants Quote Templates organized by PO Tasks (which correspond to
# SmScheduleMaster records) rather than SM Trades. PO Tasks are the scheduling unit
# that Purchase Orders link to, so this creates a natural flow:
#   QuoteTemplate → PO Task → Supplier → Accept → PurchaseOrder (linked to SmTask)
#
# Changes:
# 1. quote_template_trades: Add sm_schedule_master_id, make sm_trade_id nullable
# 2. quote_trackers: Add sm_schedule_master_id + sm_task_id for job-level linking
# 3. Update indexes for new grouping columns
#
class RefactorQuoteTemplatesToPoTasks < ActiveRecord::Migration[7.2]
  def change
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. quote_template_trades: Add sm_schedule_master_id
    # ═══════════════════════════════════════════════════════════════════════════

    # Add new column for PO Task linkage
    add_column :quote_template_trades, :sm_schedule_master_id, :bigint
    add_index :quote_template_trades, :sm_schedule_master_id

    # Make sm_trade_id nullable (keeping it for backward compat during transition)
    change_column_null :quote_template_trades, :sm_trade_id, true

    # Remove old unique index and add new one
    remove_index :quote_template_trades, name: "idx_qt_trades_template_trade"
    add_index :quote_template_trades, [:quote_template_id, :sm_schedule_master_id],
              name: "idx_qt_trades_template_po_task", unique: true,
              where: "sm_schedule_master_id IS NOT NULL"

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. quote_trackers: Add sm_schedule_master_id + sm_task_id
    # ═══════════════════════════════════════════════════════════════════════════

    # Template-level PO Task reference (for grouping)
    add_column :quote_trackers, :sm_schedule_master_id, :bigint
    add_index :quote_trackers, :sm_schedule_master_id

    # Job-level task instance (for PO creation linking)
    add_column :quote_trackers, :sm_task_id, :bigint
    add_index :quote_trackers, :sm_task_id

    # Best price index now on sm_schedule_master_id instead of sm_trade_id
    add_index :quote_trackers, [:job_id, :sm_schedule_master_id, :is_best_price],
              name: "idx_quote_trackers_best_price_by_task"

    # Register new Foundation columns for quote_trackers
    reversible do |dir|
      dir.up do
        register_foundation_columns
      end
    end
  end

  private

  def register_foundation_columns
    foundation = Foundation.find_by(slug: 'quote-tracker')
    return unless foundation

    # Find column type definitions
    lookup_type = ColumnTypeDefinition.find_by(type_key: 'lookup')
    return unless lookup_type

    max_position = foundation.columns.maximum(:position) || 0

    # sm_schedule_master_id → lookup to SmScheduleMaster
    unless foundation.columns.exists?(name: 'sm_schedule_master_id')
      foundation.columns.create!(
        name: 'sm_schedule_master_id',
        column_name: 'PO Task',
        column_type: 'lookup',
        column_type_definition: lookup_type,
        position: max_position + 1,
        required: false,
        lookup_display_column: 'name'
      )
    end

    # sm_task_id → lookup to SmTask
    unless foundation.columns.exists?(name: 'sm_task_id')
      foundation.columns.create!(
        name: 'sm_task_id',
        column_name: 'Job Task',
        column_type: 'lookup',
        column_type_definition: lookup_type,
        position: max_position + 2,
        required: false,
        lookup_display_column: 'name'
      )
    end
  end
end
