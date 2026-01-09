class CreatePlanTables < ActiveRecord::Migration[8.0]
  def change
    # 1. Plan Categories (Global SSoT - like DocumentationCategory)
    create_table :plan_categories do |t|
      t.string :name, null: false
      t.string :code
      t.integer :sequence_order, default: 0
      t.boolean :is_active, default: true
      t.timestamps
    end

    add_index :plan_categories, :code, unique: true
    add_index :plan_categories, :sequence_order

    # 2. Plan Types (Standard drawing types within categories)
    create_table :plan_types do |t|
      t.references :plan_category, foreign_key: true
      t.string :name, null: false
      t.string :code, null: false
      t.boolean :allows_variants, default: true
      t.text :notes
      t.integer :sequence_order, default: 0
      t.boolean :is_active, default: true
      t.timestamps
    end

    add_index :plan_types, [:plan_category_id, :code], unique: true
    add_index :plan_types, :sequence_order

    # 3. Revision Formats (Configurable revision sequences)
    create_table :revision_formats do |t|
      t.string :name, null: false
      t.text :sequence  # JSON array: ["A","B","C"...] or ["1","2","3"...]
      t.boolean :is_default, default: false
      t.timestamps
    end

    # 4. Job Plan Tabs (Per-job tabs - like JobDocumentationTab)
    create_table :job_plan_tabs do |t|
      t.references :job, foreign_key: true, null: false
      t.references :plan_category, foreign_key: true
      t.references :parent, foreign_key: { to_table: :job_plan_tabs }
      t.string :name, null: false
      t.string :code
      t.integer :sequence_order, default: 0
      t.boolean :is_active, default: true
      t.timestamps
    end

    add_index :job_plan_tabs, [:job_id, :plan_category_id]

    # 5. Job Plans (Actual plan files attached to jobs)
    create_table :job_plans do |t|
      t.references :job, foreign_key: true, null: false
      t.references :job_plan_tab, foreign_key: true
      t.references :plan_type, foreign_key: true
      t.string :variant_suffix  # "b", "c" for extras like 02b
      t.string :display_name
      t.timestamps
    end

    add_index :job_plans, [:job_id, :plan_type_id, :variant_suffix],
              unique: true,
              name: 'idx_job_plans_unique_per_job'

    # 6. Job Plan Revisions (Revision history)
    create_table :job_plan_revisions do |t|
      t.references :job_plan, foreign_key: true, null: false
      t.string :revision, null: false
      t.date :revision_date
      t.date :issued_date
      t.boolean :is_on_issue, default: false
      t.string :sharepoint_file_id
      t.string :sharepoint_web_url
      t.string :file_name
      t.integer :file_size
      t.text :notes
      t.references :issued_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :job_plan_revisions, [:job_plan_id, :revision], unique: true
    add_index :job_plan_revisions, :is_on_issue

    # Add current_revision reference to job_plans (after revisions table exists)
    add_reference :job_plans, :current_revision,
                  foreign_key: { to_table: :job_plan_revisions }
  end
end
