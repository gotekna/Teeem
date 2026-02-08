# frozen_string_literal: true

# SSoT: Email Templates System
# Reusable email templates with variable substitution.
# Supports both personal and shared (team) templates.
#
class EmailTemplate < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :user

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: [:tenant_id, :user_id], case_sensitive: false }
  validates :category, inclusion: { in: %w[quick_reply formal follow_up meeting quote invoice other] }, allow_blank: true

  # Scopes
  scope :ordered, -> { order(position: :asc, name: :asc) }
  scope :favorites, -> { where(is_favorite: true) }
  scope :shared, -> { where(is_shared: true) }
  scope :personal, -> { where(is_shared: false) }
  scope :by_category, ->(cat) { where(category: cat) }
  scope :popular, -> { order(usage_count: :desc) }

  # Categories for organizing templates
  CATEGORIES = {
    quick_reply: "Quick Reply",
    formal: "Formal",
    follow_up: "Follow-up",
    meeting: "Meeting",
    quote: "Quote/Proposal",
    invoice: "Invoice",
    other: "Other"
  }.freeze

  # Variable pattern: {{variable_name}}
  VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/

  # Common variables that can be auto-filled
  SYSTEM_VARIABLES = {
    "recipient_name" => "Recipient's name",
    "recipient_email" => "Recipient's email",
    "recipient_company" => "Recipient's company",
    "sender_name" => "Your name",
    "sender_email" => "Your email",
    "sender_phone" => "Your phone",
    "today_date" => "Today's date",
    "job_name" => "Job/Project name",
    "job_number" => "Job number",
    "job_address" => "Job address",
    "contact_name" => "Contact name",
    "company_name" => "Company name"
  }.freeze

  # Callbacks
  before_save :extract_variables
  before_save :generate_text_from_html

  # Extract variables from template content
  def extract_variables
    all_content = "#{subject} #{body_html} #{body_text}"
    extracted = all_content.scan(VARIABLE_PATTERN).flatten.uniq
    self.variables = extracted
  end

  # Generate plain text version from HTML if not provided
  def generate_text_from_html
    return if body_text.present? || body_html.blank?

    # Simple HTML to text conversion
    text = body_html.dup
    text.gsub!(/<br\s*\/?>/i, "\n")
    text.gsub!(/<\/p>/i, "\n\n")
    text.gsub!(/<\/div>/i, "\n")
    text.gsub!(/<[^>]+>/, "")
    text.gsub!(/&nbsp;/, " ")
    text.gsub!(/&amp;/, "&")
    text.gsub!(/&lt;/, "<")
    text.gsub!(/&gt;/, ">")
    text.gsub!(/&quot;/, '"')
    text = text.strip

    self.body_text = text
  end

  # Apply template with variable substitution
  # @param context [Hash] Variables to substitute, e.g., { recipient_name: "John", job_name: "123 Main St" }
  # @return [Hash] { subject: "...", body_html: "...", body_text: "..." }
  def apply(context = {})
    context = context.transform_keys(&:to_s)

    {
      subject: substitute_variables(subject, context),
      body_html: substitute_variables(body_html, context),
      body_text: substitute_variables(body_text, context)
    }
  end

  # Substitute variables in a string
  def substitute_variables(text, context)
    return text if text.blank?

    text.gsub(VARIABLE_PATTERN) do |match|
      var_name = ::Regexp.last_match(1)
      context[var_name] || match  # Keep original if no value provided
    end
  end

  # Increment usage count
  def record_usage!
    increment!(:usage_count)
  end

  # Duplicate template for another user
  def duplicate_for(target_user, new_name: nil)
    new_template = dup
    new_template.user = target_user
    new_template.name = new_name || "#{name} (Copy)"
    new_template.usage_count = 0
    new_template.is_shared = false
    new_template.save!
    new_template
  end

  # Get templates available to a user (own + shared)
  def self.available_to(user)
    where(user: user).or(where(is_shared: true))
  end

  # Quick reply templates (short, frequently used)
  def self.quick_replies_for(user)
    available_to(user).where(category: "quick_reply").ordered
  end

  # Create default templates for a new user
  def self.create_defaults_for(user)
    defaults = [
      {
        name: "Thanks for your email",
        category: "quick_reply",
        subject: "Re: {{original_subject}}",
        body_html: "<p>Hi {{recipient_name}},</p><p>Thanks for your email. I'll review this and get back to you shortly.</p><p>Best regards,<br>{{sender_name}}</p>",
        is_favorite: true
      },
      {
        name: "Meeting confirmation",
        category: "meeting",
        subject: "Meeting Confirmation - {{meeting_topic}}",
        body_html: "<p>Hi {{recipient_name}},</p><p>This email confirms our meeting scheduled for {{meeting_date}} at {{meeting_time}}.</p><p>Location: {{meeting_location}}</p><p>Please let me know if you need to reschedule.</p><p>Best regards,<br>{{sender_name}}</p>"
      },
      {
        name: "Follow-up reminder",
        category: "follow_up",
        subject: "Following up - {{original_subject}}",
        body_html: "<p>Hi {{recipient_name}},</p><p>I wanted to follow up on my previous email regarding {{topic}}.</p><p>Please let me know if you have any questions or need additional information.</p><p>Best regards,<br>{{sender_name}}</p>",
        is_favorite: true
      },
      {
        name: "Quote attached",
        category: "quote",
        subject: "Quote for {{job_name}} - {{job_number}}",
        body_html: "<p>Hi {{recipient_name}},</p><p>Please find attached our quote for {{job_name}}.</p><p>Key details:</p><ul><li>Job: {{job_name}}</li><li>Reference: {{job_number}}</li><li>Address: {{job_address}}</li></ul><p>Please don't hesitate to contact me if you have any questions.</p><p>Best regards,<br>{{sender_name}}<br>{{sender_phone}}</p>"
      }
    ]

    defaults.each do |attrs|
      user.email_templates.find_or_create_by!(name: attrs[:name]) do |template|
        template.assign_attributes(attrs.except(:name))
      end
    end
  end

  # JSON representation
  def as_json(options = {})
    {
      id: id,
      name: name,
      subject: subject,
      body_html: body_html,
      body_text: body_text,
      variables: variables,
      category: category,
      category_label: CATEGORIES[category&.to_sym],
      is_shared: is_shared,
      is_favorite: is_favorite,
      usage_count: usage_count,
      position: position,
      user_id: user_id,
      created_at: created_at,
      updated_at: updated_at
    }
  end
end
