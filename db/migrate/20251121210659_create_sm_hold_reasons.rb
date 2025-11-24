class CreateSmHoldReasons < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_hold_reasons do |t|
      # Configuration
      t.string :name, null: false, limit: 100
      t.text :description
      t.string :color, default: '#EF4444', limit: 20
      t.string :icon, default: 'pause', limit: 50
      t.integer :sequence_order, null: false, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :sm_hold_reasons, :name, unique: true
    add_index :sm_hold_reasons, :sequence_order
    add_index :sm_hold_reasons, :is_active
  end
end
