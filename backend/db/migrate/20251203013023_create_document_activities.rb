class CreateDocumentActivities < ActiveRecord::Migration[8.0]
  def change
    create_table :document_activities do |t|
      t.references :company_document, null: false, foreign_key: true
      t.references :user, foreign_key: true # Can be null for system actions
      t.string :action, null: false # renamed, moved, validated, ai_verified, created, deleted
      t.jsonb :old_values, default: {}
      t.jsonb :new_values, default: {}
      t.text :notes

      t.timestamps
    end

    add_index :document_activities, :action
    add_index :document_activities, :created_at
  end
end
