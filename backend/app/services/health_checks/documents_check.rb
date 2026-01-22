# frozen_string_literal: true

module HealthChecks
  # Health checks for Company Documents
  # Foundation: company_documents (slug-based lookup - SSoT)
  #
  # Checks:
  #   - Documents needing AI verification (info)
  #   - Documents needing user validation (warning)
  #   - Missing compliance documents by folder (ATO, BANK, ASIC, FINANCIALS)
  #
  class DocumentsCheck < BaseCheck
    FOUNDATION_SLUG = "company_documents"

    def self.check_type
      "company_documents"
    end

    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    def self.foundation_id
      @foundation_id ||= Foundation.find_by(slug: FOUNDATION_SLUG)&.id
    end

    # Documents pending AI verification
    def check_needs_ai_verification
      docs = CorporateCompanyDocument.where(ai_verification_status: [ nil, "pending" ])
                           .includes(:corporate_company)
                           .limit(100)

      build_result(
        name: "Documents Awaiting AI Verification",
        description: "Documents that have not been processed by AI for automatic categorization.",
        severity: :info,
        items: docs,
        icon: "cpu-chip",
        action_path: "/corporate/:company_id/documents"
      )
    end

    # Documents flagged for user validation
    def check_needs_user_validation
      docs = CorporateCompanyDocument.where(validation_required: true, user_validated_at: nil)
                           .includes(:corporate_company)
                           .limit(100)

      build_result(
        name: "Documents Needing User Validation",
        description: "Documents flagged for manual review and validation.",
        severity: :warning,
        items: docs,
        icon: "clipboard-document-check",
        action_path: "/corporate/:company_id/documents"
      )
    end

    # ATO: Missing quarterly BAS
    def check_ato_missing_bas
      missing = find_companies_missing_document(
        folder: "ATO",
        pattern: "%bas%",
        period: :quarterly
      )

      build_result(
        name: "Companies Missing BAS",
        description: "Companies without recent Business Activity Statement documents.",
        severity: :warning,
        items: missing,
        icon: "document-text",
        action_path: "/corporate/:id/documents?folder=ATO"
      )
    end

    # ATO: Missing annual tax return
    def check_ato_missing_tax_return
      fy = current_financial_year - 1 # Last completed FY

      missing = find_companies_missing_document(
        folder: "ATO",
        pattern: "%tax%return%",
        financial_year: fy
      )

      build_result(
        name: "Companies Missing FY#{fy} Tax Return",
        description: "Companies without a tax return for the #{fy}/#{fy + 1} financial year.",
        severity: :warning,
        items: missing,
        icon: "document-text",
        action_path: "/corporate/:id/documents?folder=ATO"
      )
    end

    # BANK: Missing recent statements
    def check_bank_missing_statements
      missing = find_companies_missing_document(
        folder: "BANK",
        pattern: "%statement%",
        months_ago: 3
      )

      build_result(
        name: "Companies Missing Bank Statements",
        description: "Companies without bank statements in the last 3 months.",
        severity: :info,
        items: missing,
        icon: "banknotes",
        action_path: "/corporate/:id/documents?folder=BANK"
      )
    end

    # ASIC: Missing annual statement
    def check_asic_missing_annual
      current_year = Date.current.year

      missing = find_companies_missing_document(
        folder: "ASIC",
        pattern: "%annual%",
        calendar_year: current_year
      )

      build_result(
        name: "Companies Missing #{current_year} ASIC Statement",
        description: "Companies without an ASIC annual statement for #{current_year}.",
        severity: :info,
        items: missing,
        icon: "building-library",
        action_path: "/corporate/:id/documents?folder=ASIC"
      )
    end

    # FINANCIALS: Missing annual financial statements
    def check_financials_missing_annual
      fy = current_financial_year - 1 # Last completed FY

      missing = find_companies_missing_document(
        folder: "FINANCIALS",
        pattern: "%financial%",
        financial_year: fy
      )

      build_result(
        name: "Companies Missing FY#{fy} Financials",
        description: "Companies without financial statements for the #{fy}/#{fy + 1} financial year.",
        severity: :info,
        items: missing,
        icon: "chart-bar",
        action_path: "/corporate/:id/documents?folder=FINANCIALS"
      )
    end

    # Documents missing date
    def check_documents_missing_date
      docs = CorporateCompanyDocument.where(document_date: nil)
                           .includes(:corporate_company)
                           .limit(100)

      build_result(
        name: "Documents Missing Date",
        description: "Documents without a document date set.",
        severity: :info,
        items: docs,
        icon: "calendar",
        action_path: "/corporate/:company_id/documents"
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:company)
          {
            id: item.id,
            display: "#{item.company&.name || 'Unknown'} - #{item.file_name || item.title || 'Unnamed'}",
            company_id: item.company_id,
            company_name: item.company&.name,
            file_name: item.file_name,
            folder: item.try(:folder)
          }
        elsif item.respond_to?(:code)
          # Company record
          {
            id: item.id,
            display: "#{item.code || item.id} - #{item.name}",
            company_id: item.id
          }
        else
          super
        end
      end
    end

    private

    # Australian Financial Year: July 1 to June 30
    def current_financial_year
      today = Date.current
      today.month >= 7 ? today.year : today.year - 1
    end

    # Find companies missing specific document types
    def find_companies_missing_document(folder:, pattern:, financial_year: nil, calendar_year: nil, months_ago: nil, period: nil)
      # SSoT: Use scope - CorporateCompany has status column, not active boolean
      companies = CorporateCompany.active

      query = CorporateCompanyDocument.where(folder: folder)
                            .where("LOWER(document_type) LIKE ? OR LOWER(title) LIKE ?", pattern, pattern)

      if financial_year
        query = query.where("? = ANY(financial_years)", financial_year)
      elsif calendar_year
        query = query.where("EXTRACT(year FROM document_date) = ?", calendar_year)
      elsif months_ago
        query = query.where("document_date >= ?", months_ago.months.ago)
      elsif period == :quarterly
        # Current quarter check
        query = query.where("document_date >= ?", 3.months.ago)
      end

      companies_with_docs = query.distinct.pluck(:company_id)
      companies.where.not(id: companies_with_docs).select(:id, :name, :code).limit(20)
    end
  end
end
