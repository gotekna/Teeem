# frozen_string_literal: true

# Stores generated bank statement PDF reports for ATO compliance.
# SSoT: DocumentType (ID 22: "X Bank Statement") → EntityTab (xero-bank-statement) → storage_folder_path
# Path template from EntityTab: Corporate/{CompanyGroup}/{CompanyCode}/XERO/Bank
# Example: Corporate/Tekna/THS/XERO/Bank/THS XB NAB 083-052 305422840 Dec24.pdf
# PDFs can be regenerated on demand from the underlying bank transaction data.
class BankStatementReport < ApplicationRecord
  include DocumentTemplatable
  include StorageUploadable

  belongs_to :corporate_company, foreign_key: "company_id", optional: true
  belongs_to :bank_account, primary_key: "xero_account_id", foreign_key: "bank_account_id", optional: true
  belongs_to :document_type, optional: true

  # Bank code mapping for standardized naming
  BANK_CODES = {
    "nab" => "NAB",
    "national australia" => "NAB",
    "westpac" => "WBC",
    "wbc" => "WBC",
    "boq" => "BOQ",
    "bank of queensland" => "BOQ",
    "commonwealth" => "CBA",
    "commbank" => "CBA",
    "cba" => "CBA",
    "anz" => "ANZ",
    "stripe" => "STRIPE",
    "simple saver" => "SS"
  }.freeze


  # Scopes
  scope :completed, -> { where(status: "completed") }
  scope :pending, -> { where(status: "pending") }
  scope :failed, -> { where(status: "failed") }
  scope :for_bank_account, ->(id) { where(bank_account_id: id) }
  scope :for_financial_year, ->(fy) { where(financial_year: fy) }
  scope :for_bank, ->(code) { where(bank_code: code.upcase) }
  scope :for_company, ->(code) { where(company_code: code.upcase) }
  scope :for_company_id, ->(id) { where(company_id: id) }
  scope :monthly, -> { where(report_type: "monthly") }
  scope :annual, -> { where(report_type: "annual") }

  # Callbacks
  before_validation :auto_assign_document_type, on: :create
  before_save :persist_display_name

  # Auto-select the correct DocumentType based on report_type and context
  # SSoT: DocumentType.primary_tab and tabs determine which template to use
  def self.document_type_for(report_type:)
    case report_type
    when "monthly"
      # Monthly Xero bank statement → primary_tab: XERO, tabs includes bank-statement
      DocumentType.find_by(primary_tab: "XERO", name: "X Bank Statement")
    when "annual"
      # Annual/EOY report - not yet implemented
      Rails.logger.warn("[BankStatementReport] Annual reports not yet supported for auto DocumentType selection")
      nil
    else
      Rails.logger.warn("[BankStatementReport] Unknown report_type: #{report_type}")
      nil
    end
  end

  # Detect bank code from account name
  def self.detect_bank_code(account_name)
    name = account_name.to_s.downcase
    BANK_CODES.each do |pattern, code|
      return code if name.include?(pattern)
    end
    "OTHER"
  end

  # Validations
  validates :bank_account_id, presence: true
  validates :bank_account_name, presence: true
  validates :financial_year, presence: true
  validates :bank_account_id, uniqueness: { scope: [ :financial_year, :month ] }

  # Generate or regenerate the PDF report
  def generate!
    # Detect and set bank_code if not already set
    detected_bank_code = self.class.detect_bank_code(bank_account_name)
    self.bank_code = detected_bank_code if bank_code.blank?

    # Look up BSB and account number from BankAccount table (linked to Company)
    if account_number.blank? || company_code.blank?
      bank_account = BankAccount.find_by(xero_account_id: bank_account_id)
      if bank_account.present?
        # Format BSB and account number for filename
        if account_number.blank?
          parts = []
          parts << bank_account.formatted_bsb if bank_account.bsb.present?
          parts << bank_account.account_number if bank_account.account_number.present?
          self.account_number = parts.join(" ")
        end
        # Get company code from linked company
        if company_code.blank? && bank_account.company.present?
          self.company_code = bank_account.company.code
        end
        # Get bank code
        if bank_code.blank? && bank_account.bank_code.present?
          self.bank_code = bank_account.bank_code
        end
      end
    end

    update!(status: "generating", error_message: nil)

    # Build the PDF
    service = BankTransactionReportService.new(
      bank_account_id: bank_account_id,
      financial_year: financial_year,
      month: month
    )

    result = service.generate

    if result[:success]
      # SSoT: Use DocumentType template if available, fallback to hardcoded format
      standard_filename = generate_file_name || generate_standard_filename

      # Upload PDF to SharePoint
      sharepoint_result = upload_to_sharepoint(result[:pdf], standard_filename)

      update!(
        status: "completed",
        file_name: standard_filename,
        file_size: result[:pdf].bytesize,
        transaction_count: result[:transaction_count],
        total_in: calculate_totals(result)[:in],
        total_out: calculate_totals(result)[:out],
        net_change: calculate_totals(result)[:net],
        generated_at: Time.current,
        cloudinary_url: sharepoint_result&.dig(:web_url),
        cloudinary_public_id: sharepoint_result&.dig(:id)
      )

      { success: true, report: self }
    else
      update!(status: "failed", error_message: result[:error])
      { success: false, error: result[:error] }
    end
  rescue StandardError => e
    update!(status: "failed", error_message: e.message)
    Rails.logger.error("BankStatementReport#generate! failed: #{e.message}")
    { success: false, error: e.message }
  end

  # Generate filename in standard format: {CompanyCode} {Period} {BankCode} {AccountNum} FY{YY}.pdf
  def generate_standard_filename
    # Get company code (default to "TH" for Tekna Homes if not set)
    code = company_code.presence || "TH"

    # Period: "EOY" for annual, month abbreviation for monthly
    period = if month.present?
               Date::ABBR_MONTHNAMES[month]
    else
               "EOY"
    end

    # Extract FY year (e.g., "FY24" from "FY2024")
    fy_short = financial_year.to_s.gsub(/FY?(\d{4})/, 'FY\1').gsub(/FY(\d{4})/) { "FY#{$1[-2..]}" }
    fy_short = "FY#{fy_short[-2..]}" unless fy_short.start_with?("FY")

    # Build filename parts: {CompanyCode} {Period} {BankCode} {AccountNum} FY{YY}
    parts = [ code, period, bank_code.presence || "BANK" ]
    parts << account_number if account_number.present?
    parts << fy_short

    "#{parts.join(' ')}.pdf"
  end

  # Get the period display string
  def period_display
    if month.present?
      Date.new(year, month, 1).strftime("%B %Y")
    else
      financial_year
    end
  end

  # Display name for table views - SSoT: Uses DocumentType template if available
  # Template: {BankCode} {MonthYearLong} → "NAB December 2025"
  # For legacy reports without month, fallback to FY
  def display_name
    # Return persisted value if present, otherwise compute
    self[:display_name].presence || computed_display_name
  end

  # Compute display name from template or fallback
  def computed_display_name
    if document_type&.display_name.present?
      expand_display_template(document_type.display_name)
    else
      bank_label = bank_code.presence || "Bank Statement"
      if month.present? && year.present?
        "#{bank_label} #{Date.new(year, month, 1).strftime('%B %Y')}"
      else
        "#{bank_label} #{financial_year}"
      end
    end
  end

  # Generate filename using DocumentType template (SSoT)
  def generate_file_name
    if document_type&.file_name.present?
      expand_filename_template(document_type.file_name)
    else
      nil  # Let service use its existing logic
    end
  end

  # Context for DocumentTemplatable concern
  def template_context
    # Derive period from month/year
    period_str = if month.present?
                   Date::ABBR_MONTHNAMES[month] + (year.present? ? year.to_s[-2..] : "")
                 else
                   "EOY"
                 end

    # Get clean BSB and account number from linked BankAccount (SSoT)
    # Don't use report's account_number field as it may have BSB mixed in
    linked_bsb = bank_account&.bsb
    linked_account_num = bank_account&.account_number

    {
      company_code: company_code,
      company_name: corporate_company&.name,
      doc_type_name: document_type&.name || "Bank Statement",
      doc_type_code: document_type&.abbreviation || "BS",
      financial_year: financial_year,
      period: period_str,
      period_end: period_end,
      document_date: period_end || (month.present? && year.present? ? Date.new(year, month, 1).end_of_month : nil),
      bank_code: bank_code,
      account_number: linked_account_num,
      bsb: bank_account&.bsb
    }
  end

  # ============================================
  # CLASS METHODS: Historical Report Generation
  # ============================================

  # Generate monthly bank statement reports for all bank accounts since Xero connection
  # Creates one report per bank account per month
  def self.generate_historical!(company)
    connection = company.company_xero_connection
    unless connection&.connected?
      Rails.logger.info("[BankStatementReport] Company #{company.id} not connected to Xero - skipping historical generation")
      return { success: false, error: "Company is not connected to Xero", created: 0 }
    end

    # Get all bank accounts for this company linked to Xero
    bank_accounts = company.bank_accounts.linked_to_xero
    if bank_accounts.empty?
      Rails.logger.info("[BankStatementReport] Company #{company.id} has no Xero-linked bank accounts")
      return { success: false, error: "No bank accounts linked to Xero", created: 0 }
    end

    # Determine date range: from Xero start date to LAST completed month
    start_date = (connection.xero_start_date || connection.created_at.to_date).beginning_of_month
    end_date = Date.current.prev_month.end_of_month  # Last day of previous month

    created_count = 0
    skipped_count = 0
    errors = []

    bank_accounts.each do |bank_account|
      # Generate for each month
      current_date = start_date
      while current_date <= end_date
        month_start = current_date.beginning_of_month
        month_end = current_date.end_of_month
        month_num = current_date.month
        year_num = current_date.year
        fy = fiscal_year_for_date(month_end)

        # Skip if report already exists for this period
        if exists?(bank_account_id: bank_account.xero_account_id, financial_year: fy, month: month_num)
          skipped_count += 1
          current_date = current_date.next_month
          next
        end

        begin
          report = create!(
            company_id: company.id,
            bank_account_id: bank_account.xero_account_id,
            bank_account_name: bank_account.institution_name,
            bank_code: bank_account.bank_code || detect_bank_code(bank_account.institution_name),
            account_number: bank_account.account_number,
            company_code: company.code,
            financial_year: fy,
            month: month_num,
            year: year_num,
            report_type: "monthly",
            period_start: month_start,
            period_end: month_end,
            status: "pending"
          )

          # Generate the report
          report.generate!
          created_count += 1

          Rails.logger.info("[BankStatementReport] Generated #{report.display_name} for company #{company.id}")
        rescue StandardError => e
          errors << { period: "#{bank_account.institution_name} #{month_end.strftime('%b%y')}", error: e.message }
          Rails.logger.error("[BankStatementReport] Failed to generate #{bank_account.institution_name} #{month_end.strftime('%b%y')}: #{e.message}")
        end

        current_date = current_date.next_month
      end
    end

    {
      success: errors.empty?,
      created: created_count,
      skipped: skipped_count,
      errors: errors
    }
  end

  # Calculate fiscal year for a given date (Australian FY: July-June)
  # Returns short format (FY24) to match WarehouseBankTransaction.financial_year
  def self.fiscal_year_for_date(date)
    year = date.month >= 7 ? date.year + 1 : date.year
    "FY#{year.to_s[-2..]}"
  end

  # Check if report needs regeneration (transactions updated since generation)
  def needs_regeneration?
    return true if status != "completed"
    return true if generated_at.nil?

    # Check if any transactions were updated after generation
    latest_transaction = WarehouseBankTransaction
      .where(bank_account_id: bank_account_id)
      .where(financial_year: financial_year)
      .where(month.present? ? { transaction_month: month } : {})
      .maximum(:updated_at)

    latest_transaction.present? && latest_transaction > generated_at
  end

  private

  # Auto-assign DocumentType based on report_type
  # Called on create to ensure correct template is used
  def auto_assign_document_type
    return if document_type_id.present? # Don't override if already set

    self.document_type = self.class.document_type_for(report_type: report_type || "monthly")
  end

  # Persist computed display_name to DB column before save
  def persist_display_name
    self[:display_name] = computed_display_name
  end

  # Upload file content to storage using SSoT folder structure from DocumentType system
  # Path: /Shared Documents/00 TEEEM PRIVATE/{CompanyGroup}/{CompanyCode}/BANK/{filename}
  # SSoT: Uses EntityTab.storage_folder_path for path resolution (StorageConfiguration for base)
  def upload_to_storage(content, filename)
    # SSoT: EntityTab (xero-bank-statement) → storage_folder_path is THE ONE source
    # Path defined in Admin > Entity Tabs > Bank Statement tab
    entity_tab = EntityTab.find_by(tab_key: 'xero-bank-statement')
    unless entity_tab&.storage_folder_path.present?
      Rails.logger.error("[BankStatementReport] SSoT missing: EntityTab 'xero-bank-statement' has no storage_folder_path")
      return nil
    end
    path_template = entity_tab.storage_folder_path

    # SSoT: Resolve placeholders in path template
    company_group = corporate_company&.group_name || "Other"
    resolved_path = path_template
      .gsub("{CompanyGroup}", company_group)
      .gsub("{CompanyCode}", company_code || "UNKNOWN")
      .gsub("{company_code}", company_code || "UNKNOWN")

    Rails.logger.info("[BankStatementReport] SSoT path from EntityTab: #{resolved_path}/#{filename}")

    # Use StorageUploadable for provider-agnostic upload
    result = upload_to_storage_path(resolved_path, content, filename, content_type: "application/pdf")

    unless result[:success]
      Rails.logger.error("[BankStatementReport] Storage upload failed: #{result[:error]}")
      return nil
    end

    Rails.logger.info("[BankStatementReport] Uploaded to storage: #{resolved_path}/#{filename}")

    # SSoT: Create CorporateCompanyDocument so it appears in document warehouse
    if corporate_company.present?
      create_document_record(
        filename: filename,
        sharepoint_path: result[:path] || resolved_path,
        sharepoint_file_id: result[:id],
        sharepoint_url: result[:url],
        file_size: content.bytesize
      )
    end

    result[:raw] || { id: result[:id], web_url: result[:url], path: result[:path] }
  rescue StandardError => e
    Rails.logger.error("[BankStatementReport] Storage error: #{e.message}")
    nil
  end

  # Create a CorporateCompanyDocument record for the warehouse
  # SSoT: Links the PDF to the company's document system so it appears in tabs
  def create_document_record(filename:, sharepoint_path:, sharepoint_file_id:, sharepoint_url:, file_size:)
    # Use unique external_id to prevent duplicates
    external_id = "bank_statement_report:#{id}"

    doc = CorporateCompanyDocument.find_or_initialize_by(
      source: "xero",
      external_id: external_id
    )

    doc.assign_attributes(
      company_id: company_id,
      document_type: "Bank Statement",
      display_name: display_name,
      file_name: filename,
      file_size: file_size,
      mime_type: "application/pdf",
      folder: "XERO",  # Shows in XERO tab
      document_date: period_end,
      expected_sharepoint_path: "#{sharepoint_path}/#{filename}",
      sharepoint_file_id: sharepoint_file_id,
      sharepoint_download_url: sharepoint_url,
      storage_type: "electronic",
      ai_verification_status: "verified",  # System-generated, no AI needed
      documentable: self  # Link back to BankStatementReport
    )

    if doc.save
      Rails.logger.info("[BankStatementReport] Created CorporateCompanyDocument #{doc.id} for report #{id}")
    else
      Rails.logger.error("[BankStatementReport] Failed to create document: #{doc.errors.full_messages.join(', ')}")
    end

    doc
  rescue StandardError => e
    Rails.logger.error("[BankStatementReport] Error creating document record: #{e.message}")
    nil
  end

  def calculate_totals(result)
    # Get totals from transactions
    transactions = WarehouseBankTransaction
      .where(bank_account_id: bank_account_id)
      .where(financial_year: financial_year)

    transactions = transactions.where(transaction_month: month) if month.present?

    money_in = transactions.where(transaction_type: "RECEIVE").sum(:total)
    money_out = transactions.where(transaction_type: "SPEND").sum(:total)

    {
      in: money_in,
      out: money_out,
      net: money_in - money_out
    }
  end
end
