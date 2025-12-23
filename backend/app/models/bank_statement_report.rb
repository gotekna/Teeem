# frozen_string_literal: true

# Stores generated bank statement PDF reports for ATO compliance.
# Reports are uploaded to SharePoint in a separate folder from bank-produced statements:
#   Warehousing/Bank Statements/Xero Generated/{bank_account_name}/{FY}/{filename}.pdf
# Bank-produced (official) statements go in:
#   Warehousing/Bank Statements/Bank Produced/{bank_account_name}/{FY}/{filename}.pdf
# PDFs can be regenerated on demand from the underlying bank transaction data.
class BankStatementReport < ApplicationRecord
  include DocumentTemplatable

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
      # Generate standard filename format: {CompanyCode} {Period} {BankCode} {AccountNum} FY{YY} {CompanyCode}.pdf
      # e.g., "TH EOY WBC 702 733 FY24 TH.pdf" for end of year
      # e.g., "TH Jul WBC 702 733 FY24 TH.pdf" for monthly
      standard_filename = generate_standard_filename

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
    # SSoT: Use DocumentType template if linked
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
      account_number: account_number,
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

  # Upload file content to SharePoint using folder structure:
  # Warehousing/Bank Statements/Xero Generated/{bank_account_name}/{FY}/{filename}
  # This keeps Xero-generated statements separate from bank-produced (official) statements
  def upload_to_sharepoint(content, filename)
    credential = OrganizationSharePointCredential.active_credential
    unless credential.present?
      Rails.logger.warn("[BankStatementReport] No SharePoint credentials found - skipping upload")
      return nil
    end

    graph_client = MicrosoftGraphClient.new(credential)

    # Get or create Warehousing folder at root
    warehousing_folder = graph_client.find_folder_in_drive_root("Warehousing")
    unless warehousing_folder
      warehousing_folder = graph_client.create_folder("Warehousing")
      Rails.logger.info("[BankStatementReport] Created SharePoint folder: Warehousing")
    end

    # Get or create Bank Statements subfolder
    bank_statements_folder = graph_client.get_or_create_subfolder(
      warehousing_folder["id"] || warehousing_folder[:id],
      "Bank Statements"
    )

    # Get or create "Xero Generated" subfolder to separate from bank-produced statements
    xero_generated_folder = graph_client.get_or_create_subfolder(
      bank_statements_folder[:id] || bank_statements_folder["id"],
      "Xero Generated"
    )

    # Get or create bank account subfolder (e.g., "NAB - Tekna Homes")
    bank_folder = graph_client.get_or_create_subfolder(
      xero_generated_folder[:id] || xero_generated_folder["id"],
      bank_account_name
    )

    # Get or create FY subfolder (e.g., "FY24")
    fy_folder = graph_client.get_or_create_subfolder(
      bank_folder[:id] || bank_folder["id"],
      financial_year
    )

    # Upload the file
    upload_result = graph_client.upload_file_content(
      fy_folder[:id] || fy_folder["id"],
      filename,
      content
    )

    Rails.logger.info("[BankStatementReport] Uploaded to SharePoint: Warehousing/Bank Statements/Xero Generated/#{bank_account_name}/#{financial_year}/#{filename}")
    upload_result
  rescue MicrosoftGraphClient::AuthenticationError => e
    Rails.logger.error("[BankStatementReport] SharePoint auth error: #{e.message}")
    nil
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("[BankStatementReport] SharePoint API error: #{e.message}")
    nil
  rescue StandardError => e
    Rails.logger.error("[BankStatementReport] SharePoint upload error: #{e.message}")
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
