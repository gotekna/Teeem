class CreateUnitsOfMeasure < ActiveRecord::Migration[8.0]
  def change
    create_table :units_of_measure do |t|
      t.string :code, null: false, limit: 20
      t.string :name, null: false, limit: 50
      t.string :description, limit: 100
      t.integer :sort_order, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :units_of_measure, :code, unique: true
    add_index :units_of_measure, :is_active

    # Seed the standard units
    reversible do |dir|
      dir.up do
        execute <<-SQL
          INSERT INTO units_of_measure (code, name, description, sort_order, is_active, created_at, updated_at)
          VALUES
            ('Each', 'Each', 'Individual items', 1, true, NOW(), NOW()),
            ('Lm', 'Lineal Metre', 'Linear measurement in metres', 2, true, NOW(), NOW()),
            ('m2', 'Square Metre', 'Area measurement in square metres', 3, true, NOW(), NOW()),
            ('m3', 'Cubic Metre', 'Volume measurement in cubic metres', 4, true, NOW(), NOW());
        SQL
      end
    end
  end
end
