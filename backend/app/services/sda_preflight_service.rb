class SdaPreflightService
  REQUIRED_FIELDS = {
    provider: %w[company_name abn ndis_registration_number],
    dwelling: %w[street_address suburb state postcode],
    design: %w[sda_category sda_building_type bedrooms sda_max_residents],
    assessor: %w[sda_assessor_name sda_assessor_number sda_assessment_date],
    gst: %w[sda_gst_credits_claimed],
  }.freeze

  # Document types required before NDIS SDA enrolment submission.
  # TODO: Integrate with WarehouseDocument when document classification is live.
  REQUIRED_DOCUMENTS = %w[
    sda_assessment_certificate
    certificate_of_occupancy
    fire_safety_statement
    building_compliance_certificate
    proof_of_ownership
    property_photos
    floor_plans
    tenancy_agreement_template
  ].freeze

  def self.call(property:, tenant_settings:)
    new(property, tenant_settings).check
  end

  def initialize(property, tenant_settings)
    @property = property
    @settings = tenant_settings
  end

  # Returns a hash describing the readiness of the property for NDIS SDA enrolment.
  #
  # {
  #   missing_fields: [{ section: :provider, field: "abn" }, ...],
  #   missing_documents: ["certificate_of_occupancy", ...],
  #   completeness_pct: 72,
  #   total_required: 16,
  #   filled: 12,
  #   ready: false
  # }
  def check
    missing_fields = collect_missing_fields
    missing_documents = collect_missing_documents

    total_required = REQUIRED_FIELDS.values.flatten.length + REQUIRED_DOCUMENTS.length
    filled = total_required - missing_fields.length - missing_documents.length
    completeness = ((filled.to_f / total_required) * 100).round(0)

    {
      missing_fields: missing_fields,
      missing_documents: missing_documents,
      completeness_pct: completeness,
      total_required: total_required,
      filled: filled,
      ready: missing_fields.empty? && missing_documents.empty?,
    }
  end

  private

  def collect_missing_fields
    REQUIRED_FIELDS.each_with_object([]) do |(section, fields), missing|
      source = section == :provider ? @settings : @property
      fields.each do |field|
        missing << { section: section, field: field } if source.try(field).blank?
      end
    end
  end

  def collect_missing_documents
    # TODO: Query WarehouseDocument to check which documents exist for this property.
    # For now return all document types as potentially missing so callers know what's needed.
    REQUIRED_DOCUMENTS.dup
  end
end
