# frozen_string_literal: true

# InspectionReportContextBuilder builds the template context for property inspection
# PDF reports. Used by TeeemDocumentGenerator for :inspection_report and :inspection_comparison
# templates.
#
# Usage:
#   context = InspectionReportContextBuilder.new(inspection).build
#   # Returns hash with all data needed for ERB template rendering
#
class InspectionReportContextBuilder
  CONDITION_COLORS = {
    "new" => "#059669",
    "good" => "#16a34a",
    "fair" => "#ca8a04",
    "poor" => "#ea580c",
    "damaged" => "#dc2626",
    # Legacy
    "excellent" => "#059669"
  }.freeze

  CONDITION_LABELS = {
    "new" => "New",
    "good" => "Good",
    "fair" => "Fair",
    "poor" => "Poor",
    "damaged" => "Damaged",
    "excellent" => "Excellent"
  }.freeze

  attr_reader :inspection

  def initialize(inspection)
    @inspection = inspection.is_a?(Integer) ? PropertyInspection.find(inspection) : inspection
  end

  def build
    inspection_data = load_inspection_data

    {
      inspection: inspection_data,
      property: build_property_context,
      rooms: build_rooms_context,
      summary: build_summary,
      company: build_company_context,
      generated_at: Time.current,
      condition_colors: CONDITION_COLORS,
      condition_labels: CONDITION_LABELS
    }
  end

  def build_comparison(entry_inspection)
    entry_builder = self.class.new(entry_inspection)

    {
      entry: entry_builder.build,
      exit: build,
      differences: calculate_differences(entry_inspection),
      bond_claim_items: find_degraded_items(entry_inspection),
      generated_at: Time.current,
      condition_colors: CONDITION_COLORS,
      condition_labels: CONDITION_LABELS
    }
  end

  private

  def load_inspection_data
    @inspection = PropertyInspection
      .includes(
        :property, :tenancy, :inspector_contact,
        :inspector_signature_blob, :tenant_signature_blob,
        inspection_rooms: { inspection_items: { inspection_photos: [:storage_blob, :annotated_blob] } }
      )
      .find(@inspection.id)
  end

  def build_property_context
    prop = inspection.property
    {
      id: prop.id,
      name: prop.name,
      property_code: prop.property_code,
      address: [prop.street_address, prop.suburb, prop.state, prop.postcode].compact.join(", "),
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      parking: prop.parking_spaces
    }
  end

  def build_rooms_context
    inspection.inspection_rooms.ordered.map do |room|
      {
        id: room.id,
        name: room.name,
        room_type: room.room_type,
        overall_condition: room.overall_condition,
        notes: room.notes,
        items: room.inspection_items.ordered.map { |item| build_item_context(item) },
        completion: room.completion_percentage
      }
    end
  end

  def build_item_context(item)
    {
      id: item.id,
      name: item.name,
      condition: item.condition,
      entry_condition: item.entry_condition,
      is_clean: item.is_clean,
      is_working: item.is_working,
      action_required: item.action_required,
      notes: item.notes,
      condition_changed: item.condition_change,
      photos: item.inspection_photos.ordered.map { |photo| build_photo_context(photo) }
    }
  end

  def build_photo_context(photo)
    blob = photo.annotated? ? photo.annotated_blob : photo.storage_blob

    {
      id: photo.id,
      caption: photo.caption,
      taken_at: photo.taken_at,
      gps: photo.has_gps? ? photo.gps_coordinates : nil,
      blob_id: blob.id,
      content_type: blob.content_type,
      # Generate a presigned URL or data URI for embedding in PDF
      url: generate_photo_url(blob)
    }
  end

  def build_summary
    items = inspection.inspection_items.to_a
    checked_items = items.select { |i| i.condition.present? }
    action_items = items.select(&:action_required)

    condition_counts = checked_items.group_by(&:condition).transform_values(&:count)

    {
      total_rooms: inspection.inspection_rooms.count,
      total_items: items.count,
      checked_items: checked_items.count,
      completion_percentage: inspection.completion_percentage,
      action_items_count: action_items.count,
      condition_breakdown: condition_counts,
      overall_condition: inspection.overall_condition,
      inspector_name: inspection.inspector_contact&.display_name,
      inspection_date: inspection.completed_date || inspection.scheduled_date,
      inspection_number: inspection.inspection_number,
      inspection_type: inspection.inspection_type,
      has_inspector_signature: inspection.signed_by_inspector?,
      has_tenant_signature: inspection.signed_by_tenant?,
      inspector_signature_url: inspection.inspector_signature_blob ? generate_photo_url(inspection.inspector_signature_blob) : nil,
      tenant_signature_url: inspection.tenant_signature_blob ? generate_photo_url(inspection.tenant_signature_blob) : nil
    }
  end

  def build_company_context
    tenant_setting = TenantSetting.current
    {
      name: tenant_setting&.company_name || "Company",
      logo_url: tenant_setting&.company_logo_url,
      address: tenant_setting&.company_address,
      phone: tenant_setting&.company_phone,
      email: tenant_setting&.company_email,
      abn: tenant_setting&.company_abn
    }
  end

  def calculate_differences(entry_inspection)
    exit_rooms = inspection.inspection_rooms.includes(:inspection_items).ordered
    entry_rooms = entry_inspection.inspection_rooms.includes(:inspection_items).ordered

    differences = []

    exit_rooms.each do |exit_room|
      entry_room = entry_rooms.find { |r| r.name == exit_room.name }
      next unless entry_room

      exit_room.inspection_items.each do |exit_item|
        entry_item = entry_room.inspection_items.find { |i| i.name == exit_item.name }
        next unless entry_item && exit_item.condition.present? && entry_item.condition.present?
        next if exit_item.condition == entry_item.condition

        differences << {
          room: exit_room.name,
          item: exit_item.name,
          entry_condition: entry_item.condition,
          exit_condition: exit_item.condition,
          change: exit_item.condition_change
        }
      end
    end

    differences
  end

  def find_degraded_items(entry_inspection)
    calculate_differences(entry_inspection).select { |d| d[:change] == :degraded }
  end

  def generate_photo_url(blob)
    # For PDF generation, we use base64 data URIs to embed images directly
    # This avoids needing presigned URLs during Grover rendering
    begin
      content = StorageProviderService.download(blob.storage_path)
      "data:#{blob.content_type};base64,#{Base64.strict_encode64(content)}"
    rescue => e
      Rails.logger.warn("Failed to load blob #{blob.id} for inspection report: #{e.message}")
      nil
    end
  end
end
