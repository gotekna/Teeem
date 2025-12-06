class SmsMessage < ApplicationRecord
  belongs_to :contact
  belongs_to :user, optional: true

  validates :from_phone, :to_phone, :body, :direction, presence: true
  validates :direction, inclusion: { in: %w[inbound outbound] }

  scope :inbound, -> { where(direction: "inbound") }
  scope :outbound, -> { where(direction: "outbound") }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }

  # Format phone number for display
  def formatted_from_phone
    format_phone(from_phone)
  end

  def formatted_to_phone
    format_phone(to_phone)
  end

  def inbound?
    direction == "inbound"
  end

  def outbound?
    direction == "outbound"
  end

  def delivered?
    status == "delivered"
  end

  def failed?
    status == "failed"
  end

  private

  def format_phone(phone)
    return phone unless phone

    # Remove all non-digits
    digits = phone.gsub(/\D/, "")

    # Format Australian mobile as XXXX XXX XXX
    if digits.length == 10 && digits.start_with?("04")
      "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
    # Format with country code +61
    elsif digits.length == 11 && digits.start_with?("614")
      "+61 #{digits[3..6]} #{digits[7..9]}"
    else
      phone
    end
  end
end
