# frozen_string_literal: true

# Add tender markup % (applied to non-PC/PS items) and smart roundup toggle.
# PO cost × (1 + tender_markup %) → smart round up = sell price.
class AddTenderMarkupPercent < ActiveRecord::Migration[7.2]
  def change
    # Global default
    add_column :sm_settings, :default_tender_markup_percent, :decimal, precision: 5, scale: 2, default: 0.0
    # Per-template override
    add_column :sm_schedule_master_templates, :default_tender_markup_percent, :decimal, precision: 5, scale: 2
    # PO auto-link for tender markup
    add_column :sm_schedule_master_templates, :charge_tender_markup_sm_ids, :jsonb, default: []
  end
end
