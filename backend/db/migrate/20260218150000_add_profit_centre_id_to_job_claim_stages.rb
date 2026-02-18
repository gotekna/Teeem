# frozen_string_literal: true

class AddProfitCentreIdToJobClaimStages < ActiveRecord::Migration[7.2]
  def change
    add_reference :job_claim_stages, :profit_centre, null: true, foreign_key: true
  end
end
