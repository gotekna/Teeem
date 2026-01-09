# Track data quality issues detected by automated checks
class CreateDataQualityIssues < ActiveRecord::Migration[8.0]
  def change
    create_table :data_quality_issues do |t|
      t.string :view_name, null: false
      t.string :check_name, null: false
      t.string :severity, null: false, default: 'warning'  # info, warning, error, critical
      t.string :status, null: false, default: 'open'  # open, acknowledged, resolved, ignored
      t.text :description, null: false
      t.jsonb :details, default: {}  # Additional context (expected vs actual values, affected rows, etc.)
      t.integer :affected_row_count
      t.datetime :detected_at, null: false
      t.datetime :resolved_at
      t.string :resolved_by
      t.text :resolution_notes

      t.timestamps
    end

    add_index :data_quality_issues, :view_name
    add_index :data_quality_issues, :check_name
    add_index :data_quality_issues, :severity
    add_index :data_quality_issues, :status
    add_index :data_quality_issues, :detected_at
    add_index :data_quality_issues, [ :view_name, :status ]
    add_index :data_quality_issues, [ :severity, :status ]
  end
end
