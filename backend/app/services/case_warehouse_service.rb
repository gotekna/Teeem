# CaseWarehouseService - Queries data warehouse for case investigations
# Leverages materialized views for fast analytics
class CaseWarehouseService
  attr_reader :case_record

  def initialize(case_record)
    @case_record = case_record
  end

  # ============================================
  # JOB METRICS
  # ============================================

  # Get pre-computed job metrics for case-related jobs
  def job_metrics_for_entities
    return [] if case_record.related_job_ids.empty?

    query_mv("mv_job_summary", "job_id IN (?)", [ case_record.related_job_ids ])
  end

  # Get task metrics for related jobs
  def task_metrics
    return [] if case_record.related_job_ids.empty?

    query_mv("mv_task_metrics", "job_id IN (?)", [ case_record.related_job_ids ])
  end

  # ============================================
  # DOCUMENT SEARCH
  # ============================================

  # Search documents with pre-computed stats from warehouse
  def search_documents(keywords: nil, document_type: nil, date_range: nil, verification_status: nil)
    conditions = []
    params = []

    # Filter by related companies
    if case_record.related_company_ids.any?
      conditions << "company_id IN (?)"
      params << case_record.related_company_ids
    end

    # Keyword search
    if keywords.present?
      conditions << "(document_type ILIKE ? OR document_category ILIKE ?)"
      params << "%#{keywords}%"
      params << "%#{keywords}%"
    end

    # Document type filter
    if document_type.present?
      conditions << "document_type = ?"
      params << document_type
    end

    # Year filter from date range
    if date_range.present?
      start_year = date_range[:start]&.to_date&.year
      end_year = date_range[:end]&.to_date&.year
      if start_year && end_year
        conditions << "document_year BETWEEN ? AND ?"
        params << start_year
        params << end_year
      end
    end

    # Verification status
    if verification_status.present?
      conditions << "ai_verification_status = ?"
      params << verification_status
    end

    query_mv("mv_document_summary", conditions.join(" AND "), params)
  end

  # Get document completeness for related jobs
  def document_completeness
    return [] if case_record.related_job_ids.empty?

    query_mv("mv_job_document_status", "job_id IN (?)", [ case_record.related_job_ids ])
  end

  # ============================================
  # EMAIL SEARCH
  # ============================================

  # Search emails in warehouse
  def search_emails(query: nil, date_range: nil, from_email: nil, job_id: nil)
    scope = SyncedEmail.all

    # Full-text search
    scope = scope.search_text(query) if query.present?

    # Date range
    if date_range.present?
      scope = scope.received_after(date_range[:start]) if date_range[:start]
      scope = scope.received_before(date_range[:end]) if date_range[:end]
    end

    # From email filter
    scope = scope.where(from_email: from_email) if from_email.present?

    # Job filter - either specific job or case-related jobs
    # OR search by related contact emails
    if job_id.present?
      scope = scope.for_job(job_id)
    elsif case_record.related_job_ids.any? && case_record.related_emails.any?
      # Both job IDs and related emails - use OR to find either
      job_scope = SyncedEmail.where(job_id: case_record.related_job_ids)
      email_scope = SyncedEmail.involving_email(case_record.related_emails)

      # Apply existing conditions to both sides of the OR
      if date_range.present?
        job_scope = job_scope.received_after(date_range[:start]) if date_range[:start]
        job_scope = job_scope.received_before(date_range[:end]) if date_range[:end]
        email_scope = email_scope.received_after(date_range[:start]) if date_range[:start]
        email_scope = email_scope.received_before(date_range[:end]) if date_range[:end]
      end

      scope = job_scope.or(email_scope)
      scope = scope.search_text(query) if query.present?
      scope = scope.where(from_email: from_email) if from_email.present?
    elsif case_record.related_job_ids.any?
      scope = scope.where(job_id: case_record.related_job_ids)
    elsif case_record.related_emails.any?
      scope = scope.involving_email(case_record.related_emails)
    end

    scope.recent_first.limit(100)
  end

  # Get email threads related to case
  def related_email_threads
    emails = search_emails
    conversation_ids = emails.pluck(:conversation_id).compact.uniq

    conversation_ids.map do |conv_id|
      thread_emails = SyncedEmail.by_conversation(conv_id)
      {
        conversation_id: conv_id,
        subject: thread_emails.first&.subject,
        email_count: thread_emails.count,
        first_email: thread_emails.first,
        last_email: thread_emails.last,
        participants: (thread_emails.flat_map { |e| [ e.from_email ] + e.to_emails.to_a }.compact.uniq)
      }
    end
  end

  # ============================================
  # FINANCIAL ANALYSIS
  # ============================================

  # Get financial summary for related companies
  def financial_summary(period: nil)
    return [] if case_record.related_company_ids.empty?

    conditions = [ "company_id IN (?)" ]
    params = [ case_record.related_company_ids ]

    if period.present?
      conditions << "period = ?"
      params << period
    end

    query_mv("mv_financial_summary", conditions.join(" AND "), params)
  end

  # Find financial anomalies - invoices that don't match POs
  def financial_anomalies
    return [] if case_record.related_job_ids.empty?

    query_mv(
      "mv_invoice_po_reconciliation",
      "job_id IN (?) AND reconciliation_status != 'matched'",
      [ case_record.related_job_ids ]
    )
  end

  # Get invoice-to-PO reconciliation for all related jobs
  def invoice_reconciliation
    return [] if case_record.related_job_ids.empty?

    query_mv("mv_invoice_po_reconciliation", "job_id IN (?)", [ case_record.related_job_ids ])
  end

  # ============================================
  # RESOURCE ANALYSIS
  # ============================================

  # Get resource utilization for related jobs
  def resource_utilization(week_start: nil)
    return [] if case_record.related_job_ids.empty?

    conditions = [ "job_id IN (?)" ]
    params = [ case_record.related_job_ids ]

    if week_start.present?
      conditions << "week_start >= ?"
      params << week_start
    end

    query_mv("mv_resource_utilization", conditions.join(" AND "), params)
  end

  # ============================================
  # TIMELINE BUILDING
  # ============================================

  # Build timeline from multiple data sources
  def build_timeline(start_date: nil, end_date: nil)
    start_date ||= case_record.investigation_start_date || 1.year.ago.to_date
    end_date ||= case_record.investigation_end_date || Date.current

    events = []

    # Add email events
    emails = search_emails(date_range: { start: start_date, end: end_date })
    events += emails.map { |e| timeline_event_from_email(e) }

    # Add document events from WarehouseDocument (SSoT Jan 2026)
    docs = WarehouseDocument
      .where("created_at BETWEEN ? AND ?", start_date, end_date)
      .order(:created_at)
    events += docs.map { |d| timeline_event_from_document(d) }

    # Add financial transaction events
    if defined?(FinancialTransaction)
      transactions = FinancialTransaction
        .where(company_id: case_record.related_company_ids)
        .where(transaction_date: start_date..end_date)
        .order(:transaction_date)
      events += transactions.map { |t| timeline_event_from_transaction(t) }
    end

    # Sort by date
    events.sort_by { |e| [ e[:date], e[:time] || Time.parse("00:00") ] }
  end

  # ============================================
  # ENTITY ANALYSIS
  # ============================================

  # Deep analysis of a contact
  def analyze_contact(contact_id)
    contact = Contact.find(contact_id)

    {
      contact: contact,
      directorships: contact.corporate_directors.includes(:corporate),
      shareholdings: CorporateShareholding.where(shareholder_type: "Contact", shareholder_id: contact_id)
                                        .includes(:corporate),
      relationships: contact.contact_relationships.includes(:related_contact),
      documents: WarehouseDocument.where(documentable_type: "Contact", documentable_id: contact_id),
      emails: SyncedEmail.involving_email(contact.email),
      company_group_memberships: contact.company_group_memberships.includes(:company_group)
    }
  end

  # Deep analysis of a company
  def analyze_company(company_id)
    company = Corporate.find(company_id)

    # Get warehouse metrics
    job_ids = company.jobs.pluck(:id)

    {
      company: company,
      directors: company.corporate_directors.includes(:contact),
      shareholders: company.corporate_shareholdings.includes(:contact),
      job_summary: query_mv("mv_job_summary", "job_id IN (?)", [ job_ids ]),
      financial_summary: query_mv("mv_financial_summary", "company_id = ?", [ company_id ]),
      document_summary: query_mv("mv_document_summary", "company_id = ?", [ company_id ]),
      invoice_reconciliation: query_mv("mv_invoice_po_reconciliation", "job_id IN (?)", [ job_ids ])
    }
  end

  # ============================================
  # INCONSISTENCY DETECTION
  # ============================================

  # Find potential inconsistencies in case data
  def find_inconsistencies
    inconsistencies = []

    # Check for invoice/PO mismatches
    financial_anomalies.each do |anomaly|
      inconsistencies << {
        type: "financial_mismatch",
        severity: anomaly["variance"].to_f.abs > 1000 ? "high" : "medium",
        title: "Invoice/PO Mismatch: #{anomaly['purchase_order_number']}",
        description: "#{anomaly['reconciliation_status']}: Variance of $#{anomaly['variance']}",
        source: "mv_invoice_po_reconciliation",
        data: anomaly
      }
    end

    # Check for missing documents
    document_completeness.each do |job_status|
      if job_status["documentation_status"] == "missing"
        inconsistencies << {
          type: "missing_documents",
          severity: "medium",
          title: "Missing Documents: #{job_status['job_title']}",
          description: "Job has no associated documents",
          source: "mv_job_document_status",
          data: job_status
        }
      end
    end

    # Check for unverified documents
    unverified = search_documents(verification_status: "pending")
    if unverified.any?
      inconsistencies << {
        type: "unverified_documents",
        severity: "low",
        title: "#{unverified.sum { |d| d['document_count'].to_i }} Unverified Documents",
        description: "Documents pending AI verification",
        source: "mv_document_summary",
        data: unverified
      }
    end

    inconsistencies
  end

  # ============================================
  # SUMMARY GENERATION
  # ============================================

  # Generate summary data for reporting
  def generate_summary
    {
      case_number: case_record.case_number,
      title: case_record.title,
      status: case_record.status,
      generated_at: Time.current,

      # Entity counts
      related_contacts: case_record.related_contact_ids.count,
      related_companies: case_record.related_company_ids.count,
      related_jobs: case_record.related_job_ids.count,

      # Document metrics
      documents_linked: case_record.case_documents.count,
      emails_linked: case_record.case_emails.count,

      # Actions run
      actions_completed: case_record.case_actions.completed.count,
      actions_with_findings: case_record.case_actions.with_results.count,

      # Warehouse metrics
      total_job_income: job_metrics_for_entities.sum { |j| j["total_income"].to_f },
      total_job_expenses: job_metrics_for_entities.sum { |j| j["total_expenses"].to_f },
      total_hours_logged: job_metrics_for_entities.sum { |j| j["total_hours_logged"].to_f },

      # Issues found
      inconsistencies: find_inconsistencies,
      invoice_variances: financial_anomalies.count,

      # Timeline stats
      investigation_period: {
        start: case_record.investigation_start_date,
        end: case_record.investigation_end_date
      }
    }
  end

  private

  # Query a materialized view with conditions
  def query_mv(view_name, conditions = nil, params = [])
    # Sanitize view name to prevent SQL injection
    safe_view_name = ActiveRecord::Base.connection.quote_table_name(view_name)
    sql = "SELECT * FROM #{safe_view_name}"
    sql += " WHERE #{conditions}" if conditions.present?

    if params.any?
      sanitized = ActiveRecord::Base.sanitize_sql_array([ sql, *params ])
      ActiveRecord::Base.connection.execute(sanitized).to_a
    else
      ActiveRecord::Base.connection.execute(sql).to_a
    end
  rescue ActiveRecord::StatementInvalid => e
    Rails.logger.error("[CaseWarehouseService] Query failed: #{e.message}")
    []
  end

  # Convert email to timeline event hash
  def timeline_event_from_email(email)
    {
      date: email.received_at&.to_date || email.created_at.to_date,
      time: email.received_at,
      type: "email",
      title: email.subject || "(No Subject)",
      description: "From: #{email.from_email}",
      source_type: "SyncedEmail",
      source_id: email.id,
      icon: "mail",
      color: "purple",
      metadata: {
        from: email.from_email,
        to: email.to_emails,
        has_attachments: email.has_attachments
      }
    }
  end

  # Convert document to timeline event hash
  # SSoT: WarehouseDocument (Jan 2026)
  def timeline_event_from_document(doc)
    {
      date: doc.created_at.to_date,
      time: doc.created_at,
      type: "document",
      title: doc.display_name || doc.original_filename,
      description: "Source: #{doc.source_type}",
      source_type: "WarehouseDocument",
      source_id: doc.id,
      icon: "file-text",
      color: "blue",
      metadata: {
        source_type: doc.source_type,
        folder: doc.folder
      }
    }
  end

  # Convert transaction to timeline event hash
  def timeline_event_from_transaction(txn)
    {
      date: txn.transaction_date,
      time: nil,
      type: "transaction",
      title: "#{txn.transaction_type.titleize}: $#{txn.amount}",
      description: txn.description,
      source_type: "FinancialTransaction",
      source_id: txn.id,
      icon: "dollar-sign",
      color: txn.transaction_type == "income" ? "green" : "red",
      metadata: {
        amount: txn.amount,
        category: txn.category,
        transaction_type: txn.transaction_type
      }
    }
  end
end
