# frozen_string_literal: true

# DocumentTemplate stores document templates that can be filled with Job/Contact data.
#
# ============================================================================
# IMPORTANT: TEMPLATE STRATEGY (December 2024)
# ============================================================================
#
# We use TWO template types. Word templates were DEPRECATED and removed.
#
# 1. HTML TEMPLATES (template_type: "html")
#    - For Tekna-branded documents (Welcome Letter, Colour Selections, etc.)
#    - Stored locally in app/views/tekna_documents/templates/
#    - Rendered with ERB, converted to PDF via Grover (Puppeteer)
#    - Full control over styling and layout
#
# 2. PDF OVERLAY (template_type: "pdf_overlay")
#    - For QBCC and HIA legal documents (contracts, consumer guides, etc.)
#    - These are OFFICIAL regulatory documents - we CANNOT modify the layout
#    - The regulatory body (QBCC/HIA) provides the PDF template
#    - We only fill in form fields (client name, address, prices, etc.)
#    - Uses HexaPDF or pdf-forms gem for form filling
#
# WHY NOT WORD TEMPLATES?
#    - Required SharePoint connection (fragile, 404 errors when files moved)
#    - Sablon gem had compatibility issues
#    - Hard to version control templates stored in SharePoint
#    - HTML gives us full control and is git-tracked
#
# DEPRECATED (DO NOT USE):
#    - word            - SharePoint Word templates (REMOVED Dec 2024)
#    - sharepoint_fetch - Direct SharePoint file passthrough (REMOVED)
#
# ============================================================================
#
# Template Syntax (ERB for HTML templates):
#   <%= @job.title %>                - Simple field
#   <%= @contact.display_name %>     - Contact field
#   <% @items.each do |item| %>      - Loops
#   <% if @job.has_warranty? %>      - Conditionals
#
class DocumentTemplate < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  # Constants
  CATEGORIES = %w[job contact quote invoice contract letter report certificate].freeze
  OUTPUT_FORMATS = %w[docx pdf both].freeze

  # ACTIVE template types (use these):
  #   - html        → Tekna-branded documents, full control
  #   - pdf_overlay → QBCC/HIA legal documents, form filling only
  #
  # DEPRECATED (kept for migration, DO NOT use for new templates):
  #   - word            → Was SharePoint Word templates (removed Dec 2024)
  #   - sharepoint_fetch → Was direct SharePoint passthrough (removed Dec 2024)
  TEMPLATE_TYPES = %w[word html pdf_overlay sharepoint_fetch].freeze
  ACTIVE_TEMPLATE_TYPES = %w[html pdf_overlay].freeze
  LEGAL_SOURCES = %w[qbcc hia].freeze
  LAYOUTS = %w[tekna qbcc_official hia_official none].freeze

  # Phase 3: Universal warehouse metadata (SSoT for display_name, send_name, folder)
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # Validations
  validates :name, presence: true
  validates :category, inclusion: { in: CATEGORIES, allow_blank: true }
  validates :output_format, inclusion: { in: OUTPUT_FORMATS }
  validates :template_type, inclusion: { in: TEMPLATE_TYPES }
  validates :legal_source, inclusion: { in: LEGAL_SOURCES, allow_blank: true }
  validates :layout, inclusion: { in: LAYOUTS, allow_blank: true }
  validates :local_template_path, presence: true, if: -> { template_type == "html" }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :by_category, ->(category) { where(category: category) }
  scope :by_type, ->(type) { where(template_type: type) }

  # Active template types (use these)
  scope :html_templates, -> { where(template_type: "html") }
  scope :pdf_overlay_templates, -> { where(template_type: "pdf_overlay") }

  # Find templates that need migration to active types
  # Run: DocumentTemplate.needs_migration.each { |t| puts "#{t.id}: #{t.name}" }
  scope :needs_migration, -> { where(template_type: %w[word sharepoint_fetch]) }

  scope :legal_templates, -> { where(is_legal_format: true) }
  scope :tekna_branded, -> { where(is_legal_format: false) }

  # Check if template is linked to SharePoint
  def sharepoint_linked?
    sharepoint_item_id.present?
  end

  # Template type helpers
  def html_template?
    template_type == "html"
  end

  def pdf_overlay_template?
    template_type == "pdf_overlay"
  end

  # Check if this template uses a deprecated type (word or sharepoint_fetch)
  # These templates need to be migrated to html or pdf_overlay
  def deprecated_template_type?
    %w[word sharepoint_fetch].include?(template_type)
  end

  # Check if this template uses an active (supported) type
  def active_template_type?
    ACTIVE_TEMPLATE_TYPES.include?(template_type)
  end

  # Legal document helpers
  def qbcc_document?
    legal_source == "qbcc"
  end

  def hia_document?
    legal_source == "hia"
  end

  # Get available merge fields for this template's category
  # Returns array of field paths like ["job.title", "job.address", "contact.name"]
  def available_fields
    case category
    when "job"
      job_fields
    when "contact"
      contact_fields
    when "quote"
      quote_fields
    when "contract"
      contract_fields
    when "invoice"
      invoice_fields
    else
      job_fields + contact_fields
    end
  end

  # Generate output filename based on naming pattern
  # Pattern can include: {date}, {job_number}, {job_title}, {contact_name}, {template_name}, {invoice_number}
  def generate_output_filename(job: nil, contact: nil, invoice: nil)
    pattern = output_naming_pattern.presence || "{template_name}_{date}"

    filename = pattern.dup
    filename.gsub!("{date}", Date.current.strftime("%Y%m%d"))
    filename.gsub!("{template_name}", name.parameterize)
    filename.gsub!("{job_number}", job&.job_number.to_s)
    filename.gsub!("{job_title}", job&.title.to_s.parameterize)
    filename.gsub!("{contact_name}", contact&.display_name.to_s.parameterize)
    filename.gsub!("{invoice_number}", invoice&.invoice_number.to_s)

    # Remove any unreplaced placeholders
    filename.gsub!(/\{[^}]+\}/, "")

    # Clean up multiple underscores/dashes
    filename.gsub!(/_+/, "_")
    filename.gsub!(/-+/, "-")
    filename.chomp!("_")
    filename.chomp!("-")

    "#{filename}.#{output_format == 'both' ? 'pdf' : output_format}"
  end

  private

  def job_fields
    %w[
      job.job_number
      job.title
      job.address
      job.suburb
      job.state
      job.postcode
      job.full_address
      job.status
      job.contract_price
      job.contract_date
      job.practical_completion_date
      job.site_start_date
      job.lot_number
      job.plan_number
      job.description
    ]
  end

  def contact_fields
    %w[
      contact.display_name
      contact.first_name
      contact.last_name
      contact.email
      contact.phone
      contact.mobile
      contact.company_name
      contact.abn
      contact.address_line_1
      contact.address_line_2
      contact.suburb
      contact.state
      contact.postcode
      contact.full_address
    ]
  end

  def quote_fields
    job_fields + contact_fields + %w[
      quote.quote_number
      quote.quote_date
      quote.valid_until
      quote.total_amount
      quote.gst_amount
      quote.subtotal
      quote.description
      quote.terms
      quote.notes
    ]
  end

  def contract_fields
    job_fields + contact_fields + %w[
      contract.contract_number
      contract.contract_date
      contract.contract_price
      contract.deposit_amount
      contract.progress_payment_schedule
      contract.warranty_period
      contract.defect_liability_period
    ]
  end

  def invoice_fields
    job_fields + contact_fields + %w[
      invoice.invoice_number
      invoice.reference
      invoice.invoice_date
      invoice.due_date
      invoice.description
      invoice.subtotal
      invoice.total_tax
      invoice.total
      invoice.amount_due
      invoice.amount_paid
      invoice.status
      invoice.currency_code
      claim_stage.name
      claim_stage.percentage
      claim_stage.expected_amount
    ]
  end
end
