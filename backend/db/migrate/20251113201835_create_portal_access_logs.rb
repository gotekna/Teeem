class CreatePortalAccessLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :portal_access_logs do |t|
      t.references :portal_user, null: false, foreign_key: true
      t.string :action  # login, logout, view_po, download_document, etc.
      t.string :ip_address
      t.string :user_agent
      t.jsonb :metadata  # Additional context data

      t.timestamps
    end

    add_index :portal_access_logs, [ :portal_user_id, :created_at ]
    add_index :portal_access_logs, :action
    add_index :portal_access_logs, :created_at
  end
end
