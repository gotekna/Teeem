module Api
  module V1
    class CasesController < ApplicationController
      before_action :set_case, only: [
        :show, :update, :destroy,
        :actions, :documents, :emails, :timeline, :contacts, :companies, :jobs,
        :warehouse_summary, :search_emails, :search_documents, :financial_analysis,
        :add_document, :add_email, :add_contact, :add_company, :add_job,
        :run_action, :relationship_graph, :update_contact_position, :create_child,
        :qa_pairs, :duplicates, :resolve_duplicate, :processing_status,
        :reprocess_documents, :update_qa_pair, :update_folder_settings,
        :folder_info, :create_folder, :get_case_contact, :update_case_contact,
        :remove_contact
      ]

      # GET /api/v1/cases
      def index
        cases = CaseRecord.includes(:contact, :corporate, :assigned_to, :created_by)

        # Filter by status
        cases = cases.by_status(params[:status]) if params[:status].present?

        # Filter by type
        cases = cases.by_type(params[:case_type]) if params[:case_type].present?

        # Filter by priority
        cases = cases.by_priority(params[:priority]) if params[:priority].present?

        # Filter by assigned user
        cases = cases.assigned_to_user(params[:assigned_to]) if params[:assigned_to].present?

        # Filter overdue
        cases = cases.overdue if params[:overdue] == "true"

        # Search using SSoT SearchService
        if params[:search].present?
          cases = SearchService.apply(
            cases,
            params[:search],
            columns: %w[title case_number],
            mode: params[:search_mode] || 'contains',
            model: CaseRecord
          )
        end

        # Sorting
        cases = case params[:sort]
        when "deadline" then cases.order(:deadline)
        when "priority" then cases.order(Arel.sql("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END"))
        when "created" then cases.order(created_at: :desc)
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

      # POST /api/v1/cases/:id/create_child
      # Create a sub-case under this case
      def create_child
        child_attrs = child_case_params.to_h
        child_attrs[:created_by] = current_user

        child = @case.create_child_case(child_attrs)

        render json: {
          success: true,
          data: serialize_case_detail(child),
          message: "Sub-case '#{child.title}' created under #{@case.case_number}"
        }, status: :created

      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          errors: e.record.errors.full_messages
        }, status: :unprocessable_entity
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
        emails = @case.case_emails.includes(:synced_email, :added_by).by_relevance

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
        companies = @case.case_companies.includes(:corporate)

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
          data: emails.map { |e| serialize_synced_email(e) },
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
            inconsistencies: service.find_inconsistencies.select { |i| i[:type].include?("financial") }
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
        doc = WarehouseDocument.find(params[:document_id])
        case_doc = @case.add_document(doc,
          relevance: params[:relevance] || "supporting",
          notes: params[:notes],
          added_by: current_user
        )

        render json: { success: true, data: serialize_case_document(case_doc) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Document not found" }, status: :not_found
      end

      # POST /api/v1/cases/:id/add_email
      def add_email
        email = SyncedEmail.find(params[:email_id])
        case_email = @case.add_email(email,
          relevance: params[:relevance] || "supporting",
          notes: params[:notes],
          added_by: current_user
        )

        render json: { success: true, data: serialize_case_email(case_email) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Email not found" }, status: :not_found
      end

      # POST /api/v1/cases/:id/add_contact
      def add_contact
        contact = Contact.find(params[:contact_id])

        # Validate reason is present
        if params[:reason].blank?
          render json: {
            success: false,
            error: "Reason is required when adding a contact to a case"
          }, status: :unprocessable_entity
          return
        end

        case_contact = @case.add_contact(contact,
          role: params[:role] || "related_party",
          notes: params[:notes],
          is_primary: params[:is_primary] || false,
          reason: params[:reason],
          added_by: current_user
        )

        render json: { success: true, data: serialize_case_contact(case_contact) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/cases/:id/add_company
      def add_company
        company = Corporate.find(params[:company_id])
        case_company = @case.add_company(company,
          role: params[:role] || "related_entity",
          notes: params[:notes],
          is_primary: params[:is_primary] || false
        )

        render json: { success: true, data: serialize_case_company(case_company) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Company not found" }, status: :not_found
      end

      # POST /api/v1/cases/:id/add_job
      def add_job
        job = Job.find(params[:job_id])
        case_job = @case.add_job(job,
          relevance: params[:relevance] || "direct",
          notes: params[:notes]
        )

        render json: { success: true, data: serialize_case_job(case_job) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Job not found" }, status: :not_found
      end

      # ============================================
      # RELATIONSHIP GRAPH
      # ============================================

      # GET /api/v1/cases/:id/relationship_graph
      # Returns nodes and edges for the relationship visualization chart
      def relationship_graph
        service = CaseRelationshipService.new(@case)
        graph = service.build_relationship_graph

        render json: {
          success: true,
          data: graph
        }
      end

      # PATCH /api/v1/cases/:id/contacts/:contact_id/position
      # Update a contact's position on the relationship chart
      def update_contact_position
        case_contact = @case.case_contacts.find_by!(contact_id: params[:contact_id])

        case_contact.update_chart_position!(
          x: params[:x].to_f,
          y: params[:y].to_f
        )

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not linked to this case" }, status: :not_found
      end

      # GET /api/v1/cases/:id/contacts/:contact_id
      # Get case contact details for editing
      def get_case_contact
        case_contact = @case.case_contacts.includes(:contact).find_by!(contact_id: params[:contact_id])
        contact = case_contact.contact

        render json: {
          success: true,
          case_contact: {
            id: case_contact.id,
            contact_id: contact.id,
            contact_name: contact.display_name,
            contact_email: contact.email,
            relationship_type: case_contact.relationship_type,
            alignment: case_contact.alignment,
            role: case_contact.role,
            is_primary: case_contact.is_primary,
            notes: case_contact.notes
          },
          relationship_types: CaseContact::RELATIONSHIP_TYPES.map { |k, v| { value: k, label: v[:name] } },
          alignments: CaseContact::ALIGNMENTS.map { |k, v| { value: k, label: v[:name] } },
          roles: CaseContact::ROLES.map { |k, v| { value: k, label: v } }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not linked to this case" }, status: :not_found
      end

      # PATCH /api/v1/cases/:id/contacts/:contact_id
      # Update case contact relationship details
      def update_case_contact
        case_contact = @case.case_contacts.find_by!(contact_id: params[:contact_id])

        if case_contact.update(case_contact_params)
          # Calculate auto-linked email count
          auto_linked_count = @case.case_emails
            .where(auto_linked: true, auto_linked_via_contact_id: case_contact.contact_id)
            .count

          render json: {
            success: true,
            case_contact: {
              id: case_contact.id,
              contact_id: case_contact.contact_id,
              relationship_type: case_contact.relationship_type,
              formatted_relationship_type: case_contact.formatted_relationship_type,
              alignment: case_contact.alignment,
              formatted_alignment: case_contact.formatted_alignment,
              role: case_contact.role,
              formatted_role: case_contact.formatted_role,
              is_primary: case_contact.is_primary,
              notes: case_contact.notes,
              include_all_emails: case_contact.include_all_emails,
              auto_linked_email_count: auto_linked_count
            }
          }
        else
          render json: {
            success: false,
            errors: case_contact.errors.full_messages
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not linked to this case" }, status: :not_found
      end

      # DELETE /api/v1/cases/:id/contacts/:contact_id
      # Remove contact from case and delete all case_emails involving this contact
      def remove_contact
        contact = Contact.find(params[:contact_id])

        # Check if contact is actually linked to this case
        case_contact = @case.case_contacts.find_by(contact: contact)
        unless case_contact
          render json: { success: false, error: "Contact not linked to this case" }, status: :not_found
          return
        end

        # Remove the contact and related emails
        @case.remove_contact(contact)

        render json: {
          success: true,
          message: "Contact removed from case. All related emails were also removed."
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      # ============================================
      # DOCUMENT MANAGEMENT ENDPOINTS
      # ============================================

      # GET /api/v1/cases/:id/qa_pairs
      def qa_pairs
        qa = @case.case_email_qas.includes(:case_email, :synced_email).order(created_at: :desc)

        qa = qa.answered if params[:answered] == "true"
        qa = qa.unanswered if params[:answered] == "false"
        qa = qa.important if params[:important] == "true"
        qa = qa.by_category(params[:category]) if params[:category].present?

        render json: {
          success: true,
          data: qa.map { |q| serialize_qa_pair(q) },
          meta: {
            total: qa.count,
            unanswered: @case.case_email_qas.unanswered.count,
            important_unanswered: @case.case_email_qas.unanswered.important.count
          }
        }
      end

      # GET /api/v1/cases/:id/duplicates
      def duplicates
        reviews = @case.document_duplicate_reviews.includes(:existing_document, :new_document, :resolved_by)

        reviews = reviews.pending if params[:status] == "pending"
        reviews = reviews.resolved if params[:status] == "resolved"

        render json: {
          success: true,
          data: reviews.map { |r| serialize_duplicate_review(r) },
          meta: {
            total: reviews.count,
            pending: @case.document_duplicate_reviews.pending.count,
            resolved: @case.document_duplicate_reviews.resolved.count
          }
        }
      end

      # POST /api/v1/cases/:id/resolve_duplicate
      def resolve_duplicate
        review = @case.document_duplicate_reviews.find(params[:review_id])

        case params[:resolution]
        when "keep_existing"
          review.keep_existing!(current_user)
        when "replace"
          review.replace!(current_user)
        when "keep_both"
          # SSoT: Folder path comes from WarehouseProvider template (warehouse_folders['case'])
          # Use resolve_virtual_path for WarehouseDocument.folder_path (UI display)
          new_doc = WarehouseDocumentCreator.create!(
            filename: review.new_file_name,
            source_type: "corporate",
            documentable: @case.corporate,
            linkable: @case.corporate,
            file_size: review.new_file_size,
            content_type: Marcel::MimeType.for(name: review.new_file_name)
          )
          review.keep_both!(current_user, new_doc)
        else
          render json: { success: false, error: "Invalid resolution" }, status: :unprocessable_entity
          return
        end

        render json: { success: true, data: serialize_duplicate_review(review) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Duplicate review not found" }, status: :not_found
      end

      # GET /api/v1/cases/:id/processing_status
      def processing_status
        render json: {
          success: true,
          data: {
            status: @case.document_processing_status,
            documents_count: @case.case_documents.count,
            emails_count: @case.case_emails.count,
            unanswered_questions_count: @case.unanswered_questions_count,
            pending_duplicates_count: @case.document_duplicate_reviews.pending.count,
            source_folder_paths: @case.source_folder_paths,
            filing_folder_paths: @case.filing_folder_paths,
            file_action: @case.file_action
          }
        }
      end

      # POST /api/v1/cases/:id/reprocess_documents
      def reprocess_documents
        @case.update!(document_processing_status: "pending")
        CaseDocumentProcessingJob.perform_later(@case.id)

        render json: { success: true, message: "Document processing job queued" }
      end

      # PATCH /api/v1/cases/:id/folder_settings
      # Update source/filing folder configuration
      def update_folder_settings
        @case.update!(
          source_folder_paths: params[:source_folder_paths] || @case.source_folder_paths,
          filing_folder_paths: params[:filing_folder_paths] || @case.filing_folder_paths,
          file_action: params[:file_action] || @case.file_action
        )

        render json: {
          success: true,
          data: {
            source_folder_paths: @case.source_folder_paths,
            filing_folder_paths: @case.filing_folder_paths,
            file_action: @case.file_action
          },
          message: "Folder settings updated"
        }
      end

      # PATCH /api/v1/cases/:id/qa_pairs/:qa_id
      def update_qa_pair
        qa = @case.case_email_qas.find(params[:qa_id])

        if params[:is_answered].present?
          if ActiveModel::Type::Boolean.new.cast(params[:is_answered])
            qa.mark_answered!(answer: params[:answer], answer_from: params[:answer_from])
          else
            qa.update!(is_answered: false, answer: nil, answer_from: nil, answer_date: nil)
          end
        end

        if params[:is_important].present?
          if ActiveModel::Type::Boolean.new.cast(params[:is_important])
            qa.mark_important!
          else
            qa.update!(is_important: false)
          end
        end

        render json: { success: true, data: serialize_qa_pair(qa) }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Q&A pair not found" }, status: :not_found
      end

      # ============================================
      # ONEDRIVE FOLDER MANAGEMENT
      # ============================================

      # POST /api/v1/cases/:id/create_folder
      # Creates a dedicated OneDrive folder for this case under Corporate/Case Info
      def create_folder
        service = CaseFolderService.new(@case)
        folder = service.create_case_folder

        if folder
          render json: {
            success: true,
            data: {
              folder_id: folder["id"],
              folder_name: folder["name"],
              folder_path: @case.storage_folder_path,
              web_url: folder["webUrl"]
            },
            message: "Case folder created successfully"
          }
        else
          render json: {
            success: false,
            error: "Failed to create folder. Make sure SharePoint is connected."
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/cases/:id/folder_info
      # Get information about the case's storage folder
      def folder_info
        if @case.storage_folder_id.blank?
          render json: {
            success: true,
            data: { has_folder: false }
          }
          return
        end

        service = CaseFolderService.new(@case)
        folder = service.get_case_folder

        if folder
          render json: {
            success: true,
            data: {
              has_folder: true,
              folder_id: folder["id"],
              folder_name: folder["name"],
              folder_path: @case.storage_folder_path,
              web_url: folder["webUrl"]
            }
          }
        else
          # Folder ID exists but folder not found (may have been deleted)
          render json: {
            success: true,
            data: {
              has_folder: false,
              folder_missing: true,
              message: "Folder was deleted from storage"
            }
          }
        end
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
          status: "pending"
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
        render json: { success: false, error: "Case not found" }, status: :not_found
      end

      def case_params
        params.require(:case).permit(
          :title, :case_type, :description, :status, :priority,
          :contact_id, :company_id, :company_group_id,
          :deadline, :assigned_to_id,
          :investigation_start_date, :investigation_end_date,
          :parent_case_id,
          metadata: {}
        )
      end

      def child_case_params
        # For creating child cases - title is required, others are optional
        # (will inherit from parent if not provided)
        params.require(:case).permit(
          :title, :case_type, :description, :status, :priority,
          :deadline, :assigned_to_id
        )
      end

      def case_contact_params
        params.require(:case_contact).permit(
          :relationship_type, :alignment, :role, :is_primary, :notes, :reason,
          :include_all_emails
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
          when "document_search"
                      service.search_documents(
                        keywords: action.parameters["keywords"] || action.query,
                        document_type: action.parameters["document_type"],
                        date_range: action.parameters["date_range"]
                      )
          when "email_search"
                      service.search_emails(
                        query: action.parameters["query"] || action.query,
                        date_range: action.parameters["date_range"]
                      ).map { |e| serialize_synced_email(e) }
          when "timeline_build"
                      service.build_timeline(
                        start_date: action.parameters["start_date"]&.to_date,
                        end_date: action.parameters["end_date"]&.to_date
                      )
          when "financial_analysis"
                      {
                        job_metrics: service.job_metrics_for_entities,
                        financial_summary: service.financial_summary,
                        anomalies: service.financial_anomalies,
                        reconciliation: service.invoice_reconciliation
                      }
          when "invoice_reconciliation"
                      service.invoice_reconciliation
          when "document_completeness"
                      service.document_completeness
          when "resource_audit"
                      {
                        resource_utilization: service.resource_utilization,
                        task_metrics: service.task_metrics
                      }
          when "entity_analysis"
                      contact_id = action.parameters["contact_id"]
                      company_id = action.parameters["company_id"]
                      if contact_id
                        service.analyze_contact(contact_id)
                      elsif company_id
                        service.analyze_company(company_id)
                      else
                        { error: "No contact_id or company_id provided" }
                      end
          when "inconsistency_check"
                      service.find_inconsistencies
          when "summary_report"
                      service.generate_summary
          when "full_analysis"
                      execute_full_analysis(action, service)
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

      # Execute full case analysis - imports emails, extracts entities, Q&A, timeline, links
      def execute_full_analysis(action, warehouse_service)
        results = {
          emails_imported: 0,
          emails_skipped: 0,
          entities_extracted: { contacts: 0, companies: 0 },
          qa_extracted: { total: 0, unanswered: 0 },
          timeline_events: 0,
          links_found: [],
          steps_completed: []
        }

        # Step 1: Import relevant emails from warehouse based on case entities
        Rails.logger.info "[FullAnalysis] Step 1: Importing emails for case #{@case.id}"
        emails = warehouse_service.search_emails(query: nil) # Gets all by related entities
        emails.each do |email|
          # Skip if already linked to case
          if @case.case_emails.exists?(email_warehouse_id: email.id)
            results[:emails_skipped] += 1
            next
          end

          @case.add_email(email, relevance: "supporting", added_by: current_user)
          results[:emails_imported] += 1
        end
        results[:steps_completed] << "email_import"

        # Step 2: Extract entities (contacts/companies) from imported emails using AI
        Rails.logger.info "[FullAnalysis] Step 2: Extracting entities for case #{@case.id}"
        @case.case_emails.includes(:synced_email).each do |case_email|
          email = case_email.email_warehouse
          next unless email

          # Extract contacts from email addresses
          extract_contacts_from_email(email, results)
        end
        results[:steps_completed] << "entity_extraction"

        # Step 3: Extract Q&A from emails
        Rails.logger.info "[FullAnalysis] Step 3: Extracting Q&A for case #{@case.id}"
        begin
          qa_service = CaseQaExtractionService.new(@case)
          qa_results = qa_service.extract_all
          results[:qa_extracted] = {
            total: qa_results[:questions_found],
            unanswered: qa_results[:unanswered]
          }
        rescue => e
          Rails.logger.error "[FullAnalysis] Q&A extraction failed: #{e.message}"
          results[:qa_extracted][:error] = e.message
        end
        results[:steps_completed] << "qa_extraction"

        # Step 4: Build timeline from all sources
        Rails.logger.info "[FullAnalysis] Step 4: Building timeline for case #{@case.id}"
        timeline = warehouse_service.build_timeline
        timeline.each do |event|
          next if event[:date].blank?

          # Skip duplicates
          existing = @case.case_timeline_events.find_by(
            event_date: event[:date],
            event_type: event[:type],
            source_type: event[:source_type],
            source_id: event[:source_id]
          )
          next if existing

          @case.case_timeline_events.create!(
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
          results[:timeline_events] += 1
        end
        results[:steps_completed] << "timeline_build"

        # Step 5: Extract links/URLs from email bodies
        Rails.logger.info "[FullAnalysis] Step 5: Extracting links for case #{@case.id}"
        results[:links_found] = extract_links_from_case_emails
        results[:steps_completed] << "link_extraction"

        Rails.logger.info "[FullAnalysis] Complete for case #{@case.id}: #{results.inspect}"
        results
      end

      # Extract contacts from email addresses and add to case
      def extract_contacts_from_email(email, results)
        # Collect all email addresses from this email
        all_emails = [ email.from_email ]
        all_emails += email.to_emails if email.to_emails.present?
        all_emails += email.cc_emails if email.cc_emails.present?
        all_emails = all_emails.compact.uniq

        all_emails.each do |email_address|
          next if email_address.blank?

          # Skip if contact already linked to case
          contact = Contact.find_by(email: email_address)

          if contact
            # Link existing contact to case if not already linked
            unless @case.case_contacts.exists?(contact_id: contact.id)
              @case.add_contact(contact, role: "related_party")
              results[:entities_extracted][:contacts] += 1
            end
          end
        end
      end

      # Extract HTTP/HTTPS URLs and file paths from case emails
      def extract_links_from_case_emails
        links = []

        @case.case_emails.includes(:synced_email).each do |case_email|
          email = case_email.email_warehouse
          next unless email

          body = email.body_text.presence || email.body_html
          next if body.blank?

          # Extract HTTP/HTTPS URLs
          urls = body.scan(%r{https?://[^\s<>"']+})
          urls.each do |url|
            # Clean up trailing punctuation
            clean_url = url.gsub(/[.,;:!?)]+$/, "")
            links << {
              type: "url",
              value: clean_url,
              email_id: email.id,
              email_subject: email.subject
            }
          end

          # Extract OneDrive/SharePoint links specifically
          onedrive_links = body.scan(%r{https://[^\s]*(?:sharepoint\.com|onedrive\.live\.com)[^\s<>"']*})
          onedrive_links.each do |link|
            clean_link = link.gsub(/[.,;:!?)]+$/, "")
            links << {
              type: "onedrive",
              value: clean_link,
              email_id: email.id,
              email_subject: email.subject
            }
          end

          # Extract file path references (Windows and Unix style)
          # Looks for paths like C:\..., \\server\..., /path/to/...
          file_paths = body.scan(%r{(?:[A-Za-z]:\\[^\s<>"']+|\\\\[^\s<>"']+|/(?:Users|home|var|tmp|documents?|files?)/[^\s<>"']+)}i)
          file_paths.each do |path|
            links << {
              type: "file_path",
              value: path,
              email_id: email.id,
              email_subject: email.subject
            }
          end
        end

        links.uniq { |l| l[:value] }
      end

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
          contact_name: c.contact&.display_name,
          company_id: c.company_id,
          company_name: c.corporate&.name,
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
          updated_at: c.updated_at,

          # Hierarchy info
          parent_case_id: c.parent_case_id,
          parent_case_number: c.parent_case&.case_number,
          parent_case_title: c.parent_case&.title,
          hierarchy_level: c.hierarchy_level,
          is_child_case: c.child_case?,
          has_children: c.has_children?,
          child_cases_count: c.child_cases.count,
          child_cases_summary: c.child_cases_summary,
          child_cases: c.child_cases.recent_first.map { |child| serialize_child_case(child) },

          # Folder settings
          source_folder_paths: c.source_folder_paths || [],
          filing_folder_paths: c.filing_folder_paths || [],
          file_action: c.file_action || "copy"
        )
      end

      def serialize_child_case(c)
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
          assigned_to: c.assigned_to&.name,
          has_children: c.has_children?,
          child_cases_count: c.child_cases.count,
          created_at: c.created_at
        }
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
          synced_email_id: ce.email_warehouse_id,
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
          contact_name: cc.contact.display_name,
          contact_email: cc.contact.email,
          contact_phone: cc.contact.mobile_phone || cc.contact.office_phone,
          contact_company: cc.contact.company_name_or_trust,
          contact_entity_type: cc.contact.entity_type,
          role: cc.role,
          formatted_role: cc.formatted_role,
          relationship_type: cc.relationship_type,
          formatted_relationship_type: cc.formatted_relationship_type,
          relationship_color: cc.relationship_color,
          relationship_icon: cc.relationship_icon,
          relationship_description: cc.relationship_description,
          alignment: cc.alignment,
          formatted_alignment: cc.formatted_alignment,
          alignment_color: cc.alignment_color,
          alignment_icon: cc.alignment_icon,
          notes: cc.notes,
          is_primary: cc.is_primary,
          display_position: cc.display_position,
          reason: cc.reason,
          added_by_name: cc.added_by&.name,
          added_at: cc.created_at,
          email_count: cc.email_count
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

      def serialize_synced_email(e)
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

      def serialize_qa_pair(qa)
        {
          id: qa.id,
          question: qa.question,
          answer: qa.answer,
          question_from: qa.question_from,
          answer_from: qa.answer_from,
          question_date: qa.question_date,
          answer_date: qa.answer_date,
          is_answered: qa.is_answered,
          is_important: qa.is_important,
          category: qa.category,
          formatted_category: qa.category&.titleize,
          case_email_id: qa.case_email_id,
          email_subject: qa.synced_email&.subject,
          email_short_code: qa.case_email&.short_code,
          created_at: qa.created_at
        }
      end

      def serialize_duplicate_review(r)
        existing = r.existing_document
        new_doc = r.new_document
        {
          id: r.id,
          status: r.status,
          resolution: r.resolution,
          existing_document_id: r.existing_document_id,
          existing_title: existing&.title,
          existing_filename: existing&.filename,
          existing_storage_path: existing&.expected_storage_path,
          existing_file_size: existing&.file_size,
          existing_document_date: existing&.document_date,
          new_file_path: r.new_file_path,
          new_file_name: r.new_file_name,
          new_file_hash: r.new_file_hash,
          new_file_size: r.new_file_size,
          source_type: r.source_type,
          new_document_id: r.new_document_id,
          new_document_title: new_doc&.title,
          resolved_by: r.resolved_by&.name,
          resolved_at: r.resolved_at,
          created_at: r.created_at
        }
      end
    end
  end
end
