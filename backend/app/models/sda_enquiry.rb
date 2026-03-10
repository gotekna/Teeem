class SdaEnquiry < ApplicationRecord
  belongs_to :property
  belongs_to :assigned_to_user, class_name: "User", optional: true

  validates :name, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :enquiry_type, inclusion: { in: %w[general vacancy purchase] }
  validates :status, inclusion: { in: %w[new contacted in_progress resolved archived] }

  scope :recent, -> { order(created_at: :desc) }
  scope :unresolved, -> { where.not(status: %w[resolved archived]) }

  # Rate limiting: max 5 enquiries per IP per hour
  def self.rate_limited?(ip_address)
    return false if ip_address.blank?
    where(ip_address: ip_address)
      .where("created_at > ?", 1.hour.ago)
      .count >= 5
  end
end
