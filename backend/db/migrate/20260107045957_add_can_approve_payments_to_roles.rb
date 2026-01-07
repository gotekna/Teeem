class AddCanApprovePaymentsToRoles < ActiveRecord::Migration[8.0]
  def change
    add_column :roles, :can_approve_payments, :boolean, default: false, null: false

    reversible do |dir|
      dir.up do
        # SSoT: Set can_approve_payments for roles that should receive payment notifications
        # Original hardcoded list was: supervisor, builder, admin
        # Updated to: supervisor, admin, accounts_department (builder doesn't exist)
        execute <<-SQL
          UPDATE roles SET can_approve_payments = true
          WHERE name IN ('admin', 'supervisor', 'accounts_department')
        SQL
      end
    end
  end
end
