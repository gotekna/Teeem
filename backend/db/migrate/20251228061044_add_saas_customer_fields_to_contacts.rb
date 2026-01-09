class AddSaasCustomerFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    # SaaS Customer fields
    add_column :contacts, :is_saas_customer, :boolean, default: false
    add_column :contacts, :annual_turnover, :decimal, precision: 15, scale: 2
    add_column :contacts, :saas_status, :string, default: 'active'  # trial, active, suspended, churned
    add_column :contacts, :saas_started_at, :date
    add_column :contacts, :saas_churned_at, :date
    add_column :contacts, :support_contact_id, :bigint  # FK to Contact (referrer/support line - L1)
    add_column :contacts, :upline_contact_id, :bigint   # FK to Contact (support's support - L2)

    # Referrer fields
    add_column :contacts, :referrer_status, :string, default: 'pending'  # pending, training, eligible_l1, eligible_l2, suspended
    add_column :contacts, :referrer_training_completed_at, :datetime
    add_column :contacts, :referrer_training_expires_at, :datetime
    add_column :contacts, :l1_eligible_at, :datetime  # When reached $10k threshold
    add_column :contacts, :l2_eligible_at, :datetime  # When reached $50k threshold
    add_column :contacts, :total_network_fees, :decimal, precision: 12, scale: 2, default: 0
    add_column :contacts, :total_commissions_earned, :decimal, precision: 12, scale: 2, default: 0
    add_column :contacts, :total_commissions_paid, :decimal, precision: 12, scale: 2, default: 0

    # Indexes
    add_index :contacts, :is_saas_customer
    add_index :contacts, :saas_status
    add_index :contacts, :support_contact_id
    add_index :contacts, :upline_contact_id
    add_index :contacts, :referrer_status
  end
end
