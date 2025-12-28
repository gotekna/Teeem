class AddDocumentComplianceHealthChecks < ActiveRecord::Migration[8.0]
  def up
    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    company_documents_foundation = Foundation.find_by(slug: "company_documents")
    unless company_documents_foundation
      puts "⚠️ Foundation 'company_documents' not found - skipping health check migration"
      return
    end
    company_documents_foundation_id = company_documents_foundation.id

    # ============================================================================
    # Tab-Based Document Compliance Health Checks
    # ============================================================================

    health_checks = [
      # ATO Tab - BAS and Tax Returns
      {
        foundation_id: company_documents_foundation_id,
        check_type: 'ato_missing_bas_quarterly',
        name: 'Missing Quarterly BAS',
        description: 'Companies missing BAS documents for the current or recent quarters. BAS must be lodged quarterly.',
        api_endpoint: '/api/v1/company_documents/ato_missing_bas',
        severity: 'warning',
        icon: 'file-text',
        action_path: '/corporate/companies/:company_id',
        display_order: 10
      },
      {
        foundation_id: company_documents_foundation_id,
        check_type: 'ato_missing_tax_return',
        name: 'Missing Annual Tax Return',
        description: 'Companies missing tax return documents for the most recent financial year.',
        api_endpoint: '/api/v1/company_documents/ato_missing_tax_return',
        severity: 'critical',
        icon: 'file-warning',
        action_path: '/corporate/companies/:company_id',
        display_order: 11
      },

      # BANK Tab - Monthly Statements
      {
        foundation_id: company_documents_foundation_id,
        check_type: 'bank_missing_monthly_statement',
        name: 'Missing Monthly Bank Statements',
        description: 'Companies missing bank statements for recent months. Bank statements should be collected monthly.',
        api_endpoint: '/api/v1/company_documents/bank_missing_statements',
        severity: 'warning',
        icon: 'landmark',
        action_path: '/corporate/companies/:company_id',
        display_order: 20
      },

      # ASIC Tab - Annual Statement
      {
        foundation_id: company_documents_foundation_id,
        check_type: 'asic_missing_annual_statement',
        name: 'Missing ASIC Annual Statement',
        description: 'Companies missing their annual ASIC statement. Required yearly for company compliance.',
        api_endpoint: '/api/v1/company_documents/asic_missing_annual',
        severity: 'critical',
        icon: 'building-2',
        action_path: '/corporate/companies/:company_id',
        display_order: 30
      },

      # FINANCIALS Tab - Annual Financial Statements
      {
        foundation_id: company_documents_foundation_id,
        check_type: 'financials_missing_annual',
        name: 'Missing Annual Financial Statements',
        description: 'Companies missing financial statements for the most recent financial year.',
        api_endpoint: '/api/v1/company_documents/financials_missing_annual',
        severity: 'warning',
        icon: 'bar-chart-3',
        action_path: '/corporate/companies/:company_id',
        display_order: 40
      },

      # General Document Health
      {
        foundation_id: company_documents_foundation_id,
        check_type: 'documents_missing_date',
        name: 'Documents Missing Date',
        description: 'Documents without a document date. Dates are essential for compliance tracking and financial year classification.',
        api_endpoint: '/api/v1/company_documents/missing_date',
        severity: 'info',
        icon: 'calendar',
        action_path: '/corporate/companies/:company_id',
        display_order: 50
      },
      {
        foundation_id: company_documents_foundation_id,
        check_type: 'documents_missing_financial_year',
        name: 'Documents Missing Financial Year',
        description: 'Documents without financial year classification. This affects compliance reporting.',
        api_endpoint: '/api/v1/company_documents/missing_fy',
        severity: 'info',
        icon: 'calendar-range',
        action_path: '/corporate/companies/:company_id',
        display_order: 51
      }
    ]

    health_checks.each do |check_attrs|
      TableHealthCheck.find_or_create_by!(
        foundation_id: check_attrs[:foundation_id],
        check_type: check_attrs[:check_type]
      ) do |check|
        check.assign_attributes(check_attrs.except(:foundation_id, :check_type))
        check.enabled = true
      end
    end

    puts "Created #{health_checks.count} document compliance health checks"
  end

  def down
    check_types = %w[
      ato_missing_bas_quarterly
      ato_missing_tax_return
      bank_missing_monthly_statement
      asic_missing_annual_statement
      financials_missing_annual
      documents_missing_date
      documents_missing_financial_year
    ]

    TableHealthCheck.where(check_type: check_types).destroy_all
    puts "Removed document compliance health checks"
  end
end
