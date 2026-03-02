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

  def change
    TABLES.each do |table|
      add_column table, :canonical_record_id, :bigint unless column_exists?(table, :canonical_record_id)
      add_column table, :field_overrides, :text, array: true, default: [] unless column_exists?(table, :field_overrides)
      add_column table, :canonical_version, :integer, default: 0 unless column_exists?(table, :canonical_version)

      unless index_exists?(table, :canonical_record_id)
        add_index table, :canonical_record_id, name: "idx_#{table}_canonical_record_id"
      end

      unless foreign_key_exists?(table, :sm_canonical_records)
        add_foreign_key table, :sm_canonical_records, column: :canonical_record_id, on_delete: :nullify
      end
    end
  end
end
