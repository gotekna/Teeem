# frozen_string_literal: true

# SSoT: Email User State
# Per-user email state including pin, star, archive, reminders, and notes.
# Each user has their own independent state for each email.
#
class EmailUserState < ApplicationRecord
  # SSoT: Legacy column is email_warehouse_id, but actual model is SyncedEmail
  # (EmailWarehouse was renamed to SyncedEmail in Jan 2026)
  belongs_to :email_warehouse, class_name: "SyncedEmail"
  belongs_to :user

  # Alias for legacy column name (EmailWarehouse was renamed to SyncedEmail)
  alias_attribute :synced_email_id, :email_warehouse_id
  # Use alias_method for associations (alias_attribute only works for columns in Rails 8)
  alias_method :synced_email, :email_warehouse
  alias_method :synced_email=, :email_warehouse=

  # Validations
  validates :star_color, inclusion: { in: %w[red orange yellow green blue purple] }, allow_blank: true
  validates :priority, inclusion: { in: %w[high normal low] }, allow_blank: true

  # Callbacks - Real-time sync via ActionCable
  after_update_commit :broadcast_state_change

  # Scopes
  scope :pinned, -> { where(is_pinned: true) }
  scope :starred, -> { where(is_starred: true) }
  scope :archived, -> { where(is_archived: true) }
  scope :unread, -> { where(is_read: false) }
  scope :with_reminders, -> { where.not(remind_at: nil).where(reminder_sent: false) }
  scope :reminders_due, -> { with_reminders.where("remind_at <= ?", Time.current) }
  scope :for_user, ->(user) { where(user: user) }
  scope :high_priority, -> { where(priority: "high") }

  # Star colors with their display names
  STAR_COLORS = {
    red: { hex: "#EF4444", label: "Red" },
    orange: { hex: "#F97316", label: "Orange" },
    yellow: { hex: "#EAB308", label: "Yellow" },
    green: { hex: "#22C55E", label: "Green" },
    blue: { hex: "#3B82F6", label: "Blue" },
    purple: { hex: "#A855F7", label: "Purple" }
  }.freeze

  # Priority levels
  PRIORITIES = {
    high: { label: "High", icon: "alert-circle" },
    normal: { label: "Normal", icon: "minus" },
    low: { label: "Low", icon: "arrow-down" }
  }.freeze

  # Class methods

  # Get or create state for an email/user combo
  def self.for(email, user)
    # SSoT: Use email_warehouse (the actual association name), not synced_email alias
    # synced_email is alias_method which doesn't work in find_or_create_by!
    find_or_create_by!(email_warehouse: email, user: user)
  end

  # Toggle pin for an email
  def self.toggle_pin!(email, user)
    state = self.for(email, user)
    state.update!(is_pinned: !state.is_pinned)
    state
  end

  # Toggle star for an email
  def self.toggle_star!(email, user, color: nil)
    state = self.for(email, user)

    if state.is_starred && color.nil?
      # Unstar
      state.update!(is_starred: false, star_color: nil)
    else
      # Star (with optional color)
      state.update!(is_starred: true, star_color: color || state.star_color || "yellow")
    end

    state
  end

  # Set star color
  def self.set_star_color!(email, user, color)
    state = self.for(email, user)
    state.update!(is_starred: true, star_color: color)
    state
  end

  # Toggle archive
  def self.toggle_archive!(email, user)
    state = self.for(email, user)
    state.update!(is_archived: !state.is_archived)
    state
  end

  # Set reminder
  def self.set_reminder!(email, user, remind_at:)
    state = self.for(email, user)
    state.update!(remind_at: remind_at, reminder_sent: false)
    state
  end

  # Clear reminder
  def self.clear_reminder!(email, user)
    state = self.for(email, user)
    state.update!(remind_at: nil, reminder_sent: false)
    state
  end

  # Mark as read/unread
  def self.mark_read!(email, user, is_read: true)
    state = self.for(email, user)
    state.update!(is_read: is_read)
    state
  end

  # Toggle read status
  def self.toggle_read!(email, user)
    state = self.for(email, user)
    state.update!(is_read: !state.is_read)
    state
  end

  # Set priority
  def self.set_priority!(email, user, priority)
    state = self.for(email, user)
    state.update!(priority: priority)
    state
  end

  # Update notes
  def self.update_notes!(email, user, notes)
    state = self.for(email, user)
    state.update!(notes: notes)
    state
  end

  # Get all pinned emails for a user
  def self.pinned_emails_for(user)
    SyncedEmail
      .joins(:email_user_states)
      .where(email_user_states: { user: user, is_pinned: true })
      .order("email_user_states.updated_at DESC")
  end

  # Get all starred emails for a user
  def self.starred_emails_for(user)
    SyncedEmail
      .joins(:email_user_states)
      .where(email_user_states: { user: user, is_starred: true })
      .order("email_user_states.updated_at DESC")
  end

  # Get all archived emails for a user
  def self.archived_emails_for(user)
    SyncedEmail
      .joins(:email_user_states)
      .where(email_user_states: { user: user, is_archived: true })
      .order("synced_email.received_at DESC")
  end

  # Get emails with due reminders
  def self.due_reminders_for(user)
    for_user(user).reminders_due.includes(:synced_email)
  end

  # Process due reminders (called by background job)
  def self.process_due_reminders!
    count = 0

    reminders_due.find_each do |state|
      state.send_reminder!
      count += 1
    end

    count
  end

  # Instance methods

  # Send reminder notification
  def send_reminder!
    return if reminder_sent
    return unless synced_email.present?

    # Create in-app notification
    Notification.create!(
      user: user,
      notifiable: synced_email,
      notification_type: "email_reminder",
      title: "Email Reminder",
      message: "Reminder: #{synced_email.subject.to_s.truncate(100)}"
    )

    update!(reminder_sent: true)
  end

  # Check if email is from a VIP sender for this user
  def from_vip?
    return false unless synced_email&.from_email.present?

    VipSender.exists?(user: user, email_address: synced_email.from_email.downcase)
  end

  # JSON representation
  def as_json(options = {})
    {
      id: id,
      email_id: synced_email_id,
      user_id: user_id,
      is_pinned: is_pinned,
      is_starred: is_starred,
      star_color: star_color,
      star_color_hex: star_color.present? ? STAR_COLORS[star_color.to_sym]&.dig(:hex) : nil,
      is_read: is_read,
      is_archived: is_archived,
      priority: priority,
      remind_at: remind_at,
      reminder_sent: reminder_sent,
      notes: notes,
      from_vip: from_vip?,
      created_at: created_at,
      updated_at: updated_at
    }
  end

  private

  # Broadcast state change to user via ActionCable
  def broadcast_state_change
    # Build changes hash from saved_changes
    changes = {}
    relevant_attrs = %w[is_pinned is_starred star_color is_read is_archived priority remind_at notes]

    relevant_attrs.each do |attr|
      if saved_change_to_attribute?(attr)
        changes[attr] = send(attr)
      end
    end

    return if changes.empty?

    EmailChannel.broadcast_state_change(user, synced_email_id, changes)
  rescue StandardError => e
    Rails.logger.error "Failed to broadcast email state change: #{e.message}"
  end
end
