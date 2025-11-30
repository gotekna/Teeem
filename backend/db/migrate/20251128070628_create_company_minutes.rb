class CreateCompanyMinutes < ActiveRecord::Migration[8.0]
  def change
    create_table :company_minutes do |t|
      t.references :company, null: false, foreign_key: true
      t.references :minute_template, foreign_key: true
      t.string :title, null: false
      t.date :meeting_date, null: false
      t.text :content  # Generated/edited content
      t.string :status, default: 'draft'  # draft, approved, signed, filed
      t.date :signed_date
      t.string :signed_by  # Names of signatories
      t.string :document_path  # Path to PDF if generated

      t.timestamps
    end
    add_index :company_minutes, :meeting_date
    add_index :company_minutes, :status
  end
end
