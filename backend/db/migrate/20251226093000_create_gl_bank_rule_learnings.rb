# frozen_string_literal: true

class CreateGlBankRuleLearnings < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_bank_rule_learnings do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :gl_account, null: false, foreign_key: { to_table: :gl_accounts }
      t.references :user, foreign_key: true
      t.bigint :bank_line_id

      t.string :transaction_description, null: false
      t.decimal :transaction_amount, precision: 15, scale: 2
      t.string :transaction_type, limit: 10  # credit/debit
      t.string :payee_name
      t.datetime :learned_at, null: false

      t.timestamps
    end

    # Index for finding patterns
    add_index :gl_bank_rule_learnings,
              [:corporate_company_id, :transaction_description, :gl_account_id],
              name: "idx_bank_rule_learnings_pattern"

    # Add auto_created flag to bank_rules if not exists
    unless column_exists?(:gl_bank_rules, :auto_created)
      add_column :gl_bank_rules, :auto_created, :boolean, default: false
      add_column :gl_bank_rules, :confidence, :decimal, precision: 5, scale: 2
      add_column :gl_bank_rules, :pattern_count, :integer
    end
  end
end
