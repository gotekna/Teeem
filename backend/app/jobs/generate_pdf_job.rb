# frozen_string_literal: true

# Background job for PDF generation. Runs on the worker dyno where Grover/HexaPDF are available.
#
# Supports all PDF generator types:
#   - tekna_document: TeknaDocumentGenerator (Grover)
#   - invoice: InvoicePdfGenerator (Grover)
#   - bank_report: BankTransactionReportService (HexaPDF)
#   - contract_overlay: Engines::PdfOverlayEngine (HexaPDF)
#   - director_change: DirectorChangeService (Grover + HexaPDF)
#   - financial_report: FinancialReportService (HexaPDF)
#   - form43_certificate: Form43CertificateGenerator (Grover)
#
class GeneratePdfJob < ApplicationJob
  queue_as :default

  def perform(pdf_generation_id)
    pdf_gen = PdfGeneration.find(pdf_generation_id)
    pdf_gen.update!(status: "processing")

    result = run_generator(pdf_gen)
    pdf_content = extract_pdf_content(result, pdf_gen.generator_type)
    filename = extract_filename(result, pdf_gen)

    blob = StorageBlob.find_or_create_for_content!(
      pdf_content,
      filename: filename,
      content_type: "application/pdf"
    )

    pdf_gen.update!(
      status: "completed",
      storage_blob: blob,
      result_filename: filename
    )
  rescue StandardError => e
    Rails.logger.error("[GeneratePdfJob] Failed pdf_generation=#{pdf_generation_id}: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))

    PdfGeneration.where(id: pdf_generation_id).update_all(
      status: "failed",
      error_message: e.message.truncate(500)
    )

    raise
  end

  private

  def run_generator(pdf_gen)
    params = pdf_gen.generator_params.with_indifferent_access
    type = pdf_gen.generator_type

    case type
    when "tekna_document"
      generate_tekna_document(params)
    when "invoice"
      generate_invoice(params)
    when "bank_report"
      generate_bank_report(params)
    when "contract_overlay"
      generate_contract_overlay(params)
    when "director_change"
      generate_director_change(params, pdf_gen)
    when "financial_report"
      generate_financial_report(params)
    when "form43_certificate"
      generate_form43_certificate(params)
    else
      raise "Unknown generator_type: #{type}"
    end
  end

  def generate_tekna_document(params)
    template_key = params[:template_key].to_sym
    job = params[:job_id].present? ? Job.find(params[:job_id]) : nil
    contact = params[:contact_id].present? ? Contact.find(params[:contact_id]) : nil
    purchase_order = params[:purchase_order_id].present? ? PurchaseOrder.find(params[:purchase_order_id]) : nil
    extra_data = (params[:extra_data] || {}).deep_symbolize_keys

    generator = TeknaDocumentGenerator.new(template_key)
    generator.generate(
      job: job,
      contact: contact,
      purchase_order: purchase_order,
      extra_data: extra_data
    )
  end

  def generate_invoice(params)
    template = InvoiceTemplate.find(params[:template_id])
    invoice = Invoice.find(params[:invoice_id])
    job = params[:job_id].present? ? Job.find(params[:job_id]) : nil
    contact = params[:contact_id].present? ? Contact.find(params[:contact_id]) : nil
    claim_stage = params[:claim_stage_id].present? ? JobClaimStage.find(params[:claim_stage_id]) : nil

    generator = InvoicePdfGenerator.new(template: template)
    generator.generate(
      invoice: invoice,
      job: job,
      contact: contact,
      claim_stage: claim_stage
    )
  end

  def generate_bank_report(params)
    BankTransactionReportService.new(
      bank_account_id: params[:bank_account_id],
      financial_year: params[:financial_year],
      month: params[:month].present? ? params[:month].to_i : nil,
      start_date: params[:start_date].present? ? Date.parse(params[:start_date]) : nil,
      end_date: params[:end_date].present? ? Date.parse(params[:end_date]) : nil
    ).generate
  end

  def generate_contract_overlay(params)
    template_key = (params[:template_key] || "qbcc_contract").to_sym
    job = Job.find(params[:job_id])

    engine = Engines::PdfOverlayEngine.new(template_key)
    pdf_content = engine.generate(job: job)

    { pdf_content: pdf_content, filename: "QBCC_Contract_#{job.job_number || job.id}.pdf" }
  end

  def generate_director_change(params, pdf_gen)
    company = Corporate.find(params["company_id"])
    user = User.find(params["user_id"])

    ceasing = (params["ceasing_directors"] || []).map do |cd|
      director = company.corporate_directors.find(cd["corporate_director_id"])
      {
        corporate_director: director,
        positions: cd["positions"],
        cessation_date: Date.parse(cd["cessation_date"]),
        email: cd["email"]
      }
    end

    appointments = (params["new_appointments"] || []).map do |appt|
      contact = Contact.find(appt["contact_id"])
      {
        contact: contact,
        positions: appt["positions"],
        appointment_date: Date.parse(appt["appointment_date"]),
        email: appt["email"]
      }
    end

    service = DirectorChangeService.new(
      company: company,
      ceasing_directors: ceasing,
      new_appointments: appointments,
      user: user
    )

    if params["send_for_signing"]
      result = service.generate_and_send!
      # Store e-sig result for frontend polling
      pdf_gen.update_column(:generator_params, pdf_gen.generator_params.merge(
        "_result" => {
          "e_signature_request_id" => result[:e_signature_request].id,
          "request_number" => result[:e_signature_request].request_number,
          "documents" => result[:documents].map { |d| { "type" => d[:type].to_s, "name" => d[:name] } }
        }
      ))
      { pdf_content: result[:pdf_content], filename: result[:filename] }
    else
      result = service.generate_package
      # Store documents list for frontend
      pdf_gen.update_column(:generator_params, pdf_gen.generator_params.merge(
        "_result" => {
          "documents" => result[:documents].map { |d| { "type" => d[:type].to_s, "name" => d[:name] } }
        }
      ))
      { pdf_content: result[:pdf_content], filename: result[:filename] }
    end
  end

  def generate_financial_report(params)
    report_type = params["report_type"] # "ProfitLossReport" or "BalanceSheetReport"
    report_id = params["report_id"]

    report = report_type.constantize.find(report_id)
    service = FinancialReportService.new(report)
    result = service.generate

    unless result[:success]
      raise "Financial report PDF generation failed: #{result[:error]}"
    end

    # Update the report record with PDF URL
    report.mark_completed!(
      url: result[:storage_url],
      file_name: result[:filename],
      file_size: result[:pdf]&.bytesize
    )

    { pdf_content: result[:pdf], filename: result[:filename] }
  end

  def generate_form43_certificate(params)
    job = Job.find(params["job_id"])
    document_type = DocumentType.find(params["document_type_id"])
    supervisor = User.find(params["supervisor_id"])

    generator = Form43CertificateGenerator.new(
      job: job,
      document_type: document_type,
      supervisor: supervisor
    )
    result = generator.generate

    # Create WarehouseDocument via standard service
    blob = StorageBlob.find_or_create_for_content!(
      result[:pdf_content],
      filename: result[:filename],
      content_type: "application/pdf"
    )

    warehouse_doc = WarehouseDocumentCreator.create!(
      filename: result[:filename],
      source_type: "job",
      linkable: job,
      storage_blob: blob,
      file_size: result[:pdf_content].bytesize,
      content_type: "application/pdf",
      metadata: {
        "document_type_id" => document_type.id,
        "document_type" => document_type.name,
        "version_status" => "signed",
        "signed_by_id" => supervisor.id,
        "signed_at" => result[:generated_at]&.iso8601,
        "source" => "generated",
        "certificate_template" => document_type.certificate_template
      }
    )

    # Record signature usage in digital register
    SignatureUsage.record!(
      user: supervisor,
      certificate_type: document_type.certificate_template,
      document_name: result[:filename],
      purpose: "#{document_type.certificate_template_display} - #{document_type.name}",
      document_type: document_type,
      job: job,
      job_document: warehouse_doc
    )

    { pdf_content: result[:pdf_content], filename: result[:filename] }
  end

  def extract_pdf_content(result, generator_type)
    content = result[:pdf_content] || result[:pdf]
    raise "Generator returned no PDF content" if content.blank?
    content
  end

  def extract_filename(result, pdf_gen)
    result[:filename] || pdf_gen.generator_params.dig("filename") || "document.pdf"
  end
end
