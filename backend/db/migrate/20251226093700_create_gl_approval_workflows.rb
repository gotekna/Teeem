# frozen_string_literal: true

class CreateGlApprovalWorkflows < ActiveRecord::Migration[7.1]
  def change
    # Approval workflow templates
    create_table :gl_approval_workflows do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :name, null: false
      t.string :document_type, null: false, limit: 30  # bill, purchase_order, invoice, journal, expense
      t.text :description

      # Conditions for when this workflow applies
      t.decimal :min_amount, precision: 15, scale: 2  # Apply when amount >= this
      t.decimal :max_amount, precision: 15, scale: 2  # Apply when amount <= this
      t.string :category  # Specific category (e.g., "Capital Expenditure")

      t.boolean :active, default: true
      t.integer :priority, default: 0  # Higher priority workflows match first

      t.timestamps
    end

    add_index :gl_approval_workflows, [:corporate_id, :document_type, :active],
              name: "idx_approval_workflows_type"

    # Workflow steps (multi-level)
    create_table :gl_approval_workflow_steps do |t|
      t.references :workflow, null: false, foreign_key: { to_table: :gl_approval_workflows }

      t.integer :step_order, null: false, default: 1
      t.string :approval_type, null: false, default: "user", limit: 20  # user, role, any_of, all_of

      # For user type
      t.references :approver, foreign_key: { to_table: :users }

      # For role type
      t.string :required_role, limit: 50  # admin, manager, finance_approver

      # For any_of/all_of types
      t.text :approver_ids  # JSON array of user IDs

      t.boolean :required, default: true  # If false, can be skipped
      t.integer :timeout_hours  # Auto-escalate after X hours

      t.timestamps
    end

    add_index :gl_approval_workflow_steps, [:workflow_id, :step_order],
              name: "idx_approval_steps_order"

    # Approval requests (instances of approvals)
    create_table :gl_approval_requests do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :workflow, foreign_key: { to_table: :gl_approval_workflows }
      t.references :requested_by, foreign_key: { to_table: :users }

      # Polymorphic reference to the document
      t.string :approvable_type, null: false
      t.bigint :approvable_id, null: false

      t.decimal :amount, precision: 15, scale: 2
      t.text :notes

      # Current status
      t.string :status, null: false, default: "pending", limit: 20  # pending, approved, rejected, cancelled
      t.integer :current_step, default: 1
      t.integer :total_steps

      t.datetime :submitted_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :gl_approval_requests, [:approvable_type, :approvable_id],
              name: "idx_approval_requests_approvable"
    add_index :gl_approval_requests, [:corporate_id, :status],
              name: "idx_approval_requests_status"

    # Individual step approvals
    create_table :gl_approval_actions do |t|
      t.references :approval_request, null: false, foreign_key: { to_table: :gl_approval_requests }
      t.references :workflow_step, foreign_key: { to_table: :gl_approval_workflow_steps }
      t.references :user, foreign_key: true

      t.integer :step_number, null: false
      t.string :action, null: false, limit: 20  # approved, rejected, delegated, skipped
      t.text :comments
      t.datetime :acted_at, null: false

      # Delegation
      t.references :delegated_to, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :gl_approval_actions, [:approval_request_id, :step_number],
              name: "idx_approval_actions_step"
  end
end
