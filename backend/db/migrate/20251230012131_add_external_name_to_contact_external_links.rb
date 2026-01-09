class AddExternalNameToContactExternalLinks < ActiveRecord::Migration[8.0]
  def change
    add_column :contact_external_links, :external_name, :string
  end
end
