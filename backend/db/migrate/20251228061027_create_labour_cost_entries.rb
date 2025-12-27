# frozen_string_literal: true

# LabourCostEntry - simPRO-style labour cost tracking with full cost loading
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Formula: Total Cost = Base Labour + Employment Costs + Overhead
#   Base Labour = (Regular × Rate) + (OT1.5 × Rate × 1.5) + (OT2 × Rate × 2)
#   Employment = Base × Employment% (super, leave, workers comp)
#   Overhead = (Base + Employment) × Overhead%
#
class CreateLabourCostEntries < ActiveRecord::Migration[8.0]
  def change
    create_table :labour_cost_entries do |t|
      # Source session (optional - can be manual entry)
      t.references :site_presence_session, foreign_key: { on_delete: :nullify }

      # Core relationships
      t.references :worker_profile, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :sm_task, foreign_key: true
      t.references :cost_centre, foreign_key: true

      # Date
      t.date :entry_date, null: false

      # Hours breakdown (Australian overtime rules)
      t.decimal :regular_hours, precision: 5, scale: 2, default: 0      # First 7.6h
      t.decimal :overtime_1_5x_hours, precision: 5, scale: 2, default: 0  # Next 2h
      t.decimal :overtime_2x_hours, precision: 5, scale: 2, default: 0    # Beyond
      t.decimal :travel_hours, precision: 5, scale: 2, default: 0
      t.decimal :standby_hours, precision: 5, scale: 2, default: 0

      # Rate snapshot at time of entry (for historical accuracy)
      t.decimal :base_rate, precision: 10, scale: 2
      t.decimal :overtime_1_5x_rate, precision: 10, scale: 2
      t.decimal :overtime_2x_rate, precision: 10, scale: 2
      t.decimal :employment_cost_percent_used, precision: 5, scale: 2
      t.decimal :overhead_percent_used, precision: 5, scale: 2

      # Cost calculations (simPRO formula)
      t.decimal :base_labour_cost, precision: 10, scale: 2, default: 0
      t.decimal :employment_cost, precision: 10, scale: 2, default: 0
      t.decimal :overhead_cost, precision: 10, scale: 2, default: 0
      t.decimal :total_cost, precision: 10, scale: 2, default: 0

      # Entry source tracking
      t.string :entry_source, limit: 20, default: "manual"
      # "photo" = from SitePresenceSession
      # "manual" = manually entered
      # "ai_suggested" = from AiTimesheetSuggestion
      # "imported" = from external system

      # Billable tracking
      t.boolean :billable, default: true
      t.decimal :billable_rate, precision: 10, scale: 2    # Rate to charge client
      t.decimal :billable_amount, precision: 10, scale: 2  # Amount to bill

      # Billing status
      t.string :billing_status, limit: 20, default: "unbilled"
      # "unbilled", "pending_invoice", "invoiced", "written_off"
      # Note: invoice_id is a soft reference - no FK constraint as invoices table may not exist
      t.bigint :invoice_id

      # Notes
      t.text :description
      t.text :internal_notes

      t.timestamps
    end

    # Indexes
    add_index :labour_cost_entries, :entry_date
    add_index :labour_cost_entries, :entry_source
    add_index :labour_cost_entries, :billing_status
    add_index :labour_cost_entries, [:job_id, :entry_date]
    add_index :labour_cost_entries, [:worker_profile_id, :entry_date]
    add_index :labour_cost_entries, [:cost_centre_id, :entry_date]

    # For billing queue
    add_index :labour_cost_entries, [:billable, :billing_status],
              name: "idx_labour_cost_billing_queue"
  end
end
