# frozen_string_literal: true

class AddStorageBlobToJobPlanRevisions < ActiveRecord::Migration[7.1]
  def change
    add_reference :job_plan_revisions, :storage_blob, foreign_key: true, null: true, index: true
  end
end
