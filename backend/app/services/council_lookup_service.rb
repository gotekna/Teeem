class CouncilLookupService
  def self.find_council(postcode:, suburb:)
    return nil if postcode.blank? && suburb.blank?

    # Primary: postcode + suburb
    if postcode.present? && suburb.present?
      council = AustralianCouncil.lookup_council(
        postcode: postcode,
        suburb: suburb
      )
      return council if council.present?
    end

    # Fallback: postcode only
    if postcode.present?
      councils = AustralianCouncil.where(postcode: postcode).pluck(:council_name).uniq
      return councils.first if councils.one?
    end

    nil
  end
end
