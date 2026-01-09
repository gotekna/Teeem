class AddLinkToCgToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :link_to_cg, :boolean, default: false
  end
end
