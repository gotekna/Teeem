# frozen_string_literal: true

module HealthChecks
  # Health checks for Corporate Companies
  # Foundation: corporate_companies (slug-based lookup - SSoT)
  #
  # This is the unified SSoT for company health, merging:
  # - Data quality checks (ABN, ACN formatting)
  # - Compliance checks (directors, secretary, public officer)
  # - Document requirements (registered office, bank accounts)
  # - Review scheduling (overdue reviews, upcoming compliance)
  #
  # Checks:
  #   Critical:
  #   - Companies without ACN (for Pty Ltd companies)
  #   - Companies without ABN
  #   - Companies without current directors
  #   - Companies without registered office address
  #
  #   Warning:
  #   - Companies without TFN
  #   - Companies without bank accounts
  #   - Companies without shareholders
  #   - Shareholding total mismatch (sum of shares ≠ shares on issue)
  #   - Companies without secretary
  #   - Companies without public officer
  #   - Companies overdue for review
  #   - Overdue compliance items
  #
  #   Info:
  #   - Companies without review date
  #   - Companies without corporate key
  #   - Upcoming compliance items
  #
  class CompaniesCheck < BaseCheck
    FOUNDATION_SLUG = "corporate_companies"

    def self.check_type
      "companies"
    end

    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    def self.foundation_id
      @foundation_id ||= Foundation.find_by(slug: FOUNDATION_SLUG)&.id
    end

    # ============================================
    # CRITICAL COMPLIANCE CHECKS
    # ============================================

    # Companies missing ABN (critical for business operations)
    def check_companies_without_abn
      companies = Corporate.where(active: [ true, nil ])
                        .where(abn: [ nil, "" ])
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without ABN",
        description: "Active companies missing an Australian Business Number. Required for tax and invoicing.",
        severity: :critical,
        items: companies,
        icon: "identification",
        action_path: "/corporate/:id",
        check_name: "companies_without_abn"
      )
    end

    # Companies missing ACN (for Pty Ltd companies)
    def check_companies_without_acn
      companies = Corporate.where(active: [ true, nil ])
                        .where(acn: [ nil, "" ])
                        .where("entity_type ILIKE '%pty%' OR entity_type ILIKE '%proprietary%' OR entity_type ILIKE '%limited%' OR entity_type ILIKE '%company%'")
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without ACN",
        description: "Proprietary/Limited companies missing an Australian Company Number. Required for ASIC compliance.",
        severity: :critical,
        items: companies,
        icon: "building-office",
        action_path: "/corporate/:id",
        check_name: "companies_without_acn"
      )
    end

    # Companies without any current directors
    def check_companies_without_directors
      # Find companies with no current directors
      companies_with_directors = CorporateDirector.where(is_current: true).select(:company_id).distinct
      companies = Corporate.where(active: [ true, nil ])
                        .where.not(id: companies_with_directors)
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without Directors",
        description: "Companies without any current director records. At least one director is required by law.",
        severity: :critical,
        items: companies,
        icon: "user-group",
        action_path: "/corporate/:id",
        check_name: "companies_without_directors"
      )
    end

    # Companies missing registered office address
    def check_companies_without_registered_office
      companies = Corporate.where(active: [ true, nil ])
                        .where(registered_office_address: [ nil, "" ])
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without Registered Office",
        description: "Companies missing a registered office address. Required for ASIC and legal notices.",
        severity: :critical,
        items: companies,
        icon: "map-pin",
        action_path: "/corporate/:id",
        check_name: "companies_without_registered_office"
      )
    end

    # ============================================
    # WARNING COMPLIANCE CHECKS
    # ============================================

    # Companies missing TFN
    def check_companies_without_tfn
      companies = Corporate.where(active: [ true, nil ])
                        .where(tfn: [ nil, "" ])
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without TFN",
        description: "Companies missing a Tax File Number. Required for tax returns and withholding.",
        severity: :warning,
        items: companies,
        icon: "receipt-tax",
        action_path: "/corporate/:id",
        check_name: "companies_without_tfn"
      )
    end

    # Companies without any bank accounts
    def check_companies_without_bank_accounts
      companies_with_accounts = BankAccount.where(status: "active").select(:company_id).distinct
      companies = Corporate.where(active: [ true, nil ])
                        .where.not(id: companies_with_accounts)
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without Bank Accounts",
        description: "Companies without any active bank account records. Bank accounts should be documented for reconciliation.",
        severity: :warning,
        items: companies,
        icon: "banknotes",
        action_path: "/corporate/:id",
        check_name: "companies_without_bank_accounts"
      )
    end

    # Companies without shareholders
    def check_companies_without_shareholders
      companies_with_shareholders = CorporateShareholding.select(:company_id).distinct
      companies = Corporate.where(active: [ true, nil ])
                        .where("LOWER(entity_type) = 'company'")
                        .where.not(id: companies_with_shareholders)
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without Shareholders",
        description: "Companies without any shareholder records. Shareholding structure should be documented.",
        severity: :warning,
        items: companies,
        icon: "users",
        action_path: "/corporate/:id",
        check_name: "companies_without_shareholders"
      )
    end

    # Companies where shareholding totals don't match shares on issue
    def check_shareholding_mismatch
      # Find companies with shareholdings where total doesn't match shares_on_issue
      mismatched = []

      Corporate.where(active: [ true, nil ])
                      .where.not(shares_on_issue: [ nil, 0 ])
                      .includes(:corporate_shareholdings)
                      .find_each do |company|
        total_shares = company.corporate_shareholdings.sum(:number_of_shares)
        shares_on_issue = company.shares_on_issue.to_i

        next if total_shares == 0 # Skip if no shareholdings recorded
        next if total_shares == shares_on_issue # Skip if they match

        mismatched << {
          id: company.id,
          display: "#{company.id} - #{company.name}",
          code: company.code,
          name: company.name,
          entity_type: company.entity_type,
          shares_on_issue: shares_on_issue,
          shareholding_total: total_shares,
          difference: total_shares - shares_on_issue
        }
      end

      build_result(
        name: "Shareholding Total Mismatch",
        description: "Companies where the sum of shareholdings doesn't match shares on issue. This may indicate missing or duplicate shareholding records.",
        severity: :warning,
        items: mismatched,
        icon: "calculator",
        action_path: "/corporate/:id",
        check_name: "shareholding_mismatch"
      )
    end

    # Companies without a secretary appointed
    def check_companies_without_secretary
      # Find companies where no director has secretary position
      companies_with_secretary = CorporateDirector
        .where(is_current: true)
        .where("LOWER(position) LIKE '%secretary%'")
        .select(:company_id).distinct

      companies = Corporate.where(active: [ true, nil ])
                        .where("LOWER(entity_type) = 'company'")
                        .where.not(id: companies_with_secretary)
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without Secretary",
        description: "Companies without a secretary appointed. A company secretary is recommended for ASIC compliance.",
        severity: :warning,
        items: companies,
        icon: "clipboard-document-list",
        action_path: "/corporate/:id",
        check_name: "companies_without_secretary"
      )
    end

    # Companies without a public officer appointed
    def check_companies_without_public_officer
      companies_with_officer = CorporateDirector
        .where(is_current: true)
        .where("LOWER(position) LIKE '%public%officer%'")
        .select(:company_id).distinct

      companies = Corporate.where(active: [ true, nil ])
                        .where.not(id: companies_with_officer)
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without Public Officer",
        description: "Companies without a public officer appointed. Required for ATO correspondence.",
        severity: :warning,
        items: companies,
        icon: "user-circle",
        action_path: "/corporate/:id",
        check_name: "companies_without_public_officer"
      )
    end

    # Companies with overdue review
    def check_companies_overdue_review
      companies = Corporate.where(active: [ true, nil ])
                        .where("review_date < ?", Date.current)
                        .select(:id, :name, :code, :review_date)

      build_result(
        name: "Companies Overdue for Review",
        description: "Companies that have passed their scheduled review date. Annual reviews ensure ongoing compliance.",
        severity: :warning,
        items: companies,
        icon: "exclamation-triangle",
        action_path: "/corporate/:id",
        check_name: "companies_overdue_review"
      )
    end

    # Companies with overdue compliance items
    def check_overdue_compliance_items
      # Count companies with overdue compliance items
      companies_with_overdue = CorporateComplianceItem
        .where("due_date < ?", Date.current)
        .where(completed: false)
        .select(:company_id).distinct

      companies = Corporate.where(id: companies_with_overdue)
                        .select(:id, :name, :code)

      build_result(
        name: "Companies with Overdue Compliance",
        description: "Companies with overdue compliance items that need immediate attention.",
        severity: :warning,
        items: companies,
        icon: "clock",
        action_path: "/corporate/:id",
        check_name: "overdue_compliance_items"
      )
    end

    # ============================================
    # INFO CHECKS (Recommendations)
    # ============================================

    # Companies without review date set
    def check_companies_without_review_date
      companies = Corporate.where(active: [ true, nil ])
                        .where(review_date: nil)
                        .select(:id, :name, :code)

      build_result(
        name: "Companies Without Review Date",
        description: "Companies without a scheduled review date. Set a review date for compliance tracking.",
        severity: :info,
        items: companies,
        icon: "calendar-days",
        action_path: "/corporate/:id",
        check_name: "companies_without_review_date"
      )
    end

    # Companies without corporate key
    def check_companies_without_corporate_key
      companies = Corporate.where(active: [ true, nil ])
                        .where(corporate_key: [ nil, "" ])
                        .select(:id, :name, :code)

      build_result(
        name: "Companies Without Corporate Key",
        description: "Companies missing their ASIC corporate key. Required for ASIC portal access.",
        severity: :info,
        items: companies,
        icon: "key",
        action_path: "/corporate/:id",
        check_name: "companies_without_corporate_key"
      )
    end

    # Companies without ASIC credentials
    def check_companies_without_asic_credentials
      companies = Corporate.where(active: [ true, nil ])
                        .where(asic_username: [ nil, "" ])
                        .select(:id, :name, :code)

      build_result(
        name: "Companies Without ASIC Credentials",
        description: "Companies missing ASIC portal login credentials. Required for online lodgements.",
        severity: :info,
        items: companies,
        icon: "lock-closed",
        action_path: "/corporate/:id",
        check_name: "companies_without_asic_credentials"
      )
    end

    # Companies without date of incorporation
    def check_companies_without_incorporation_date
      companies = Corporate.where(active: [ true, nil ])
                        .where(date_incorporated: nil)
                        .select(:id, :name, :code, :entity_type)

      build_result(
        name: "Companies Without Incorporation Date",
        description: "Companies missing their date of incorporation. Important for compliance tracking.",
        severity: :info,
        items: companies,
        icon: "calendar",
        action_path: "/corporate/:id",
        check_name: "companies_without_incorporation_date"
      )
    end

    # Companies with upcoming compliance items (within 30 days)
    def check_upcoming_compliance_items
      companies_with_upcoming = CorporateComplianceItem
        .where("due_date BETWEEN ? AND ?", Date.current, 30.days.from_now)
        .where(completed: false)
        .select(:company_id).distinct

      companies = Corporate.where(id: companies_with_upcoming)
                        .select(:id, :name, :code)

      build_result(
        name: "Companies with Upcoming Compliance",
        description: "Companies with compliance items due within the next 30 days.",
        severity: :info,
        items: companies,
        icon: "bell",
        action_path: "/corporate/:id",
        check_name: "upcoming_compliance_items"
      )
    end

    # ============================================
    # DATA FORMATTING CHECKS (Auto-fixable)
    # ============================================

    # Companies with improperly formatted ABN (should be XX XXX XXX XXX)
    def check_abn_formatting
      # Find companies with ABN that doesn't match format XX XXX XXX XXX
      companies = Corporate.where(active: [ true, nil ])
                        .where.not(abn: [ nil, "" ])
                        .where("abn !~ '^[0-9]{2} [0-9]{3} [0-9]{3} [0-9]{3}$'")
                        .select(:id, :name, :code, :abn)

      build_result(
        name: "ABN Needs Formatting",
        description: "ABN should be formatted as XX XXX XXX XXX. Click Fix All to auto-format.",
        severity: :info,
        items: companies,
        icon: "identification",
        action_path: "/corporate/:id",
        check_name: "abn_formatting",
        auto_fixable: true,
        fix_type: "abn_format"
      )
    end

    # Companies with improperly formatted ACN (should be XXX XXX XXX)
    def check_acn_formatting
      # Find companies with ACN that doesn't match format XXX XXX XXX
      companies = Corporate.where(active: [ true, nil ])
                        .where.not(acn: [ nil, "" ])
                        .where("acn !~ '^[0-9]{3} [0-9]{3} [0-9]{3}$'")
                        .select(:id, :name, :code, :acn)

      build_result(
        name: "ACN Needs Formatting",
        description: "ACN should be formatted as XXX XXX XXX. Click Fix All to auto-format.",
        severity: :info,
        items: companies,
        icon: "building-office",
        action_path: "/corporate/:id",
        check_name: "acn_formatting",
        auto_fixable: true,
        fix_type: "acn_format"
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:code)
          {
            id: item.id,
            display: "#{item.code || item.id} - #{item.name}",
            code: item.code,
            name: item.name,
            entity_type: item.try(:entity_type),
            review_date: item.try(:review_date)
          }
        else
          super
        end
      end
    end
  end
end
