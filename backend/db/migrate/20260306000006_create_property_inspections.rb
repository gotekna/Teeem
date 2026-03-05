class CreatePropertyInspections < ActiveRecord::Migration[8.0]
  def change
    create_table :property_inspections do |t|
      t.bigint :tenant_id, null: false
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, foreign_key: true

      t.string :inspection_type, null: false # entry, routine, exit, maintenance, sda_compliance
      t.date :scheduled_date, null: false
      t.date :completed_date
      t.references :inspector_contact, foreign_key: { to_table: :contacts }

      t.string :status, null: false, default: "scheduled" # scheduled, in_progress, completed, overdue
      t.text :notes
      t.string :overall_condition # excellent, good, fair, poor
      t.date :next_inspection_date

      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :property_inspections, :tenant_id
    add_index :property_inspections, :inspection_type
    add_index :property_inspections, :status
    add_index :property_inspections, :scheduled_date
    add_index :property_inspections, [:property_id, :status]
  end
end
