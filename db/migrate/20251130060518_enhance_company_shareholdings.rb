class EnhanceCompanyShareholdings < ActiveRecord::Migration[8.0]
  def change
    add_column :company_shareholdings, :acquisition_date, :date
    add_column :company_shareholdings, :disposal_date, :date
    add_column :company_shareholdings, :certificate_number, :string
    add_column :company_shareholdings, :consideration_paid, :decimal, precision: 15, scale: 2
  end
end
