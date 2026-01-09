class RemoveScheduleTemplateTables < ActiveRecord::Migration[8.0]
  # Phase 6 Tier 2: Remove deprecated ScheduleTemplate system
  # Frontend fully migrated to SmTemplate - these tables are no longer used
  # See TEEEM_DOCS/PHASE6_DELETION_AUDIT.md for details

  def up
    # Remove foreign keys first
    remove_foreign_key :project_tasks, :schedule_template_rows, if_exists: true
    remove_foreign_key :tasks, column: :template_row_id, if_exists: true
    remove_foreign_key :sm_settings, column: :default_template_id, if_exists: true
    remove_foreign_key :schedule_template_row_audits, :schedule_template_rows, if_exists: true
    remove_foreign_key :schedule_template_rows, :schedule_templates, if_exists: true
    remove_foreign_key :schedule_template_rows, :contacts, column: :supplier_id, if_exists: true
    remove_foreign_key :schedule_template_rows, :users, column: :assigned_user_id, if_exists: true
    remove_foreign_key :schedule_templates, :users, column: :created_by_id, if_exists: true

    # Nullify FK columns that reference deprecated tables
    change_column_null :project_tasks, :schedule_template_row_id, true if column_exists?(:project_tasks, :schedule_template_row_id)
    change_column_null :tasks, :template_row_id, true if column_exists?(:tasks, :template_row_id)
    change_column_null :sm_settings, :default_template_id, true if column_exists?(:sm_settings, :default_template_id)

    # Drop audit table first (child of schedule_template_rows)
    drop_table :schedule_template_row_audits, if_exists: true

    # Drop child table
    drop_table :schedule_template_rows, if_exists: true

    # Drop parent table
    drop_table :schedule_templates, if_exists: true

    # Remove orphaned columns that pointed to deleted tables
    remove_column :project_tasks, :schedule_template_row_id, if_exists: true
    remove_column :tasks, :template_row_id, if_exists: true
    remove_column :sm_settings, :default_template_id, if_exists: true
  end

  def down
    # Recreate schedule_templates table
    create_table :schedule_templates do |t|
      t.string :name, null: false
      t.text :description
      t.boolean :is_default, default: false
      t.references :created_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :schedule_templates, :name
    add_index :schedule_templates, :is_default

    # Recreate schedule_template_rows table
    create_table :schedule_template_rows do |t|
      t.references :schedule_template, null: false, foreign_key: true
      t.string :name
      t.string :trade
      t.string :stage
      t.integer :duration_days
      t.integer :sequence_order
      t.references :assigned_user, foreign_key: { to_table: :users }
      t.references :supplier, foreign_key: { to_table: :contacts }
      t.timestamps
    end
    add_index :schedule_template_rows, [:schedule_template_id, :sequence_order]

    # Recreate schedule_template_row_audits table
    create_table :schedule_template_row_audits do |t|
      t.references :schedule_template_row, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :action
      t.jsonb :changes
      t.datetime :changed_at
      t.timestamps
    end
    add_index :schedule_template_row_audits, [:schedule_template_row_id, :changed_at]

    # Re-add columns to referencing tables
    add_reference :project_tasks, :schedule_template_row, foreign_key: true unless column_exists?(:project_tasks, :schedule_template_row_id)
    add_reference :tasks, :template_row, foreign_key: { to_table: :schedule_template_rows }, type: :bigint unless column_exists?(:tasks, :template_row_id)
    add_reference :sm_settings, :default_template, foreign_key: { to_table: :schedule_templates, on_delete: :nullify } unless column_exists?(:sm_settings, :default_template_id)
  end
end
