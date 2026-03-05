class InspectionPhoto < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :inspection_item
  belongs_to :storage_blob
  belongs_to :annotated_blob, class_name: "StorageBlob", optional: true

  validates :sort_order, numericality: { greater_than_or_equal_to: 0 }

  scope :ordered, -> { order(:sort_order) }

  def annotated?
    annotated_blob_id.present?
  end

  def display_blob
    annotated? ? annotated_blob : storage_blob
  end

  def has_gps?
    latitude.present? && longitude.present?
  end

  def gps_coordinates
    return nil unless has_gps?
    { latitude: latitude, longitude: longitude }
  end
end
