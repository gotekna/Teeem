# frozen_string_literal: true

class CreateTrialInvitations < ActiveRecord::Migration[8.0]
  def change
    create_table :trial_invitations do |t|
      t.string :email, null: false
      t.string :name, null: false
      t.string :company_name, null: false
      t.string :token, null: false
      t.string :status, default: 'pending'
      t.bigint :invited_by_user_id
      t.bigint :tenant_id
      t.datetime :accepted_at
      t.datetime :expires_at, null: false
      t.text :personal_message
      t.timestamps

      t.index :token, unique: true
      t.index :email
      t.index :status
      t.index :expires_at
      t.index :invited_by_user_id
      t.index :tenant_id
    end

    add_foreign_key :trial_invitations, :users, column: :invited_by_user_id, on_delete: :nullify
    add_foreign_key :trial_invitations, :tenants, column: :tenant_id, on_delete: :nullify
  end
end
