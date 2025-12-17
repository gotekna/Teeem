# frozen_string_literal: true

# DocumentEsignService - Generate a document and send for e-signature
#
# This service combines document generation with the e-signature system
# to provide a seamless "generate and send for signing" workflow.
#
# Usage:
#   service = DocumentEsignService.new(
#     template: template,
#     job: job,
#     signers: [
#       { contact: primary_contact, role: "client" },
#       { contact: secondary_contact, role: "client" }
#     ]
#   )
#   result = service.execute!
#   # result[:e_signature_request] - The created request
#   # result[:document_url] - SharePoint URL to the document
#
class DocumentEsignService
  class Error < StandardError; end

  attr_reader :template, :job, :signers, :options

  def initialize(template:, job:, signers: [], **options)
    @template = template
    @job = job
    @signers = signers
    @options = options
  end

  # Execute the full workflow: generate → upload → create e-sign request → send
  def execute!
    validate!

    # Step 1: Generate the main document
    Rails.logger.info "[DocumentEsignService] Generating document from template: #{template.name}"
    generator = DocumentGenerator.new(template)
    generated = generator.generate(job: job, extra_data: options[:extra_data] || {})

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

    # Step 2: Upload to SharePoint (to job's Documents folder)
    Rails.logger.info "[DocumentEsignService] Uploading to SharePoint"
    uploaded_file = upload_to_sharepoint(generated)

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
    raise Error, "Template is required" unless template
    raise Error, "Job is required" unless job
    raise Error, "Template is not linked to SharePoint" unless template.sharepoint_linked?
    raise Error, "At least one signer is required" if signers.empty?

    signers.each do |signer|
      if signer[:contact]
        raise Error, "Signer contact has no email" unless signer[:contact].email.present?
      elsif signer[:email].blank?
        raise Error, "Signer must have contact or email"
      end
    end
  end

  def upload_to_sharepoint(generated)
    graph_client = MicrosoftAppGraphClient.new

    # Determine destination folder (job's Documents folder or specified folder)
    folder_path = options[:destination_folder] || build_job_folder_path

    # Upload the PDF (preferred for e-signing) or DOCX
    content = generated[:pdf_content] || generated[:docx_content]
    filename = generated[:pdf_filename] || generated[:filename]

    graph_client.upload_file_content(
      template.sharepoint_site_id,
      template.sharepoint_drive_id,
      folder_path,
      filename,
      content
    )
  end

  def build_job_folder_path
    # Build path like: "TEEEM Jobs/123 - Smith Residence/Documents"
    base_path = CorporateCompanySetting.job_documents_base_path
    job_folder = job.sharepoint_folder_name || "#{job.id} - #{job.name}"
    "#{base_path}/#{job_folder}/Documents"
  end

  def create_esign_request(uploaded_file, document_filename)
    request = ESignatureRequest.new(
      title: options[:title] || "#{template.name} - #{job.name}",
      description: options[:description],
      documentable: job,
      created_by_id: Current.user&.id,
      signing_order: options[:signing_order] || 0, # 0 = parallel
      expires_at: (options[:expires_in_days] || 30).days.from_now,
      message_to_signers: options[:message_to_signers],
      send_reminders: options[:send_reminders] != false,
      original_sharepoint_file_id: uploaded_file[:id],
      sharepoint_site_id: template.sharepoint_site_id,
      sharepoint_drive_id: template.sharepoint_drive_id
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

  def calculate_document_hash(file_id)
    graph_client = MicrosoftAppGraphClient.new
    content = graph_client.get_drive_item_content(
      site_id: template.sharepoint_site_id,
      drive_id: template.sharepoint_drive_id,
      item_id: file_id
    )
    Digest::SHA256.hexdigest(content)
  rescue StandardError => e
    Rails.logger.warn "[DocumentEsignService] Could not calculate document hash: #{e.message}"
    nil
  end

  # Generate additional documents from template keys
  def generate_additional_documents
    template_keys = options[:additional_templates]
    return [] if template_keys.blank?

    template_keys.filter_map do |key|
      additional_template = DocumentTemplate.find_by(key: key) || DocumentTemplate.find_by(name: key)
      unless additional_template
        Rails.logger.warn "[DocumentEsignService] Additional template not found: #{key}"
        next
      end

      Rails.logger.info "[DocumentEsignService] Generating additional document: #{additional_template.name}"
      generator = DocumentGenerator.new(additional_template)
      generated = generator.generate(job: job, extra_data: options[:extra_data] || {})

      # Return the PDF content
      generated[:pdf_content] || generated[:docx_content]
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
