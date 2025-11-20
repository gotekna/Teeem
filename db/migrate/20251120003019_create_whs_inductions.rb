class CreateWhsInductions < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_inductions do |t|
      # References
      t.bigint :whs_induction_template_id, null: false # FK added later
      t.references :construction, foreign_key: true, null: true # If site-specific
      t.references :user, foreign_key: true, null: true # If worker is a system user
      t.references :conducted_by_user, null: false, foreign_key: { to_table: :users }

      # Certificate details
      t.string :certificate_number, null: false
      t.string :induction_type, null: false # company_wide, site_specific, project_specific, visitor
      t.string :status, null: false, default: 'valid' # valid, expired, superseded

      # Worker details (may not be a system user)
      t.string :worker_name, null: false
      t.string :worker_company
      t.string :worker_contact

      # Completion details
      t.datetime :completion_date, null: false
      t.date :expiry_date # Null if never expires
      t.integer :quiz_score # If template has quiz
      t.boolean :passed, default: true

      # Sign-off
      t.text :worker_signature
      t.text :supervisor_signature
      t.text :acknowledgment_statement

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :whs_inductions, :certificate_number, unique: true
    add_index :whs_inductions, :status
    add_index :whs_inductions, :expiry_date
    add_index :whs_inductions, [:worker_name, :induction_type]
  end
end
