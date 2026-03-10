class CreateSdaEnquiries < ActiveRecord::Migration[7.1]
  def change
    create_table :sda_enquiries do |t|
      t.references :property, null: false, foreign_key: true
      t.string :name, null: false
      t.string :email, null: false
      t.string :phone
      t.text :message
      t.string :ndis_number
      t.string :enquiry_type, default: "general"  # general, vacancy, purchase
      t.string :status, default: "new", null: false  # new, contacted, in_progress, resolved, archived
      t.string :ip_address
      t.text :staff_notes
      t.datetime :responded_at
      t.references :assigned_to_user, foreign_key: { to_table: :users }, null: true
      t.timestamps
    end

    add_index :sda_enquiries, :status
    add_index :sda_enquiries, :email
    add_index :sda_enquiries, [:ip_address, :created_at], name: "idx_sda_enquiries_rate_limit"
  end
end
