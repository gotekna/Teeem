# Gold Standard Table model for demonstrating table features
class GoldStandardTable < ApplicationRecord
  self.table_name = "gold_standard_table"

  # This model serves as a live reference implementation
  # for the TEEEMTableView component

  # Include shared column type validations
  include ColumnTypeValidations

  # Define column types for validation
  column_type_validations(
    email: :email,
    phone: :phone,
    mobile: :mobile,
    url: :url,
    whole_number: :whole_number,
    number: :number,
    currency: :currency,
    percentage: :percentage,
    gps_coordinates: :gps_coordinates,
    color_picker: :color_picker,
    abn: :abn,
    acn: :acn,
    bsb: :bsb,
    bank_account: :bank_account,
    postcode: :postcode,
    tfn: :tfn
  )

  # Format phone numbers before saving
  before_save :format_phone_numbers

  # Text field validations
  validates :single_line_text, length: { maximum: 255 }, allow_blank: true
  validates :multiple_lines_text, length: { maximum: 10000 }, allow_blank: true

  # Choice and lookup validations
  validates :choice, length: { maximum: 50 }, allow_blank: true
  validates :lookup, length: { maximum: 255 }, allow_blank: true
  validates :computed, length: { maximum: 255 }, allow_blank: true
  validates :action_buttons, length: { maximum: 255 }, allow_blank: true

  private

  def format_phone_numbers
    self.phone = format_australian_phone(phone) if phone.present?
    self.mobile = format_australian_phone(mobile) if mobile.present?
  end
end
