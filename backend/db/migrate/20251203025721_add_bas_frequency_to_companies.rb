class AddBasFrequencyToCompanies < ActiveRecord::Migration[8.0]
  def change
    # BAS reporting frequency: quarterly (default for < $20M turnover) or monthly (> $20M turnover)
    add_column :companies, :bas_frequency, :string, default: 'quarterly'
  end
end
