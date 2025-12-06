class DropSupplierTables < ActiveRecord::Migration[8.0]
  def up
    # Remove foreign key constraints first
    if foreign_key_exists?(:supplier_contacts, :suppliers)
      remove_foreign_key :supplier_contacts, :suppliers
    end
    if foreign_key_exists?(:supplier_contacts, :contacts)
      remove_foreign_key :supplier_contacts, :contacts
    end
    if foreign_key_exists?(:supplier_ratings, :contacts)
      remove_foreign_key :supplier_ratings, :contacts
    end
    if foreign_key_exists?(:supplier_ratings, :users)
      remove_foreign_key :supplier_ratings, column: :rated_by_user_id
    end
    if foreign_key_exists?(:supplier_ratings, :jobs)
      remove_foreign_key :supplier_ratings, :jobs
    end
    if foreign_key_exists?(:supplier_ratings, :purchase_orders)
      remove_foreign_key :supplier_ratings, :purchase_orders
    end
    if foreign_key_exists?(:suppliers, :contacts)
      remove_foreign_key :suppliers, :contacts
    end

    # Remove FK from schedule_template_rows to suppliers (should now point to contacts)
    if foreign_key_exists?(:schedule_template_rows, :suppliers)
      remove_foreign_key :schedule_template_rows, :suppliers
    end

    # Clear supplier_id values that don't exist in contacts (old supplier IDs)
    execute <<-SQL
      UPDATE schedule_template_rows
      SET supplier_id = NULL
      WHERE supplier_id IS NOT NULL
      AND supplier_id NOT IN (SELECT id FROM contacts)
    SQL

    # Add FK from schedule_template_rows.supplier_id to contacts
    unless foreign_key_exists?(:schedule_template_rows, :contacts, column: :supplier_id)
      add_foreign_key :schedule_template_rows, :contacts, column: :supplier_id
    end

    # Drop the tables
    drop_table :supplier_contacts if table_exists?(:supplier_contacts)
    drop_table :supplier_ratings if table_exists?(:supplier_ratings)
    drop_table :suppliers if table_exists?(:suppliers)
  end

  def down
    # Recreate suppliers table
    create_table :suppliers do |t|
      t.string :name, null: false
      t.string :email
      t.string :phone
      t.text :address
      t.string :contact_person
      t.decimal :rating, precision: 3, scale: 2
      t.decimal :response_rate, precision: 5, scale: 2
      t.integer :avg_response_time
      t.text :notes
      t.boolean :is_active, default: true
      t.references :contact, foreign_key: true
      t.decimal :confidence_score, precision: 3, scale: 2
      t.string :match_type
      t.boolean :is_verified, default: false
      t.string :original_name
      t.string :contact_name
      t.string :contact_number
      t.string :supplier_code
      t.jsonb :trade_categories, default: []
      t.jsonb :is_default_for_trades, default: {}
      t.decimal :markup_percentage, precision: 5, scale: 2
      t.integer :purchase_orders_count, default: 0
      t.timestamps
    end

    add_index :suppliers, :name, unique: true
    add_index :suppliers, :supplier_code, unique: true
    add_index :suppliers, :contact_id
    add_index :suppliers, :is_active
    add_index :suppliers, :is_verified
    add_index :suppliers, :match_type

    # Recreate supplier_contacts table
    create_table :supplier_contacts do |t|
      t.references :supplier, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.boolean :is_primary, default: false
      t.timestamps
    end

    add_index :supplier_contacts, [ :supplier_id, :contact_id ], unique: true

    # Recreate supplier_ratings table
    create_table :supplier_ratings do |t|
      t.references :contact, null: false, foreign_key: true
      t.references :rated_by_user, null: false, foreign_key: { to_table: :users }
      t.references :job, foreign_key: true
      t.references :purchase_order, foreign_key: true
      t.integer :quality_rating
      t.integer :timeliness_rating
      t.integer :communication_rating
      t.integer :professionalism_rating
      t.integer :value_rating
      t.decimal :overall_rating, precision: 3, scale: 2
      t.text :positive_feedback
      t.text :areas_for_improvement
      t.text :internal_notes
      t.timestamps
    end

    add_index :supplier_ratings, [ :contact_id, :created_at ]
  end
end
