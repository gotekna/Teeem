# frozen_string_literal: true

class CreateXeroAlerts < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_alerts do |t|
      t.references :xero_credential, foreign_key: true
      t.references :corporate, foreign_key: true

      # Alert classification
      t.string :alert_type, null: false # token_expired, sync_stale, rate_limited, disconnected, inactivity_warning
      t.string :severity, null: false   # info, warning, critical

      # Alert content
      t.string :title, null: false
      t.text :message

      # Dismissal tracking
      t.boolean :dismissed, default: false, null: false
      t.datetime :dismissed_at
      t.references :dismissed_by, foreign_key: { to_table: :users }

      # Auto-resolve tracking
      t.boolean :auto_resolved, default: false, null: false
      t.datetime :auto_resolved_at

      t.timestamps
    end

    add_index :xero_alerts, [ :corporate_id, :dismissed, :created_at ], name: 'idx_xero_alerts_company_active'
    add_index :xero_alerts, [ :xero_credential_id, :alert_type, :dismissed ], name: 'idx_xero_alerts_credential_type'
    add_index :xero_alerts, [ :severity, :dismissed ], name: 'idx_xero_alerts_severity_active'
  end
end
