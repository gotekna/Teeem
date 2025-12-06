class CreateMaintenanceRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :maintenance_requests do |t|
      t.references :construction, null: false, foreign_key: true
      t.references :supplier_contact, foreign_key: { to_table: :contacts }  # Responsible supplier
      t.references :reported_by_user, foreign_key: { to_table: :users }
      t.references :purchase_order, foreign_key: true  # Related PO if applicable

      t.string :request_number, null: false  # Auto-generated: MR-YYYYMMDD-XXX
      t.string :status, null: false, default: 'open'  # open, in_progress, resolved, closed
      t.string :priority, default: 'medium'  # low, medium, high, urgent
      t.string :category  # plumbing, electrical, structural, etc.

      t.string :title, null: false
      t.text :description
      t.text :resolution_notes

      t.date :reported_date, null: false
      t.date :due_date
      t.date :resolved_date

      t.boolean :warranty_claim, default: false
      t.decimal :estimated_cost, precision: 10, scale: 2
      t.decimal :actual_cost, precision: 10, scale: 2

      t.timestamps
    end

    add_index :maintenance_requests, :request_number, unique: true
    add_index :maintenance_requests, [ :supplier_contact_id, :status ]
    add_index :maintenance_requests, [ :construction_id, :status ]
    add_index :maintenance_requests, :status
  end
end
