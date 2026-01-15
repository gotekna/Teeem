# frozen_string_literal: true

# Form43CertificateGenerator generates QBCC Form 43 - Aspect Certificate (QBCC Licensee)
#
# Used for certifying aspects of building work including:
# - Insulation (stormwater, thermal)
# - Waterproofing
# - Termite management
# - And other licensed trade work
#
# Usage:
#   generator = Form43CertificateGenerator.new(
#     job: job,
#     document_type: document_type,
#     supervisor: supervisor_user
#   )
#   result = generator.generate
#   # result[:pdf_content] - PDF binary
#   # result[:filename] - Generated filename
#   # result[:html] - Rendered HTML (for debugging)
#
class Form43CertificateGenerator
  class GenerationError < StandardError; end

  TEMPLATE_PATH = "certificates/form_43"

  attr_reader :job, :document_type, :supervisor

  def initialize(job:, document_type:, supervisor:)
    @job = job
    @document_type = document_type
    @supervisor = supervisor

    validate!
  end

  # Generate PDF and return result hash
  def generate
    html = render_html
    pdf_content = convert_to_pdf(html)

    {
      pdf_content: pdf_content,
      html: html,
      filename: generate_filename,
      generated_at: Time.current,
      document_type_id: document_type.id,
      document_type_name: document_type.name,
      supervisor_id: supervisor.id,
      supervisor_name: supervisor.name
    }
  end

  # Preview HTML only (no PDF conversion)
  def preview
    render_html
  end

  private

  def validate!
    raise GenerationError, "Job is required" unless job
    raise GenerationError, "Document type is required" unless document_type
    raise GenerationError, "Supervisor is required" unless supervisor
    raise GenerationError, "Supervisor must have signature attached" unless supervisor.signature.attached?
    raise GenerationError, "Supervisor must have QBCC licence number" unless supervisor.qbcc_licence_number.present?
    raise GenerationError, "Supervisor must have QBCC licence class" unless supervisor.qbcc_licence_class.present?
  end

  def render_html
    ApplicationController.render(
      template: TEMPLATE_PATH,
      layout: "pdf",
      assigns: build_context
    )
  end

  def convert_to_pdf(html)
    Grover.new(
      html,
      format: "A4",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      print_background: true,
      display_header_footer: false
    ).to_pdf
  end

  def build_context
    {
      # Job/Property details
      job: job,
      property_address: build_property_address,
      building_approval_number: job.approval_number || job.council_reference,
      building_class: job.dwelling_type || "Class 1A",
      lot_plan: job.lot_plan,

      # Aspect being certified
      document_type: document_type,
      aspect_description: document_type.name,
      aspect_code: document_type.abbreviation,

      # Form number based on dwelling type
      form_number: document_type.resolve_form_number(job.dwelling_type),

      # QBCC Licensee (Supervisor) details
      supervisor: supervisor,
      licensee_name: supervisor.name,
      licensee_licence_number: supervisor.qbcc_licence_number,
      licensee_licence_class: supervisor.qbcc_licence_class,
      licensee_signature_data_url: supervisor.signature_data_url,
      licensee_business_name: CompanySetting.trading_name || "Tekna Group",
      licensee_address: CompanySetting.business_address,
      licensee_phone: supervisor.mobile_phone || CompanySetting.business_phone,
      licensee_email: supervisor.email,

      # Certification details
      certification_date: Date.current,
      certification_date_formatted: Date.current.strftime("%d/%m/%Y"),
      certification_date_long: Date.current.strftime("%d %B %Y"),

      # Basis of certification (standard text)
      basis_of_certification: build_basis_of_certification,

      # Reference documentation
      reference_documents: build_reference_documents
    }
  end

  def build_property_address
    parts = [
      job.street_address,
      job.suburb,
      job.state,
      job.postcode
    ].compact.reject(&:blank?)

    parts.any? ? parts.join(", ") : job.title
  end

  def build_basis_of_certification
    <<~TEXT
      I certify that I have personally supervised and/or inspected the work described above,
      and that the work complies with the requirements of the Building Act 1975,
      the Building Code of Australia and any relevant Australian Standards.
    TEXT
  end

  def build_reference_documents
    [
      "Building Code of Australia (BCA)",
      "AS/NZS 4200.1 Pliable building membranes and underlays",
      "Queensland Development Code - Performance Solutions",
      "Manufacturer's installation instructions"
    ]
  end

  def generate_filename
    # Use document type's naming pattern if available
    if document_type.file_name.present?
      document_type.generate_proposed_name(job: job, file_extension: "pdf")
    else
      # Fallback filename - SSoT: use database column
      job_code = job.job_code
      date = Date.current.strftime("%d-%m-%Y")
      "#{job_code} #{document_type.abbreviation || 'CERT'} Form43 #{date}.pdf"
    end
  end
end
