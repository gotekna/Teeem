# Gold Standard Table model for demonstrating table features
class GoldStandardTable < ApplicationRecord
  self.table_name = 'gold_standard_table'

  # This model serves as a live reference implementation
  # for the TrapidTableView component

  # Email validation
  validates :email,
    format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" },
    allow_blank: true,
    length: { maximum: 255 }

  # Phone validations
  validates :phone, length: { maximum: 50 }, allow_blank: true
  validates :mobile, length: { maximum: 50 }, allow_blank: true

  # Text field validations
  validates :single_line_text, length: { maximum: 255 }, allow_blank: true
  validates :multiple_lines_text, length: { maximum: 10000 }, allow_blank: true

  # URL validation
  validates :url,
    format: { with: URI::DEFAULT_PARSER.make_regexp(['http', 'https']), message: "must be a valid URL" },
    allow_blank: true,
    length: { maximum: 500 }

  # Numeric validations
  validates :whole_number,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 },
    allow_nil: true

  validates :number,
    numericality: { greater_than_or_equal_to: 0 },
    allow_nil: true

  validates :currency,
    numericality: { greater_than_or_equal_to: 0 },
    allow_nil: true

  validates :percentage,
    numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
    allow_nil: true

  # GPS coordinates validation (lat,lng format)
  validates :gps_coordinates,
    format: { with: /\A-?\d+\.?\d*,-?\d+\.?\d*\z/, message: "must be in format: latitude,longitude" },
    allow_blank: true,
    length: { maximum: 100 }

  # Color picker validation (hex format)
  validates :color_picker,
    format: { with: /\A#[0-9A-Fa-f]{6}\z/, message: "must be a valid hex color (e.g., #FF0000)" },
    allow_blank: true

  # Choice and lookup validations
  validates :choice, length: { maximum: 50 }, allow_blank: true
  validates :lookup, length: { maximum: 255 }, allow_blank: true
  validates :computed, length: { maximum: 255 }, allow_blank: true
  validates :action_buttons, length: { maximum: 255 }, allow_blank: true
end
