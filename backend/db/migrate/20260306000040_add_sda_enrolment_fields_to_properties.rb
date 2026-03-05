class AddSdaEnrolmentFieldsToProperties < ActiveRecord::Migration[7.1]
  def change
    change_table :properties do |t|
      # SDA dwelling classification
      t.string :sda_building_type          # apartment, duplex, group_home, house, townhouse, villa
      t.string :sda_enrolment_status, default: "not_started"
      t.integer :sda_max_residents
      t.string :sda_new_or_existing       # new_build, existing

      # Assessor details
      t.string :sda_assessor_name
      t.string :sda_assessor_number
      t.date :sda_assessment_date

      # GST
      t.boolean :sda_gst_credits_claimed, default: false
      t.decimal :sda_gst_amount_claimed, precision: 12, scale: 2

      # Accessibility features (structural ramps, ceiling hoists, etc.)
      t.jsonb :sda_features, default: {}

      # Key dates
      t.date :sda_enrolled_date
      t.date :completion_date

      # Property identification
      t.string :lot_number
    end

    add_index :properties, :sda_enrolment_status
    add_index :properties, :sda_building_type

    change_table :tenant_settings do |t|
      t.string :ndis_registration_number
    end
  end
end
