# frozen_string_literal: true

module Gl
  # Billable hourly rates for time-based billing
  class BillableRate < ApplicationRecord
    self.table_name = "gl_billable_rates"

    RATE_TYPES = %w[user role default].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :user, optional: true
    belongs_to :job, optional: true
    belongs_to :contact, optional: true

    has_many :time_entries, class_name: "Gl::BillableTimeEntry",
                            foreign_key: "billable_rate_id", dependent: :nullify

    validates :rate_type, presence: true, inclusion: { in: RATE_TYPES }
    validates :hourly_rate, presence: true, numericality: { greater_than: 0 }
    validates :role_name, presence: true, if: -> { rate_type == "role" }

    scope :active, -> { where(active: true) }
    scope :for_user, ->(user) { where(user_id: user.id) }
    scope :for_job, ->(job) { where(job_id: job.id) }
    scope :for_role, ->(role) { where(rate_type: "role", role_name: role) }
    scope :default_rates, -> { where(rate_type: "default") }

    # Find the best matching rate for a given context
    def self.find_rate_for(company, user:, job: nil, contact: nil, date: Date.current)
      rates = where(corporate_company: company)
              .active
              .where("effective_from IS NULL OR effective_from <= ?", date)
              .where("effective_to IS NULL OR effective_to >= ?", date)

      # Priority: User+Job > User+Client > User > Job > Client > Role > Default
      rate = rates.find_by(user: user, job: job) if job
      rate ||= rates.find_by(user: user, contact: contact) if contact
      rate ||= rates.find_by(user: user, job: nil, contact: nil)
      rate ||= rates.find_by(job: job, user: nil) if job
      rate ||= rates.find_by(contact: contact, user: nil) if contact
      # SSoT: Check all user roles from user_roles join table
      rate ||= rates.where(rate_type: "role", role_name: user&.role_names).first
      rate ||= rates.find_by(rate_type: "default")

      rate
    end

    # Calculate rate for specific time (handles overtime/weekend)
    def rate_for_time(datetime)
      if datetime.saturday? || datetime.sunday?
        weekend_rate || hourly_rate
      elsif overtime_hours?(datetime)
        overtime_rate || hourly_rate
      else
        hourly_rate
      end
    end

    private

    def overtime_hours?(datetime)
      # After 6pm or before 6am considered overtime
      hour = datetime.hour
      hour >= 18 || hour < 6
    end
  end
end
