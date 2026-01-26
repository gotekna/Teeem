# World-Class Asset Register - Odometer/Hours Reading (vehicle/equipment tracking)
class AssetOdometerReading < ApplicationRecord
  include WarehouseDocumentable
  warehouse_type :asset

  belongs_to :asset
  belongs_to :user, optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  # ActiveStorage has_one_attached :photo was REMOVED (Jan 2026) - it violated SSoT.

  # Reading types
  READING_TYPES = %w[photo manual service fuel inspection].freeze

  # Validations
  validates :reading_date, presence: true
  validates :reading_type, inclusion: { in: READING_TYPES }, allow_nil: true
  validate :must_have_odometer_or_hours
  validate :reading_must_be_progressive

  # Scopes
  scope :chronological, -> { order(reading_date: :asc) }
  scope :reverse_chronological, -> { order(reading_date: :desc) }
  scope :photos_only, -> { where(reading_type: "photo") }
  scope :for_date_range, ->(start_date, end_date) { where(reading_date: start_date..end_date) }

  # Callbacks
  after_create :update_asset_reading
  after_create :create_activity

  # Display value (km or hours)
  def display_value
    if odometer_km.present?
      "#{odometer_km.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse} km"
    elsif hours.present?
      "#{hours} hrs"
    else
      "-"
    end
  end

  # Distance since last reading
  def distance_since_last
    previous = asset.odometer_readings.where("reading_date < ?", reading_date).order(reading_date: :desc).first
    return nil unless previous && odometer_km && previous.odometer_km

    odometer_km - previous.odometer_km
  end

  # Hours since last reading
  def hours_since_last
    previous = asset.odometer_readings.where("reading_date < ?", reading_date).order(reading_date: :desc).first
    return nil unless previous && hours && previous.hours

    hours - previous.hours
  end

  # ========================================
  # StorageBlob Photo Access (SSoT)
  # ========================================

  def has_photo?
    storage_blob_id.present?
  end

  def photo_url(expires_in: 3600)
    return nil unless storage_blob

    storage_blob.presigned_url(expires_in: expires_in)
  end

  def attach_photo(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!
  end

  private

  def must_have_odometer_or_hours
    if odometer_km.blank? && hours.blank?
      errors.add(:base, "Must have either odometer reading or hours")
    end
  end

  def reading_must_be_progressive
    return unless odometer_km.present? || hours.present?

    previous = asset.odometer_readings.where("reading_date < ?", reading_date).order(reading_date: :desc).first
    return unless previous

    if odometer_km.present? && previous.odometer_km.present? && odometer_km < previous.odometer_km
      errors.add(:odometer_km, "cannot be less than previous reading (#{previous.odometer_km} km)")
    end

    if hours.present? && previous.hours.present? && hours < previous.hours
      errors.add(:hours, "cannot be less than previous reading (#{previous.hours} hrs)")
    end
  end

  def update_asset_reading
    updates = { last_reading_date: reading_date }
    updates[:odometer_reading] = odometer_km if odometer_km.present?
    updates[:hours_reading] = hours if hours.present?
    asset.update!(updates)
  end

  def create_activity
    return unless asset.corporate_company.present?

    user_record = user || User.first
    asset.corporate_company.corporate_company_activities.create!(
      activity_type: "asset_reading_recorded",
      description: "Odometer/hours reading recorded for #{asset.display_name}: #{display_value}",
      change_details: { asset_id: asset.id, reading: display_value },
      user: user_record
    )
  rescue => e
    Rails.logger.error "Failed to create reading activity: #{e.message}"
  end
end
