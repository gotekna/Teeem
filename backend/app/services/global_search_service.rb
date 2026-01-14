# frozen_string_literal: true

# Gold Standard Search Infrastructure - Global Search Service (SSoT)
#
# Provides unified search across all searchable tables in TEEEM.
# Uses PostgreSQL full-text search with GIN indexes for sub-50ms response times.
#
# Usage:
#   service = GlobalSearchService.new
#   results = service.search("invoice", types: ['emails', 'documents'], limit: 20)
#
#   # Result format:
#   {
#     success: true,
#     query: "invoice",
#     total_count: 15,
#     results: {
#       emails: [...],
#       documents: [...],
#       jobs: [...],
#       contacts: [...],
#       tasks: [...],
#       purchase_orders: [...]
#     }
#   }
#
class GlobalSearchService
  # Searchable types and their model classes
  SEARCHABLE_TYPES = {
    "emails" => EmailWarehouse,
    "documents" => CorporateCompanyDocument,
    "jobs" => Job,
    "contacts" => Contact,
    "tasks" => SmTask,
    "purchase_orders" => PurchaseOrder
  }.freeze

  DEFAULT_LIMIT = 20
  MAX_LIMIT = 100

  def initialize(user: nil)
    @user = user
  end

  # Search across one or more types
  #
  # @param query [String] The search query
  # @param types [Array<String>] Types to search (nil = all types)
  # @param limit [Integer] Max results per type
  # @return [Hash] Search results grouped by type
  def search(query, types: nil, limit: DEFAULT_LIMIT)
    return empty_results(query) if query.blank?

    query = query.to_s.strip
    limit = [[limit.to_i, 1].max, MAX_LIMIT].min
    types = normalize_types(types)

    results = {}
    total_count = 0

    types.each do |type|
      model = SEARCHABLE_TYPES[type]
      next unless model

      type_results = search_type(model, query, limit)
      results[type] = type_results
      total_count += type_results.size
    end

    {
      success: true,
      query: query,
      total_count: total_count,
      results: results
    }
  end

  # Search a single type with more control
  def search_single(type, query, limit: DEFAULT_LIMIT, offset: 0)
    model = SEARCHABLE_TYPES[type.to_s]
    return { success: false, error: "Unknown type: #{type}" } unless model

    query = query.to_s.strip
    return { success: false, error: "Query is required" } if query.blank?

    limit = [[limit.to_i, 1].max, MAX_LIMIT].min

    results = search_type(model, query, limit, offset: offset)
    count = count_type(model, query)

    {
      success: true,
      type: type,
      query: query,
      total_count: count,
      results: results
    }
  end

  # Get available search types
  def self.available_types
    SEARCHABLE_TYPES.keys
  end

  # Check if search infrastructure is configured for a type
  def self.configured?(type)
    model = SEARCHABLE_TYPES[type.to_s]
    return false unless model

    model.respond_to?(:searchable_configured?) && model.searchable_configured?
  end

  private

  def empty_results(query)
    {
      success: true,
      query: query.to_s,
      total_count: 0,
      results: SEARCHABLE_TYPES.keys.each_with_object({}) { |k, h| h[k] = [] }
    }
  end

  def normalize_types(types)
    return SEARCHABLE_TYPES.keys if types.blank?

    types = types.is_a?(String) ? types.split(",").map(&:strip) : Array(types)
    types.map(&:to_s).select { |t| SEARCHABLE_TYPES.key?(t) }
  end

  def search_type(model, query, limit, offset: 0)
    scope = base_scope(model)

    # Use the Searchable concern's search_text scope
    if model.respond_to?(:search_text)
      scope = scope.search_text(query)
    else
      # Fallback for models without Searchable concern yet
      return []
    end

    scope.limit(limit).offset(offset).map { |record| serialize_result(model, record) }
  rescue StandardError => e
    Rails.logger.error "[GlobalSearchService] Error searching #{model.name}: #{e.message}"
    []
  end

  def count_type(model, query)
    scope = base_scope(model)

    if model.respond_to?(:search_text)
      scope.search_text(query).count
    else
      0
    end
  rescue StandardError
    0
  end

  def base_scope(model)
    case model.name
    when "EmailWarehouse"
      model.order(received_at: :desc)
    when "CorporateCompanyDocument"
      model.includes(:document_type_record).order(created_at: :desc)
    when "Job"
      model.order(created_at: :desc)
    when "Contact"
      model.order(:display_name)
    when "SmTask"
      model.order(created_at: :desc)
    when "PurchaseOrder"
      model.order(created_at: :desc)
    else
      model.all
    end
  end

  # Serialize a result for API response
  def serialize_result(model, record)
    case model.name
    when "EmailWarehouse"
      {
        id: record.id,
        type: "email",
        title: record.subject,
        subtitle: record.from_email,
        date: record.received_at&.iso8601,
        has_attachments: record.has_attachments
      }
    when "CorporateCompanyDocument"
      {
        id: record.id,
        type: "document",
        title: record.display_name || record.file_name,
        subtitle: record.document_type_record&.name || "Document",
        date: record.created_at&.iso8601,
        # SSoT: storage_url (from StorableDocument concern) is THE ONE way to get download URLs
        url: record.storage_url || record.file_url
      }
    when "Job"
      {
        id: record.id,
        type: "job",
        title: record.name,
        subtitle: record.location || [record.street_name, record.suburb].compact.join(", "),
        date: record.created_at&.iso8601,
        status: record.job_status&.name
      }
    when "Contact"
      {
        id: record.id,
        type: "contact",
        title: record.display_name,
        subtitle: record.email,
        company: record.company_name_or_trust,
        is_supplier: record.respond_to?(:is_supplier?) ? record.is_supplier? : false
      }
    when "SmTask"
      {
        id: record.id,
        type: "task",
        title: record.name,
        subtitle: record.description&.truncate(100),
        date: record.created_at&.iso8601,
        status: record.status
      }
    when "PurchaseOrder"
      {
        id: record.id,
        type: "purchase_order",
        title: record.po_number,
        subtitle: record.description,
        date: record.created_at&.iso8601,
        status: record.status
      }
    else
      {
        id: record.id,
        type: model.name.underscore,
        title: record.try(:name) || record.try(:title) || "Record ##{record.id}"
      }
    end
  end
end
