# frozen_string_literal: true

class AddTrialFieldsToTenants < ActiveRecord::Migration[8.0]
  def change
    add_column :tenants, :trial_starts_at, :datetime
    add_column :tenants, :trial_ends_at, :datetime
    add_column :tenants, :trial_status, :string, default: 'none'
    add_column :tenants, :trial_days, :integer, default: 30
    add_column :tenants, :converted_at, :datetime
    add_column :tenants, :invited_by_user_id, :bigint

    add_index :tenants, :trial_status
    add_index :tenants, :trial_ends_at
    add_index :tenants, :invited_by_user_id
  end
end
