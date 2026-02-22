# frozen_string_literal: true

# Add sm_schedule_master_template_id to quote_templates
#
# A Quote Template is linked to an SM Template so that the user can
# pick which Schedule Master template's PO tasks to include.
# Pattern: Same as PoTemplatePack.sm_schedule_master_template_id
#
class AddSmTemplateToQuoteTemplates < ActiveRecord::Migration[7.2]
  def change
    add_column :quote_templates, :sm_schedule_master_template_id, :bigint
    add_index :quote_templates, :sm_schedule_master_template_id
    add_foreign_key :quote_templates, :sm_schedule_master_templates
  end
end
