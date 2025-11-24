class CreateSmSettings < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_settings do |t|
      # Rollover Settings
      t.time :rollover_time, null: false, default: '00:00:00'
      t.string :rollover_timezone, null: false, default: 'Australia/Brisbane', limit: 50
      t.boolean :rollover_enabled, default: true

      # Notification Settings
      t.boolean :notify_on_hold, default: true
      t.boolean :notify_on_supplier_confirm, default: true
      t.boolean :notify_on_rollover, default: true

      # Default Template
      t.bigint :default_template_id

      t.timestamps
    end

    # Foreign key to schedule_templates for default template
    add_foreign_key :sm_settings, :schedule_templates, column: :default_template_id, on_delete: :nullify

    # Insert singleton row
    reversible do |dir|
      dir.up do
        execute "INSERT INTO sm_settings (id, created_at, updated_at) VALUES (1, NOW(), NOW())"
      end
    end
  end
end
