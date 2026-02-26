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
  def generate_package(on_progress: nil)
    documents = generate_all_documents(on_progress: on_progress)
    on_progress&.call(nil, nil, "Combining documents...")
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
      # Set resignation_date on ALL CorporateDirector records for each ceasing person.
      # Each cd_data[:corporate_director] is ONE record, but the person may hold multiple
      # positions (director, secretary, public_officer) as separate CorporateDirector rows.
      # We must resign ALL position records listed in cd_data[:positions].
      ceasing_directors.each do |cd_data|
        contact = cd_data[:corporate_director].contact
        cd_data[:positions].each do |position|
          record = company.corporate_directors.find_by(
            contact: contact,
            position: position,
            is_current: true
          )
          if record
            record.update!(resignation_date: cd_data[:cessation_date], is_current: false)
          else
            Rails.logger.warn "[DirectorChange] No current #{position} record found for #{contact.display_name} on #{company.name}"
          end
        end
      end

      # Create one CorporateDirector record PER POSITION per contact.
      # e.g., ["director", "secretary", "public_officer"] → 3 separate records.
      # Note: CorporateDirector model callbacks handle activity logging automatically
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
      end

      # Store signed PDF as WarehouseDocument.
      # Fail fast: require the signed (stamped) blob - no fallback to original.
      # If store_signed_document! failed in ESignatureRequest#complete!, that
      # error should have been visible and fixed before reaching this point.
      storage_ref = e_signature_request.signed_storage_reference
      raise "Signed document not available for #{e_signature_request.request_number}. " \
            "store_signed_document! in ESignatureRequest#complete! may have failed." unless storage_ref.present?
      store_signed_document(e_signature_request, storage_ref)
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

  # Pre-calculate total document count for progress tracking.
  # Public because BpmnTasks::DirectorChangeTask calls this externally.
  def document_count
    count = 1 # Minutes
    count += ceasing_directors.sum { |cd| cd[:positions].size } # Resignations
    count += new_appointments.sum { |appt| appt[:positions].size } # Consents
    count += 1 if ceasing_directors.present? # Form 484 cessation
    count += 1 if new_appointments.present? # Form 484 appointment
    count
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

  def generate_all_documents(on_progress: nil)
    documents = []
    total = document_count

    # Generate minutes of directors' meeting (first - it's the board resolution)
    on_progress&.call(1, total, "Minutes of Meeting")
    documents << render_minutes

    # Generate one resignation letter per position per ceasing director
    ceasing_directors.each do |cd|
      cd[:positions].each do |position|
        doc_name = "Resignation - #{cd[:corporate_director].contact.display_name}"
        on_progress&.call(documents.size + 1, total, doc_name)
        documents << render_resignation(cd.merge(positions: [position]))
      end
    end

    # Generate one consent form per position per new appointment
    new_appointments.each do |appt|
      appt[:positions].each do |position|
        doc_name = "Consent - #{appt[:contact].display_name}"
        on_progress&.call(documents.size + 1, total, doc_name)
        documents << render_consent(appt.merge(positions: [position]))
      end
    end

    # Generate Form 484 records (separate documents for cessation and appointment)
    if ceasing_directors.present?
      on_progress&.call(documents.size + 1, total, "Form 484 - Cessation")
      form_484_cessation = render_form_484_cessation
      documents << form_484_cessation if form_484_cessation
    end

    if new_appointments.present?
      on_progress&.call(documents.size + 1, total, "Form 484 - Appointment")
      form_484_appointment = render_form_484_appointment
      documents << form_484_appointment if form_484_appointment
    end

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
    chair = determine_chairperson(remaining)
    chairperson_contact = chair[:contact]
    chairperson_selected_email = chair[:selected_email]

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
      pdf_content: pdf,
      signer_name: chairperson_contact&.display_name,
      signer_email: chairperson_selected_email.presence || chairperson_contact&.primary_email,
      signer_contact: chairperson_contact,
      signer_role: "chairperson"
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

  # Fixed badge position matching the flex-pushed signature section in ASIC templates.
  # With margin-top: auto on the signature block and flexbox on .page, the badge
  # always renders at a consistent position regardless of content length.
  # Values are percentages of the FULL PDF page dimensions (including margins).
  #
  # Signature field positions per template type (measured from rendered PDFs at 66% zoom).
  # Each template has `margin-top: auto` pushing the signature block to the bottom,
  # but the block HEIGHT varies by template (different fields below the signature line),
  # so the "Signature:" label ends up at different y_percent positions.
  #
  # Common: x_percent: 5.0 (left margin), width_percent: 42.0 (left column), height_percent: 8.0
  BADGE_POSITIONS = {
    # Minutes: only "Chairperson: [name]" below signature → signature at ~85%
    minutes:     { x_percent: 5.0, y_percent: 85.0, width_percent: 42.0, height_percent: 8.0 },
    # Resignation: Full Name + DOB + Address below signature → signature at ~74%
    resignation: { x_percent: 5.0, y_percent: 74.0, width_percent: 42.0, height_percent: 8.0 },
    # Consent: only "Full Name: [name]" below signature → signature at ~83%
    consent:     { x_percent: 5.0, y_percent: 83.0, width_percent: 42.0, height_percent: 8.0 }
  }.freeze

  # Legacy alias for external references (BPMN task etc.)
  BADGE_POSITION = BADGE_POSITIONS[:resignation].freeze

  # Split the signed combined PDF into individual documents and store each separately.
  #
  # The combined PDF is generated in deterministic order (same as generate_all_documents):
  #   1. Minutes (1 page)
  #   2. Resignations (1 page per position per ceasing director)
  #   3. Consents (1 page per position per new appointment)
  #   4. Form 484 Cessation (1+ pages)
  #   5. Form 484 Appointment (1+ pages)
  #   6. Certificate of Completion (last page, added by ESignaturePdfStamper)
  #
  # Each document gets its own StorageBlob so it opens as a standalone PDF in the UI.
  def store_signed_document(e_signature_request, storage_ref = nil)
    storage_ref ||= e_signature_request.signed_storage_reference
    signed_blob = StorageBlob.find_by(id: storage_ref)
    raise "[DirectorChange] Signed blob not found for ref #{storage_ref}" unless signed_blob

    signed_content = signed_blob.download
    signed_pdf = HexaPDF::Document.new(io: StringIO.new(signed_content))
    total_pages = signed_pdf.pages.count

    asic_folder = WarehouseFolder.find_by_type_and_name("corporate", "ASIC")
    base_metadata = {
      form_type: "form_484",
      e_signature_request_id: e_signature_request.id,
      signed_at: e_signature_request.completed_at
    }

    # Build page assignments in deterministic document order.
    # Each template-generated document is 1 page (same assumption as build_page_signer_map).
    # Certificate of Completion is always the last page.
    page_assignments = []
    current_page = 1

    # 1. Minutes
    minutes_name = resolve_doc_name("DM", "Minutes of Meeting of Directors")
    page_assignments << { pages: [current_page], abbr: "DM", name: minutes_name, metadata: base_metadata }
    current_page += 1

    # 2. Resignations (1 page per position per ceasing director)
    # Must iterate ALL positions (matching generate_all_documents), not just RESIGNATION_DOC_TYPES keys.
    ceasing_directors.each do |cd|
      person_name = cd[:corporate_director].contact.display_name
      date_str = cd[:cessation_date].strftime("%d/%m/%Y")
      cd[:positions].each do |pos|
        abbr = RESIGNATION_DOC_TYPES[pos] || "RD"
        doc_name = resolve_doc_name(abbr, "Resignation #{pos.tr('_', ' ').split.map(&:capitalize).join(' ')}")
        page_assignments << {
          pages: [current_page], abbr: abbr,
          name: "#{doc_name} - #{person_name} #{date_str}",
          metadata: base_metadata.merge(person: person_name, position: pos, date: cd[:cessation_date].iso8601)
        }
        current_page += 1
      end
    end

    # 3. Consents (1 page per position per new appointment)
    # Must iterate ALL positions (matching generate_all_documents), not just CONSENT_DOC_TYPES keys.
    new_appointments.each do |appt|
      person_name = appt[:contact].display_name
      date_str = appt[:appointment_date].strftime("%d/%m/%Y")
      appt[:positions].each do |pos|
        abbr = CONSENT_DOC_TYPES[pos] || "CAD"
        doc_name = resolve_doc_name(abbr, "Consent to Act as #{pos.tr('_', ' ').split.map(&:capitalize).join(' ')}")
        page_assignments << {
          pages: [current_page], abbr: abbr,
          name: "#{doc_name} - #{person_name} #{date_str}",
          metadata: base_metadata.merge(person: person_name, position: pos, date: appt[:appointment_date].iso8601)
        }
        current_page += 1
      end
    end

    # 4. Form 484 pages (remaining pages before certificate)
    last_content_page = total_pages - 1  # certificate is always the last page
    remaining_pages = (current_page..last_content_page).to_a

    f484_name = resolve_doc_name("F484", "Form 484")
    if ceasing_directors.any? && new_appointments.any? && remaining_pages.size >= 2
      midpoint = remaining_pages.size / 2
      page_assignments << { pages: remaining_pages[0...midpoint], abbr: "F484", name: "#{f484_name} - Cessation", metadata: base_metadata.merge(form_subtype: "cessation") }
      page_assignments << { pages: remaining_pages[midpoint..], abbr: "F484", name: "#{f484_name} - Appointment", metadata: base_metadata.merge(form_subtype: "appointment") }
    elsif ceasing_directors.any? && remaining_pages.any?
      page_assignments << { pages: remaining_pages, abbr: "F484", name: "#{f484_name} - Cessation", metadata: base_metadata.merge(form_subtype: "cessation") }
    elsif new_appointments.any? && remaining_pages.any?
      page_assignments << { pages: remaining_pages, abbr: "F484", name: "#{f484_name} - Appointment", metadata: base_metadata.merge(form_subtype: "appointment") }
    end

    # Extract each document's pages into a separate PDF and store individually
    page_assignments.each do |assignment|
      individual_content = extract_pages(signed_pdf, assignment[:pages])
      individual_blob = StorageBlob.find_or_create_for_content!(
        individual_content,
        filename: "#{assignment[:name]}.pdf",
        content_type: "application/pdf"
      )
      store_one(individual_blob, asic_folder, assignment[:abbr], assignment[:name], assignment[:metadata])
    end
  end

  # Extract specific pages from a parsed HexaPDF document into a new PDF binary string.
  # Page numbers are 1-indexed (matching PDF convention).
  def extract_pages(source_doc, page_numbers)
    new_doc = HexaPDF::Document.new
    page_numbers.each do |page_num|
      source_page = source_doc.pages[page_num - 1]
      next unless source_page
      new_doc.pages << new_doc.import(source_page)
    end
    output = StringIO.new
    new_doc.write(output)
    output.string
  end

  def store_one(blob, asic_folder, abbreviation, fallback_name, metadata)
    wfdt = asic_folder && WarehouseFolderDocumentType
      .joins(:document_type)
      .find_by(warehouse_folder: asic_folder, document_types: { abbreviation: abbreviation })

    # Auto-validate: TEEEM-generated documents are pre-validated by the platform
    metadata = metadata.merge(
      "user_validated_at" => Time.current.iso8601,
      "user_validated_by_name" => "TEEEM Platform"
    )

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

    # Create positioned signature fields from metadata (deterministic document order)
    create_fields_from_metadata(request)

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

    # Create positioned signature fields from metadata (deterministic document order)
    create_fields_from_metadata(request)

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

  # --- Chairperson Resolution ---

  # Determine the chairperson contact for minutes signing.
  # Priority: 1) first ceasing director (outgoing director chairs the transition meeting),
  # 2) remaining director with "chair" position, 3) first remaining director,
  # 4) first new appointment (last resort)
  def determine_chairperson(remaining_directors_relation = nil)
    chairperson_contact = nil
    chairperson_selected_email = nil

    # Outgoing director chairs the meeting
    cd = ceasing_directors.first
    if cd
      chairperson_contact = cd[:corporate_director]&.contact
      chairperson_selected_email = cd[:email]
    end

    # Fallback to remaining directors
    unless chairperson_contact
      remaining = remaining_directors_relation || begin
        ceasing_contact_ids = ceasing_directors.map { |cd_data| cd_data[:corporate_director].contact_id }
        company.corporate_directors.where(is_current: true).where.not(contact_id: ceasing_contact_ids).includes(:contact)
      end
      remaining.each do |dir|
        if dir.position&.downcase&.include?("chair")
          chairperson_contact = dir.contact
          break
        end
      end
      chairperson_contact ||= remaining.first&.contact
    end

    chairperson_contact ||= new_appointments.first&.dig(:contact)

    { contact: chairperson_contact, selected_email: chairperson_selected_email }
  end

  # --- Metadata-Based Field Creation ---

  # Create ESignatureField records from the deterministic document order.
  # System-generated PDFs have a known page-to-signer mapping, so we can
  # place signature fields without parsing the PDF content stream.
  #
  # Document order (matches generate_all_documents):
  #   Page 1: Minutes → chairperson signs
  #   Page 2+: Resignations → one per position per ceasing director
  #   After resignations: Consents → one per position per new appointment
  #   Final pages: Form 484 records → no signature (informational only)
  def create_fields_from_metadata(request)
    signers = request.signers.order(:signing_order).to_a
    return if signers.empty?

    # Build page-to-contact mapping from deterministic document order
    # Each signing page has exactly one signer and a template type
    page_signer_map = build_page_signer_map(signers)

    page_signer_map.each do |page_number, entry|
      signer = entry[:signer]
      pos = BADGE_POSITIONS[entry[:template]] || BADGE_POSITIONS[:resignation]

      request.fields.create!(
        e_signature_signer: signer,
        field_type: "signature",
        page_number: page_number,
        x_percent: pos[:x_percent],
        y_percent: pos[:y_percent],
        width_percent: pos[:width_percent],
        height_percent: pos[:height_percent],
        label: "Signature - #{signer.name}",
        required: true
      )
    end
  end

  # Map each signing page to its signer and template type.
  # Returns: { page_number => { signer: ESignatureSigner, template: :minutes|:resignation|:consent } }
  def build_page_signer_map(signers)
    page_map = {}
    current_page = 1

    # Build a contact_id → signer lookup
    signer_by_contact_id = {}
    signers.each { |s| signer_by_contact_id[s.contact_id] = s }

    # Page 1: Minutes - chairperson signs (first signer = first ceasing director)
    chair = determine_chairperson
    chairperson_signer = signer_by_contact_id[chair[:contact]&.id] || signers.first
    page_map[current_page] = { signer: chairperson_signer, template: :minutes }
    current_page += 1

    # Resignations: one page per position per ceasing director
    ceasing_directors.each do |cd|
      contact = cd[:corporate_director].contact
      signer = signer_by_contact_id[contact.id]
      next unless signer

      cd[:positions].each do |_position|
        page_map[current_page] = { signer: signer, template: :resignation }
        current_page += 1
      end
    end

    # Consents: one page per position per new appointment
    new_appointments.each do |appt|
      contact = appt[:contact]
      signer = signer_by_contact_id[contact.id]
      next unless signer

      appt[:positions].each do |_position|
        page_map[current_page] = { signer: signer, template: :consent }
        current_page += 1
      end
    end

    # Form 484 pages follow but have no signature fields

    page_map
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
