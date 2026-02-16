# frozen_string_literal: true

# Move SmTask SLA/ticket settings from hardcoded constants to tenant-configurable JSONB columns.
# Different businesses need different SLA response/resolution times and ticket categories.
class AddTicketSettingsToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    add_column :tenant_settings, :ticket_sla_response_hours, :jsonb,
      default: { "urgent" => 1, "high" => 4, "medium" => 8, "low" => 24 },
      comment: "SLA response time by priority (hours)"

    add_column :tenant_settings, :ticket_sla_resolution_hours, :jsonb,
      default: { "urgent" => 4, "high" => 24, "medium" => 72, "low" => 168 },
      comment: "SLA resolution time by priority (hours)"

    add_column :tenant_settings, :ticket_priorities, :jsonb,
      default: ["urgent", "high", "medium", "low"],
      comment: "Available ticket priority levels"

    add_column :tenant_settings, :ticket_categories, :jsonb,
      default: ["bug", "feature_request", "question", "onboarding", "billing", "other"],
      comment: "Available ticket categories"
  end
end
