class MinuteTemplate < ApplicationRecord
  # Associations
  has_many :corporate_company_minutes, dependent: :nullify

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :template_type, inclusion: { in: %w[company trust general], allow_blank: true }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_type, ->(type) { where(template_type: type) }
  scope :company_templates, -> { by_type("company") }
  scope :trust_templates, -> { by_type("trust") }

  # Placeholder patterns: {{field_name}}
  PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/

  def display_name
    name
  end

  # Extract required fields from template body
  def extract_placeholders
    return [] unless body.present?
    body.scan(PLACEHOLDER_PATTERN).flatten.uniq
  end

  # Generate content by replacing placeholders with values
  def generate_content(values = {})
    return "" unless body.present?

    content = body.dup
    values.each do |key, value|
      content.gsub!("{{#{key}}}", value.to_s)
    end
    content
  end
end
