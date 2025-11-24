class EnhanceContactRelationships < ActiveRecord::Migration[8.0]
  def change
    add_column :contact_relationships, :role_in_relationship, :string
    add_column :contact_relationships, :ownership_percentage, :decimal, precision: 5, scale: 2
    add_column :contact_relationships, :context, :text
    add_column :contact_relationships, :start_date, :date
    add_column :contact_relationships, :end_date, :date
    add_column :contact_relationships, :is_active, :boolean, default: true
    add_column :contact_relationships, :metadata, :jsonb, default: {}

    add_index :contact_relationships, :is_active
    add_index :contact_relationships, :relationship_type
  end
end
