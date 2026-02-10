# frozen_string_literal: true

# DocumentEsignService - Generate a document and send for e-signature
#
# This service combines document generation with the e-signature system
# to provide a seamless "generate and send for signing" workflow.
#
# ============================================================================
# SSoT:
# - Uses TeknaDocumentGenerator for document generation (Dec 2024)
# - Uses DocumentProviderAware for provider-agnostic storage operations
# ============================================================================
#
# Usage (NEW - template_key):
#   service = DocumentEsignService.new(
#     template_key: :welcome_letter,  # Uses TeknaDocumentGenerator (SSoT)
#     job: job,
#     signers: [
#       { contact: primary_contact, role: "client" },
#       { contact: secondary_contact, role: "client" }
#     ]
#   )
#   result = service.execute!
#
# Usage (DEPRECATED - template object):
#   service = DocumentEsignService.new(
#     template: template,  # DocumentTemplate object (deprecated)
#     job: job,
#     signers: [...]
#   )
#
class DocumentEsignService
  include DocumentProviderAware

  class Error < StandardError; end

  attr_reader :template, :template_key, :job, :signers, :options

  def initialize(template: nil, template_key: nil, job:, signers: [], **options)
    @template = template
    @template_key = template_key&.to_sym
    @job = job
    @signers = signers
    @options = options
  end

  # Execute the full workflow: generate → upload → create e-sign request → send
  def execute!
    validate!

    # Step 1: Generate the main document
    # SSoT: Uses TeknaDocumentGenerator (template_key required)
    generated = generate_document

    # Step 1b: Generate additional documents if specified
    additional_pdfs = generate_additional_documents

    # Step 1c: Combine PDFs if there are additional documents
    if additional_pdfs.any?
      Rails.logger.info "[DocumentEsignService] Combining #{additional_pdfs.length + 1} documents into signing package"
      main_pdf_content = generated[:pdf_content] || generated[:docx_content]
      all_pdfs = [main_pdf_content] + additional_pdfs
      combined_content = combine_pdfs(all_pdfs)
      generated[:pdf_content] = combined_content
      generated[:pdf_filename] ||= generated[:filename].sub(/\.\w+$/, ".pdf")
    end

    # Step 2: Upload to storage (to job's Documents folder)
    Rails.logger.info "[DocumentEsignService] Uploading to storage"
    uploaded_file = upload_to_storage(generated)

    # Step 3: Create e-signature request
    Rails.logger.info "[DocumentEsignService] Creating e-signature request"
    request = create_esign_request(uploaded_file, generated[:filename])

    # Step 4: Send for signing (unless auto_send: false)
    unless options[:auto_send] == false
      Rails.logger.info "[DocumentEsignService] Sending for signing to #{request.signers.count} signers"
      request.send_for_signing!
    end

    {
      success: true,
      e_signature_request: request,
      request_number: request.request_number,
      document_filename: generated[:filename],
      document_sharepoint_id: uploaded_file[:id],
      signers_count: request.signers.count,
      status: request.status
    }
  rescue StandardError => e
    Rails.logger.error "[DocumentEsignService] Error: #{e.message}"
    raise Error, e.message
  end

  private

  def validate!
    raise Error, "template_key is required (Word templates no longer supported)" unless template_key
    raise Error, "Job is required" unless job
    raise Error, "At least one signer is required" if signers.empty?

    # Validate template_key exists in TeknaDocumentGenerator
    unless TeknaDocumentGenerator::TEMPLATES.key?(template_key)
      available = TeknaDocumentGenerator::TEMPLATES.keys.join(", ")
      raise Error, "Unknown template_key: #{template_key}. Available: #{available}"
    end

    signers.each do |signer|
      if signer[:contact]
        raise Error, "Signer contact has no email" unless signer[:contact].email.present?
      elsif signer[:email].blank?
        raise Error, "Signer must have contact or email"
      end
    end
  end

  # Generate document using SSoT (TeknaDocumentGenerator)
  def generate_document
    raise Error, "template_key is required. Word templates are no longer supported." unless template_key

    # SSoT: Use TeknaDocumentGenerator
    Rails.logger.info "[DocumentEsignService] Generating document from TeknaDocumentGenerator: #{template_key}"
    generator = TeknaDocumentGenerator.new(template_key)
    result = generator.generate(job: job, extra_data: options[:extra_data] || {})

    {
      pdf_content: result[:pdf_content],
      filename: result[:filename],
      title: result[:title]
    }
  end

  # Get template name for display
  def template_name
    if template_key
      TeknaDocumentGenerator::TEMPLATES.dig(template_key, :title) || template_key.to_s.titleize
    else
      template&.name || "Unknown"
    end
  end

  def upload_to_storage(generated)
    # Setup provider-agnostic storage
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      raise Error, "Storage not connected: #{e.message}"
    end

    # Determine destination folder (job's Documents folder or specified folder)
    folder_path = options[:destination_folder] || build_job_folder_path

    # Upload the PDF (preferred for e-signing) or DOCX
    content = generated[:pdf_content] || generated[:docx_content]
    filename = generated[:pdf_filename] || generated[:filename]

    # Ensure folder exists
    get_or_create_folder_path(folder_path)

    # Upload using provider-agnostic method
    upload_to_provider(folder_path, content, filename, content_type: "application/pdf")
  end

  def build_job_folder_path
    # Build path like: "Jobs/123 - Smith Residence/Documents"
    # SSoT: WarehouseFolder owns folder names, WarehouseProvider owns base path
    base_path = WarehouseProvider.instance.path_for(:jobs)
    job_folder = "#{job.id} - #{job.name}"

    # SSoT (Feb 2026): Use WarehouseFolder for folder name instead of hardcoding
    documents_tab = WarehouseFolder.for_warehouse_type("job").find_by(tab_key: "documents")
    folder_name = documents_tab&.display_name || "Documents"

    "#{base_path}/#{job_folder}/#{folder_name}"
  end

  def create_esign_request(uploaded_file, document_filename)
    # SSoT: Use WarehouseProvider for site/drive IDs
    storage_config = WarehouseProvider.instance

    request = ESignatureRequest.new(
      title: options[:title] || "#{template_name} - #{job.name}",
      description: options[:description],
      documentable: job,
      created_by_id: Current.user&.id,
      signing_order: options[:signing_order] || 0, # 0 = parallel
      expires_at: (options[:expires_in_days] || 30).days.from_now,
      message_to_signers: options[:message_to_signers],
      send_reminders: options[:send_reminders] != false,
      original_storage_file_id: uploaded_file[:id],
      storage_site_id: storage_config.site_id,
      storage_drive_id: storage_config.drive_id
    )

    # Add signers
    signers.each_with_index do |signer_config, index|
      contact = signer_config[:contact]

      request.signers.build(
        name: contact&.display_name || signer_config[:name],
        email: contact&.email || signer_config[:email],
        role: signer_config[:role] || "signer",
        signing_order: signer_config[:signing_order] || index,
        contact_id: contact&.id
      )
    end

    # Calculate document hash for integrity
    request.original_document_hash = calculate_document_hash(uploaded_file[:id])

    request.save!
    request
  end

  def calculate_document_hash(file_info)
    # file_info can have :id or :path from any storage provider
    file_identifier = file_info[:path] || file_info[:id]
    return nil unless file_identifier

    storage_service = DocumentStorageService.new
    doc = OpenStruct.new(
      storage_path: file_info[:path],
      storage_file_id: file_info[:id]
    )
    result = storage_service.download(doc)
    return nil unless result[:success] && result[:content].present?

    Digest::SHA256.hexdigest(result[:content])
  rescue StandardError => e
    Rails.logger.warn "[DocumentEsignService] Could not calculate document hash: #{e.message}"
    nil
  end

  # Generate additional documents from template keys
  # SSoT: Uses TeknaDocumentGenerator for all additional documents
  def generate_additional_documents
    additional_keys = options[:additional_templates]
    return [] if additional_keys.blank?

    additional_keys.filter_map do |key|
      key_sym = key.to_sym

      # Validate template exists in TeknaDocumentGenerator
      unless TeknaDocumentGenerator::TEMPLATES.key?(key_sym)
        Rails.logger.warn "[DocumentEsignService] Additional template not found in TeknaDocumentGenerator: #{key}"
        next
      end

      Rails.logger.info "[DocumentEsignService] Generating additional document: #{key}"
      generator = TeknaDocumentGenerator.new(key_sym)
      generated = generator.generate(job: job, extra_data: options[:extra_data] || {})

      # Return the PDF content
      generated[:pdf_content]
    rescue StandardError => e
      Rails.logger.error "[DocumentEsignService] Failed to generate additional document #{key}: #{e.message}"
      nil
    end
  end

  # Combine multiple PDFs into one using HexaPDF
  def combine_pdfs(pdf_contents)
    require "hexapdf"

    target = HexaPDF::Document.new

    pdf_contents.each_with_index do |content, index|
      next unless content.present?

      # Parse each PDF and import its pages
      begin
        source = HexaPDF::Document.new(io: StringIO.new(content))
        source.pages.each { |page| target.pages << target.import(page) }
        Rails.logger.info "[DocumentEsignService] Added document #{index + 1} (#{source.pages.count} pages)"
      rescue StandardError => e
        Rails.logger.warn "[DocumentEsignService] Could not parse document #{index + 1}: #{e.message}"
      end
    end

    # Write to string and return
    output = StringIO.new
    target.write(output, optimize: true)
    output.string
  end
end
