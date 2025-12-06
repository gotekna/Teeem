class CreateScheduleTemplateRowAudits < ActiveRecord::Migration[8.0]
  def change
    create_table :schedule_template_row_audits do |t|
      t.references :schedule_template_row, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :field_name, null: false
      t.boolean :old_value
      t.boolean :new_value
      t.datetime :changed_at, null: false

      t.timestamps
    end

    add_index :schedule_template_row_audits, [ :schedule_template_row_id, :changed_at ]
  end
end
