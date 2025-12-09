class ConsolidationReconciliationService
  attr_reader :company_group, :as_of_date

  def initialize(company_group, as_of_date: Date.today)
    @company_group = company_group
    @as_of_date = as_of_date
  end

  # Run full reconciliation for a company group
  def run_reconciliation
    report = ReconciliationReport.create!(
      company_group: company_group,
      as_of_date: as_of_date,
      status: "running",
      started_at: Time.current
    )

    begin
      # Step 1: Sync balances from loan register
      sync_loan_balances

      # Step 2: Sync balances from Xero (for connected companies)
      sync_xero_balances

      # Step 3: Calculate discrepancies
      results = calculate_discrepancies

      report.mark_completed!(results)

      {
        success: true,
        report: report,
        summary: results[:summary],
        discrepancies: results[:discrepancies]
      }
    rescue StandardError => e
      Rails.logger.error("Reconciliation failed for group #{company_group.id}: #{e.message}")
      report.mark_failed!(e.message)

      {
        success: false,
        report: report,
        error: e.message
      }
    end
  end

  # Get current intercompany relationships and balances
  def intercompany_relationships
    companies = company_group.corporate_companies.to_a
    relationships = []

    # For each pair of companies, find balances
    companies.combination(2).each do |company_a, company_b|
      balances_a_to_b = IntercompanyBalance.where(
        company_id: company_a.id,
        related_company_id: company_b.id,
        as_of_date: as_of_date
      )

      balances_b_to_a = IntercompanyBalance.where(
        company_id: company_b.id,
        related_company_id: company_a.id,
        as_of_date: as_of_date
      )

      # Group by balance type
      IntercompanyBalance::BALANCE_TYPES.each do |balance_type|
        balance_a = balances_a_to_b.find { |b| b.balance_type == balance_type }
        balance_b = balances_b_to_a.find { |b| b.balance_type == balance_type }

        next unless balance_a || balance_b

        amount_a = balance_a&.amount || 0
        amount_b = balance_b&.amount || 0
        discrepancy = amount_a + amount_b  # Should be zero if matched

        relationships << {
          company_a: {
            id: company_a.id,
            name: company_a.name,
            amount: amount_a,
            source: balance_a&.source
          },
          company_b: {
            id: company_b.id,
            name: company_b.name,
            amount: amount_b,
            source: balance_b&.source
          },
          balance_type: balance_type,
          discrepancy: discrepancy.round(2),
          matched: discrepancy.abs < 0.01,
          as_of_date: as_of_date
        }
      end
    end

    relationships
  end

  # Get summary of intercompany balances for a specific company
  def company_summary(company)
    balances = IntercompanyBalance.where(company_id: company.id, as_of_date: as_of_date)

    {
      company_id: company.id,
      company_name: company.name,
      total_receivables: balances.where("amount > 0").sum(:amount),
      total_payables: balances.where("amount < 0").sum(:amount).abs,
      net_position: balances.sum(:amount),
      balance_count: balances.count,
      related_companies: balances.map do |b|
        {
          related_company_id: b.related_company_id,
          related_company_name: b.related_company_name,
          balance_type: b.balance_type,
          amount: b.amount,
          source: b.source,
          reconciled: b.reconciled?
        }
      end
    }
  end

  private

  def sync_loan_balances
    IntercompanyBalance.sync_from_loans(company_group, as_of_date: as_of_date)
  end

  def sync_xero_balances
    # For each company with a Xero connection, try to fetch intercompany balances
    company_group.corporate_companies.each do |company|
      connection = company.company_xero_connection
      next unless connection&.connected?

      begin
        sync_xero_balances_for_company(company, connection)
      rescue StandardError => e
        Rails.logger.warn("Failed to sync Xero balances for company #{company.id}: #{e.message}")
        # Continue with other companies
      end
    end
  end

  def sync_xero_balances_for_company(company, connection)
    # Get contacts from Xero that match other companies in the group
    client = XeroApiClient.new
    group_company_names = company_group.corporate_companies.where.not(id: company.id).pluck(:name)

    # Fetch aged receivables and payables from Xero
    # This would require implementing aged_receivables and aged_payables endpoints in XeroApiClient
    # For now, we'll skip this as it requires additional Xero API work

    # TODO: Implement Xero aged receivables/payables sync
    # The flow would be:
    # 1. Get contacts from Xero that match company names in group
    # 2. Get aged receivables/payables for those contacts
    # 3. Create IntercompanyBalance records with source='xero'
  end

  def calculate_discrepancies
    relationships = intercompany_relationships

    matched = relationships.count { |r| r[:matched] }
    mismatched = relationships.count { |r| !r[:matched] }
    total_discrepancy = relationships.reject { |r| r[:matched] }.sum { |r| r[:discrepancy].abs }

    discrepancy_details = relationships.reject { |r| r[:matched] }.map do |r|
      {
        company_a_name: r[:company_a][:name],
        company_a_amount: r[:company_a][:amount],
        company_b_name: r[:company_b][:name],
        company_b_amount: r[:company_b][:amount],
        balance_type: r[:balance_type],
        discrepancy: r[:discrepancy],
        severity: categorize_severity(r[:discrepancy])
      }
    end

    {
      total_pairs: relationships.count,
      matched: matched,
      mismatched: mismatched,
      total_discrepancy: total_discrepancy.round(2),
      summary: {
        by_type: summarize_by_type(relationships),
        health_score: calculate_health_score(matched, relationships.count)
      },
      discrepancies: discrepancy_details
    }
  end

  def summarize_by_type(relationships)
    IntercompanyBalance::BALANCE_TYPES.map do |type|
      type_relationships = relationships.select { |r| r[:balance_type] == type }
      {
        type: type,
        total_pairs: type_relationships.count,
        matched: type_relationships.count { |r| r[:matched] },
        mismatched: type_relationships.count { |r| !r[:matched] }
      }
    end
  end

  def calculate_health_score(matched, total)
    return 100 if total.zero?
    (matched.to_f / total * 100).round(0)
  end

  def categorize_severity(discrepancy)
    abs_discrepancy = discrepancy.abs
    case
    when abs_discrepancy < 100 then "low"
    when abs_discrepancy < 10_000 then "medium"
    else "high"
    end
  end
end
