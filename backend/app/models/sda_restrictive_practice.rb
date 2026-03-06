# frozen_string_literal: true

class SdaRestrictivePractice < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :contact
  belongs_to :sda_incident, optional: true
  belongs_to :recorded_by_user, class_name: "User", optional: true
  belongs_to :approved_by_user, class_name: "User", optional: true

  PRACTICE_TYPES = %w[chemical mechanical physical seclusion environmental].freeze
  STATUSES = %w[active ceased under_review].freeze
  AUTHORIZATION_SOURCES = %w[behaviour_support_plan emergency other].freeze

  validates :practice_type, presence: true, inclusion: { in: PRACTICE_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :authorization_source, inclusion: { in: AUTHORIZATION_SOURCES }, allow_nil: true
  validates :used_at, presence: true
  validates :reason, presence: true

  scope :active, -> { where(status: "active") }
  scope :unauthorized, -> { where(authorized: false) }
  scope :reportable, -> { where(ndis_reportable: true) }
  scope :unreported, -> { where(ndis_reportable: true, ndis_reported: false) }

  def overdue_for_reporting?
    return false unless ndis_reportable && !ndis_reported
    return false unless used_at

    business_days = 0
    date = used_at.to_date
    while date < Date.current
      business_days += 1 unless date.saturday? || date.sunday?
      date += 1.day
    end
    business_days > 5
  end

  def days_until_report_due
    return nil unless ndis_reportable && !ndis_reported
    return nil unless used_at

    business_days = 0
    date = used_at.to_date
    while date < Date.current
      business_days += 1 unless date.saturday? || date.sunday?
      date += 1.day
    end
    [5 - business_days, 0].max
  end
end
