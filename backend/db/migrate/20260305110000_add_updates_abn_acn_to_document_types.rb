class AddUpdatesAbnAcnToDocumentTypes < ActiveRecord::Migration[7.2]
  def change
    add_column :document_types, :updates_abn, :boolean, default: false, null: false
    add_column :document_types, :updates_acn, :boolean, default: false, null: false
  end
end
