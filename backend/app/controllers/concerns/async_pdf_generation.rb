# frozen_string_literal: true

# Include in controllers that generate PDFs to provide async generation.
#
# Usage:
#   include AsyncPdfGeneration
#
#   def generate_pdf
#     enqueue_pdf_and_respond(
#       generator_type: "tekna_document",
#       generator_params: { template_key: "specifications", job_id: @job.id }
#     )
#   end
#
module AsyncPdfGeneration
  extend ActiveSupport::Concern

  private

  def enqueue_pdf_and_respond(generator_type:, generator_params:)
    pdf_gen = PdfGeneration.create!(
      generator_type: generator_type,
      generator_params: generator_params,
      user: current_user,
      tenant: current_tenant,
      status: "pending"
    )

    GeneratePdfJob.perform_later(pdf_gen.id)

    render json: {
      success: true,
      data: {
        pdfGenerationId: pdf_gen.id,
        status: "pending",
        statusUrl: api_v1_pdf_generation_path(pdf_gen),
        downloadUrl: download_api_v1_pdf_generation_path(pdf_gen),
        message: "PDF generation started"
      }
    }, status: :accepted
  end
end
