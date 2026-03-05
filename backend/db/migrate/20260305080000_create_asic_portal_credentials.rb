class CreateAsicPortalCredentials < ActiveRecord::Migration[7.2]
  def up
    create_table :asic_portal_credentials do |t|
      t.bigint :corporate_id, null: false
      t.bigint :contact_id
      t.bigint :tenant_id
      t.string :username
      t.text :encrypted_password
      t.string :recovery_question
      t.text :encrypted_recovery_answer
      t.string :status, default: "active", null: false
      t.text :notes
      t.timestamps
    end

    add_index :asic_portal_credentials, :corporate_id
    add_index :asic_portal_credentials, :contact_id
    add_index :asic_portal_credentials, :tenant_id
    add_index :asic_portal_credentials, [:corporate_id, :status]

    add_foreign_key :asic_portal_credentials, :corporates, column: :corporate_id
    add_foreign_key :asic_portal_credentials, :contacts, column: :contact_id

    # Data migration: Copy existing single-user ASIC credentials from corporates to new table
    execute <<-SQL
      INSERT INTO asic_portal_credentials (corporate_id, tenant_id, username, encrypted_password, recovery_question, encrypted_recovery_answer, status, created_at, updated_at)
      SELECT id, tenant_id, asic_username, encrypted_asic_password, recovery_question, encrypted_recovery_answer, 'active', NOW(), NOW()
      FROM corporates
      WHERE asic_username IS NOT NULL AND asic_username != ''
    SQL
  end

  def down
    drop_table :asic_portal_credentials
  end
end
