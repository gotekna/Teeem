class CreateRecipeTables < ActiveRecord::Migration[8.0]
  def change
    # Recipe Categories - hierarchical organization (like DataBuild's tree structure)
    create_table :recipe_categories do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.text :description
      t.references :parent, foreign_key: { to_table: :recipe_categories }
      t.integer :position, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :recipe_categories, :code, unique: true
    add_index :recipe_categories, [:parent_id, :position]

    # Recipes - reusable assemblies/packages (like DataBuild's recipes)
    create_table :recipes do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.text :description
      t.string :recipe_type, default: 'full_assembly' # materials, labour, full_assembly, subcontract
      t.string :status, default: 'draft' # draft, active, archived
      t.references :recipe_category, foreign_key: true
      t.references :default_supplier, foreign_key: { to_table: :contacts }
      t.decimal :cached_total, precision: 12, scale: 2 # Cached total for quick display
      t.datetime :cached_total_at # When total was last calculated
      t.integer :version_number, default: 1
      t.text :notes
      t.jsonb :metadata, default: {} # Flexible storage for future fields

      t.timestamps
    end

    add_index :recipes, :code, unique: true
    add_index :recipes, :status
    add_index :recipes, :recipe_type
    add_index :recipes, [:recipe_category_id, :name]

    # Recipe Items - line items within a recipe
    create_table :recipe_items do |t|
      t.references :recipe, null: false, foreign_key: true
      t.references :pricebook_item, foreign_key: { to_table: :pricebook } # Optional link to pricebook
      t.string :description, null: false
      t.string :unit_of_measure, default: 'ea'
      t.string :cost_type, default: 'materials' # materials, labour, overhead, subcontract

      # Quantity can be fixed or formula-based
      t.decimal :base_quantity, precision: 12, scale: 4
      t.string :quantity_formula # e.g., "floor_area * 1.1" or "{floor_area} * 1.1"
      t.boolean :uses_formula, default: false

      # Price - use pricebook price or override
      t.decimal :unit_price_override, precision: 12, scale: 2
      t.boolean :use_pricebook_price, default: true

      # Calculated fields (cached)
      t.decimal :cached_unit_price, precision: 12, scale: 2
      t.decimal :cached_line_total, precision: 12, scale: 2

      t.integer :sequence_order, default: 0
      t.text :notes
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :recipe_items, [:recipe_id, :sequence_order]
    # Note: pricebook_item_id index created automatically by t.references

    # Recipe Versions - track price history snapshots
    create_table :recipe_versions do |t|
      t.references :recipe, null: false, foreign_key: true
      t.integer :version_number, null: false
      t.decimal :total_amount, precision: 12, scale: 2
      t.jsonb :snapshot_data # Full snapshot of recipe items at this version
      t.string :change_reason
      t.references :created_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :recipe_versions, [:recipe_id, :version_number], unique: true
  end
end
