# frozen_string_literal: true

class Lead < ApplicationRecord
  belongs_to :job, optional: true

  STATUSES = %w[new contacted qualified proposal contract_sent won lost].freeze
  SOURCES = %w[referral website advertisement social_media cold_call repeat_client other].freeze
  PROJECT_TYPES = %w[new_dwelling renovation extension demolition_rebuild other].freeze
  DWELLING_TYPES = %w[detached_house townhouse duplex unit granny_flat].freeze

  validates :title, presence: true
  validates :client_name, presence: true
  validates :client_email, presence: true
  validates :site_suburb, presence: true
  validates :site_state, presence: true
  validates :site_postcode, presence: true
  validates :project_type, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :source, inclusion: { in: SOURCES }, allow_blank: true
  validates :project_type, inclusion: { in: PROJECT_TYPES }
  validates :dwelling_type, inclusion: { in: DWELLING_TYPES }, allow_blank: true
  validates :lead_number, uniqueness: true, allow_blank: true

  before_create :generate_lead_number

  scope :by_status, ->(status) { where(status: status) }
  scope :active, -> { where.not(status: %w[won lost]) }

  private

  def generate_lead_number
    return if lead_number.present?

    year = Date.current.year
    last_lead = Lead.where("lead_number LIKE ?", "LEAD-#{year}-%").order(:lead_number).last
    next_number = if last_lead
      last_lead.lead_number.split("-").last.to_i + 1
    else
      1
    end
    self.lead_number = "LEAD-#{year}-#{next_number.to_s.rjust(3, '0')}"
  end
end
