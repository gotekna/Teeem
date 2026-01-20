# frozen_string_literal: true

# CorporateBillPdfSyncJob
#
# Downloads all bill PDFs from Xero for corporate companies and stores them
# in the warehouse (CorporateCompanyDocument) and SharePoint.
#
# Uses XeroAttachmentSyncService for the actual PDF download and storage.
#
# Run manually:
#   CorporateBillPdfSyncJob.perform_now
#   CorporateBillPdfSyncJob.perform_now(company_ids: [1, 2])
#   CorporateBillPdfSyncJob.perform_now(dry_run: true)
#
class CorporateBillPdfSyncJob < ApplicationJob
  queue_as :low

  # @param options [Hash] Optional configuration
  #   - :company_ids [Array<Integer>] Specific company IDs to process (default: all with Xero)
  #   - :dry_run [Boolean] If true, logs what would be done without downloading
  #   - :force [Boolean] If true, re-download even if PDF already exists
  def perform(options = {})
    options = options.with_indifferent_access
    dry_run = options[:dry_run] || false
    force = options[:force] || false

    Rails.logger.info("[CorporateBillPdfSyncJob] Starting#{' (DRY RUN)' if dry_run}")

    result = {
      companies_processed: 0,
      bills_found: 0,
      pdfs_downloaded: 0,
      pdfs_skipped: 0,
      errors: []
    }

    # Get companies with Xero connections
    companies = fetch_companies(options[:company_ids])
    Rails.logger.info("[CorporateBillPdfSyncJob] Found #{companies.count} companies with Xero connections")

    companies.each do |company|
      begin
        process_company(company, result, dry_run: dry_run, force: force)
        result[:companies_processed] += 1
      rescue StandardError => e
        result[:errors] << { company_id: company.id, company_name: company.name, error: e.message }
        Rails.logger.error("[CorporateBillPdfSyncJob] Error processing #{company.name}: #{e.message}")
      end
    end

    Rails.logger.info("[CorporateBillPdfSyncJob] Completed: #{result.inspect}")
    result
  end

  private

  def fetch_companies(company_ids = nil)
    scope = CorporateCompany.joins(:corporate_company_xero_connection)
                            .where.not(corporate_company_xero_connections: { xero_tenant_id: nil })
                            .distinct

    scope = scope.where(id: company_ids) if company_ids.present?
    scope.order(:name)
  end

  def process_company(company, result, dry_run:, force:)
    connection = company.corporate_company_xero_connection
    return unless connection&.xero_tenant_id.present?
    return unless connection.xero_credential.present?

    tenant_id = connection.xero_tenant_id
    Rails.logger.info("[CorporateBillPdfSyncJob] Processing #{company.name} (tenant: #{tenant_id})")

    # Find all bills for this tenant that don't have PDFs yet (or all if force)
    bills = ExternalInvoice.where(tenant_id: tenant_id, invoice_type: "bill")
                           .where.not(external_id: nil)

    Rails.logger.info("[CorporateBillPdfSyncJob] Found #{bills.count} bills for #{company.name}")
    result[:bills_found] += bills.count

    bills.find_each do |bill|
      process_bill(bill, result, dry_run: dry_run, force: force)
    end
  end

  def process_bill(bill, result, dry_run:, force:)
    # Check if PDF already exists
    external_doc_id = "xero:#{bill.external_id}:pdf"
    existing = CorporateCompanyDocument.find_by(source: "xero", external_id: external_doc_id)

    if existing.present? && existing.storage_reference.present? && !force
      Rails.logger.debug("[CorporateBillPdfSyncJob] PDF already exists for bill #{bill.invoice_number}")
      result[:pdfs_skipped] += 1
      return
    end

    if dry_run
      Rails.logger.info("[CorporateBillPdfSyncJob] DRY RUN: Would download PDF for bill #{bill.invoice_number}")
      result[:pdfs_downloaded] += 1
      return
    end

    # Use XeroAttachmentSyncService to download the PDF
    service = XeroAttachmentSyncService.new(bill)
    sync_result = service.sync!

    if sync_result[:pdf].present?
      result[:pdfs_downloaded] += 1
      Rails.logger.info("[CorporateBillPdfSyncJob] Downloaded PDF for bill #{bill.invoice_number}")
    elsif sync_result[:skipped]
      result[:pdfs_skipped] += 1
    else
      error_msg = sync_result[:errors].join(", ")
      result[:errors] << { bill_id: bill.id, invoice_number: bill.invoice_number, error: error_msg }
      Rails.logger.warn("[CorporateBillPdfSyncJob] Failed to download PDF for bill #{bill.invoice_number}: #{error_msg}")
    end
  rescue XeroApiClient::RateLimitError => e
    # Handle rate limiting with exponential backoff
    Rails.logger.warn("[CorporateBillPdfSyncJob] Rate limited, waiting 60 seconds...")
    sleep(60)
    retry
  rescue StandardError => e
    result[:errors] << { bill_id: bill.id, invoice_number: bill.invoice_number, error: e.message }
    Rails.logger.error("[CorporateBillPdfSyncJob] Error downloading PDF for bill #{bill.invoice_number}: #{e.message}")
  end
end
