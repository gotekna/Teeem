# frozen_string_literal: true

class AddOverheadPoAndClaimTemplateLink < ActiveRecord::Migration[7.2]
  def change
    # Each claim stage line can optionally name the overhead PO it maps to
    add_column :claim_stage_template_lines, :overhead_po_name, :string, limit: 100

    # Each SM template can optionally link to a claim stage template
    # for auto-deriving overhead split percentages
    add_column :sm_schedule_master_templates, :claim_stage_template_id, :bigint
    add_index :sm_schedule_master_templates, :claim_stage_template_id,
              name: "idx_sm_templates_claim_stage_template"
    add_foreign_key :sm_schedule_master_templates, :claim_stage_templates
  end
end
