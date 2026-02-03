class AddXeroStartDateToCorporateCompanyXeroConnections < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_xero_connections, :xero_start_date, :date
  end
end
