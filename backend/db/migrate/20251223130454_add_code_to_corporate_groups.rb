class AddCodeToCorporateGroups < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_groups, :code, :string
  end
end
