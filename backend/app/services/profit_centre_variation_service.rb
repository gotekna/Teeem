# frozen_string_literal: true

# ProfitCentreVariationService - Auto-creates numbered variations for a job
#
# Creates "Variation 1" (VAR-001), "Variation 2" (VAR-002), etc.
# Auto-detects the next available number per job.
#
class ProfitCentreVariationService
  def initialize(job)
    @job = job
  end

  def create!(name: nil, description: nil)
    next_number = next_variation_number

    ProfitCentre.create!(
      tenant_id: @job.tenant_id,
      job_id: @job.id,
      code: format("VAR-%03d", next_number),
      name: name || "Variation #{next_number}",
      centre_type: "variation",
      description: description,
      is_template: false,
      active: true,
      sort_order: next_number
    )
  end

  private

  def next_variation_number
    existing = ProfitCentre.where(job_id: @job.id, centre_type: "variation")
                           .pluck(:code)
                           .filter_map { |code|
                             match = code.match(/\AVAR-(\d+)\z/)
                             match ? match[1].to_i : nil
                           }

    (existing.max || 0) + 1
  end
end
