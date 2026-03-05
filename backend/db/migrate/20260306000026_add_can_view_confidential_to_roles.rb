# frozen_string_literal: true

class AddCanViewConfidentialToRoles < ActiveRecord::Migration[7.2]
  def change
    add_column :roles, :can_view_confidential_fields, :boolean, default: false, null: false
  end
end
