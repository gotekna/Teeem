# frozen_string_literal: true

class AddStripeCustomerIdToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :stripe_customer_id, :string
    add_index :contacts, :stripe_customer_id, unique: true, where: "stripe_customer_id IS NOT NULL"
  end
end
