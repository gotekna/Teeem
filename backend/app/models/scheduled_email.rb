# frozen_string_literal: true

# Schedules emails to be sent at a future date/time
#
# Supports multiple account types:
# - IMAP credentials (imap_credential_id set)
# - Outlook personal (account_type = "outlook")
# - MS365 org mailboxes (account_type = "ms365", microsoft_credential_id set)
#
class ScheduledEmail < ApplicationRecord
  include EmailAccountTypes

  belongs_to :imap_credential, optional: true
  belongs_to :created_by, class_name: "User", optional: true

  validates :to_addresses, presence: true
  validates :subject, presence: true
  validates :body, presence: true
  validates :scheduled_for, presence: true
  validates :status, presence: true, inclusion: { in: %w[pending sent cancelled failed] }
  validates :account_type, inclusion: { in: ACCOUNT_TYPES }, allow_nil: true

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :due_now, -> { pending.where("scheduled_for <= ?", Time.current) }
  scope :upcoming, -> { pending.where("scheduled_for > ?", Time.current).order(:scheduled_for) }
  scope :for_user, ->(user) { where(created_by: user) }

  # Process all due scheduled emails
  def self.process_due!
    processed = 0
    failed = 0

    due_now.find_each do |scheduled|
      if scheduled.send_email!
        processed += 1
      else
        failed += 1
      end
    end

    { processed: processed, failed: failed }
  end

  # Parse JSON addresses
  def to_list
    parse_addresses(to_addresses)
  end

  def cc_list
    parse_addresses(cc_addresses)
  end

  def bcc_list
    parse_addresses(bcc_addresses)
  end

  # Send the scheduled email
  def send_email!
    return false if status != "pending"

    begin
      case account_type
      when "imap"
        send_via_imap
      when "outlook"
        send_via_outlook
      when "ms365"
        send_via_ms365
      else
        # Default to IMAP if credential is set
        if imap_credential.present?
          send_via_imap
        else
          raise "No valid account configured for sending"
        end
      end

      update!(status: "sent", sent_at: Time.current)
      true
    rescue StandardError => e
      Rails.logger.error("ScheduledEmail ##{id} failed: #{e.message}")
      update!(status: "failed", error_message: e.message)
      false
    end
  end

  # Cancel a scheduled email
  def cancel!
    return false unless status == "pending"

    update!(status: "cancelled", cancelled_at: Time.current)
    true
  end

  # Reschedule to a new time
  def reschedule!(new_time)
    return false unless status == "pending"

    update!(scheduled_for: new_time)
    true
  end

  private

  def parse_addresses(addresses)
    return [] if addresses.blank?

    if addresses.is_a?(Array)
      addresses
    else
      JSON.parse(addresses) rescue addresses.split(",").map(&:strip)
    end
  end

  def send_via_imap
    raise "IMAP credential not found" unless imap_credential

    ImapEmailService.new(imap_credential).send_email(
      to: to_list,
      cc: cc_list,
      bcc: bcc_list,
      subject: subject,
      body: body,
      attachments: attachments || [],
      reply_to_message_id: reply_to_message_id
    )
  end

  def send_via_outlook
    # Find the user's outlook credential
    user = created_by
    raise "No user associated with scheduled email" unless user

    token = UserMicrosoftToken.active_for_user(user)
    raise "No active Outlook token for user" unless token

    client = MicrosoftGraphClient.new(token.access_token)
    client.send_email(
      to: to_list,
      cc: cc_list,
      bcc: bcc_list,
      subject: subject,
      body: body,
      attachments: attachments || []
    )
  end

  def send_via_ms365
    raise "Microsoft credential ID not set" unless microsoft_credential_id

    credential = MicrosoftCredential.find(microsoft_credential_id)
    raise "Microsoft credential not found" unless credential

    client = MicrosoftAppGraphClient.new(credential)

    # Use mailbox_email if set, otherwise use credential's email
    from_email = mailbox_email.presence || credential.email

    client.send_email(
      from: from_email,
      to: to_list,
      cc: cc_list,
      bcc: bcc_list,
      subject: subject,
      body: body,
      attachments: attachments || []
    )
  end
end
