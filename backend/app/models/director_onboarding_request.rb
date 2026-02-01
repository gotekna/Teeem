class DirectorOnboardingRequest < ApplicationRecord
  belongs_to :contact, optional: true
  belongs_to :corporate_company, foreign_key: "company_id", optional: true
  belongs_to :reviewed_by, class_name: "User", optional: true
  belongs_to :invited_by, class_name: "User", optional: true

  # Status constants
  STATUSES = %w[pending submitted approved rejected expired].freeze

  # Australian states/territories
  AUSTRALIAN_STATES = %w[NSW VIC QLD SA WA TAS NT ACT].freeze

  validates :access_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true

  # Validate date of birth when submitting
  validate :date_of_birth_is_valid, if: -> { date_of_birth.present? }

  # Validate residential address when submitting
  validate :residential_address_is_valid, if: -> { residential_address.present? }

  # Validate expiry dates when submitting
  validate :drivers_licence_expiry_is_valid, if: -> { drivers_licence_expiry.present? }
  validate :passport_expiry_is_valid, if: -> { passport_expiry.present? }

  before_validation :generate_access_token, on: :create

  scope :pending, -> { where(status: "pending") }
  scope :submitted, -> { where(status: "submitted") }
  scope :approved, -> { where(status: "approved") }
  scope :rejected, -> { where(status: "rejected") }
  scope :needs_review, -> { where(status: "submitted") }

  def display_name
    "#{first_name} #{last_name}".strip
  end

  def token_valid?
    return false if access_token.blank?
    return true if token_expires_at.nil?
    token_expires_at > Time.current
  end

  def submitted?
    status == "submitted"
  end

  def approved?
    status == "approved"
  end

  def rejected?
    status == "rejected"
  end

  def pending?
    status == "pending"
  end

  def submit!(ip_address: nil)
    update!(
      status: "submitted",
      submitted_at: Time.current,
      consent_given: true,
      consent_given_at: Time.current,
      consent_ip_address: ip_address
    )
  end

  def approve!(reviewer:, notes: nil)
    transaction do
      # Create or update the contact
      contact_record = find_or_create_contact!

      # Create company director relationship if company specified
      if corporate_company.present?
        CorporateDirector.find_or_create_by!(
          corporate: corporate_company,
          contact: contact_record
        ) do |cd|
          cd.position = "director"
          cd.is_current = true
        end
      end

      update!(
        status: "approved",
        reviewed_by: reviewer,
        reviewed_at: Time.current,
        review_notes: notes,
        contact: contact_record
      )
    end
  end

  def reject!(reviewer:, notes: nil)
    update!(
      status: "rejected",
      reviewed_by: reviewer,
      reviewed_at: Time.current,
      review_notes: notes
    )
  end

  def compliance_score
    required_fields = [ :director_id, :date_of_birth, :residential_address, :drivers_licence ]
    optional_fields = [ :passport_number, :photo_url, :place_of_birth ]

    filled_required = required_fields.count { |f| send(f).present? }
    filled_optional = optional_fields.count { |f| send(f).present? }

    total_filled = filled_required + filled_optional
    total_fields = required_fields.length + optional_fields.length

    ((total_filled.to_f / total_fields) * 100).round
  end

  def missing_required_fields
    required = {
      director_id: "Director ID",
      date_of_birth: "Date of Birth",
      residential_address: "Residential Address",
      drivers_licence: "Drivers Licence"
    }

    required.select { |field, _| send(field).blank? }.values
  end

  private

  def generate_access_token
    self.access_token ||= SecureRandom.urlsafe_base64(32)
    self.token_expires_at ||= 30.days.from_now
  end

  def find_or_create_contact!
    # Try to find existing contact by email
    existing = Contact.find_by(email: email) if email.present?

    if existing
      # Update existing contact with new information
      existing.update!(contact_attributes)
      existing
    else
      # Create new contact
      Contact.create!(contact_attributes)
    end
  end

  def contact_attributes
    {
      first_name: first_name,
      last_name: last_name,
      display_name: display_name,
      email: email,
      mobile_phone: mobile_phone,
      date_of_birth: date_of_birth,
      place_of_birth: place_of_birth,
      birth_state: birth_state,
      birth_country: birth_country,
      residential_address: residential_address,
      director_id: director_id,
      drivers_licence: drivers_licence,
      passport_number: passport_number,
      photo_url: photo_url
    }.compact
  end

  # Validate date of birth
  # - Must not be in the future
  # - Must be at least 18 years old (directors must be adults)
  # - Must be reasonable (not more than 120 years old)
  def date_of_birth_is_valid
    return if date_of_birth.blank?

    if date_of_birth > Date.current
      errors.add(:date_of_birth, "cannot be in the future")
    elsif date_of_birth > 18.years.ago.to_date
      errors.add(:date_of_birth, "you must be at least 18 years old to be a director")
    elsif date_of_birth < 120.years.ago.to_date
      errors.add(:date_of_birth, "is not a valid date")
    end
  end

  # Validate residential address
  # - Must include an Australian state/territory
  # - Must include a valid Australian postcode (4 digits)
  # - Must have minimum reasonable length (street + suburb + state + postcode)
  def residential_address_is_valid
    return if residential_address.blank?

    address = residential_address.to_s.strip

    # Check minimum length (at least street number + name + suburb + state + postcode)
    if address.length < 15
      errors.add(:residential_address, "is too short - please include full street address, suburb, state and postcode")
      return
    end

    # Check for Australian state/territory
    state_pattern = /\b(#{AUSTRALIAN_STATES.join('|')})\b/i
    unless address.match?(state_pattern)
      errors.add(:residential_address, "must include an Australian state (NSW, VIC, QLD, SA, WA, TAS, NT, or ACT)")
      return
    end

    # Check for 4-digit Australian postcode
    postcode_pattern = /\b\d{4}\b/
    unless address.match?(postcode_pattern)
      errors.add(:residential_address, "must include a 4-digit postcode")
      return
    end

    # Extract and validate postcode range (Australian postcodes are 0200-9999)
    postcodes = address.scan(/\b(\d{4})\b/).flatten
    valid_postcode = postcodes.any? do |pc|
      pc_int = pc.to_i
      pc_int >= 200 && pc_int <= 9999
    end

    unless valid_postcode
      errors.add(:residential_address, "must include a valid Australian postcode")
    end
  end

  # Validate drivers licence expiry
  # - Must not be in the past (expired)
  # - Must be a reasonable future date (within 15 years)
  def drivers_licence_expiry_is_valid
    return if drivers_licence_expiry.blank?

    if drivers_licence_expiry < Date.current
      errors.add(:drivers_licence_expiry, "cannot be in the past - your licence appears to be expired")
    elsif drivers_licence_expiry > 15.years.from_now.to_date
      errors.add(:drivers_licence_expiry, "is not a valid expiry date")
    end
  end

  # Validate passport expiry
  # - Must not be in the past (expired)
  # - Must be a reasonable future date (within 15 years)
  def passport_expiry_is_valid
    return if passport_expiry.blank?

    if passport_expiry < Date.current
      errors.add(:passport_expiry, "cannot be in the past - your passport appears to be expired")
    elsif passport_expiry > 15.years.from_now.to_date
      errors.add(:passport_expiry, "is not a valid expiry date")
    end
  end
end
