# frozen_string_literal: true

class CompanyApprovalRule < ApplicationRecord
  # Associations
  belongs_to :corporate, foreign_key: "company_id"
  belongs_to :bpmn_process, optional: true
  belongs_to :approver, class_name: "User", optional: true, foreign_key: :approver_id
  belongs_to :escalation_to, class_name: "User", optional: true, foreign_key: :escalation_to_user_id

  # Validations
  validates :rule_type, presence: true, inclusion: {
    in: %w[bill_approval payment_batch po_variance workflow_config]
  }
  validates :name, presence: true
  validates :approver_type, presence: true, inclusion: { in: %w[user role group] }

  # Constants
  RULE_TYPES = %w[bill_approval payment_batch po_variance workflow_config].freeze
  APPROVER_TYPES = %w[user role group].freeze

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :for_bills, -> { where(rule_type: "bill_approval") }
  scope :for_batches, -> { where(rule_type: "payment_batch") }
  scope :for_variance, -> { where(rule_type: "po_variance") }
  scope :workflow_configs, -> { where(rule_type: "workflow_config") }
  scope :by_priority, -> { order(priority: :desc) }
  scope :for_company, ->(company_id) { where(company_id: company_id) }

  # Instance methods
  def matches?(amount:, variance_percent: nil)
    return false unless is_active

    amount_match = true
    if min_amount.present?
      amount_match &&= amount >= min_amount
    end
    if max_amount.present?
      amount_match &&= amount <= max_amount
    end

    variance_match = true
    if variance_percent.present? && variance_threshold_percent.present?
      variance_match = variance_percent.abs >= variance_threshold_percent
    end

    amount_match && variance_match
  end

  def get_approvers
    case approver_type
    when "user"
      [ User.find_by(id: approver_id) ].compact
    when "role"
      # SSoT: Use user_roles join table to find users by role
      User.joins(:roles).where(roles: { name: approver_role }).distinct
    when "group"
      # If UserGroup model exists
      if defined?(UserGroup) && approver_group_id.present?
        UserGroup.find_by(id: approver_group_id)&.users || []
      else
        []
      end
    else
      []
    end
  end

  # Get workflow config value with default
  def config_value(key, default = nil)
    config.dig(key.to_s) || default
  end

  # Class methods for finding applicable rules
  def self.find_for_bill(company:, amount:, variance_percent: nil)
    for_company(company.id)
      .for_bills
      .active
      .by_priority
      .find { |rule| rule.matches?(amount: amount, variance_percent: variance_percent) }
  end

  def self.find_for_batch(company:, amount:)
    for_company(company.id)
      .for_batches
      .active
      .by_priority
      .find { |rule| rule.matches?(amount: amount) }
  end

  def self.workflow_config_for(company:)
    for_company(company.id)
      .workflow_configs
      .active
      .first
  end

  # Get default thresholds from workflow config
  def self.default_bill_config(company)
    config = workflow_config_for(company: company)&.config || {}
    bill_config = config["bill_approval"] || {}

    {
      auto_approve_threshold: bill_config["auto_approve_threshold"] || 0,
      team_lead_threshold: bill_config["team_lead_threshold"] || 5000,
      finance_manager_threshold: bill_config["finance_manager_threshold"] || 50_000,
      director_threshold: bill_config["director_threshold"],
      variance_threshold_percent: bill_config["variance_threshold_percent"] || 5.0,
      variance_threshold_amount: bill_config["variance_threshold_amount"] || 100,
      require_po: bill_config["require_po"] != false,
      auto_create_po_for_subsidiaries: bill_config["auto_create_po_for_subsidiaries"] != false
    }
  end

  def self.default_batch_config(company)
    config = workflow_config_for(company: company)&.config || {}
    batch_config = config["payment_batch"] || {}

    {
      require_dual_authorization: batch_config["require_dual_authorization"] != false,
      cfo_threshold: batch_config["cfo_threshold"] || 100_000,
      max_batch_amount: batch_config["max_batch_amount"] || 500_000
    }
  end
end
