class AddLookupFoundationSlugToColumns < ActiveRecord::Migration[8.0]
  def change
    add_column :columns, :lookup_foundation_slug, :string
    add_index :columns, :lookup_foundation_slug
  end
end
