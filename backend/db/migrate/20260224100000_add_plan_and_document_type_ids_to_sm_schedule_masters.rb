# frozen_string_literal: true

class AddPlanAndDocumentTypeIdsToSmScheduleMasters < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_schedule_masters, :plan_type_ids, :jsonb, default: []
    add_column :sm_schedule_masters, :document_ref_type_ids, :jsonb, default: []
  end
end
