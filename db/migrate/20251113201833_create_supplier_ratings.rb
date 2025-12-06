class CreateSupplierRatings < ActiveRecord::Migration[8.0]
  def change
    create_table :supplier_ratings do |t|
      t.references :contact, null: false, foreign_key: true  # The supplier being rated
      t.references :rated_by_user, null: false, foreign_key: { to_table: :users }
      t.references :construction, foreign_key: true  # Optional: specific project
      t.references :purchase_order, foreign_key: true  # Optional: specific PO

      # Rating categories (1-5 scale)
      t.integer :quality_rating  # Quality of work/materials
      t.integer :timeliness_rating  # On-time delivery
      t.integer :communication_rating  # Responsiveness
      t.integer :professionalism_rating  # Professional conduct
      t.integer :value_rating  # Value for money

      # Calculated overall
      t.decimal :overall_rating, precision: 3, scale: 2  # Average of above

      # Comments
      t.text :positive_feedback
      t.text :areas_for_improvement
      t.text :internal_notes  # Not visible to supplier

      t.timestamps
    end

    add_index :supplier_ratings, [ :contact_id, :created_at ]
  end
end
