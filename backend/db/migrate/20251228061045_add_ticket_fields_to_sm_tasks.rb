class AddTicketFieldsToSmTasks < ActiveRecord::Migration[8.0]
  def change
    # Link to SaaS customer
    add_column :sm_tasks, :saas_customer_id, :bigint

    # Ticket-specific fields
    add_column :sm_tasks, :is_ticket, :boolean, default: false
    add_column :sm_tasks, :ticket_priority, :string  # low, medium, high, urgent
    add_column :sm_tasks, :ticket_category, :string  # bug, feature_request, question, onboarding

    # SLA tracking
    add_column :sm_tasks, :sla_response_due_at, :datetime
    add_column :sm_tasks, :sla_resolution_due_at, :datetime
    add_column :sm_tasks, :sla_first_response_at, :datetime

    # Portal visibility
    add_column :sm_tasks, :customer_visible, :boolean, default: true
    add_column :sm_tasks, :submitted_via_portal, :boolean, default: false

    # Indexes
    add_index :sm_tasks, :saas_customer_id
    add_index :sm_tasks, :is_ticket
    add_index :sm_tasks, :ticket_priority
    add_index :sm_tasks, :sla_resolution_due_at
  end
end
