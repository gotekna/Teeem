class CreateCompanyApprovalRules < ActiveRecord::Migration[8.0]
  def change
    create_table :company_approval_rules do |t|
      t.references :corporate, null: false, foreign_key: true

      t.string :rule_type, null: false  # bill_approval, payment_batch, po_variance, workflow_config
      t.string :name, null: false
      t.text :description

      # Threshold conditions
      t.decimal :min_amount, precision: 15, scale: 2
      t.decimal :max_amount, precision: 15, scale: 2
      t.decimal :variance_threshold_percent, precision: 5, scale: 2  # e.g., 5.0 for 5%
      t.decimal :variance_threshold_amount, precision: 15, scale: 2

      # Approver configuration
      t.string :approver_type, null: false  # user, role, group
      t.bigint :approver_id              # User ID if type=user
      t.string :approver_role            # Role name if type=role
      t.bigint :approver_group_id        # UserGroup ID if type=group

      # Escalation
      t.integer :escalation_hours
      t.bigint :escalation_to_user_id

      # BPMN integration
      t.references :bpmn_process, foreign_key: true

      # Configuration (for workflow_config rule_type)
      t.jsonb :config, default: {}

      t.integer :priority, default: 0  # Higher = checked first
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :company_approval_rules, [ :corporate_id, :rule_type, :is_active ],
              name: 'idx_approval_rules_company_type_active'
    add_index :company_approval_rules, :priority
    add_foreign_key :company_approval_rules, :users, column: :approver_id
    add_foreign_key :company_approval_rules, :users, column: :escalation_to_user_id
  end
end
