# frozen_string_literal: true

# DocumentInbox - Universal document inbox item
#
# SSoT: THE ONE table for documents entering TEEEM through any channel
#
# Flow:
#   Input → Classify (AI) → Route → Process
#     │         │              │         │
#     ├─ Upload ├─ Invoice → BillInbox → Xero
#     ├─ Email  ├─ Plan → JobPlan → File in job
#     └─ API    ├─ Quote → Estimate → Link to job
#               ├─ Contract → Review Queue
#               └─ General → Manual routing
#
# Classification uses 3-layer approach:
#   1. Filename patterns (fast, high confidence)
#   2. DocumentTypeMatcher (SSoT pattern matching)
#   3. AI (Claude Haiku) for uncertain cases
#
class DocumentInbox < ApplicationRecord
  include TenantResolvable

  # Multi-tenancy (SSoT)
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant
  belongs_to :storage_blob, optional: true
  belongs_to :warehouse_document, optional: true
  belongs_to :synced_email, optional: true
  belongs_to :uploaded_by, class_name: 'User', optional: true
  belongs_to :overridden_by, class_name: 'User', optional: true

  # Polymorphic routing target
  belongs_to :routed_to, polymorphic: true, optional: true

  # Standalone takeoff associations (Feb 2026)
  has_many :takeoff_measurements, dependent: :destroy
  has_many :page_scales, dependent: :destroy
  has_many :takeoff_layers, dependent: :destroy

  # Constants
  SOURCES = %w[upload email api forward].freeze
  STATUSES = %w[pending classifying classified processing completed error archived].freeze
  # Legacy routing categories (kept for backward compatibility with existing data)
  ROUTING_CATEGORIES = %w[
    invoice plan quote contract purchase_order work_order
    email certificate compliance correspondence general
  ].freeze

  # Validations
  validates :source, presence: true, inclusion: { in: SOURCES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :document_type, length: { maximum: 255 }, allow_nil: true
  validates :classification_confidence, numericality: {
    greater_than_or_equal_to: 0,
    less_than_or_equal_to: 1
  }, allow_nil: true

  # Callbacks
  before_validation :set_defaults, on: :create

  # Scopes
  scope :pending, -> { where(status: 'pending') }
  scope :classifying, -> { where(status: 'classifying') }
  scope :classified, -> { where(status: 'classified') }
  scope :processing, -> { where(status: 'processing') }
  scope :completed, -> { where(status: 'completed') }
  scope :errors, -> { where(status: 'error') }
  scope :archived, -> { where(status: 'archived') }
  scope :active, -> { where.not(status: %w[completed archived error]) }

  scope :by_source, ->(source) { where(source: source) }
  scope :by_document_type, ->(type) { where(document_type: type) }
  scope :high_confidence, -> { where('classification_confidence >= ?', 0.8) }
  scope :low_confidence, -> { where('classification_confidence < ?', 0.6) }
  scope :needs_review, -> { classified.low_confidence.or(classified.where(user_override: false)) }
  scope :recent, -> { order(created_at: :desc) }

  # From email source
  scope :from_email, -> { where(source: %w[email forward]) }
  scope :from_upload, -> { where(source: 'upload') }

  # ========================================
  # Class Methods
  # ========================================

  # Create from uploaded file
  # FRC (Feb 2026): Classification is now synchronous. For 90%+ of uploads,
  # filename-pattern + DocumentTypeMatcher resolves in <50ms. AI path (500-2000ms)
  # only fires if confidence < 0.6 AND AI is enabled. This eliminates the queue
  # bottleneck where DocSort items sat at "pending" forever when workers fell behind.
  def self.create_from_upload!(file:, user:, metadata: {})
    content = file.read
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: file.original_filename,
      content_type: file.content_type
    )
    blob.increment!(:reference_count)

    item = create!(
      source: 'upload',
      uploaded_by: user,
      storage_blob: blob,
      original_filename: file.original_filename,
      content_type: file.content_type || blob.content_type,
      file_size: content.bytesize,
      metadata: metadata,
      tenant: ActsAsTenant.current_tenant
    )

    # Classify inline - upload still succeeds if classification fails
    begin
      item.classify!
    rescue StandardError => e
      Rails.logger.error "[DocumentInbox] Inline classification failed for #{item.id}: #{e.message}"
    end

    item
  end

  # Create from SyncedEmail (email or forward)
  def self.create_from_email!(email:, attachment_doc: nil, source: 'email')
    item = create!(
      source: source,
      synced_email: email,
      from_email: email.from_email,
      subject: email.subject,
      tenant_id: email.tenant_id
    )

    # If specific attachment, link it
    if attachment_doc
      item.update!(
        storage_blob: attachment_doc.storage_blob,
        warehouse_document: attachment_doc,
        original_filename: attachment_doc.original_filename,
        content_type: attachment_doc.content_type,
        file_size: attachment_doc.file_size
      )
    end

    item
  end

  # ========================================
  # Instance Methods
  # ========================================

  # Start classification process
  def classify!
    update!(status: 'classifying')

    result = DocumentClassificationService.new(self).classify!

    update!(
      status: 'classified',
      document_type: result[:document_type],
      classification_confidence: result[:confidence],
      classification_result: result
    )

    result
  rescue StandardError => e
    update!(
      status: 'error',
      error_message: "Classification failed: #{e.message}"
    )
    raise
  end

  # User manually sets document type
  def override_classification!(user:, document_type:)
    old_type = self.document_type

    update!(
      document_type: document_type,
      user_override: true,
      overridden_by: user,
      overridden_at: Time.current,
      classification_confidence: 1.0  # User overrides are 100% confidence
    )

    # Log correction to AIProcessingLog for learning (non-blocking)
    log_override_correction(user: user, new_type: document_type, old_type: old_type)

    # Check if auto-learning should add a new alias
    check_auto_learn_alias(filename: original_filename, target_type: document_type)
  end

  # Route to appropriate handler based on document_type
  def route!
    return if status == 'completed' || routed_to.present?

    update!(status: 'processing')

    result = DocumentInboxRoutingService.new(self).route!

    if result[:success]
      update!(
        status: 'completed',
        routed_to_type: result[:routed_to_type],
        routed_to_id: result[:routed_to_id],
        routed_at: Time.current,
        processed_at: Time.current
      )
    else
      update!(
        status: 'error',
        error_message: result[:error]
      )
    end

    result
  rescue StandardError => e
    update!(
      status: 'error',
      error_message: "Routing failed: #{e.message}"
    )
    raise
  end

  # Archive without routing (manual dismissal)
  def archive!
    update!(
      status: 'archived',
      processed_at: Time.current
    )
  end

  # Get file content for processing
  def download_content
    storage_blob&.download
  end

  # Get presigned download URL
  def download_url(expires_in: 3600)
    storage_blob&.presigned_url(expires_in: expires_in)
  end

  # Display helpers
  def display_name
    original_filename.presence || subject.presence || "Document #{id}"
  end

  def status_color
    case status
    when 'pending' then 'gray'
    when 'classifying' then 'blue'
    when 'classified' then confidence_color
    when 'processing' then 'yellow'
    when 'completed' then 'green'
    when 'error' then 'red'
    when 'archived' then 'gray'
    else 'gray'
    end
  end

  def confidence_color
    return 'gray' unless classification_confidence

    if classification_confidence >= 0.8
      'green'
    elsif classification_confidence >= 0.6
      'yellow'
    else
      'red'
    end
  end

  def confidence_percent
    return nil unless classification_confidence
    (classification_confidence * 100).round
  end

  def source_icon
    case source
    when 'upload' then 'upload'
    when 'email', 'forward' then 'mail'
    when 'api' then 'code'
    else 'file'
    end
  end

  def document_type_label
    document_type&.humanize&.titleize || 'Unclassified'
  end

  # Check if ready for auto-routing
  def can_auto_route?
    status == 'classified' &&
      document_type.present? &&
      classification_confidence.to_f >= 0.8 &&
      !user_override
  end

  private

  def set_defaults
    self.status ||= 'pending'
    self.source ||= 'upload'
  end

  # Find the AIProcessingLog entry for this item and record the user's correction
  def log_override_correction(user:, new_type:, old_type:)
    log = AiProcessingLog.where(
      processable_type: "DocumentInbox",
      processable_id: id
    ).order(created_at: :desc).first

    return unless log

    log.record_correction!(new_type, user: user)
  rescue StandardError => e
    Rails.logger.error "[DocumentInbox] Failed to log override correction: #{e.message}"
  end

  # After 3+ corrections of the same filename→type pattern, auto-add alias to DocumentType
  AUTO_LEARN_THRESHOLD = 3

  def check_auto_learn_alias(filename:, target_type:)
    return if filename.blank? || target_type.blank?

    # Count how many times this pattern has been corrected to the same type
    correction_count = AiProcessingLog
      .for_service("document_classification")
      .corrected
      .where(corrected_to: target_type)
      .where("input_identifier IS NOT NULL")
      .count

    return unless correction_count >= AUTO_LEARN_THRESHOLD

    # Extract meaningful words from the filename to use as alias candidates
    words = filename
      .gsub(/\.[^.]+$/, '')           # Remove extension
      .gsub(/[^a-zA-Z0-9\s]/, ' ')   # Replace special chars with spaces
      .split
      .map(&:downcase)
      .select { |w| w.length >= 3 }
      .reject { |w| %w[the and for doc pdf jpg png].include?(w) }
      .uniq

    return if words.empty?

    # Find the target DocumentType
    doc_type = DocumentType.find_by("lower(name) = ? OR lower(name) = ?",
      target_type.tr('_', ' ').downcase,
      target_type.downcase
    )
    return unless doc_type

    # Add new words that aren't already aliases
    existing_aliases = (doc_type.aliases || []).map { |a| a.to_s.downcase }
    new_aliases = words.reject { |w| existing_aliases.include?(w) || w == doc_type.name.downcase }

    return if new_aliases.empty?

    # Only add the most relevant word (first meaningful one from the corrected filenames)
    alias_to_add = new_aliases.first
    updated_aliases = (doc_type.aliases || []) + [alias_to_add]
    doc_type.update!(aliases: updated_aliases)

    Rails.logger.info "[DocumentInbox] Auto-learned alias '#{alias_to_add}' for DocumentType '#{doc_type.name}' " \
                      "(#{correction_count} corrections triggered this)"
  rescue StandardError => e
    Rails.logger.error "[DocumentInbox] Auto-learn alias failed: #{e.message}"
  end
end
