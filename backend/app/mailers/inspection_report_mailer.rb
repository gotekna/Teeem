# frozen_string_literal: true

# InspectionReportMailer handles email delivery of property inspection reports.
#
# Usage:
#   InspectionReportMailer.send_report(inspection, ["tenant@example.com"]).deliver_later
#
class InspectionReportMailer < ApplicationMailer
  default from: -> {
    TenantSetting.current&.company_email.presence ||
      ENV.fetch("SMTP_USERNAME", "noreply@teeem.com.au")
  }

  # Send completed inspection report to recipients
  def send_report(inspection, recipients)
    @inspection = inspection
    @property = inspection.property
    @company = TenantSetting.current

    # Attach the PDF report if it exists
    if inspection.report_blob.present?
      begin
        content = StorageProviderService.download(inspection.report_blob.storage_path)
        attachments["#{inspection.inspection_number}_report.pdf"] = {
          mime_type: "application/pdf",
          content: content
        }
      rescue => e
        Rails.logger.error("Failed to attach inspection report PDF: #{e.message}")
      end
    end

    mail(
      to: recipients,
      subject: "Property Inspection Report - #{@property.property_code} - #{inspection.inspection_number}"
    )
  end
end
