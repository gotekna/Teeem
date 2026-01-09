class AddSlugToFoundationViews < ActiveRecord::Migration[8.0]
  def change
    add_column :foundation_views, :slug, :string
    # Slug is unique per foundation (different foundations can have same view slug)
    add_index :foundation_views, [:foundation_id, :slug], unique: true, name: 'index_foundation_views_on_foundation_and_slug'
  end
end
