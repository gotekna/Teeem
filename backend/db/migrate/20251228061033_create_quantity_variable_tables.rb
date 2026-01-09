class CreateQuantityVariableTables < ActiveRecord::Migration[8.0]
  def change
    # Quantity Variables - master list of house spec variables (like DataBuild's quantity generator)
    create_table :quantity_variables do |t|
      t.string :variable_name, null: false # snake_case, e.g., "floor_area"
      t.string :display_name, null: false # e.g., "Floor Area"
      t.string :category, null: false # dimensions, counts, specifications, computed
      t.string :data_type, default: 'number' # number, text, select
      t.string :unit_label # e.g., "m²", "rooms", "ea"

      # Validation constraints
      t.decimal :min_value, precision: 12, scale: 4
      t.decimal :max_value, precision: 12, scale: 4
      t.decimal :default_value, precision: 12, scale: 4

      # For select type - available options
      t.jsonb :select_options, default: [] # e.g., ["tile", "colorbond", "concrete"]

      # For computed variables - formula that references other variables
      t.string :formula # e.g., "floor_area * ceiling_height"
      t.boolean :is_computed, default: false

      # Workflow flags
      t.boolean :required_for_po_generation, default: false
      t.boolean :is_system_variable, default: false # Prevents deletion
      t.integer :position, default: 0
      t.text :description

      t.timestamps
    end

    add_index :quantity_variables, :variable_name, unique: true
    add_index :quantity_variables, :category
    add_index :quantity_variables, :position

    # Job Quantity Variables - per-job values for each variable
    create_table :job_quantity_variables do |t|
      t.references :job, null: false, foreign_key: true
      t.references :quantity_variable, null: false, foreign_key: true
      t.string :value # Stored as string, typed on retrieval based on data_type
      t.references :updated_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :job_quantity_variables, [:job_id, :quantity_variable_id], unique: true, name: 'idx_job_quantity_vars_unique'
  end
end
