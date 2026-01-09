# frozen_string_literal: true

# SSoT: VIP Senders
# Mark email addresses as VIP for priority treatment.
# Emails from VIP senders appear in the VIP inbox and can trigger notifications.
#
class VipSender < ApplicationRecord
  belongs_to :user

  # Validations
  validates :email_address, presence: true
  validates :email_address, uniqueness: { scope: :user_id, case_sensitive: false }
  validates :email_address, format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email" }
  validates :category, inclusion: { in: %w[work personal client vendor team other] }, allow_blank: true

  # Callbacks
  before_save :normalize_email

  # Scopes
  scope :for_user, ->(user) { where(user: user) }
  scope :by_category, ->(cat) { where(category: cat) }
  scope :with_notifications, -> { where(notify_immediately: true) }
  scope :alphabetical, -> { order(:name, :email_address) }

  # Categories
  CATEGORIES = {
    work: { label: "Work", icon: "briefcase" },
    personal: { label: "Personal", icon: "user" },
    client: { label: "Client", icon: "users" },
    vendor: { label: "Vendor", icon: "package" },
    team: { label: "Team", icon: "users" },
    other: { label: "Other", icon: "star" }
  }.freeze

  # Class methods

  # Check if an email address is VIP for a user
  def self.vip?(email_address, user)
    exists?(user: user, email_address: email_address.to_s.downcase)
  end

  # Add a VIP sender
  def self.add!(user:, email_address:, name: nil, category: nil, notify: true)
    find_or_create_by!(user: user, email_address: email_address.downcase) do |vip|
      vip.name = name
      vip.category = category
      vip.notify_immediately = notify
    end
  end

  # Remove a VIP sender
  def self.remove!(user:, email_address:)
    find_by(user: user, email_address: email_address.downcase)&.destroy
  end

  # Toggle VIP status
  def self.toggle!(user:, email_address:, name: nil)
    existing = find_by(user: user, email_address: email_address.downcase)

    if existing
      existing.destroy
      nil
    else
      add!(user: user, email_address: email_address, name: name)
    end
  end

  # Get VIP emails for a user
  def self.vip_emails_for(user)
    vip_addresses = for_user(user).pluck(:email_address)
    return EmailWarehouse.none if vip_addresses.empty?

    EmailWarehouse.where("LOWER(from_email) IN (?)", vip_addresses)
  end

  # Import VIP senders from contacts
  def self.import_from_contacts!(user, contact_ids: nil)
    contacts = Contact.where(id: contact_ids) if contact_ids.present?
    contacts ||= Contact.all

    imported = 0

    contacts.where.not(email: [nil, ""]).find_each do |contact|
      next if vip?(contact.email, user)

      create!(
        user: user,
        email_address: contact.email.downcase,
        name: contact.display_name,
        category: determine_category(contact)
      )
      imported += 1
    rescue ActiveRecord::RecordInvalid
      # Skip duplicates
    end

    imported
  end

  # Suggest VIP senders based on email frequency
  def self.suggestions_for(user, limit: 10)
    # Find most frequent senders that aren't already VIP
    existing_vips = for_user(user).pluck(:email_address)

    EmailWarehouse
      .where.not(from_email: nil)
      .where.not("LOWER(from_email) IN (?)", existing_vips.presence || [""])
      .group("LOWER(from_email)")
      .order("COUNT(*) DESC")
      .limit(limit)
      .pluck("LOWER(from_email)", "MAX(from_name)", "COUNT(*)")
      .map do |email, name, count|
        {
          email_address: email,
          name: name,
          email_count: count
        }
      end
  end

  # Instance methods

  # Get recent emails from this VIP
  def recent_emails(limit: 10)
    EmailWarehouse
      .where("LOWER(from_email) = ?", email_address.downcase)
      .order(received_at: :desc)
      .limit(limit)
  end

  # Get email count from this VIP
  def email_count
    EmailWarehouse.where("LOWER(from_email) = ?", email_address.downcase).count
  end

  # Display name (name or email)
  def display_name
    name.presence || email_address
  end

  # JSON representation
  def as_json(options = {})
    {
      id: id,
      user_id: user_id,
      email_address: email_address,
      name: name,
      display_name: display_name,
      category: category,
      category_label: category.present? ? CATEGORIES[category.to_sym]&.dig(:label) : nil,
      notify_immediately: notify_immediately,
      notes: notes,
      email_count: options[:include_count] ? email_count : nil,
      created_at: created_at
    }.compact
  end

  private

  def normalize_email
    self.email_address = email_address.to_s.downcase.strip
  end

  def self.determine_category(contact)
    return "client" if contact.respond_to?(:is_client?) && contact.is_client?
    return "vendor" if contact.respond_to?(:is_vendor?) && contact.is_vendor?

    nil
  end
end
