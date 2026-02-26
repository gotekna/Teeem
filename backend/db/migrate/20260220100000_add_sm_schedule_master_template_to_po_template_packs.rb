# frozen_string_literal: true

class AddSmScheduleMasterTemplateToPoTemplatePacks < ActiveRecord::Migration[7.1]
  def change
    add_reference :po_template_packs, :sm_schedule_master_template,
                  null: true,
                  foreign_key: true,
                  index: true
  end
end
