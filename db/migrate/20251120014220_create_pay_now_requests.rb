class CreatePayNowRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :pay_now_requests do |t|
      # Relationships
      t.references :purchase_order, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :requested_by_portal_user, foreign_key: { to_table: :portal_users }

      # Financial details - MUST use DECIMAL(15,2) per Trinity Rule 16.6
      t.decimal :original_amount, precision: 15, scale: 2, null: false
      t.decimal :discount_percentage, precision: 5, scale: 2, default: 5.0, null: false
      t.decimal :discount_amount, precision: 15, scale: 2, null: false
      t.decimal :discounted_amount, precision: 15, scale: 2, null: false

      # Request status
      t.string :status, null: false, default: 'pending'
      # Status values: pending, approved, rejected, paid, cancelled

      # Supervisor approval
      t.references :reviewed_by_supervisor, foreign_key: { to_table: :users }
      t.datetime :supervisor_reviewed_at
      t.text :supervisor_notes

      # Builder approval (optional - for future two-tier approval)
      t.references :approved_by_builder, foreign_key: { to_table: :users }
      t.datetime :builder_approved_at
      t.text :builder_notes

      # Payment tracking
      t.references :payment, foreign_key: true
      t.datetime :paid_at

      # Request details
      t.text :supplier_notes
      t.date :requested_payment_date

      # Rejection tracking
      t.datetime :rejected_at
      t.text :rejection_reason

      # Weekly limit tracking
      t.references :pay_now_weekly_limit, foreign_key: true

      t.timestamps

      # Indexes for performance and queries
      t.index [:purchase_order_id, :status], name: 'index_pay_now_requests_on_po_and_status'
      t.index [:contact_id, :status], name: 'index_pay_now_requests_on_contact_and_status'
      t.index :status
      t.index :requested_payment_date
      t.index :created_at
      t.index [:status, :created_at], name: 'index_pay_now_requests_on_status_and_created_at'
    end
  end
end
