class CreateSubcontractorAccounts < ActiveRecord::Migration[8.0]
  def change
    create_table :subcontractor_accounts do |t|
      t.references :portal_user, null: false, foreign_key: true
      t.string :account_tier, null: false, default: 'free'
      t.datetime :activated_at
      t.references :invited_by_contact, null: true, foreign_key: { to_table: :contacts }
      t.decimal :kudos_score, precision: 10, scale: 2, default: 0.0
      t.integer :jobs_completed_count, default: 0
      t.boolean :accounting_system_connected, default: false
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :subcontractor_accounts, :account_tier
    add_index :subcontractor_accounts, :kudos_score
    add_index :subcontractor_accounts, :activated_at
  end
end
