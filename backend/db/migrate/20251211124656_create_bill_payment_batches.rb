class CreateBillPaymentBatches < ActiveRecord::Migration[8.0]
  def change
    create_table :bill_payment_batches do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :bank_account, null: false, foreign_key: true

      t.string :batch_reference, null: false  # Auto-generated
      t.string :status, null: false, default: 'draft'
      # draft, pending_approval, approved, generating, generated,
      # submitted, processing, completed, failed, cancelled

      t.date :payment_date, null: false
      t.decimal :total_amount, precision: 15, scale: 2, default: 0
      t.integer :payment_count, default: 0

      # ABA file details
      t.string :aba_file_name
      t.text :aba_file_content
      t.datetime :aba_generated_at
      t.string :aba_sequence_number

      # Processing info
      t.string :processing_description
      t.string :self_balancing_reference

      # Approval
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }
      t.datetime :approved_at
      t.bigint :bpmn_process_instance_id

      # Sync
      t.datetime :submitted_to_bank_at
      t.datetime :completed_at
      t.text :bank_response

      t.text :notes
      t.timestamps
    end

    add_index :bill_payment_batches, :batch_reference, unique: true
    add_index :bill_payment_batches, :status
    add_index :bill_payment_batches, [ :corporate_id, :status ]
    add_index :bill_payment_batches, :payment_date
    add_foreign_key :bill_payment_batches, :bpmn_process_instances, column: :bpmn_process_instance_id
  end
end
