class CreateReferralCommissions < ActiveRecord::Migration[8.0]
  def change
    create_table :referral_commissions do |t|
      t.references :referrer_contact, null: false, foreign_key: { to_table: :contacts }  # Who earns the commission
      t.references :customer_contact, null: false, foreign_key: { to_table: :contacts }  # The paying customer
      t.references :saas_billing_record, null: false, foreign_key: true  # Which billing period
      t.string :commission_level, null: false  # l1 (20%) or l2 (10%)
      t.decimal :customer_fee, precision: 12, scale: 2, null: false  # The fee the customer paid
      t.decimal :commission_rate, precision: 5, scale: 4, null: false  # 0.20 or 0.10
      t.decimal :commission_amount, precision: 12, scale: 2, null: false  # Calculated amount
      t.string :status, default: 'pending'  # pending, eligible, paid, forfeited
      t.string :ineligible_reason  # training_incomplete, threshold_not_met, training_expired
      t.datetime :paid_at
      t.text :notes

      t.timestamps
    end

    add_index :referral_commissions, :commission_level
    add_index :referral_commissions, :status
    add_index :referral_commissions, [:referrer_contact_id, :status], name: 'index_commissions_on_referrer_and_status'
  end
end
