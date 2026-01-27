# frozen_string_literal: true

# SyncedEmailMailbox - Join table linking emails to mailboxes
#
# Ultra Email Architecture: Store email content ONCE, link to multiple mailboxes.
#
# An email can appear in multiple mailboxes (e.g., sent to multiple recipients).
# Each appearance has its own:
#   - outlook_id (Graph API identifier, different per mailbox)
#   - folder_name (Inbox, Sent Items, Archive, etc.)
#   - is_read (per-mailbox read status)
#   - labels (mailbox-specific labels)
#
# SSoT: Email content is in SyncedEmail (once). Mailbox appearances here.
#
# Example: Email sent to James AND Andrew
#   SyncedEmail #1001 (SINGLE)
#   ├─ internet_message_id: <abc@outlook>
#   ├─ subject: "RE: Invoice"
#   └─ body: "..." (stored ONCE)
#          │
#          ▼
#   SyncedEmailMailbox (JOIN TABLE)
#   ├─ synced_email_id: 1001
#   │  mailbox_owner_email: james@tekna.com.au
#   │  outlook_id: AAMkAD... (James's mailbox ID)
#   │  folder_name: Inbox
#   │  is_read: true
#   │
#   └─ synced_email_id: 1001
#      mailbox_owner_email: andrew@tekna.com.au
#      outlook_id: BzMkBE... (Andrew's mailbox ID)
#      folder_name: Inbox
#      is_read: false
#
class SyncedEmailMailbox < ApplicationRecord
  belongs_to :synced_email
  belongs_to :microsoft_credential, optional: true
  belongs_to :imap_credential, optional: true

  validates :mailbox_owner_email, presence: true
  validates :synced_email_id, uniqueness: {
    scope: :mailbox_owner_email,
    message: "email can only appear once per mailbox"
  }

  # Normalize email for consistent lookups
  before_validation :normalize_mailbox_email

  # Scopes for mailbox filtering
  scope :for_mailbox, ->(email) { where("LOWER(mailbox_owner_email) = LOWER(?)", email) }
  scope :for_mailboxes, ->(emails) { where("LOWER(mailbox_owner_email) IN (?)", emails.map(&:downcase)) }
  scope :unread, -> { where(is_read: false) }

  # SSoT: Folder name filtering (case-insensitive)
  # ALWAYS use this scope instead of .where(folder_name: x) to handle provider variations
  # Gmail uses INBOX, Outlook uses Inbox, others may use inbox - this handles all cases
  SENT_FOLDER_VARIANTS = ["sent", "sent items", "sent mail", "inbox.sent"].freeze

  scope :in_folder, ->(name) {
    folder_name_only = name.to_s.split("/").last
    normalized_name = name.to_s.downcase

    if SENT_FOLDER_VARIANTS.include?(normalized_name)
      where("LOWER(folder_name) IN (?)", SENT_FOLDER_VARIANTS)
    else
      where("LOWER(folder_name) = LOWER(?) OR LOWER(folder_name) = LOWER(?)", name, folder_name_only)
    end
  }

  # Determine direction based on folder and mailbox email
  def direction
    return "sent" if folder_name&.downcase&.include?("sent")
    return "sent" if synced_email&.from_email&.downcase == mailbox_owner_email&.downcase

    if synced_email&.to_emails&.any? { |e| e.downcase == mailbox_owner_email&.downcase }
      "received"
    elsif synced_email&.cc_emails&.any? { |e| e.downcase == mailbox_owner_email&.downcase }
      "cc"
    else
      "received"  # Default for inbox
    end
  end

  private

  def normalize_mailbox_email
    self.mailbox_owner_email = mailbox_owner_email&.downcase&.strip
  end
end
