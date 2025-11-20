class CreateWhsSwmsAcknowledgments < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_swms_acknowledgments do |t|
      t.references :whs_swms, null: false, foreign_key: true
      t.references :user, foreign_key: true, null: true # If user exists in system

      # Worker details (may not be a system user)
      t.string :worker_name, null: false
      t.string :worker_company
      t.string :worker_role
      t.text :signature_data # Base64 encoded signature
      t.datetime :acknowledged_at, null: false
      t.string :ip_address

      t.timestamps
    end

    add_index :whs_swms_acknowledgments, :acknowledged_at
  end
end
