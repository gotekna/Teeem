# frozen_string_literal: true

module HealthChecks
  # Health checks for Companies
  # Foundation ID: 353
  #
  # Checks:
  #   - Companies without ABN (warning)
  #   - Companies without ACN (info for Pty Ltd)
  #   - Companies without review date (info)
  #   - Companies without directors (critical)
  #
  class CompaniesCheck < BaseCheck
    FOUNDATION_ID = 353

    def self.check_type
      "companies"
    end

    def self.foundation_id
      FOUNDATION_ID
    end

    # Companies missing ABN
    def check_companies_without_abn
      companies = Company.where(active: [ true, nil ])
                        .where(abn: [ nil, "" ])
                        .select(:id, :name, :code, :company_type)

      build_result(
        name: "Companies Without ABN",
        description: "Active companies missing an Australian Business Number. Required for tax and invoicing.",
        severity: :warning,
        items: companies,
        icon: "identification",
        action_path: "/corporate/:id"
      )
    end

    # Companies missing ACN (for Pty Ltd companies)
    def check_companies_without_acn
      companies = Company.where(active: [ true, nil ])
                        .where(acn: [ nil, "" ])
                        .where("company_type ILIKE '%pty%' OR company_type ILIKE '%proprietary%' OR company_type ILIKE '%limited%'")
                        .select(:id, :name, :code, :company_type)

      build_result(
        name: "Companies Without ACN",
        description: "Proprietary/Limited companies missing an Australian Company Number.",
        severity: :info,
        items: companies,
        icon: "building-office",
        action_path: "/corporate/:id"
      )
    end

    # Companies without review date set
    def check_companies_without_review_date
      companies = Company.where(active: [ true, nil ])
                        .where(review_date: nil)
                        .select(:id, :name, :code)

      build_result(
        name: "Companies Without Review Date",
        description: "Companies without a scheduled review date for compliance checks.",
        severity: :info,
        items: companies,
        icon: "calendar-days",
        action_path: "/corporate/:id"
      )
    end

    # Companies without any directors
    # NOTE: Disabled - CompanyRelationship model does not exist yet
    # TODO: Implement when company-contact relationship model is created
    def check_companies_without_directors
      # Skip this check - model not implemented
      build_result(
        name: "Companies Without Directors",
        description: "Companies without any director records. (Check disabled - awaiting data model)",
        severity: :info,
        items: [],
        icon: "user-group",
        action_path: "/corporate/:id"
      )
    end

    # Companies with overdue review
    def check_companies_overdue_review
      companies = Company.where(active: [ true, nil ])
                        .where("review_date < ?", Date.current)
                        .select(:id, :name, :code, :review_date)

      build_result(
        name: "Companies Overdue for Review",
        description: "Companies that have passed their scheduled review date.",
        severity: :warning,
        items: companies,
        icon: "exclamation-triangle",
        action_path: "/corporate/:id"
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
            company_type: item.try(:company_type),
            review_date: item.try(:review_date)
          }
        else
          super
        end
      end
    end
  end
end
