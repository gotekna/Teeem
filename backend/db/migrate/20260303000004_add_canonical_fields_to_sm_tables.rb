class AddCanonicalFieldsToSmTables < ActiveRecord::Migration[7.2]
  TABLES = %i[
    sm_schedule_masters
    sm_schedule_master_templates
    sm_trades
    sm_stages
    sm_task_groups
    sm_hold_reasons
    sm_resources
    sm_schedule_master_document_types
    bpmn_processes
  ].freeze

  # FRC (Mar 2026): Use if_not_exists: true (DB-level) instead of column_exists?
  # (Rails cache) for idempotent migrations on Heroku.
  def up
    TABLES.each do |table|
      add_column table, :canonical_record_id, :bigint, if_not_exists: true
      add_column table, :field_overrides, :text, array: true, default: [], if_not_exists: true
      add_column table, :canonical_version, :integer, default: 0, if_not_exists: true

      add_index table, :canonical_record_id, name: "idx_#{table}_canonical_record_id", if_not_exists: true

      unless foreign_key_exists?(table, :sm_canonical_records)
        add_foreign_key table, :sm_canonical_records, column: :canonical_record_id, on_delete: :nullify
      end
    end
  end

  def down
    TABLES.each do |table|
      remove_foreign_key table, :sm_canonical_records, column: :canonical_record_id, if_exists: true
      remove_index table, name: "idx_#{table}_canonical_record_id", if_exists: true
      remove_column table, :canonical_version, if_exists: true
      remove_column table, :field_overrides, if_exists: true
      remove_column table, :canonical_record_id, if_exists: true
    end
  end
end
