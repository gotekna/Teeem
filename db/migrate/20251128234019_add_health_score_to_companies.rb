class AddHealthScoreToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :health_score, :integer
    add_column :companies, :health_status, :string
  end
end
