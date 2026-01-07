class AddGodViewAccessToRoles < ActiveRecord::Migration[8.0]
  def change
    add_column :roles, :god_view_access, :boolean, default: false, null: false

    reversible do |dir|
      dir.up do
        # SSoT: Set god_view_access for roles that previously had it hardcoded
        # Original list: admin, product_owner, user, estimator, supervisor, builder
        # Plus adding all current staff roles for consistency
        execute <<-SQL
          UPDATE roles SET god_view_access = true
          WHERE name IN ('admin', 'product_owner', 'user', 'estimator', 'supervisor',
                         'pre_construction', 'drafting', 'accounts_department', 'sales',
                         'final_certification', 'site_coordinator', 'client_coordinator')
        SQL
      end
    end
  end
end
