# frozen_string_literal: true

require "hexapdf"
require "grover"

# DirectorChangeService generates ASIC Form 484 director change packages.
#
# Generates up to 5 documents:
# 1. Minutes of Meeting of Directors (board resolution)
# 2. Director Resignation Letter (for outgoing director to sign)
# 3. Consent to Act as Director (for incoming director to sign)
# 4. Form 484 Record - Cessation (internal record for ASIC filing)
# 5. Form 484 Record - Appointment (internal record for ASIC filing)
#
# Document names are resolved from DocumentType records (SSoT) via abbreviation,
# so renaming in settings is reflected in generated documents.
#
# All documents are combined into a single PDF package and optionally sent
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

  TEMPLATE_BASE = "tekna_documents/templates/asic".freeze

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
    combined_pdf, page_offsets = combine_pdfs_with_offsets(documents)

    # Attach 1-based page offset to each document for frontend navigation.
    # Include :abbreviation and :pdf_content so callers (e.g. DirectorChangeTask)
    # can store individual documents in the warehouse.
    doc_metadata = documents.each_with_index.map do |d, i|
      d.slice(:type, :name, :abbreviation, :pdf_content).merge(page: page_offsets[i] || 1)
    end

    {
      pdf_content: combined_pdf,
      filename: generate_filename,
      documents: doc_metadata,
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

  # Send for e-signature using an existing StorageBlob (from preview step).
  # Avoids regenerating the PDF when the user already previewed it.
  def send_with_existing_blob!(blob)
    pdf_content = blob.download

    e_sig_request = create_e_signature_request_from_blob(blob, pdf_content)
    e_sig_request.send_for_signing!

    documents = build_document_metadata

    {
      e_signature_request: e_sig_request,
      pdf_content: pdf_content,
      filename: generate_filename,
      documents: documents
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
    when "form_484", "form_484_cessation"
      raise GenerationError, "No ceasing directors to preview" if ceasing_directors.empty?
      render_form_484_cessation[:html]
    when "form_484_appointment"
      raise GenerationError, "No new appointments to preview" if new_appointments.empty?
      render_form_484_appointment[:html]
    else
      raise GenerationError, "Unknown document type: #{document_type}"
    end
  end

  private

  # Resolve the Form 484 document type from the "ASIC" warehouse folder.
  # This ensures the e-signature request (and its stored signed PDF) gets the
  # correct document type for folder routing and metadata.
  def resolve_form484_document_type
    DocumentType.find_by(abbreviation: "F484")
  end

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

    # Generate one resignation letter per position per ceasing director
    ceasing_directors.each do |cd|
      cd[:positions].each do |position|
        documents << render_resignation(cd.merge(positions: [position]))
      end
    end

    # Generate one consent form per position per new appointment
    new_appointments.each do |appt|
      appt[:positions].each do |position|
        documents << render_consent(appt.merge(positions: [position]))
      end
    end

    # Generate Form 484 records (separate documents for cessation and appointment)
    form_484_cessation = render_form_484_cessation
    documents << form_484_cessation if form_484_cessation

    form_484_appointment = render_form_484_appointment
    documents << form_484_appointment if form_484_appointment

    documents
  end

  def render_resignation(cd_data)
    director = cd_data[:corporate_director]
    contact = director.contact
    cessation_date = cd_data[:cessation_date]

    context = {
      company: build_company_context,
      director: build_director_context(contact, selected_email: cd_data[:email], selected_address: cd_data[:address]),
      positions: deduplicate_positions(cd_data[:positions]),
      cessation_date: cessation_date,
      cessation_date_formatted: cessation_date.strftime("%d/%m/%Y")
    }

    html = render_template("director_resignation", context)
    pdf = convert_to_pdf(html)

    # Resolve name from DocumentType by primary position abbreviation
    primary_pos = cd_data[:positions]&.first || "director"
    resignation_abbr = RESIGNATION_DOC_TYPES[primary_pos] || "RD"
    doc_name = resolve_doc_name(resignation_abbr, "Resignation")

    {
      type: :resignation,
      name: "#{doc_name} - #{contact.display_name}",
      abbreviation: resignation_abbr,
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
      director: build_director_context(contact, selected_email: appt_data[:email], selected_address: appt_data[:address]),
      positions: deduplicate_positions(appt_data[:positions]),
      appointment_date: appointment_date,
      appointment_date_formatted: appointment_date.strftime("%d/%m/%Y")
    }

    html = render_template("consent_to_act", context)
    pdf = convert_to_pdf(html)

    # Resolve name from DocumentType by primary position abbreviation
    primary_pos = appt_data[:positions]&.first || "director"
    consent_abbr = CONSENT_DOC_TYPES[primary_pos] || "CAD"
    doc_name = resolve_doc_name(consent_abbr, "Consent to Act")

    {
      type: :consent,
      name: "#{doc_name} - #{contact.display_name}",
      abbreviation: consent_abbr,
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
        positions: deduplicate_positions(dirs.map(&:position))
      }
    end

    # Determine chairperson for signing badge
    # Priority: 1) first ceasing director (outgoing director chairs the transition meeting),
    # 2) remaining director with "chair" position, 3) first remaining director,
    # 4) first new appointment (last resort)
    chairperson_contact = nil
    chairperson_selected_email = nil

    # Outgoing director chairs the meeting - they are the current officeholder
    cd = ceasing_directors.first
    if cd
      chairperson_contact = cd[:corporate_director]&.contact
      chairperson_selected_email = cd[:email]
    end

    # Fallback to remaining directors if no one is ceasing
    unless chairperson_contact
      remaining.each do |dir|
        if dir.position&.downcase&.include?("chair")
          chairperson_contact = dir.contact
          break
        end
      end
      chairperson_contact ||= remaining.first&.contact
    end

    chairperson_contact ||= new_appointments.first&.dig(:contact)

    context = {
      company: build_company_context,
      ceasing_directors: ceasing_directors.map do |cd|
        contact = cd[:corporate_director].contact
        {
          full_name: contact.display_name,
          positions: deduplicate_positions(cd[:positions]),
          cessation_date_formatted: cd[:cessation_date].strftime("%d/%m/%Y")
        }
      end,
      new_appointments: new_appointments.map do |appt|
        contact = appt[:contact]
        {
          full_name: contact.display_name,
          address: appt[:address].presence || contact.residential_address.presence || contact.full_address,
          positions: deduplicate_positions(appt[:positions]),
          appointment_date_formatted: appt[:appointment_date].strftime("%d/%m/%Y")
        }
      end,
      remaining_directors: remaining_directors,
      chairperson_name: chairperson_contact&.display_name,
      chairperson_email: chairperson_selected_email.presence || chairperson_contact&.primary_email,
      meeting_date: meeting_date,
      meeting_date_formatted: meeting_date.strftime("%d/%m/%Y")
    }

    html = render_template("directors_minutes", context)
    pdf = convert_to_pdf(html)

    {
      type: :minutes,
      name: resolve_doc_name("DM", "Minutes of Meeting of Directors"),
      abbreviation: "DM",
      html: html,
      pdf_content: pdf
    }
  end

  def render_form_484_cessation
    return nil if ceasing_directors.empty?

    lodgement_date = Date.current
    base_name = resolve_doc_name("F484", "Form 484")

    context = {
      company: build_company_context,
      ceasing_directors: ceasing_directors.map do |cd|
        contact = cd[:corporate_director].contact
        {
          full_name: contact.display_name,
          date_of_birth: contact.date_of_birth&.strftime("%d/%m/%Y"),
          address: cd[:address].presence || contact.residential_address.presence || contact.full_address,
          positions: deduplicate_positions(cd[:positions]),
          cessation_date_formatted: cd[:cessation_date].strftime("%d/%m/%Y")
        }
      end,
      new_appointments: [],
      lodgement_date: lodgement_date,
      lodgement_date_formatted: lodgement_date.strftime("%d/%m/%Y")
    }

    html = render_template("form_484_record", context)
    pdf = convert_to_pdf(html)

    {
      type: :form_484_cessation,
      name: "#{base_name} - Cessation",
      abbreviation: "F484",
      html: html,
      pdf_content: pdf
    }
  end

  def render_form_484_appointment
    return nil if new_appointments.empty?

    lodgement_date = Date.current
    base_name = resolve_doc_name("F484", "Form 484")

    context = {
      company: build_company_context,
      ceasing_directors: [],
      new_appointments: new_appointments.map do |appt|
        contact = appt[:contact]
        {
          full_name: contact.display_name,
          date_of_birth: contact.date_of_birth&.strftime("%d/%m/%Y"),
          address: appt[:address].presence || contact.residential_address.presence || contact.full_address,
          positions: deduplicate_positions(appt[:positions]),
          appointment_date_formatted: appt[:appointment_date].strftime("%d/%m/%Y")
        }
      end,
      lodgement_date: lodgement_date,
      lodgement_date_formatted: lodgement_date.strftime("%d/%m/%Y")
    }

    html = render_template("form_484_record", context)
    pdf = convert_to_pdf(html)

    {
      type: :form_484_appointment,
      name: "#{base_name} - Appointment",
      abbreviation: "F484",
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

  def build_director_context(contact, selected_email: nil, selected_address: nil)
    {
      full_name: contact.display_name,
      date_of_birth: contact.date_of_birth&.strftime("%d/%m/%Y"),
      address: selected_address.presence || contact.residential_address.presence || contact.full_address,
      email: selected_email.presence || contact.primary_email
    }
  end

  # --- PDF Combination ---

  # Combine individual document PDFs into one, tracking where each starts.
  # Returns [combined_pdf_binary, page_offsets_array] where offsets are 1-based.
  def combine_pdfs_with_offsets(documents)
    combined = HexaPDF::Document.new
    page_offsets = []
    current_page = 1

    documents.each do |doc|
      next unless doc[:pdf_content]

      page_offsets << current_page
      source = HexaPDF::Document.new(io: StringIO.new(doc[:pdf_content]))
      source.pages.each { |page| combined.pages << combined.import(page) }
      current_page += source.pages.count
    end

    output = StringIO.new
    combined.write(output)
    [output.string, page_offsets]
  end

  # --- Storage ---

  def upload_to_storage(pdf_content, filename)
    StorageBlob.find_or_create_for_content!(
      pdf_content,
      filename: filename,
      content_type: "application/pdf"
    )
  end

  # Position → document type abbreviation mapping (matches ASIC warehouse folder WFDTs)
  RESIGNATION_DOC_TYPES = {
    "director" => "RD",
    "secretary" => "RS",
    "public_officer" => "RPO"
  }.freeze

  CONSENT_DOC_TYPES = {
    "director" => "CAD",
    "secretary" => "CAS",
    "public_officer" => "CAPO"
  }.freeze

  def store_signed_document(e_signature_request)
    signed_blob = StorageBlob.find_by(id: e_signature_request.signed_storage_reference)
    asic_folder = WarehouseFolder.find_by_type_and_name("corporate", "ASIC")
    base_metadata = {
      form_type: "form_484",
      e_signature_request_id: e_signature_request.id,
      signed_at: e_signature_request.completed_at
    }

    # One warehouse document per position-specific doc type
    minutes_name = resolve_doc_name("DM", "Minutes of Meeting of Directors")
    store_one(signed_blob, asic_folder, "DM", minutes_name, base_metadata)

    ceasing_directors.each do |cd|
      person_name = cd[:corporate_director].contact.display_name
      date_str = cd[:cessation_date].strftime("%d/%m/%Y")
      cd[:positions].select { |p| RESIGNATION_DOC_TYPES.key?(p) }.each do |pos|
        abbr = RESIGNATION_DOC_TYPES[pos]
        doc_name = resolve_doc_name(abbr, "Resignation #{pos.tr('_', ' ').split.map(&:capitalize).join(' ')}")
        store_one(signed_blob, asic_folder, abbr, "#{doc_name} - #{person_name} #{date_str}",
          base_metadata.merge(person: person_name, position: pos, date: cd[:cessation_date].iso8601))
      end
    end

    new_appointments.each do |appt|
      person_name = appt[:contact].display_name
      date_str = appt[:appointment_date].strftime("%d/%m/%Y")
      appt[:positions].select { |p| CONSENT_DOC_TYPES.key?(p) }.each do |pos|
        abbr = CONSENT_DOC_TYPES[pos]
        doc_name = resolve_doc_name(abbr, "Consent to Act as #{pos.tr('_', ' ').split.map(&:capitalize).join(' ')}")
        store_one(signed_blob, asic_folder, abbr, "#{doc_name} - #{person_name} #{date_str}",
          base_metadata.merge(person: person_name, position: pos, date: appt[:appointment_date].iso8601))
      end
    end

    # Store separate Form 484 records for cessation and appointment
    f484_name = resolve_doc_name("F484", "Form 484")
    if ceasing_directors.any?
      store_one(signed_blob, asic_folder, "F484", "#{f484_name} - Cessation", base_metadata.merge(form_subtype: "cessation"))
    end
    if new_appointments.any?
      store_one(signed_blob, asic_folder, "F484", "#{f484_name} - Appointment", base_metadata.merge(form_subtype: "appointment"))
    end
  end

  def store_one(blob, asic_folder, abbreviation, fallback_name, metadata)
    wfdt = asic_folder && WarehouseFolderDocumentType
      .joins(:document_type)
      .find_by(warehouse_folder: asic_folder, document_types: { abbreviation: abbreviation })

    # Pass specific WFDT so materialize_ui_name uses the correct template.
    # fallback_name used as original_filename if no template resolves.
    WarehouseDocumentCreator.create!(
      filename: fallback_name,
      source_type: "corporate",
      linkable: company,
      storage_blob: blob,
      warehouse_folder_id: asic_folder&.id,
      warehouse_folder_document_type_id: wfdt&.id,
      metadata: metadata,
      user: user
    )
  end

  # --- E-Signature ---

  def create_e_signature_request(blob, package)
    request = ESignatureRequest.create!(
      title: "Director Change - #{company.name}",
      documentable: company,
      created_by: user,
      document_type: resolve_form484_document_type,
      signing_order: ESignatureRequest::SIGNING_ORDERS[:sequential],
      send_reminders: true,
      original_document_hash: Digest::SHA256.hexdigest(package[:pdf_content])
    )

    # Set storage reference
    request.set_original_storage_reference(blob.id.to_s)
    request.save!

    # Add signers from input data (no need to regenerate PDFs for signer metadata)
    add_signers_to_request(request)

    # Create positioned signature fields by detecting blue badges in the PDF
    ESignatureBadgeDetector.create_fields_from_pdf!(request, package[:pdf_content])

    request
  end

  # Create e-signature request using an existing blob (reuse from preview step)
  def create_e_signature_request_from_blob(blob, pdf_content)
    request = ESignatureRequest.create!(
      title: "Director Change - #{company.name}",
      documentable: company,
      created_by: user,
      document_type: resolve_form484_document_type,
      signing_order: ESignatureRequest::SIGNING_ORDERS[:sequential],
      send_reminders: true,
      original_document_hash: Digest::SHA256.hexdigest(pdf_content)
    )

    request.set_original_storage_reference(blob.id.to_s)
    request.save!

    add_signers_to_request(request)

    # Create positioned signature fields by detecting blue badges in the PDF
    ESignatureBadgeDetector.create_fields_from_pdf!(request, pdf_content)

    request
  end

  # Extract signer info directly from ceasing_directors and new_appointments
  # without regenerating PDFs (avoids expensive Grover HTML→PDF conversion)
  def add_signers_to_request(request)
    signing_order = 0

    ceasing_directors.each do |cd|
      contact = cd[:corporate_director].contact
      email = cd[:email].presence || contact.primary_email
      next unless email.present?

      signing_order += 1
      request.signers.create!(
        name: contact.display_name,
        email: email,
        contact: contact,
        role: "director",
        signing_order: signing_order
      )
    end

    new_appointments.each do |appt|
      contact = appt[:contact]
      email = appt[:email].presence || contact.primary_email
      next unless email.present?

      signing_order += 1
      request.signers.create!(
        name: contact.display_name,
        email: email,
        contact: contact,
        role: "director",
        signing_order: signing_order
      )
    end
  end

  # Build document metadata without generating PDFs.
  # One entry per position per person (mirrors generate_all_documents).
  def build_document_metadata
    docs = [{ type: :minutes, name: resolve_doc_name("DM", "Minutes of Meeting of Directors") }]

    ceasing_directors.each do |cd|
      cd[:positions].each do |position|
        abbr = RESIGNATION_DOC_TYPES[position] || "RD"
        doc_name = resolve_doc_name(abbr, "Resignation")
        docs << { type: :resignation, name: "#{doc_name} - #{cd[:corporate_director].contact.display_name}" }
      end
    end

    new_appointments.each do |appt|
      appt[:positions].each do |position|
        abbr = CONSENT_DOC_TYPES[position] || "CAD"
        doc_name = resolve_doc_name(abbr, "Consent to Act")
        docs << { type: :consent, name: "#{doc_name} - #{appt[:contact].display_name}" }
      end
    end

    f484_name = resolve_doc_name("F484", "Form 484")
    docs << { type: :form_484_cessation, name: "#{f484_name} - Cessation" } if ceasing_directors.any?
    docs << { type: :form_484_appointment, name: "#{f484_name} - Appointment" } if new_appointments.any?
    docs
  end

  # --- Document Name Resolution (SSoT: DocumentType records) ---

  # Look up document name from DocumentType by abbreviation, with fallback.
  # Caches results for the lifetime of this service instance.
  def resolve_doc_name(abbreviation, fallback = nil)
    @doc_name_cache ||= {}
    @doc_name_cache[abbreviation] ||= DocumentType.find_by(abbreviation: abbreviation)&.name || fallback
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

  # Deduplicate positions: removes combined strings like "Director Secretary Public Officer"
  # when individual positions ("Director", "Secretary", "Public Officer") are also present.
  def deduplicate_positions(positions)
    return positions if positions.length <= 1

    positions.reject do |pos|
      others = positions.select { |p| p != pos && pos.downcase.include?(p.downcase) }
      others.length >= 2
    end
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
