class CouncilLookupService
  # SSoT: Council is determined by suburb NAME, not postcode
  # Same postcode can have different councils (e.g., Rochedale South = Logan, Rochedale = Brisbane)
  def self.find_council(postcode:, suburb:)
    return nil if suburb.blank?

    # SSoT: Suburb table stores council per suburb
    suburb_record = Suburb.find_by("name ILIKE ?", suburb)
    return suburb_record.council if suburb_record&.council.present?

    nil
  end
end
