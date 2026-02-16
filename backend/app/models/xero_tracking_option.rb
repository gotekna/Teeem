# frozen_string_literal: true

# Local SSoT for Xero tracking options.
# Synced from Xero API, eliminates need for live API calls on every page load.
# New options are pushed to Xero when jobs are created.
class XeroTrackingOption < ApplicationRecord
  acts_as_tenant :tenant

  has_many :xero_job_tracking_links, primary_key: :xero_tracking_option_id, foreign_key: :tracking_option_id
  has_many :jobs, through: :xero_job_tracking_links

  validates :xero_tracking_option_id, presence: true, uniqueness: true
  validates :name, presence: true

  scope :active, -> { where(status: "ACTIVE") }
  scope :archived, -> { where(status: "ARCHIVED") }
end
