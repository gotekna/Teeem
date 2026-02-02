# frozen_string_literal: true

class CreateGlAiFeatures < ActiveRecord::Migration[7.2]
  def change
    # AI Transaction Categorization
    create_table :gl_transaction_categories do |t|
      t.references :corporate, null: false, foreign_key: true
      t.string :name, null: false
      t.string :category_type # expense, revenue, asset, liability
      t.references :default_account, foreign_key: { to_table: :gl_accounts }
      t.references :default_tax_rate, foreign_key: { to_table: :gl_tax_rates }
      t.jsonb :keywords, default: [] # Keywords for AI matching
      t.jsonb :patterns, default: [] # Regex patterns
      t.integer :usage_count, default: 0
      t.float :confidence_threshold, default: 0.7
      t.boolean :active, default: true
      t.timestamps
    end

    add_index :gl_transaction_categories, [:corporate_id, :name], unique: true
    add_index :gl_transaction_categories, :category_type
    add_index :gl_transaction_categories, :active

    # AI Categorization predictions
    create_table :gl_categorization_predictions do |t|
      t.references :corporate, null: false, foreign_key: true
      t.bigint :bank_transaction_id # No FK - table may not exist yet
      t.references :predicted_category, foreign_key: { to_table: :gl_transaction_categories }
      t.references :predicted_account, foreign_key: { to_table: :gl_accounts }
      t.references :actual_category, foreign_key: { to_table: :gl_transaction_categories }
      t.references :actual_account, foreign_key: { to_table: :gl_accounts }
      t.float :confidence_score, null: false
      t.jsonb :features_used, default: {} # What features led to prediction
      t.string :status, default: "pending" # pending, accepted, rejected, corrected
      t.references :reviewed_by, foreign_key: { to_table: :users }
      t.datetime :reviewed_at
      t.text :rejection_reason
      t.timestamps
    end

    add_index :gl_categorization_predictions, :bank_transaction_id
    add_index :gl_categorization_predictions, :confidence_score
    add_index :gl_categorization_predictions, :status
    add_index :gl_categorization_predictions, :created_at

    # Anomaly Detection
    create_table :gl_anomalies do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :anomalable, polymorphic: true # Can be invoice, payment, journal, etc.
      t.string :anomaly_type, null: false # unusual_amount, timing, duplicate, pattern_break
      t.string :severity, null: false, default: "medium" # low, medium, high, critical
      t.text :description, null: false
      t.float :anomaly_score # 0-1 score of how unusual
      t.jsonb :details, default: {} # Specific anomaly details
      t.jsonb :comparison_data, default: {} # Historical comparison
      t.string :status, default: "open" # open, investigating, resolved, dismissed
      t.references :assigned_to, foreign_key: { to_table: :users }
      t.references :resolved_by, foreign_key: { to_table: :users }
      t.datetime :resolved_at
      t.text :resolution_notes
      t.timestamps
    end

    add_index :gl_anomalies, :anomaly_type
    add_index :gl_anomalies, :severity
    add_index :gl_anomalies, :status
    add_index :gl_anomalies, :created_at

    # Anomaly detection rules
    create_table :gl_anomaly_rules do |t|
      t.references :corporate, null: false, foreign_key: true
      t.string :name, null: false
      t.string :rule_type, null: false # threshold, pattern, statistical
      t.string :entity_type, null: false # invoice, payment, journal, etc.
      t.jsonb :conditions, null: false # Rule conditions
      t.string :severity, default: "medium"
      t.boolean :active, default: true
      t.integer :trigger_count, default: 0
      t.timestamps
    end

    add_index :gl_anomaly_rules, :rule_type
    add_index :gl_anomaly_rules, :entity_type
    add_index :gl_anomaly_rules, :active

    # Duplicate Detection
    create_table :gl_duplicate_groups do |t|
      t.references :corporate, null: false, foreign_key: true
      t.string :entity_type, null: false # invoice, bill, payment, contact
      t.string :status, default: "pending" # pending, reviewed, resolved
      t.float :similarity_score
      t.jsonb :matching_fields, default: [] # Fields that matched
      t.references :reviewed_by, foreign_key: { to_table: :users }
      t.datetime :reviewed_at
      t.string :resolution # keep_first, keep_last, merge, none_duplicate
      t.timestamps
    end

    add_index :gl_duplicate_groups, :entity_type
    add_index :gl_duplicate_groups, :status
    add_index :gl_duplicate_groups, :created_at

    # Duplicate group members
    create_table :gl_duplicate_members do |t|
      t.references :duplicate_group, null: false, foreign_key: { to_table: :gl_duplicate_groups }
      t.references :duplicable, polymorphic: true
      t.boolean :is_primary, default: false
      t.boolean :is_retained, default: false # Kept after resolution
      t.timestamps
    end

    add_index :gl_duplicate_members, [:duplicate_group_id, :is_primary]
    add_index :gl_duplicate_members, [:duplicable_type, :duplicable_id]

    # Late Payment Prediction
    create_table :gl_payment_predictions do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :invoice, null: false, foreign_key: { to_table: :gl_invoices }
      t.references :contact, foreign_key: true
      t.float :probability_late, null: false # 0-1
      t.integer :predicted_days_late # How many days late expected
      t.date :predicted_payment_date
      t.jsonb :risk_factors, default: [] # What contributed to prediction
      t.string :risk_level # low, medium, high
      t.boolean :prediction_correct # Set after actual payment
      t.date :actual_payment_date
      t.timestamps
    end

    add_index :gl_payment_predictions, :probability_late
    add_index :gl_payment_predictions, :risk_level
    add_index :gl_payment_predictions, :created_at

    # Customer payment behavior history (for prediction model)
    create_table :gl_customer_payment_stats do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.integer :total_invoices, default: 0
      t.integer :paid_on_time, default: 0
      t.integer :paid_late, default: 0
      t.float :average_days_to_pay
      t.float :average_days_late
      t.decimal :total_invoiced, precision: 15, scale: 2, default: 0
      t.decimal :total_outstanding, precision: 15, scale: 2, default: 0
      t.decimal :largest_invoice, precision: 15, scale: 2
      t.date :last_payment_date
      t.date :last_late_payment
      t.float :payment_reliability_score # 0-100
      t.timestamps
    end

    add_index :gl_customer_payment_stats, [:corporate_id, :contact_id], unique: true
    add_index :gl_customer_payment_stats, :payment_reliability_score
  end
end
