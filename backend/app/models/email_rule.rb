class EmailRule < ApplicationRecord
  belongs_to :user
  belongs_to :imap_credential, optional: true

  validates :name, presence: true
  validates :conditions, presence: true

  scope :active, -> { where(is_active: true) }
  scope :by_priority, -> { order(priority: :desc, created_at: :asc) }
  scope :for_account, ->(cred_id) { where(imap_credential_id: [nil, cred_id]) }

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

    # Also move on IMAP server if possible
    if email.imap_credential.present?
      service = ImapEmailService.new(email.imap_credential)
      service.move_email(email.uid, folder_name) if email.uid.present?
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
