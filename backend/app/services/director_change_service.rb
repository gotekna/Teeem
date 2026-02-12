# frozen_string_literal: true

# DirectorChangeService generates ASIC Form 484 director change packages.
#
# Generates 4 documents:
# 1. Minutes of Meeting of Directors (board resolution)
# 2. Director Resignation Letter (for outgoing director to sign)
# 3. Consent to Act as Director (for incoming director to sign)
# 4. Form 484 Record Copy (internal record for ASIC filing)
#
# All three are combined into a single PDF package and optionally sent
# for e-signature via TEEEM's e-signature system.
#
# Usage:
#   service = DirectorChangeService.new(
#     company: corporate,
#     ceasing_directors: [{ corporate_director: cd, positions: ["director"], cessation_date: Date.today }],
#     new_appointments: [{ contact: contact, positions: ["director"], appointment_date: Date.today }],
#     user: current_user
#   )
#
#   # Preview/download only
#   result = service.generate_package
#   # result[:pdf_content], result[:filename], result[:documents]
#
#   # Generate and send for e-signature
#   result = service.generate_and_send!
#   # result[:e_signature_request], result[:pdf_content], result[:filename]
#
class DirectorChangeService
  class GenerationError < StandardError; end

  TEMPLATE_BASE = "tekna_documents/templates/asic"

  attr_reader :company, :ceasing_directors, :new_appointments, :user

  def initialize(company:, ceasing_directors: [], new_appointments: [], user:)
    @company = company
    @ceasing_directors = ceasing_directors
    @new_appointments = new_appointments
    @user = user

    validate!
  end

  # Generate combined PDF package without sending
  def generate_package
    documents = generate_all_documents
    combined_pdf = combine_pdfs(documents)

    {
      pdf_content: combined_pdf,
      filename: generate_filename,
      documents: documents.map { |d| { type: d[:type], name: d[:name] } },
      generated_at: Time.current
    }
  end

  # Generate, upload, and send for e-signature
  def generate_and_send!
    package = generate_package

    # Upload combined PDF to storage
    blob = upload_to_storage(package[:pdf_content], package[:filename])

    # Create e-signature request with signers
    e_sig_request = create_e_signature_request(blob, package)

    # Send for signing
    e_sig_request.send_for_signing!

    {
      e_signature_request: e_sig_request,
      pdf_content: package[:pdf_content],
      filename: package[:filename],
      documents: package[:documents]
    }
  end

  # Called when e-signature completes - updates director records
  def complete_signing!(e_signature_request)
    ActiveRecord::Base.transaction do
      # Set resignation_date on ceasing directors
      ceasing_directors.each do |cd_data|
        director = cd_data[:corporate_director]
        director.update!(
          resignation_date: cd_data[:cessation_date],
          is_current: false
        )

        log_activity(
          "director_resigned",
          "#{director.contact.display_name} resigned as #{cd_data[:positions].join(', ')}"
        )
      end

      # Create new CorporateDirector records for appointments
      new_appointments.each do |appt_data|
        contact = appt_data[:contact]
        appt_data[:positions].each do |position|
          company.corporate_directors.create!(
            contact: contact,
            position: position,
            appointment_date: appt_data[:appointment_date],
            is_current: true
          )
        end

        log_activity(
          "director_appointed",
          "#{contact.display_name} appointed as #{appt_data[:positions].join(', ')}"
        )
      end

      # Store signed PDF as WarehouseDocument
      if e_signature_request.signed_storage_reference.present?
        store_signed_document(e_signature_request)
      end
    end
  end

  # Preview HTML for a specific document type
  def preview(document_type)
    case document_type.to_s
    when "minutes"
      render_minutes[:html]
    when "resignation"
      raise GenerationError, "No ceasing directors to preview" if ceasing_directors.empty?
      render_resignation(ceasing_directors.first)[:html]
    when "consent"
      raise GenerationError, "No new appointments to preview" if new_appointments.empty?
      render_consent(new_appointments.first)[:html]
    when "form_484"
      render_form_484[:html]
    else
      raise GenerationError, "Unknown document type: #{document_type}"
    end
  end

  private

  def validate!
    raise GenerationError, "Company is required" unless company
    raise GenerationError, "User is required" unless user
    raise GenerationError, "At least one change is required" if ceasing_directors.empty? && new_appointments.empty?

    # Validate ceasing directors have required data
    ceasing_directors.each do |cd|
      raise GenerationError, "corporate_director is required for ceasing directors" unless cd[:corporate_director]
      raise GenerationError, "positions are required for ceasing directors" if cd[:positions].blank?
      raise GenerationError, "cessation_date is required for ceasing directors" unless cd[:cessation_date]
    end

    # Validate new appointments have required data
    new_appointments.each do |appt|
      raise GenerationError, "contact is required for new appointments" unless appt[:contact]
      raise GenerationError, "positions are required for new appointments" if appt[:positions].blank?
      raise GenerationError, "appointment_date is required for new appointments" unless appt[:appointment_date]
    end
  end

  # --- Document Generation ---

  def generate_all_documents
    documents = []

    # Generate minutes of directors' meeting (first - it's the board resolution)
    documents << render_minutes

    # Generate resignation letters
    ceasing_directors.each do |cd|
      documents << render_resignation(cd)
    end

    # Generate consent forms
    new_appointments.each do |appt|
      documents << render_consent(appt)
    end

    # Generate Form 484 record
    documents << render_form_484

    documents
  end

  def render_resignation(cd_data)
    director = cd_data[:corporate_director]
    contact = director.contact
    cessation_date = cd_data[:cessation_date]

    context = {
      company: build_company_context,
      director: build_director_context(contact),
      positions: cd_data[:positions],
      cessation_date: cessation_date,
      cessation_date_formatted: cessation_date.strftime("%d/%m/%Y")
    }

    html = render_template("director_resignation", context)
    pdf = convert_to_pdf(html)

    {
      type: :resignation,
      name: "Resignation - #{contact.display_name}",
      html: html,
      pdf_content: pdf,
      signer_name: contact.display_name,
      signer_email: cd_data[:email].presence || contact.primary_email,
      signer_contact: contact,
      signer_role: "director"
    }
  end

  def render_consent(appt_data)
    contact = appt_data[:contact]
    appointment_date = appt_data[:appointment_date]

    context = {
      company: build_company_context,
      director: build_director_context(contact),
      positions: appt_data[:positions],
      appointment_date: appointment_date,
      appointment_date_formatted: appointment_date.strftime("%d/%m/%Y")
    }

    html = render_template("consent_to_act", context)
    pdf = convert_to_pdf(html)

    {
      type: :consent,
      name: "Consent to Act - #{contact.display_name}",
      html: html,
      pdf_content: pdf,
      signer_name: contact.display_name,
      signer_email: appt_data[:email].presence || contact.primary_email,
      signer_contact: contact,
      signer_role: "director"
    }
  end

  def render_minutes
    meeting_date = determine_meeting_date

    # Build list of remaining directors (those not ceasing) for "Present" section
    ceasing_contact_ids = ceasing_directors.map { |cd| cd[:corporate_director].contact_id }
    remaining = company.corporate_directors.where(is_current: true).where.not(contact_id: ceasing_contact_ids).includes(:contact)
    remaining_directors = remaining.group_by(&:contact_id).map do |_cid, dirs|
      {
        full_name: dirs.first.contact.display_name,
        positions: dirs.map(&:position)
      }
    end

    # Determine chairperson - prefer director with chairperson position, else first remaining
    chairperson_contact = nil
    remaining.each do |dir|
      if dir.position&.downcase&.include?("chair")
        chairperson_contact = dir.contact
        break
      end
    end
    chairperson_contact ||= remaining.first&.contact

    context = {
      company: build_company_context,
      ceasing_directors: ceasing_directors.map do |cd|
        contact = cd[:corporate_director].contact
        {
          full_name: contact.display_name,
          positions: cd[:positions],
          cessation_date_formatted: cd[:cessation_date].strftime("%d/%m/%Y")
        }
      end,
      new_appointments: new_appointments.map do |appt|
        contact = appt[:contact]
        {
          full_name: contact.display_name,
          address: contact.full_address,
          positions: appt[:positions],
          appointment_date_formatted: appt[:appointment_date].strftime("%d/%m/%Y")
        }
      end,
      remaining_directors: remaining_directors,
      chairperson_name: chairperson_contact&.display_name,
      chairperson_email: chairperson_contact&.primary_email,
      meeting_date: meeting_date,
      meeting_date_formatted: meeting_date.strftime("%d/%m/%Y")
    }

    html = render_template("directors_minutes", context)
    pdf = convert_to_pdf(html)

    {
      type: :minutes,
      name: "Minutes of Meeting of Directors",
      html: html,
      pdf_content: pdf
    }
  end

  def render_form_484
    lodgement_date = Date.current

    context = {
      company: build_company_context,
      ceasing_directors: ceasing_directors.map do |cd|
        contact = cd[:corporate_director].contact
        {
          full_name: contact.display_name,
          date_of_birth: contact.date_of_birth&.strftime("%d/%m/%Y"),
          address: contact.full_address,
          positions: cd[:positions],
          cessation_date_formatted: cd[:cessation_date].strftime("%d/%m/%Y")
        }
      end,
      new_appointments: new_appointments.map do |appt|
        contact = appt[:contact]
        {
          full_name: contact.display_name,
          date_of_birth: contact.date_of_birth&.strftime("%d/%m/%Y"),
          address: contact.full_address,
          positions: appt[:positions],
          appointment_date_formatted: appt[:appointment_date].strftime("%d/%m/%Y")
        }
      end,
      lodgement_date: lodgement_date,
      lodgement_date_formatted: lodgement_date.strftime("%d/%m/%Y")
    }

    html = render_template("form_484_record", context)
    pdf = convert_to_pdf(html)

    {
      type: :form_484,
      name: "Form 484 Record",
      html: html,
      pdf_content: pdf
    }
  end

  # --- Template Rendering ---

  def render_template(template_name, local_vars)
    PdfRenderController.render(
      template: "#{TEMPLATE_BASE}/#{template_name}",
      layout: "pdf",
      locals: local_vars
    )
  end

  def convert_to_pdf(html)
    raise "Grover (PDF generation) is only available on the worker dyno. Use GeneratePdfJob." unless defined?(Grover)
    Grover.new(
      html,
      format: "A4",
      margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
      print_background: true,
      display_header_footer: false
    ).to_pdf
  end

  # --- Context Builders ---

  def build_company_context
    {
      name: company.name,
      acn: company.acn,
      formatted_acn: company.formatted_acn,
      abn: company.abn,
      formatted_abn: company.formatted_abn,
      registered_office_address: company.registered_office_address
    }
  end

  def build_director_context(contact)
    {
      full_name: contact.display_name,
      date_of_birth: contact.date_of_birth&.strftime("%d/%m/%Y"),
      address: contact.full_address,
      email: contact.primary_email
    }
  end

  # --- PDF Combination ---

  def combine_pdfs(documents)
    combined = HexaPDF::Document.new

    documents.each do |doc|
      next unless doc[:pdf_content]

      source = HexaPDF::Document.new(io: StringIO.new(doc[:pdf_content]))
      source.pages.each { |page| combined.pages << combined.import(page) }
    end

    output = StringIO.new
    combined.write(output)
    output.string
  end

  # --- Storage ---

  def upload_to_storage(pdf_content, filename)
    StorageBlob.find_or_create_for_content!(
      pdf_content,
      filename: filename,
      content_type: "application/pdf"
    )
  end

  def store_signed_document(e_signature_request)
    # Link to the signed PDF blob from the e-signature system
    signed_blob = StorageBlob.find_by(id: e_signature_request.signed_storage_reference)

    # Find the "Officers" warehouse folder (corporate doc type for director changes)
    officers_folder = WarehouseFolder.find_by_type_and_name("corporate", "Officers")

    WarehouseDocumentCreator.create!(
      filename: generate_filename,
      source_type: "corporate",
      linkable: company,
      storage_blob: signed_blob,
      warehouse_folder_id: officers_folder&.id,
      metadata: {
        form_type: "form_484",
        document_type: "Officers",
        e_signature_request_id: e_signature_request.id,
        ceasing_directors: ceasing_directors.map { |cd| cd[:corporate_director].contact.display_name },
        new_appointments: new_appointments.map { |appt| appt[:contact].display_name },
        signed_at: e_signature_request.completed_at
      },
      user: user
    )
  end

  # --- E-Signature ---

  def create_e_signature_request(blob, package)
    request = ESignatureRequest.create!(
      title: "Director Change - #{company.name}",
      documentable: company,
      created_by: user,
      signing_order: ESignatureRequest::SIGNING_ORDERS[:sequential],
      send_reminders: true,
      original_document_hash: Digest::SHA256.hexdigest(package[:pdf_content])
    )

    # Set storage reference
    request.set_original_storage_reference(blob.id.to_s)
    request.save!

    # Add signers from documents that need signatures
    signing_order = 0
    package_documents = generate_all_documents

    package_documents.each do |doc|
      next unless doc[:signer_email].present?

      signing_order += 1
      request.signers.create!(
        name: doc[:signer_name],
        email: doc[:signer_email],
        contact: doc[:signer_contact],
        role: doc[:signer_role],
        signing_order: signing_order
      )
    end

    request
  end

  # --- Helpers ---

  def generate_filename
    date = Date.current.strftime("%Y-%m-%d")
    company_code = company.code.presence || company.name.parameterize
    "Form484_#{company_code}_#{date}.pdf"
  end

  def determine_meeting_date
    # Meeting date = earliest change date (resignation or appointment)
    dates = []
    ceasing_directors.each { |cd| dates << cd[:cessation_date] }
    new_appointments.each { |appt| dates << appt[:appointment_date] }
    dates.compact.min || Date.current
  end

  def log_activity(activity_type, description)
    company.corporate_activities.create!(
      activity_type: activity_type,
      description: description,
      user: user
    )
  rescue => e
    Rails.logger.warn("[DirectorChangeService] Failed to log activity: #{e.message}")
  end
end
