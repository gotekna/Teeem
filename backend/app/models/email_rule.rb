class EmailRule < ApplicationRecord
  belongs_to :user
  belongs_to :imap_credential, optional: true
  belongs_to :microsoft_credential, optional: true

  validates :name, presence: true
  validates :conditions, presence: true

  scope :active, -> { where(is_active: true) }
  scope :by_priority, -> { order(priority: :desc, created_at: :asc) }
  # SSoT: Find rules that apply to an email based on its source
  # Rules with nil credential IDs apply to ALL accounts
  scope :for_account, ->(cred_id) { where(imap_credential_id: [nil, cred_id]) }
  scope :for_ms365_account, ->(ms_cred_id, mailbox_email = nil) {
    rules = where(microsoft_credential_id: [nil, ms_cred_id])
    rules = rules.where(mailbox_email: [nil, mailbox_email]) if mailbox_email
    rules
  }
  scope :for_email, ->(email) {
    if email.imap_credential_id.present?
      for_account(email.imap_credential_id)
    elsif email.microsoft_credential_id.present?
      for_ms365_account(email.microsoft_credential_id, email.mailbox_owner_email)
    else
      where(imap_credential_id: nil, microsoft_credential_id: nil)  # Global rules only
    end
  }

  # Condition types
  CONDITION_TYPES = %w[
    from_contains from_exact from_domain
    to_contains to_exact
    subject_contains subject_not_contains subject_exact
    body_contains
    has_attachments
  ].freeze

  # Action types
  ACTION_TYPES = %w[
    move_to_folder
    add_label
    mark_as_read
    mark_as_spam
    delete
    forward_to
  ].freeze

  def matches?(email)
    return false if conditions.blank?

    conditions.all? do |condition_type, value|
      evaluate_condition(email, condition_type, value)
    end
  end

  def apply_to!(email)
    return false unless matches?(email)

    actions.each do |action_type, value|
      execute_action(email, action_type, value)
    end

    increment!(:emails_matched)
    update!(last_matched_at: Time.current)

    stop_processing
  end

  private

  def evaluate_condition(email, condition_type, value)
    case condition_type.to_s
    when "from_contains"
      email.from_email&.downcase&.include?(value.to_s.downcase)
    when "from_exact"
      email.from_email&.downcase == value.to_s.downcase
    when "from_domain"
      email.from_email&.split("@")&.last&.downcase == value.to_s.downcase
    when "to_contains"
      Array(email.to_emails).any? { |e| e&.downcase&.include?(value.to_s.downcase) }
    when "to_exact"
      Array(email.to_emails).any? { |e| e&.downcase == value.to_s.downcase }
    when "subject_contains"
      email.subject&.downcase&.include?(value.to_s.downcase)
    when "subject_not_contains"
      !email.subject&.downcase&.include?(value.to_s.downcase)
    when "subject_exact"
      email.subject&.downcase == value.to_s.downcase
    when "body_contains"
      email.body_text&.downcase&.include?(value.to_s.downcase) ||
        email.body_html&.downcase&.include?(value.to_s.downcase)
    when "has_attachments"
      email.has_attachments == value
    else
      true
    end
  end

  def execute_action(email, action_type, value)
    case action_type.to_s
    when "move_to_folder"
      move_to_folder(email, value)
    when "mark_as_read"
      email.update!(is_read: value)
    when "mark_as_spam"
      email.update!(user_classification: value ? "spam" : nil)
    when "add_label"
      labels = email.labels || []
      email.update!(labels: (labels | [value.to_s]).uniq)
    when "delete"
      delete_email(email) if value
    when "forward_to"
      forward_email(email, value)
    end
  end

  def move_to_folder(email, folder_name)
    email.update!(folder_name: folder_name)

    # Also move on server if possible
    if email.imap_credential.present? && email.uid.present?
      # IMAP: Move via IMAP protocol
      service = ImapEmailService.new(email.imap_credential)
      service.move_email(email.uid, folder_name)
    elsif email.microsoft_credential.present? && email.outlook_id.present?
      # MS365: Move via Graph API
      begin
        client = MicrosoftAppGraphClient.new(email.microsoft_credential)
        # Find folder ID by name
        folders = client.get_user_mail_folders(email.mailbox_owner_email)
        target_folder = folders.find { |f| f[:name].downcase == folder_name.downcase }
        if target_folder
          client.move_user_email(email.mailbox_owner_email, email.outlook_id, target_folder[:id])
        else
          Rails.logger.warn "[EmailRule] Folder '#{folder_name}' not found for MS365 move"
        end
      rescue => e
        Rails.logger.error "[EmailRule] MS365 move failed: #{e.message}"
      end
    end
  end

  def delete_email(email)
    # Delete on server first if IMAP
    if email.imap_credential.present? && email.uid.present?
      service = ImapEmailService.new(email.imap_credential)
      service.delete_email(email.uid)
    end

    email.destroy!
  end

  def forward_email(email, forward_to)
    ForwardEmailJob.perform_later(email.id, forward_to)
  rescue NameError
    Rails.logger.warn "[EmailRule] ForwardEmailJob not defined, skipping forward action"
  end
end
