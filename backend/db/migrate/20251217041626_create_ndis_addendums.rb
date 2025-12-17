class CreateNdisAddendums < ActiveRecord::Migration[8.0]
  def change
    create_table :ndis_addendums do |t|
      t.string :document_type, null: false
      t.string :section_key
      t.string :title, null: false
      t.text :content, null: false
      t.integer :position, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :ndis_addendums, :document_type
  end
end
