class CorporateCompanyDocument < ApplicationRecord
  include DocumentTemplatable
  include Searchable
  include StorableDocument
  include DocumentStorageConstants

  # SSoT: Storage scope for this document type
  # Determines path: /Corporate/{GroupName}/{CompanyCode}/{TabName}/filename
  storage_scope :corporate

  # SSoT: Get EntityTab from DocumentType.primary_entity_tab
  # This is THE ONE way to get folder structure for a document
  def effective_entity_tab
    document_type_record&.primary_entity_tab
  end

  # SSoT: Get storage folder template from EntityTab
  # Returns the inherited_template (e.g., "{{CompanyGroup}}/{{CompanyCode}}/ASIC")
  def storage_folder_template
    effective_entity_tab&.inherited_template
  end

  # Compatibility with BulkDocumentCategorizationService (which uses folder_path)
  # Returns the folder field value (e.g., "ASIC", "ATO", "LOANS")
  def folder_path
    folder
  end

  # Extract file extension from file_name (for compatibility with JobDocument interface)
  def file_extension
    return nil if file_name.blank?
    File.extname(file_name.to_s).delete('.').downcase.presence
  end

  # Searchable columns for full-text search (GIN index)
  searchable_columns :file_name, :display_name, :description, :folder

  # Associations
  belongs_to :corporate_company, foreign_key: "company_id", optional: true

  # Alias for as_json compatibility (alias_method works for associations, alias_attribute doesn't)
  def company
    corporate_company
  end
  belongs_to :contact, optional: true  # For documents linked to people (family members, directors)
  belongs_to :user, optional: true
  belongs_to :asset, optional: true
  belongs_to :loan, class_name: "CorporateCompanyLoan", optional: true
  belongs_to :document_type_record, class_name: "DocumentType", foreign_key: "document_type_id", optional: true
  belongs_to :user_validated_by, class_name: "User", optional: true

  # Polymorphic association - link to PurchaseOrder, ExternalInvoice, Job, etc.
  belongs_to :documentable, polymorphic: true, optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  # Same file = same StorageBlob, deduplication via content_hash
  belongs_to :storage_blob, optional: true

  # Activity log for tracking changes
  # Note: foreign_key is :company_document_id (legacy name from before table rename)
  has_many :document_activities, foreign_key: :company_document_id, dependent: :destroy

  # Case links
  # Note: foreign_key is :company_document_id (legacy name from before table rename)
  has_many :case_documents, foreign_key: :company_document_id, dependent: :destroy
  has_many :cases, through: :case_documents, source: :case_record

  # Verification feedback
  # Note: foreign_key is :company_document_id (legacy name from before table rename)
  has_many :document_verification_feedbacks, foreign_key: :company_document_id, dependent: :destroy

  # Duplicate tracking
  has_many :duplicate_reviews_as_existing, class_name: "DocumentDuplicateReview", foreign_key: :existing_document_id, dependent: :destroy
  has_many :duplicate_reviews_as_new, class_name: "DocumentDuplicateReview", foreign_key: :new_document_id, dependent: :nullify

  # Task attachments
  has_many :sm_task_attachments, as: :attachable, dependent: :destroy
  has_many :attached_tasks, through: :sm_task_attachments, source: :sm_task

  # Phase 3: Universal warehouse metadata (SSoT for display_name, send_name, folder)
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # ActiveStorage has_one_attached :file was REMOVED (Jan 2026) - it violated SSoT by
  # duplicating storage location. Files now stored via StorageBlob (belongs_to :storage_blob)
  # which deduplicates via content_hash and uses StorageConfiguration for provider-agnostic paths.

  # SSoT: ALLOWED_CONTENT_TYPES defined in DocumentStorageConstants concern

  # Storage types for Company Register tracking
  STORAGE_TYPES = %w[manual electronic both].freeze

  # SSoT: STORAGE_PROVIDERS, MIGRATION_STATUSES, AI_VERIFICATION_STATUSES
  # defined in DocumentStorageConstants concern

  # Focus types - three main categories for organizing documents
  FOCUS_TYPES = %w[company people job].freeze

  # Legacy hardcoded document types for backward compatibility
  LEGACY_DOCUMENT_TYPES = %w[constitution minutes loan_agreement security_deed setup share_certificate
                             tax_return financial_statement insurance_policy asic share_registry trust_deed
                             financial tax insurance contract certificate invoice quote other].freeze

  # Returns all allowed document types (from database + legacy hardcoded)
  def self.allowed_document_types
    # Get document type names from database
    db_types = DocumentType.pluck(:name) rescue []
    # Combine with legacy types
    (LEGACY_DOCUMENT_TYPES + db_types).uniq
  end

  # Legacy abbreviations for fallback (when DB is unavailable)
  LEGACY_ABBREVIATIONS = {
    "CTR" => "Company Tax Return",
    "TTR" => "Trust Tax Return",
    "BAS" => "Business Activity Statement",
    "PPSR" => "PPSR Registration",
    "CA" => "Client Advice",
    "AA" => "Accountant Advice",
    "LA" => "Legal Advice"
  }.freeze

  # Document type abbreviations for display title generation
  # Reads from database with caching, falls back to legacy if DB unavailable
  def self.document_type_abbreviations
    @abbreviations_cache ||= begin
      # Build hash from database: abbreviation => display_name (or name if no display_name)
      db_abbrs = DocumentType.where.not(abbreviation: [ nil, "" ])
                             .pluck(:abbreviation, :display_name, :name)
                             .each_with_object({}) do |(abbr, display_name, name), hash|
        # Use display_name if set, otherwise extract display name from name
        # e.g., "CTR - Company Tax Return" -> "Company Tax Return"
        display = display_name.presence || name.to_s.sub(/\A\w+\s*-\s*/, "")
        hash[abbr] = display
      end
      # Merge with legacy fallback (DB takes precedence)
      LEGACY_ABBREVIATIONS.merge(db_abbrs)
    rescue => e
      Rails.logger.warn "[CorporateCompanyDocument] Failed to load abbreviations from DB: #{e.message}"
      LEGACY_ABBREVIATIONS
    end
  end

  # Clear the abbreviations cache (called when DocumentType changes)
  def self.clear_abbreviations_cache!
    @abbreviations_cache = nil
  end

  # Validations
  validates :file_name, presence: true  # SSoT: file_name is THE filename
  # Allow document_type from the DocumentType table or legacy hardcoded values
  validates :document_type, inclusion: {
    in: ->(doc) { doc.class.allowed_document_types }
  }, allow_blank: true
  validates :storage_type, inclusion: { in: STORAGE_TYPES }, allow_blank: true
  validates :focus, inclusion: { in: FOCUS_TYPES }, presence: true
  validates :storage_provider, inclusion: { in: STORAGE_PROVIDERS }, allow_nil: true
  validates :migration_status, inclusion: { in: MIGRATION_STATUSES }, allow_nil: true

  # Validations for ownership
  validate :must_have_owner

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
  scope :by_type, ->(type) { where(document_type: type) }
  scope :by_year, ->(year) { where(year: year) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_tab, ->(tab) {
    # Match documents by any of:
    # 1. folder field matching the tab name (SharePoint synced documents)
    # 2. document_type (string) matching a DocumentType whose tabs array contains this tab (legacy)
    # 3. document_type_id (FK) matching a DocumentType whose tabs array contains this tab (SSoT)
    joins("LEFT JOIN document_types dt_legacy ON dt_legacy.name = corporate_company_documents.document_type")
      .joins("LEFT JOIN document_types dt_fk ON dt_fk.id = corporate_company_documents.document_type_id")
      .where(
        "UPPER(corporate_company_documents.folder) = ? OR dt_legacy.tabs @> ? OR dt_fk.tabs @> ?",
        tab.upcase, [ tab ].to_json, [ tab ].to_json
      )
  }
  scope :by_source, ->(source) { where(source: source) }
  scope :by_asset, ->(asset_id) { where(asset_id: asset_id) }
  scope :with_asset, -> { where.not(asset_id: nil) }
  scope :without_asset, -> { where(asset_id: nil) }
  scope :electronic, -> { where(storage_type: "electronic") }
  scope :manual, -> { where(storage_type: "manual") }
  scope :recent, -> { order(created_at: :desc) }
  # Filter by financial year using PostgreSQL array contains
  scope :by_financial_year, ->(year) { where("financial_years @> ARRAY[?]::integer[]", year.to_i) }
  scope :by_content_hash, ->(hash) { where(content_hash: hash) if hash.present? }
  # Filter by focus (company, people, job)
  scope :by_focus, ->(focus) { where(focus: focus) if focus.present? }
  scope :company_focus, -> { where(focus: "company") }
  scope :people_focus, -> { where(focus: "people") }
  scope :job_focus, -> { where(focus: "job") }
  # Migration scopes
  scope :migration_pending, -> { where(migration_status: 'pending') }
  scope :migration_in_progress, -> { where(migration_status: 'in_progress') }
  scope :migration_completed, -> { where(migration_status: 'completed') }
  scope :migration_failed, -> { where(migration_status: 'failed') }
  scope :needs_migration, -> { where(migration_status: [nil, 'failed']) }
  scope :on_provider, ->(provider) { where(storage_provider: provider) }

  # Callbacks
  after_create :create_activity
  after_create :create_warehouse_entry
  before_validation :set_focus
  before_save :extract_financial_years_from_file_name  # SSoT: file_name is THE filename
  before_save :generate_display_name                    # SSoT: display_name is THE display

  # Instance methods
  def formatted_document_type
    document_type.to_s.titleize.gsub("_", " ")
  end

  def file_size_mb
    return nil unless file_size.present?
    (file_size.to_f / 1024 / 1024).round(2)
  end

  # Find an existing document by content hash
  def self.find_by_content_hash(hash)
    return nil if hash.blank?
    by_content_hash(hash).first
  end

  # Check if a duplicate exists anywhere in the system
  def self.duplicate_exists?(hash)
    return false if hash.blank?
    by_content_hash(hash).exists?
  end

  # Find all documents with matching content (duplicates)
  def find_duplicates
    return CorporateCompanyDocument.none if content_hash.blank?
    CorporateCompanyDocument.by_content_hash(content_hash).where.not(id: id)
  end

  def has_duplicates?
    find_duplicates.exists?
  end

  # Provider-agnostic storage helpers
  # Returns true if stored in S3-compatible storage
  def s3_stored?
    storage_provider == 's3_compatible'
  end

  # Migration helpers
  def migration_in_progress?
    migration_status == 'in_progress'
  end

  def migration_completed?
    migration_status == 'completed'
  end

  def migration_failed?
    migration_status == 'failed'
  end

  def can_migrate?
    !migration_in_progress? && storage_reference.present?
  end

  # SSoT: storage_reference is now defined in StorableDocument concern

  # ========================================
  # StorageBlob File Access (SSoT - Jan 2026)
  # ========================================

  def has_file?
    storage_blob_id.present?
  end

  def file_url(expires_in: 3600)
    return nil unless storage_blob
    storage_blob.presigned_url(expires_in: expires_in, filename: file_name)
  end

  def attach_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!

    # Update document metadata
    self.file_name = filename
    self.file_size = content.bytesize
    self.content_type = content_type || blob.content_type
    self.content_hash = blob.content_hash
  end

  def download_file
    return nil unless storage_blob
    storage_blob.download
  end

  # Sets both provider-agnostic and SharePoint-specific fields
  # for backwards compatibility during migration
  def set_storage_reference(item_id, provider: 'sharepoint', path: nil)
    self.storage_item_id = item_id
    self.storage_provider = provider
    self.storage_path = path

    # Maintain backwards compatibility with SharePoint fields
    if provider == 'sharepoint'
      self.sharepoint_file_id = item_id
    end
  end

  # Phase 4: Virtual folder path for File Warehouse
  # DEPRECATED: folder is legacy - use WarehouseDocument.folder instead (Phase 3 SSoT)
  # SSoT: Reads template from StorageConfiguration.virtual_template_for(:corporate)
  # No fallback - if template is nil, that's a config error that should be fixed
  def virtual_folder_path
    config = StorageConfiguration.instance
    template = config&.virtual_template_for(:corporate)
    raise "StorageConfiguration missing :corporate template - run rails warehouse:init" unless template

    tokens = storage_tokens_for_virtual_path
    result = template.dup
    result.gsub!("{{CompanyGroup}}", tokens[:CompanyGroup].to_s)
    result.gsub!("{{GroupName}}", tokens[:GroupName].to_s)
    result.gsub!("{{CompanyCode}}", tokens[:CompanyCode].to_s)
    result.gsub!("{{CompanyName}}", tokens[:CompanyName].to_s)
    result.gsub!("{{TabName}}", tokens[:TabName].to_s)
    result.gsub!("{{Category}}", folder.to_s)

    # Clean up empty tokens
    result.gsub!(/\{\{[^}]+\}\}/, "")
    result.gsub!(%r{//+}, "/")
    result.gsub!(%r{^/|/$}, "")
    result
  end

  private

  # SSoT: Default tokens for storage path template
  # Template: /Corporate/{GroupName}/{CompanyCode}/{TabName}/filename
  # Priority: EntityTab.display_name > folder > document_type
  def default_storage_tokens
    entity_tab = effective_entity_tab
    {
      CompanyGroup: corporate_company&.corporate_group&.name || "No Group",
      GroupName: corporate_company&.corporate_group&.name || "No Group",
      CompanyCode: corporate_company&.code || corporate_company&.name&.first(3)&.upcase || "UNK",
      CompanyName: corporate_company&.name || "Unknown",
      # SSoT: TabName comes from EntityTab (THE ONE source of folder names)
      TabName: entity_tab&.display_name || folder || document_type&.titleize || "Documents"
    }
  end

  # Tokens for virtual_folder_path (uses same logic as default_storage_tokens)
  alias_method :storage_tokens_for_virtual_path, :default_storage_tokens

  # Automatically set focus based on associations
  # Priority: people > job > company
  def set_focus
    self.focus = if contact_id.present?
                   "people"
    elsif job_id.present? || documentable_type&.include?("Job")
                   "job"
    else
                   "company"
    end
  end

  def create_activity
    # Only create activity if there's a company (contacts don't have company_activities)
    return unless corporate_company.present?

    performer = user || (defined?(Current) && Current.respond_to?(:user) ? Current.user : nil) || User.first
    corporate_company.company_activities.create!(
      activity_type: "document_uploaded",
      description: "Document uploaded: #{file_name}",
      change_details: {
        document_type: document_type,
        file_name: file_name,
        file_size: file_size
      },
      user: performer
    )
  end

  # SSoT: Documents can belong to company, contact, job, OR task
  belongs_to :sm_task, optional: true

  def must_have_owner
    # Documents must have at least one owner
    if company_id.blank? && contact_id.blank? && job_id.blank? && sm_task_id.blank?
      errors.add(:base, "Document must belong to a company, contact, job, or task")
    end
  end

  # Generate a user-friendly display name from the filename
  # ULTRA SSoT: DocumentType.display_name IS the template
  # If document has a type, use its template. Otherwise, clean the filename.
  def generate_display_name
    return if file_name.blank?
    # Only regenerate if relevant fields changed or display_name is blank
    return if display_name.present? && !file_name_changed? && !document_type_id_changed?

    if document_type_record&.display_name.present?
      self.display_name = expand_display_template(document_type_record.display_name)
    else
      self.display_name = clean_file_name_for_display
    end
  end

  # Provide context for DocumentTemplatable concern
  # SSoT: All template expansion uses the concern's expand_display_template method
  def template_context
    fy = financial_years&.first || extract_fy_from_file_name
    {
      company_code: corporate_company&.code,
      company_name: corporate_company&.name,
      doc_type_name: document_type_record&.name,
      doc_type_code: document_type_record&.abbreviation,
      financial_year: fy,
      financial_years: financial_years,
      document_date: document_date,
      file_name: file_name
    }
  end

  # Extract FY from file_name if not in financial_years
  def extract_fy_from_file_name
    return nil unless file_name.present?
    if file_name.match?(/FY(\d{2})\b/)
      "20#{file_name.match(/FY(\d{2})\b/)[1]}".to_i
    elsif file_name.match?(/FY(\d{4})\b/)
      file_name.match(/FY(\d{4})\b/)[1].to_i
    end
  end

  # Fallback: clean filename for display when no DocumentType
  def clean_file_name_for_display
    display = file_name.dup

    # Remove company code prefix if present
    if corporate_company&.code.present?
      display.sub!(/\A#{Regexp.escape(corporate_company.code)}\s+/i, '')
    end

    # Remove file extension
    display.sub!(/\.(pdf|docx?|xlsx?|png|jpg|jpeg)$/i, '')

    # Clean up extra spaces
    display.gsub!(/\s+/, ' ')
    display.strip
  end

  # Extract financial years from file_name
  # ONLY extracts if file_name explicitly contains "FY" pattern
  # If file_name uses dates or date ranges without FY, financial_years is cleared
  def extract_financial_years_from_file_name
    return if file_name.blank?

    # Only populate financial_years if file_name explicitly contains "FY" pattern
    # Documents with date ranges (e.g., "BAS Statement 01-07-2023 to 30-06-2024") should NOT have FY
    unless file_name.match?(/FY\d{2,4}/i)
      self.financial_years = []
      return
    end

    years = Set.new

    # Extract FY followed by 2 or 4 digits (e.g., FY21, FY2021)
    file_name.scan(/FY(\d{2,4})/i).each do |match|
      year_str = match[0]
      year = year_str.length == 2 ? "20#{year_str}".to_i : year_str.to_i
      years.add(year) if year >= 2000 && year <= 2100
    end

    self.financial_years = years.to_a.sort
  end

  # Class method to update financial years for all existing documents
  def self.backfill_financial_years!
    CorporateCompanyDocument.find_each do |doc|
      doc.extract_financial_years_from_file_name
      doc.save(validate: false) if doc.financial_years_changed?
    end
  end

  # Class method to generate display_name for all existing documents
  def self.backfill_display_names!
    count = 0
    CorporateCompanyDocument.includes(:corporate_company).find_each do |doc|
      doc.send(:generate_display_name)
      if doc.display_name_changed?
        doc.save(validate: false)
        count += 1
      end
    end
    Rails.logger.info "[CorporateCompanyDocument] Updated #{count} documents with display names"
    count
  end

  # Create WarehouseDocument entry for File Warehouse
  def create_warehouse_entry
    return unless storage_blob

    create_warehouse_document!(
      source_type: "corporate",
      folder: virtual_folder_path,
      display_name: display_name || file_name,
      original_filename: file_name,
      storage_blob: storage_blob,
      metadata: {
        corporate_company_document_id: id,
        company_id: company_id,
        document_type: document_type,
        document_type_id: document_type_id,
        folder: folder
      }
    )
  rescue StandardError => e
    Rails.logger.error("[CorporateCompanyDocument] Failed to create warehouse entry for #{id}: #{e.message}")
  end
end
