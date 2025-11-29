class DirectorOnboardingRequest < ApplicationRecord
  belongs_to :contact, optional: true
  belongs_to :company, optional: true
  belongs_to :reviewed_by, class_name: 'User', optional: true
  belongs_to :invited_by, class_name: 'User', optional: true

  # Status constants
  STATUSES = %w[pending submitted approved rejected expired].freeze

  validates :access_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true

  before_validation :generate_access_token, on: :create

  scope :pending, -> { where(status: 'pending') }
  scope :submitted, -> { where(status: 'submitted') }
  scope :approved, -> { where(status: 'approved') }
  scope :rejected, -> { where(status: 'rejected') }
  scope :needs_review, -> { where(status: 'submitted') }

  def full_name
    "#{first_name} #{last_name}".strip
  end

  def token_valid?
    return false if access_token.blank?
    return true if token_expires_at.nil?
    token_expires_at > Time.current
  end

  def submitted?
    status == 'submitted'
  end

  def approved?
    status == 'approved'
  end

  def rejected?
    status == 'rejected'
  end

  def pending?
    status == 'pending'
  end

  def submit!(ip_address: nil)
    update!(
      status: 'submitted',
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
      if company.present?
        CompanyDirector.find_or_create_by!(
          company: company,
          contact: contact_record
        ) do |cd|
          cd.position = 'director'
          cd.is_current = true
        end
      end

      update!(
        status: 'approved',
        reviewed_by: reviewer,
        reviewed_at: Time.current,
        review_notes: notes,
        contact: contact_record
      )
    end
  end

  def reject!(reviewer:, notes: nil)
    update!(
      status: 'rejected',
      reviewed_by: reviewer,
      reviewed_at: Time.current,
      review_notes: notes
    )
  end

  def compliance_score
    required_fields = [:director_id, :date_of_birth, :residential_address, :drivers_licence]
    optional_fields = [:passport_number, :photo_url, :place_of_birth]

    filled_required = required_fields.count { |f| send(f).present? }
    filled_optional = optional_fields.count { |f| send(f).present? }

    total_filled = filled_required + filled_optional
    total_fields = required_fields.length + optional_fields.length

    ((total_filled.to_f / total_fields) * 100).round
  end

  def missing_required_fields
    required = {
      director_id: 'Director ID',
      date_of_birth: 'Date of Birth',
      residential_address: 'Residential Address',
      drivers_licence: 'Drivers Licence'
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
      full_name: full_name,
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
end
