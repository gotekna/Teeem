module Api
  module V1
    class CasesController < ApplicationController
      before_action :set_case, only: [
        :show, :update, :destroy,
        :actions, :documents, :emails, :timeline, :contacts, :companies, :jobs,
        :warehouse_summary, :search_emails, :search_documents, :financial_analysis,
        :add_document, :add_email, :add_contact, :add_company, :add_job,
        :run_action
      ]

      # GET /api/v1/cases
      def index
        cases = CaseRecord.includes(:contact, :company, :company_group, :assigned_to, :created_by)

        # Filter by status
        cases = cases.by_status(params[:status]) if params[:status].present?

        # Filter by type
        cases = cases.by_type(params[:case_type]) if params[:case_type].present?

        # Filter by priority
        cases = cases.by_priority(params[:priority]) if params[:priority].present?

        # Filter by assigned user
        cases = cases.assigned_to_user(params[:assigned_to]) if params[:assigned_to].present?

        # Filter overdue
        cases = cases.overdue if params[:overdue] == 'true'

        # Search by title/number
        if params[:search].present?
          cases = cases.where('title ILIKE ? OR case_number ILIKE ?', "%#{params[:search]}%", "%#{params[:search]}%")
        end

        # Sorting
        cases = case params[:sort]
                when 'deadline' then cases.order(:deadline)
                when 'priority' then cases.order(Arel.sql("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END"))
                when 'created' then cases.order(created_at: :desc)
                else cases.recent_first
                end

        render json: {
          success: true,
          data: cases.map { |c| serialize_case_list(c) },
          meta: {
            total: cases.count,
            open: CaseRecord.open_cases.count,
            overdue: CaseRecord.overdue.count
          }
        }
      end

      # GET /api/v1/cases/:id
      def show
        render json: {
          success: true,
          data: serialize_case_detail(@case)
        }
      end

      # POST /api/v1/cases
      def create
        @case = CaseRecord.new(case_params)
        @case.created_by = current_user

        if @case.save
          render json: { success: true, data: serialize_case_detail(@case) }, status: :created
        else
          render json: { success: false, errors: @case.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/cases/:id
      def update
        if @case.update(case_params)
          render json: { success: true, data: serialize_case_detail(@case) }
        else
          render json: { success: false, errors: @case.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/cases/:id
      def destroy
        @case.destroy
        render json: { success: true }
      end

      # ============================================
      # CASE CONTENT ENDPOINTS
      # ============================================

      # GET /api/v1/cases/:id/actions
      def actions
        actions = @case.case_actions.includes(:created_by).recent_first

        render json: {
          success: true,
          data: actions.map { |a| serialize_action(a) }
        }
      end

      # GET /api/v1/cases/:id/documents
      def documents
        docs = @case.case_documents.includes(:company_document, :added_by).by_relevance

        render json: {
          success: true,
          data: docs.map { |d| serialize_case_document(d) }
        }
      end

      # GET /api/v1/cases/:id/emails
      def emails
        emails = @case.case_emails.includes(:email_warehouse, :added_by).by_relevance

        render json: {
          success: true,
          data: emails.map { |e| serialize_case_email(e) }
        }
      end

      # GET /api/v1/cases/:id/timeline
      def timeline
        events = @case.case_timeline_events.chronological

        render json: {
          success: true,
          data: events.map { |e| serialize_timeline_event(e) }
        }
      end

      # GET /api/v1/cases/:id/contacts
      def contacts
        contacts = @case.case_contacts.includes(:contact)

        render json: {
          success: true,
          data: contacts.map { |c| serialize_case_contact(c) }
        }
      end

      # GET /api/v1/cases/:id/companies
      def companies
        companies = @case.case_companies.includes(:company)

        render json: {
          success: true,
          data: companies.map { |c| serialize_case_company(c) }
        }
      end

      # GET /api/v1/cases/:id/jobs
      def jobs
        jobs = @case.case_jobs.includes(:job)

        render json: {
          success: true,
          data: jobs.map { |j| serialize_case_job(j) }
        }
      end

      # ============================================
      # WAREHOUSE INTEGRATION ENDPOINTS
      # ============================================

      # GET /api/v1/cases/:id/warehouse_summary
      def warehouse_summary
        summary = @case.warehouse_service.generate_summary

        render json: {
          success: true,
          data: summary
        }
      end

      # GET /api/v1/cases/:id/search_emails
      def search_emails
        emails = @case.warehouse_service.search_emails(
          query: params[:q],
          date_range: parse_date_range,
          from_email: params[:from],
          job_id: params[:job_id]
        )

        render json: {
          success: true,
          data: emails.map { |e| serialize_email_warehouse(e) },
          meta: { count: emails.count }
        }
      end

      # GET /api/v1/cases/:id/search_documents
      def search_documents
        docs = @case.warehouse_service.search_documents(
          keywords: params[:q],
          document_type: params[:document_type],
          date_range: parse_date_range,
          verification_status: params[:verification_status]
        )

        render json: {
          success: true,
          data: docs,
          meta: { count: docs.count }
        }
      end

      # GET /api/v1/cases/:id/financial_analysis
      def financial_analysis
        service = @case.warehouse_service

        render json: {
          success: true,
          data: {
            job_metrics: service.job_metrics_for_entities,
            financial_summary: service.financial_summary,
            invoice_reconciliation: service.invoice_reconciliation,
            anomalies: service.financial_anomalies,
            inconsistencies: service.find_inconsistencies.select { |i| i[:type].include?('financial') }
          }
        }
      end

      # POST /api/v1/cases/:id/build_timeline
      # Builds timeline from warehouse data and saves events to the case
      def build_timeline
        timeline = @case.warehouse_service.build_timeline(
          start_date: params[:start_date]&.to_date,
          end_date: params[:end_date]&.to_date
        )

        # Save timeline events to database
        saved_events = []
        timeline.each do |event|
          next if event[:date].blank?

          existing = @case.case_timeline_events.find_by(
            event_date: event[:date],
            event_type: event[:type],
            source_type: event[:source_type],
            source_id: event[:source_id]
          )

          next if existing # Skip duplicates

          saved_event = @case.case_timeline_events.create!(
            event_date: event[:date],
            event_time: event[:time],
            event_type: event[:type],
            title: event[:title],
            description: event[:description],
            source_type: event[:source_type],
            source_id: event[:source_id],
            icon: event[:icon],
            color: event[:color],
            is_auto_generated: true,
            metadata: event[:metadata]
          )
          saved_events << saved_event
        end

        render json: {
          success: true,
          data: @case.case_timeline_events.chronological.map { |e| serialize_timeline_event(e) },
          meta: {
            total: @case.case_timeline_events.count,
            new: saved_events.count,
            from_warehouse: timeline.count
          }
        }
      end

      # ============================================
      # ADD ITEMS TO CASE
      # ============================================

      # POST /api/v1/cases/:id/add_document
      def add_document
        doc = CompanyDocument.find(params[:document_id])
        case_doc = @case.add_document(doc,
          relevance: params[:relevance] || 'supporting',
          notes: params[:notes],
          added_by: current_user
        )

        render json: { success: true, data: serialize_case_document(case_doc) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Document not found' }, status: :not_found
      end

      # POST /api/v1/cases/:id/add_email
      def add_email
        email = EmailWarehouse.find(params[:email_id])
        case_email = @case.add_email(email,
          relevance: params[:relevance] || 'supporting',
          notes: params[:notes],
          added_by: current_user
        )

        render json: { success: true, data: serialize_case_email(case_email) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Email not found' }, status: :not_found
      end

      # POST /api/v1/cases/:id/add_contact
      def add_contact
        contact = Contact.find(params[:contact_id])
        case_contact = @case.add_contact(contact,
          role: params[:role] || 'related_party',
          notes: params[:notes],
          is_primary: params[:is_primary] || false
        )

        render json: { success: true, data: serialize_case_contact(case_contact) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Contact not found' }, status: :not_found
      end

      # POST /api/v1/cases/:id/add_company
      def add_company
        company = Company.find(params[:company_id])
        case_company = @case.add_company(company,
          role: params[:role] || 'related_entity',
          notes: params[:notes],
          is_primary: params[:is_primary] || false
        )

        render json: { success: true, data: serialize_case_company(case_company) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Company not found' }, status: :not_found
      end

      # POST /api/v1/cases/:id/add_job
      def add_job
        job = Job.find(params[:job_id])
        case_job = @case.add_job(job,
          relevance: params[:relevance] || 'direct',
          notes: params[:notes]
        )

        render json: { success: true, data: serialize_case_job(case_job) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Job not found' }, status: :not_found
      end

      # ============================================
      # RUN ACTIONS
      # ============================================

      # POST /api/v1/cases/:id/run_action
      def run_action
        action = @case.case_actions.create!(
          action_type: params[:action_type],
          query: params[:query],
          parameters: params[:parameters] || {},
          created_by: current_user,
          status: 'pending'
        )

        # Execute synchronously for now (could be async with job)
        execute_action(action)

        render json: { success: true, data: serialize_action(action) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # ============================================
      # STATIC DATA
      # ============================================

      # GET /api/v1/cases/types
      def types
        render json: {
          success: true,
          data: {
            case_types: CaseRecord::CASE_TYPES,
            statuses: CaseRecord::STATUSES,
            priorities: CaseRecord::PRIORITIES,
            action_types: CaseAction::ACTION_TYPES
          }
        }
      end

      private

      def set_case
        @case = CaseRecord.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Case not found' }, status: :not_found
      end

      def case_params
        params.require(:case).permit(
          :title, :case_type, :description, :status, :priority,
          :contact_id, :company_id, :company_group_id,
          :deadline, :assigned_to_id,
          :investigation_start_date, :investigation_end_date,
          metadata: {}
        )
      end

      def parse_date_range
        return nil unless params[:start_date] || params[:end_date]
        {
          start: params[:start_date]&.to_date,
          end: params[:end_date]&.to_date
        }
      end

      # Execute a case action
      def execute_action(action)
        action.start!

        begin
          service = @case.warehouse_service

          results = case action.action_type
                    when 'document_search'
                      service.search_documents(
                        keywords: action.parameters['keywords'] || action.query,
                        document_type: action.parameters['document_type'],
                        date_range: action.parameters['date_range']
                      )
                    when 'email_search'
                      service.search_emails(
                        query: action.parameters['query'] || action.query,
                        date_range: action.parameters['date_range']
                      ).map { |e| serialize_email_warehouse(e) }
                    when 'timeline_build'
                      service.build_timeline(
                        start_date: action.parameters['start_date']&.to_date,
                        end_date: action.parameters['end_date']&.to_date
                      )
                    when 'financial_analysis'
                      {
                        job_metrics: service.job_metrics_for_entities,
                        financial_summary: service.financial_summary,
                        anomalies: service.financial_anomalies,
                        reconciliation: service.invoice_reconciliation
                      }
                    when 'invoice_reconciliation'
                      service.invoice_reconciliation
                    when 'document_completeness'
                      service.document_completeness
                    when 'resource_audit'
                      {
                        resource_utilization: service.resource_utilization,
                        task_metrics: service.task_metrics
                      }
                    when 'entity_analysis'
                      contact_id = action.parameters['contact_id']
                      company_id = action.parameters['company_id']
                      if contact_id
                        service.analyze_contact(contact_id)
                      elsif company_id
                        service.analyze_company(company_id)
                      else
                        { error: 'No contact_id or company_id provided' }
                      end
                    when 'inconsistency_check'
                      service.find_inconsistencies
                    when 'summary_report'
                      service.generate_summary
                    else
                      { message: "Action type '#{action.action_type}' not implemented" }
                    end

          action.complete!(
            results: results,
            result_count: results.is_a?(Array) ? results.count : 1
          )
        rescue StandardError => e
          action.fail!(e.message)
          Rails.logger.error("[CaseAction] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
        end
      end

      # ============================================
      # SERIALIZERS
      # ============================================

      def serialize_case_list(c)
        {
          id: c.id,
          case_number: c.case_number,
          title: c.title,
          case_type: c.case_type,
          formatted_case_type: c.formatted_case_type,
          status: c.status,
          formatted_status: c.formatted_status,
          priority: c.priority,
          formatted_priority: c.formatted_priority,
          deadline: c.deadline,
          overdue: c.overdue?,
          days_until_deadline: c.days_until_deadline,
          primary_entity_name: c.primary_entity_name,
          assigned_to: c.assigned_to&.name,
          created_by: c.created_by&.name,
          actions_count: c.case_actions.count,
          documents_count: c.case_documents.count,
          created_at: c.created_at
        }
      end

      def serialize_case_detail(c)
        serialize_case_list(c).merge(
          description: c.description,
          contact_id: c.contact_id,
          contact_name: c.contact&.full_name,
          company_id: c.company_id,
          company_name: c.company&.name,
          company_group_id: c.company_group_id,
          company_group_name: c.company_group&.name,
          investigation_start_date: c.investigation_start_date,
          investigation_end_date: c.investigation_end_date,
          ai_summary: c.ai_summary,
          key_findings: c.key_findings,
          risk_score: c.risk_score,
          metadata: c.metadata,
          emails_count: c.case_emails.count,
          contacts_count: c.case_contacts.count,
          companies_count: c.case_companies.count,
          jobs_count: c.case_jobs.count,
          timeline_events_count: c.case_timeline_events.count,
          updated_at: c.updated_at
        )
      end

      def serialize_action(a)
        {
          id: a.id,
          action_type: a.action_type,
          action_name: a.action_name,
          action_description: a.action_description,
          status: a.status,
          query: a.query,
          parameters: a.parameters,
          results: a.results,
          ai_analysis: a.ai_analysis,
          inconsistencies: a.inconsistencies,
          result_count: a.result_count,
          error_message: a.error_message,
          execution_time: a.formatted_execution_time,
          created_by: a.created_by&.name,
          started_at: a.started_at,
          completed_at: a.completed_at,
          created_at: a.created_at
        }
      end

      def serialize_case_document(cd)
        doc = cd.company_document
        {
          id: cd.id,
          company_document_id: cd.company_document_id,
          title: doc.title,
          filename: doc.filename,
          document_type: doc.document_type,
          relevance: cd.relevance,
          formatted_relevance: cd.formatted_relevance,
          notes: cd.notes,
          sequence: cd.sequence,
          ai_tags: cd.ai_tags,
          ai_summary: cd.ai_summary,
          relevance_score: cd.relevance_score,
          added_by: cd.added_by&.name,
          document_date: doc.document_date,
          file_size: doc.file_size,
          created_at: cd.created_at
        }
      end

      def serialize_case_email(ce)
        email = ce.email_warehouse
        {
          id: ce.id,
          email_warehouse_id: ce.email_warehouse_id,
          subject: email.subject,
          from_email: email.from_email,
          to_emails: email.to_emails || [],
          relevance: ce.relevance,
          formatted_relevance: ce.formatted_relevance,
          notes: ce.notes,
          sequence: ce.sequence,
          ai_tags: ce.ai_tags,
          ai_summary: ce.ai_summary,
          relevance_score: ce.relevance_score,
          added_by: ce.added_by&.name,
          received_at: email.received_at,
          has_attachments: email.has_attachments || false,
          created_at: ce.created_at
        }
      end

      def serialize_timeline_event(e)
        {
          id: e.id,
          event_date: e.event_date,
          event_time: e.event_time,
          event_type: e.event_type,
          event_name: e.event_name,
          title: e.title,
          description: e.description,
          source_type: e.source_type,
          source_id: e.source_id,
          icon: e.display_icon,
          color: e.display_color,
          is_auto_generated: e.is_auto_generated,
          formatted_date: e.formatted_date,
          formatted_datetime: e.formatted_datetime,
          contact_id: e.contact_id,
          company_id: e.company_id,
          job_id: e.job_id
        }
      end

      def serialize_case_contact(cc)
        {
          id: cc.id,
          contact_id: cc.contact_id,
          contact_name: cc.contact.full_name,
          contact_email: cc.contact.email,
          contact_entity_type: cc.contact.entity_type,
          role: cc.role,
          formatted_role: cc.formatted_role,
          notes: cc.notes,
          is_primary: cc.is_primary
        }
      end

      def serialize_case_company(cc)
        company = cc.company
        {
          id: cc.id,
          company_id: cc.company_id,
          company_name: company.name,
          abn: company.abn,
          acn: company.acn,
          entity_type: company.entity_type,
          role: cc.role,
          formatted_role: cc.formatted_role,
          notes: cc.notes,
          is_primary: cc.is_primary,
          created_at: cc.created_at
        }
      end

      def serialize_case_job(cj)
        job = cj.job
        {
          id: cj.id,
          job_id: cj.job_id,
          job_number: job.job_number,
          job_title: job.title,
          job_status: job.job_status&.name,
          client_name: job.client_name,
          role: cj.relevance,
          formatted_relevance: cj.formatted_relevance,
          notes: cj.notes,
          created_at: cj.created_at
        }
      end

      def serialize_email_warehouse(e)
        {
          id: e.id,
          subject: e.subject,
          from_email: e.from_email,
          from_name: e.from_name,
          to_emails: e.to_emails,
          cc_emails: e.cc_emails,
          received_at: e.received_at,
          has_attachments: e.has_attachments,
          attachment_count: e.attachment_count,
          preview: e.preview_body(length: 200),
          job_id: e.job_id,
          conversation_id: e.conversation_id,
          thread_count: e.thread_count
        }
      end
    end
  end
end
