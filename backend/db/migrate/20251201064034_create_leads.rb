class CreateLeads < ActiveRecord::Migration[8.0]
  def change
    create_table :leads do |t|
      t.string :lead_number
      t.string :title
      t.string :status, default: 'new'
      t.string :source
      t.string :client_name
      t.string :client_email
      t.string :client_phone
      t.string :client_company
      t.string :site_address
      t.string :site_suburb
      t.string :site_state
      t.string :site_postcode
      t.string :lot_plan_number
      t.string :project_type
      t.string :dwelling_type
      t.integer :number_of_storeys
      t.decimal :estimated_floor_area, precision: 10, scale: 2
      t.decimal :estimated_value, precision: 12, scale: 2, default: 0
      t.date :expected_start_date
      t.string :decision_timeline
      t.text :notes
      t.references :job, foreign_key: true
      t.integer :contract_id

      t.timestamps
    end

    add_index :leads, :lead_number, unique: true
    add_index :leads, :status
  end
end
