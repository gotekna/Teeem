# frozen_string_literal: true

# EmailAccountTypes - Single Source of Truth (SSoT)
#
# This module defines the valid email account types used throughout the system.
# All models that reference account types should include this concern to ensure
# consistency across the codebase.
#
# Usage:
#   class ScheduledEmail < ApplicationRecord
#     include EmailAccountTypes
#
#     validates :account_type, inclusion: { in: ACCOUNT_TYPES }, allow_nil: true
#   end
#
module EmailAccountTypes
  extend ActiveSupport::Concern

  # Valid email account types - SSoT
  # These values must match frontend-next/lib/email-constants.ts
  ACCOUNT_TYPES = %w[imap outlook ms365].freeze

  # Human-readable labels for each account type
  ACCOUNT_TYPE_LABELS = {
    "imap" => "IMAP/SMTP",
    "outlook" => "Outlook (Personal)",
    "ms365" => "Microsoft 365 (Organization)"
  }.freeze

  included do
    # Scope for each account type
    scope :imap_accounts, -> { where(account_type: "imap") }
    scope :outlook_accounts, -> { where(account_type: "outlook") }
    scope :ms365_accounts, -> { where(account_type: "ms365") }
  end

  class_methods do
    # Check if a given type is valid
    def valid_account_type?(type)
      ACCOUNT_TYPES.include?(type.to_s)
    end

    # Get human-readable label for account type
    def account_type_label(type)
      ACCOUNT_TYPE_LABELS[type.to_s] || type.to_s.upcase
    end

    # Get all account types as options for select fields
    def account_type_options
      ACCOUNT_TYPES.map { |type| [account_type_label(type), type] }
    end
  end

  # Instance method to get label for this record's account type
  def account_type_label
    self.class.account_type_label(account_type)
  end

  # Check if this is an IMAP account
  def imap_account?
    account_type == "imap"
  end

  # Check if this is an Outlook (personal) account
  def outlook_account?
    account_type == "outlook"
  end

  # Check if this is an MS365 (organization) account
  def ms365_account?
    account_type == "ms365"
  end

  # Check if this is any Microsoft account (outlook or ms365)
  def microsoft_account?
    outlook_account? || ms365_account?
  end
end
