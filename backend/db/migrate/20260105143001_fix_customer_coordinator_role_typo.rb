class FixCustomerCoordinatorRoleTypo < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      UPDATE roles
      SET name = 'client_coordinator',
          display_name = 'Client Coordinator'
      WHERE name = 'customer_coowordinator'
         OR name = 'customer_coordinator'
    SQL
  end

  def down
    execute <<-SQL
      UPDATE roles
      SET name = 'customer_coowordinator',
          display_name = 'Customer Coowordinator'
      WHERE name = 'client_coordinator'
    SQL
  end
end
