class CreatePurchaseOrderDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :purchase_order_documents do |t|
      t.references :purchase_order, null: false, foreign_key: true
      t.references :document_task, null: false, foreign_key: true

      t.timestamps
    end

    # Add unique index to prevent duplicate associations
    add_index :purchase_order_documents, [ :purchase_order_id, :document_task_id ],
              unique: true, name: 'index_po_documents_on_po_and_document'
  end
end
