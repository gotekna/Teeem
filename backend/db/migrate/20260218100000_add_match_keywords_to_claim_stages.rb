# frozen_string_literal: true

class AddMatchKeywordsToClaimStages < ActiveRecord::Migration[7.1]
  def change
    add_column :claim_stage_template_lines, :match_keywords, :string
    add_column :job_claim_stages, :match_keywords, :string
  end
end
