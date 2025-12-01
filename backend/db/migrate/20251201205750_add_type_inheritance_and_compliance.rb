class AddTypeInheritanceAndCompliance < ActiveRecord::Migration[8.0]
  def change
    # Add type inheritance fields to columns table
    add_reference :columns, :column_type_definition, foreign_key: true, null: true

    # Override fields (nullable - when null, inherit from type definition)
    add_column :columns, :override_max_length, :integer
    add_column :columns, :override_min_length, :integer
    add_column :columns, :override_min_value, :decimal, precision: 15, scale: 2
    add_column :columns, :override_max_value, :decimal, precision: 15, scale: 2
    add_column :columns, :override_validation_message, :text

    # Track which version of the type definition this column is using
    add_column :columns, :type_version_applied, :integer, default: 0
    add_column :columns, :last_compliance_check, :datetime

    # Add compliance tracking fields to foundations table
    add_column :foundations, :compliance_score, :decimal, precision: 5, scale: 2
    add_column :foundations, :compliance_checked_at, :datetime
    add_column :foundations, :non_compliant_columns, :jsonb, default: []

    add_index :foundations, :compliance_score
  end
end
