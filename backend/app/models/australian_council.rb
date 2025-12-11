class AustralianCouncil < ApplicationRecord
  validates :postcode, :suburb, :state, :council_name, presence: true

  def self.lookup_council(postcode:, suburb:)
    where(postcode: postcode, suburb: suburb.downcase)
      .order(created_at: :desc)
      .first&.council_name
  end
end
