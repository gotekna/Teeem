# frozen_string_literal: true

# Replace sm_schedule_master_template_id with po_template_pack_id on quote_templates
#
# Instead of linking directly to an SM Template (and manually picking tasks),
# the Quote Template now links to a PO Template Pack which already defines:
#   - Which SM Template to use
#   - Which PO Tasks (SmScheduleMaster) to include
#   - Which supplier is assigned to each task (from pricebook)
#
class ReplaceSmTemplateWithPoPackOnQuoteTemplates < ActiveRecord::Migration[7.2]
  def change
    # Add PO Template Pack link
    add_column :quote_templates, :po_template_pack_id, :bigint
    add_index :quote_templates, :po_template_pack_id
    add_foreign_key :quote_templates, :po_template_packs

    # Remove SM Template link (now derived via po_template_pack.sm_schedule_master_template)
    remove_foreign_key :quote_templates, :sm_schedule_master_templates
    remove_index :quote_templates, :sm_schedule_master_template_id
    remove_column :quote_templates, :sm_schedule_master_template_id, :bigint
  end
end
