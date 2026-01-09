class CreateSmTaskAttachments < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_task_attachments do |t|
      t.references :sm_task, null: false, foreign_key: { on_delete: :cascade }

      # Polymorphic: can attach EmailWarehouse, CorporateCompanyDocument
      t.string :attachable_type, null: false
      t.bigint :attachable_id, null: false

      # Metadata
      t.string :attachment_type, limit: 50  # email, document, upload
      t.text :notes
      t.references :added_by, foreign_key: { to_table: :users, on_delete: :nullify }

      t.timestamps
    end

    add_index :sm_task_attachments, [:attachable_type, :attachable_id]
    add_index :sm_task_attachments, [:sm_task_id, :attachable_type, :attachable_id],
              unique: true, name: 'idx_sm_task_attachments_unique'
  end
end
