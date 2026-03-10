module Api
  module V1
    class JobsController < ApplicationController
      include AsyncPdfGeneration

      before_action :set_job, only: [ :show, :update, :destroy, :saved_messages, :emails, :sms_messages, :documentation_tabs, :import_xero_bills, :link_xero_tracking, :xero_tracking_options, :xero_profit_loss, :finance_counts, :activities, :budget_tracking, :boq, :price_analysis, :merge, :update_stage, :mark_lost, :upload_plan_set, :plan_set, :rename_plans, :generate_contract, :save_contract, :send_contract_for_signing, :create_storage_folders, :markup, :update_markup, :target_margin ]

      # GET /api/v1/jobs/pipeline
      # Returns jobs with Enquiry status grouped by stage for the pipeline view
      def pipeline
        enquiry_status = JobStatus.find_by(name: "Enquiry")

        # Get all enquiry stages
        enquiry_stages = JobStage.where(job_status_id: enquiry_status&.id).order(:position)

        # Get all jobs with Enquiry status
        # SSoT: Use Job.with_contacts scope for standard includes
        jobs = Job.with_contacts
                  .where(job_status_id: enquiry_status&.id)
                  .order(created_at: :desc)

        # Group jobs by stage - single pass O(N) instead of O(N*M)
        # Performance: Uses Ruby group_by once instead of nested filtering
        jobs_grouped = jobs.group_by(&:job_stage_id)

        jobs_by_stage = {}
        enquiry_stages.each do |stage|
          stage_jobs = jobs_grouped[stage.id] || []
          jobs_by_stage[stage.name.downcase.gsub(" ", "_")] = stage_jobs.map { |job| pipeline_job_to_json(job) }
        end

        # Add jobs without a stage to "needs_pricing" (first stage)
        no_stage_jobs = jobs_grouped[nil] || []
        jobs_by_stage["needs_pricing"] ||= []
        jobs_by_stage["needs_pricing"] = no_stage_jobs.map { |job| pipeline_job_to_json(job) } + jobs_by_stage["needs_pricing"]

        # Initialize won array as empty (won jobs move to Pre Contract status)
        jobs_by_stage["won"] = []
        # Ensure lost array exists (should be populated from enquiry_stages if Lost stage exists)
        jobs_by_stage["lost"] ||= []

        # For stats, we can still count won/lost from other statuses
        won_statuses = JobStatus.where(name: [ "Pre Contract", "Contract", "Pre Start", "Active Job", "Handover", "Archived" ])
        won_jobs = Job.where(job_status_id: won_statuses.pluck(:id))
                      .where("created_at > ?", 30.days.ago)

        lost_statuses = JobStatus.where("name LIKE ?", "%Lost%")
        lost_jobs = Job.where(job_status_id: lost_statuses.pluck(:id))
                       .where("created_at > ?", 30.days.ago)

        # Calculate stats
        # SSoT: contract_price is THE ONE
        # Performance: Use SQL SUM instead of Ruby block
        total_pipeline_value = jobs.sum(:contract_price) || 0
        won_value = won_jobs.sum(:contract_price) || 0

        render json: {
          success: true,
          jobs_by_stage: jobs_by_stage,
          stages: enquiry_stages.map { |s| { id: s.id, name: s.name, position: s.position } },
          meta: {
            total_count: jobs.count,
            total_pipeline_value: total_pipeline_value,
            won_count: won_jobs.count,
            won_value: won_value,
            lost_count: lost_jobs.count
          }
        }
      end

      # PATCH /api/v1/jobs/:id/stage
      # Update job stage (for drag-and-drop in pipeline)
      def update_stage
        stage_name = params[:stage]

        if stage_name == "won"
          # Move to Pre Contract status
          pre_contract = JobStatus.find_by(name: "Pre Contract")
          if @job.update(job_status_id: pre_contract&.id, job_stage_id: nil)
            render json: { success: true, job: pipeline_job_to_json(@job) }
          else
            render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
          end
        else
          # Find the stage by name
          enquiry_status = JobStatus.find_by(name: "Enquiry")
          stage = JobStage.find_by(job_status_id: enquiry_status&.id, name: stage_name.titleize.gsub("_", " "))

          unless stage
            return render_error("Invalid stage: #{stage_name}", status: :unprocessable_entity)
          end

          # Ensure job is in Enquiry status
          @job.job_status_id = enquiry_status.id unless @job.job_status_id == enquiry_status&.id

          if @job.update(job_stage_id: stage.id)
            render json: { success: true, job: pipeline_job_to_json(@job) }
          else
            render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
          end
        end
      end

      # PATCH /api/v1/jobs/:id/mark_lost
      # Mark job as lost (changes status to "Lost - Pre Contract")
      def mark_lost
        lost_status = JobStatus.find_by(name: "Lost - Pre Contract")

        unless lost_status
          return render_error("Lost - Pre Contract status not found", status: :unprocessable_entity)
        end

        if @job.update(job_status_id: lost_status.id, job_stage_id: nil)
          render json: { success: true, job: pipeline_job_to_json(@job) }
        else
          render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/jobs/for_select
      # GET /api/v1/jobs/for_select?q=search_term
      # Lightweight endpoint for dropdowns - searchable by job name, client name, employee name,
      # AND employees of company contacts (two levels deep)
      def for_select
        search_term = params[:q].present? ? "%#{params[:q].downcase}%" : nil

        jobs = Job.joins(:job_status)
                  .includes(job_contacts: { contact: :employees })
                  .where.not(job_statuses: { name: ["Lost - Pre Contract", "Lost - Contract", "Archived"] })

        # Server-side search if query provided
        # Search: job name, direct contacts, AND employees of company contacts
        if search_term
          jobs = jobs.joins("LEFT OUTER JOIN job_contacts ON job_contacts.job_id = jobs.id")
                     .joins("LEFT OUTER JOIN contacts ON contacts.id = job_contacts.contact_id")
                     .joins("LEFT OUTER JOIN contacts AS company_employees ON company_employees.primary_company_id = contacts.id")
                     .where(
                       "LOWER(jobs.name) LIKE :q " \
                       "OR LOWER(contacts.display_name) LIKE :q " \
                       "OR LOWER(contacts.first_name) LIKE :q " \
                       "OR LOWER(contacts.last_name) LIKE :q " \
                       "OR LOWER(company_employees.display_name) LIKE :q " \
                       "OR LOWER(company_employees.first_name) LIKE :q " \
                       "OR LOWER(company_employees.last_name) LIKE :q",
                       q: search_term
                     )
                     .distinct
        end

        jobs = jobs.order(created_at: :desc).limit(100)

        # Default preview job: most recent job that has purchase orders (tenant-dynamic)
        default_preview_job = Job.joins(:purchase_orders)
                                 .where.not(purchase_orders: { status: "cancelled" })
                                 .order("purchase_orders.created_at DESC")
                                 .limit(1)
                                 .pick(:id)

        render json: {
          success: true,
          default_preview_job_id: default_preview_job,
          jobs: jobs.map do |job|
            clients = job.job_contacts.select { |jc| jc.role == "client" }.filter_map(&:contact)
            client = clients.first
            employees = job.job_contacts
                          .select { |jc| %w[coordinator estimator internal_sales site_coordinator supervisor].include?(jc.role) }
                          .map { |jc| jc.contact&.display_name || "#{jc.contact&.first_name} #{jc.contact&.last_name}".strip }
                          .compact
                          .reject(&:blank?)

            # Find which contact matched the search (for highlighting)
            # Check direct contacts first, then employees of company contacts
            matched_contact = nil
            if search_term && params[:q].present?
              query = params[:q].downcase

              # Check direct job contacts
              job.job_contacts.each do |jc|
                contact = jc.contact
                next unless contact
                contact_name = contact.display_name.presence || "#{contact.first_name} #{contact.last_name}".strip
                if contact_name.downcase.include?(query)
                  matched_contact = { name: contact_name, role: jc.role }
                  break
                end

                # Check employees of this contact (companies, trusts, etc. can have employees)
                if contact.employees.loaded? ? contact.employees.any? : contact.employees.exists?
                  contact.employees.each do |emp|
                    emp_name = emp.display_name.presence || "#{emp.first_name} #{emp.last_name}".strip
                    if emp_name.downcase.include?(query)
                      matched_contact = {
                        name: emp_name,
                        role: "employee_of",
                        company_name: contact_name
                      }
                      break
                    end
                  end
                end
                break if matched_contact
              end
            end

            {
              id: job.id,
              name: job.name,
              client_name: client&.display_name || "#{client&.first_name} #{client&.last_name}".strip.presence,
              client_names: clients.map { |c| c.display_name.presence || "#{c.first_name} #{c.last_name}".strip }.reject(&:blank?),
              employee_names: employees,
              matched_contact: matched_contact
            }
          end
        }
      end

      # GET /api/v1/jobs
      # GET /api/v1/jobs?status=Active
      # GET /api/v1/jobs?contact_id=123
      def index
        # SSoT: Use Job.with_lookups scope for standard includes
        @jobs = Job.with_lookups

        # Filter by contact_id if provided - only return jobs where this contact is a client
        # (not representative, broker, etc. - only actual client role)
        if params[:contact_id].present?
          @jobs = @jobs.joins(:job_contacts)
                       .where(job_contacts: { contact_id: params[:contact_id], role: "client" })
                       .distinct
        end

        # Filter by job_status.name if provided
        # Note: No default filter - frontend-next handles filtering via saved views
        if params[:status].present?
          @jobs = @jobs.joins(:job_status).where(job_status: { name: params[:status] })
        end

        # Filter by location presence if requested
        if params[:has_location] == "true"
          @jobs = @jobs.with_coordinates
        end

        # Search using SSoT SearchService
        if params[:search].present?
          search_columns = params[:search_all].to_s == "true" ? %w[name address] : %w[name]
          @jobs = SearchService.apply(
            @jobs,
            params[:search],
            columns: search_columns,
            mode: params[:search_mode] || 'contains',
            model: Job
          )
        end

        # Pagination
        page = params[:page]&.to_i || 1
        per_page = params[:per_page]&.to_i || 500

        # Get total count before limiting results
        total_count = @jobs.count
        total_pages = (total_count.to_f / per_page).ceil

        # Return all columns - no column limiting
        @jobs = @jobs.order(created_at: :desc)
                     .limit(per_page)
                     .offset((page - 1) * per_page)

        render json: {
          jobs: @jobs.as_json(
            include: {
              job_type: {},
              job_status: {},
              job_stage: {}
            }
          ),
          pagination: {
            current_page: page,
            total_pages: total_pages,
            total_count: total_count,
            per_page: per_page
          }
        }
      end

      # GET /api/v1/jobs/:id
      def show
        # Include contacts with their relationships in the response
        job_json = @job.as_json

        # SSoT: Include job_code for display (e.g., "J201")
        job_json[:job_code] = @job.job_code

        # Include job_type, job_status, and job_stage associations - all columns
        job_json[:job_type] = @job.job_type&.as_json
        job_json[:job_status] = @job.job_status&.as_json
        job_json[:job_stage] = @job.job_stage&.as_json
        job_json[:job_design] = @job.job_design&.as_json

        # Use already-eager-loaded job_contacts from set_job
        # Sort in Ruby since we already have the data loaded
        job_json[:contacts] = @job.job_contacts
                                                     .select { |jc| jc.contact_id.present? || jc.user_id.present? }
                                                     .sort_by { |jc| [jc.primary ? 0 : 1, jc.created_at] }
                                                     .map do |cc|
          contact_json = if cc.contact.present?
            cj = cc.contact.as_json
            # Include computed fields for frontend display (not in as_json by default)
            cj["full_address"] = cc.contact.full_address
            cj["primary_email"] = cc.contact.primary_email
            cj["primary_mobile"] = cc.contact.primary_mobile
            cj
          end

          {
            id: cc.id,
            contact_id: cc.contact_id,
            user_id: cc.user_id,
            primary: cc.primary,
            role: cc.role,
            contact: contact_json,
            # Include user info for internal roles (supervisor, internal_sales, etc.)
            user: cc.user.present? ? { id: cc.user.id, name: cc.user.name, email: cc.user.email } : nil,
            display_name: cc.person_name,
            # Use .size to use the already-loaded collection (not .count which triggers a query)
            relationships_count: cc.contact.present? ? cc.contact.outgoing_relationships.size : 0
          }
        end

        # Include estimator analysis from proposal if available
        if @job.email_job_proposal&.extracted_data.present?
          extracted = @job.email_job_proposal.extracted_data
          # Only include if the estimator fields are present
          if extracted["job_summary"].present? || extracted["key_points"].present?
            job_json[:estimator_analysis] = {
              job_summary: extracted["job_summary"],
              key_points: extracted["key_points"],
              estimated_scope: extracted["estimated_scope"],
              recommendations: extracted["recommendations"],
              source: "pdf_extraction",
              extracted_at: @job.email_job_proposal.created_at
            }
          end
        end

        render json: { success: true, data: job_json }
      end

      # POST /api/v1/jobs
      def create
        Rails.logger.info "[JobsController#create] job_params: #{job_params.inspect}"
        Rails.logger.info "[JobsController#create] job_status_id from params: #{job_params[:job_status_id].inspect}"

        @job = Job.new(job_params)

        if @job.save
          # Enqueue OneDrive folder creation if requested
          folder_creation_enqueued = false
          if params[:create_onedrive_folders] == true || params[:create_onedrive_folders] == "true"
            @job.create_folders_if_needed!(params[:template_id])
            folder_creation_enqueued = true
          end

          # Instantiate schedule template if provided
          template_instantiation_result = nil
          if params[:template_id].present?
            template_instantiation_result = instantiate_schedule_template(params[:template_id])
          end

          response_data = @job.as_json.merge(
            folder_creation_enqueued: folder_creation_enqueued
          )

          # Add template instantiation info if applicable
          if template_instantiation_result
            response_data[:template_instantiation] = template_instantiation_result
          end

          render json: { success: true, data: response_data }, status: :created
        else
          Rails.logger.error "[JobsController#create] Validation failed: #{@job.errors.full_messages.inspect}"
          Rails.logger.error "[JobsController#create] job_status_id was: #{@job.job_status_id.inspect}"
          render json: { success: false, error: @job.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PUT/PATCH /api/v1/jobs/:id
      def update
        if @job.update(job_params)
          render json: { success: true, data: @job }
        else
          render json: { success: false, error: @job.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:id
      def destroy
        @job.destroy
        head :no_content
      end

      # GET /api/v1/jobs/:id/saved_messages
      def saved_messages
        @messages = @job.chat_messages
                                  .where(saved_to_job: true)
                                  .includes(:user)
                                  .order(created_at: :desc)

        render json: {
          success: true,
          data: @messages.as_json(
            include: { user: {} },
            methods: :formatted_timestamp
          )
        }
      end

      # GET /api/v1/jobs/:id/emails
      def emails
        @emails = @job.emails
                              .includes(:synced_by_user)
                              .order(received_at: :desc)

        render json: { success: true, data: { emails: @emails } }
      end

      # GET /api/v1/jobs/:id/sms_messages
      # Returns SMS messages for all contacts associated with this job
      def sms_messages
        contact_ids = @job.job_contacts.pluck(:contact_id)

        if contact_ids.empty?
          render json: { sms_messages: [] }
          return
        end

        messages = SmsMessage
          .where(contact_id: contact_ids)
          .includes(:contact, :user)
          .order(created_at: :desc)
          .limit(100)

        render json: {
          sms_messages: messages.as_json(
            include: {
              contact: {},
              user: {}
            }
          )
        }
      end

      # GET /api/v1/jobs/:id/documentation_tabs
      # SSoT: Now uses WarehouseFolder (warehouse_type: 'job', tab_group: 'documents')
      def documentation_tabs
        # FRC (Feb 2026): warehouse_folders has no job_id column - folders are
        # tenant-scoped (via acts_as_tenant), not per-job. Previous code queried
        # .where(job_id: @job.id) which raised PG::UndefinedColumn.
        job_tabs = WarehouseFolder.for_warehouse_type('job')
                            .where(tab_group: 'documents', parent_id: nil)
                            .enabled
                            .ordered
                            .includes(:children)

        render json: { success: true, data: job_tabs.map(&:as_nested_json) }
      end

      # POST /api/v1/jobs/:id/import_xero_bills
      # Import bills from Xero that are tracked to this job
      def import_xero_bills
        service = XeroBillImportService.new(@job)
        result = service.import_bills

        render json: result
      rescue XeroBillImportService::NotConnectedError => e
        render_error(e.message, status: :service_unavailable)
      rescue XeroBillImportService::NoTrackingOptionError => e
        render_error(e.message, status: :unprocessable_entity)
      rescue StandardError => e
        Rails.logger.error("Xero bill import error: #{e.message}")
        render_error(e.message, status: :internal_server_error)
      end

      # POST /api/v1/jobs/:id/link_xero_tracking
      # Link this job to one or more Xero tracking options
      # Accepts either:
      #   Single: { tracking_option_id: "...", tracking_option_name: "..." }
      #   Multi:  { tracking_options: [{ id: "...", name: "...", is_primary: true }, ...] }
      def link_xero_tracking
        if params[:tracking_options].present?
          # Multi-link mode: replace all link rows
          link_xero_tracking_multi
        else
          # Single-link mode (backward compatible)
          link_xero_tracking_single
        end
      end

      # GET /api/v1/jobs/:id/xero_tracking_options
      # Get available Xero tracking options and current linked options for this job
      def xero_tracking_options
        # SSoT: Read from local xero_tracking_options table (not Xero API)
        local_options = XeroTrackingOption.active.order(:name)

        # Return all linked options from join table (multi-link)
        current_links = @job.xero_tracking_links.order(is_primary: :desc, created_at: :asc)
        current_options = current_links.map do |link|
          {
            id: link.tracking_option_id,
            name: link.tracking_option_name,
            variant: link.variant,
            is_primary: link.is_primary
          }
        end

        # Backward compat: if no link rows but legacy column has a value, include it
        if current_options.empty? && @job.xero_tracking_option_id.present?
          current_options = [{
            id: @job.xero_tracking_option_id,
            name: @job.xero_tracking_option_name,
            variant: nil,
            is_primary: true
          }]
        end

        render json: {
          success: true,
          tracking_options: local_options.map { |o| { id: o.xero_tracking_option_id, name: o.name } },
          current_options: current_options,
          current_option: current_options.find { |o| o[:is_primary] } || current_options.first,
          suggested_match: nil
        }
      rescue StandardError => e
        render_error(e.message, status: :internal_server_error)
      end

      # GET /api/v1/jobs/:id/xero_profit_loss
      # Returns Xero Profit & Loss report filtered by this job's tracking category
      # Params:
      #   from_date: start date (default: start of financial year)
      # GET /api/v1/jobs/:id/finance_counts
      # Lightweight endpoint for badge counts on finance sub-tabs
      def finance_counts
        invoices = @job.external_invoices.where.not(status: [ "draft", "voided" ])

        # Look up actual finance tab_keys from WarehouseFolder
        # FRC: Folders may be global (tenant_id=nil) or tenant-specific — check both
        job_type_ids = WarehouseType.where(code: "job").pluck(:id)
        tenant_scope = [ @job.tenant_id, nil ]

        # Map component_name OR tab_key to the correct count query
        # Uses JOB_TAB_COMPONENTS mapping (same as frontend) to identify tab purpose
        claims_fn = -> { @job.job_claim_stages.count }
        expenses_fn = -> { @job.purchase_orders.where.not(status: [ "draft", "cancelled" ]).count }
        xero_invoices_fn = -> { invoices.where(invoice_type: "sales_invoice").count }
        xero_bills_fn = -> { invoices.where(invoice_type: "bill").count }

        # Estimating tab counts
        po_count_fn = -> { @job.purchase_orders.where.not(status: "cancelled").count }

        # component_name keys (when set) + tab_key keys (when component_name is nil)
        count_map = {
          "JobClaimStagesTab" => claims_fn, "claims" => claims_fn,
          "JobExpensesTab" => expenses_fn, "expenses" => expenses_fn,
          "XeroInvoicesCard" => xero_invoices_fn, "claims---xero" => xero_invoices_fn, "claims-xero" => xero_invoices_fn,
          "XeroBillsCard" => xero_bills_fn, "bills" => xero_bills_fn, "bills-xero" => xero_bills_fn, "bills---xero" => xero_bills_fn,
          "JobPurchaseOrdersTab" => po_count_fn, "purchase-orders" => po_count_fn
        }

        counts = {}

        # Resolve counts for all parent tabs with children (Finance, Estimating/Jobs, etc.)
        # FRC: Folders may be global (tenant_id=nil) or tenant-specific — check both
        parent_tabs = WarehouseFolder.where(
          warehouse_type_id: job_type_ids,
          parent_id: nil,
          tenant_id: tenant_scope
        ).includes(:children)

        parent_tabs.each do |parent_tab|
          parent_tab.children.where(enabled: true).each do |child|
            resolver = count_map[child.component_name] || count_map[child.tab_key]
            counts[child.tab_key] = resolver.call if resolver
          end
        end

        # Parent-level badge counts (e.g., total photos across all photo sub-tabs)
        # Also computes per-child counts for sub-tab badges
        #
        # FRC (Mar 2026): All job documents are 100% migrated to warehouse_folder_id FK.
        # Legacy folder_path LIKE fallback removed — single batched COUNT query instead of N+1.
        parent_counts = {}

        # Collect all child folder IDs across all parent tabs (photo + document children)
        all_child_folders = []
        parent_tabs.each do |parent_tab|
          photo_children = parent_tab.children.where(enabled: true, tab_type: "photo")
          doc_children = parent_tab.children.where(enabled: true, tab_type: "document")
          all_child_folders.concat(photo_children.to_a)
          all_child_folders.concat(doc_children.to_a)
        end

        if all_child_folders.any?
          # Batch: collect all folder IDs (children + their sub-folders) in one query
          child_ids = all_child_folders.map(&:id)
          sub_folder_ids = WarehouseFolder.where(parent_id: child_ids).pluck(:id)
          all_folder_ids = child_ids + sub_folder_ids

          # Single batched COUNT query for all folders at once
          folder_counts = WarehouseDocument
            .where(linkable_type: "Job", linkable_id: @job.id)
            .where(warehouse_folder_id: all_folder_ids)
            .group(:warehouse_folder_id)
            .count

          # Map folder counts back to tab_keys
          # Build lookup: sub_folder_id → parent child folder (single query, no N+1)
          sub_to_parent = WarehouseFolder.where(parent_id: child_ids)
            .pluck(:id, :parent_id)
            .to_h

          # Aggregate counts per child folder (including sub-folder counts)
          child_totals = Hash.new(0)
          folder_counts.each do |folder_id, count|
            parent_id = sub_to_parent[folder_id] || folder_id
            child_totals[parent_id] += count
          end

          # Assign to tab_keys and compute parent totals
          parent_tabs.each do |parent_tab|
            photo_children = parent_tab.children.where(enabled: true, tab_type: "photo")
            doc_children = parent_tab.children.where(enabled: true, tab_type: "document")

            tab_total = 0
            (photo_children.to_a + doc_children.to_a).each do |child|
              count = child_totals[child.id]
              counts[child.tab_key] = count  # Always include (even 0) so UI shows it's working
              tab_total += count
            end
            parent_counts[parent_tab.tab_key] = tab_total
          end
        end

        render json: { success: true, counts: counts, parentCounts: parent_counts }
      end

      #   to_date: end date (default: today)
      #   periods: number of comparison periods (default: 3)
      #   timeframe: MONTH, QUARTER, YEAR (default: YEAR)
      def xero_profit_loss
        # SSoT: Build P&L from local DB data (job_claims for income, purchase_orders for expenses)
        # No Xero API call needed - all data already synced locally
        periods = (params[:periods] || 3).to_i
        from_date = params[:from_date].present? ? Date.parse(params[:from_date]) : nil
        to_date = params[:to_date].present? ? Date.parse(params[:to_date]) : nil

        # Build period ranges from frontend params, with comparison periods going back
        if from_date && to_date
          duration_days = (to_date - from_date).to_i
          fy_periods = (0..periods).map do |i|
            pf, pt = step_period_back(from_date, to_date, duration_days, i)
            { label: format_period_label(pf, pt), from: pf, to: pt }
          end
        else
          # Fallback: Australian financial year periods (1 Jul - 30 Jun)
          today = Date.current
          current_fy_start_year = today.month >= 7 ? today.year : today.year - 1
          fy_periods = (0..periods).map do |i|
            start_year = current_fy_start_year - i
            {
              label: "FY#{start_year}/#{(start_year + 1).to_s[-2..]}",
              from: Date.new(start_year, 7, 1),
              to: Date.new(start_year + 1, 6, 30)
            }
          end
        end

        # SSoT: external_invoices table has all Xero-synced invoices and bills
        invoices = @job.external_invoices.where.not(status: [ "draft", "voided" ])
        sales = invoices.where(invoice_type: "sales_invoice")
        bills = invoices.where(invoice_type: "bill")
        credit_notes = invoices.where(invoice_type: "credit_note")

        # Use subtotal (ex GST) by default, total (inc GST) when requested
        amount_col = params[:inc_gst] == "true" ? :total : :subtotal

        # Build P&L data for each period
        income_by_period = fy_periods.map do |period|
          sales.where(invoice_date: period[:from]..period[:to]).sum(amount_col) || 0
        end

        expenses_by_period = fy_periods.map do |period|
          bills.where(invoice_date: period[:from]..period[:to]).sum(amount_col) || 0
        end

        credits_by_period = fy_periods.map do |period|
          credit_notes.where(invoice_date: period[:from]..period[:to]).sum(amount_col) || 0
        end

        # Totals across all periods
        total_income = income_by_period.sum
        total_expenses = expenses_by_period.sum
        total_credits = credits_by_period.sum

        # Build rows in Xero-compatible format for frontend rendering
        header_cells = [ { value: "" } ] + fy_periods.map { |p| { value: p[:label] } } + [ { value: "Total" } ]

        rows = [
          { row_type: "Header", cells: header_cells },
          { row_type: "Section", title: "Income" },
          {
            row_type: "Row",
            cells: [ { value: "Sales Invoices" } ] + income_by_period.map { |v| { value: format_pl_amount(v) } } + [ { value: format_pl_amount(total_income) } ]
          },
          {
            row_type: "SummaryRow",
            cells: [ { value: "Total Income" } ] + income_by_period.map { |v| { value: format_pl_amount(v) } } + [ { value: format_pl_amount(total_income) } ]
          },
          { row_type: "Section", title: "Less Cost of Sales" },
          {
            row_type: "Row",
            cells: [ { value: "Bills" } ] + expenses_by_period.map { |v| { value: format_pl_amount(v) } } + [ { value: format_pl_amount(total_expenses) } ]
          },
          {
            row_type: "Row",
            cells: [ { value: "Credit Notes" } ] + credits_by_period.map { |v| { value: format_pl_amount(v.negative? ? v : -v) } } + [ { value: format_pl_amount(total_credits.negative? ? total_credits : -total_credits) } ]
          },
          {
            row_type: "SummaryRow",
            cells: [ { value: "Total Cost of Sales" } ] + fy_periods.each_with_index.map { |_, i|
              { value: format_pl_amount(expenses_by_period[i] - credits_by_period[i]) }
            } + [ { value: format_pl_amount(total_expenses - total_credits) } ]
          },
          {
            row_type: "SummaryRow",
            cells: [ { value: "Net Profit" } ] + fy_periods.each_with_index.map { |_, i|
              net = income_by_period[i] - expenses_by_period[i] + credits_by_period[i]
              { value: format_pl_amount(net) }
            } + [ { value: format_pl_amount(total_income - total_expenses + total_credits) } ]
          }
        ]

        render json: {
          success: true,
          report: {
            titles: [
              "Profit & Loss - #{@job.name}",
              "#{@job.job_code}",
              params[:inc_gst] == "true" ? "Including GST" : "Excluding GST"
            ],
            from_date: fy_periods.last[:from].to_s,
            to_date: fy_periods.first[:to].to_s,
            periods: periods,
            timeframe: "YEAR",
            tracking_option_name: @job.xero_tracking_option_name,
            rows: rows
          }
        }
      end

      # GET /api/v1/jobs/:id/activities
      # Get activity timeline for a job
      def activities
        activities = @job.job_activities
                         .includes(:user)
                         .recent

        # Filter by type if specified
        activities = activities.by_type(params[:type]) if params[:type].present?

        # Filter by date range
        activities = activities.since(params[:since].to_date) if params[:since].present?

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 100)
        total_count = activities.count

        activities = activities.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          activities: activities.map { |a| serialize_activity(a) },
          meta: {
            total_count: total_count,
            page: page,
            per_page: per_page,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/jobs/:id/budget_tracking
      # Returns budget vs invoiced summary for purchase orders
      # Performance: includes :line_items to avoid N+1 when accessing first description
      def budget_tracking
        purchase_orders = @job.purchase_orders
                              .where.not(status: "cancelled")
                              .includes(:supplier, :line_items)

        budget_items = purchase_orders.map do |po|
          budgeted = po.total || 0
          invoiced = po.invoiced_amount || 0
          variance = invoiced - budgeted

          {
            id: po.id,
            po_number: po.purchase_order_number,
            supplier_name: po.supplier&.display_name || po.supplier&.company_name || "Unknown Supplier",
            item_description: po.description || po.line_items.first&.description || "No description",
            budgeted: budgeted.to_f.round(2),
            invoiced: invoiced.to_f.round(2),
            variance: variance.to_f.round(2),
            payment_status: po.payment_status || "pending"
          }
        end

        total_budgeted = budget_items.sum { |i| i[:budgeted] }
        total_invoiced = budget_items.sum { |i| i[:invoiced] }
        total_variance = total_invoiced - total_budgeted
        variance_percentage = total_budgeted > 0 ? (total_variance / total_budgeted * 100) : 0

        render json: {
          budget_items: budget_items,
          totals: {
            budgeted: total_budgeted.round(2),
            invoiced: total_invoiced.round(2),
            variance: total_variance.round(2),
            variance_percentage: variance_percentage.round(2)
          }
        }
      end

      # GET /api/v1/jobs/:id/boq
      # Returns BOQ (Bill of Quantities) vs Purchase Orders comparison
      # Shows side-by-side view of estimated vs actual costs
      def boq
        purchase_orders = @job.purchase_orders
                              .where.not(status: "cancelled")
                              .includes(:supplier, :tender, :po_status, line_items: [:pricebook_item, :profit_centre],
                                        sm_task: [:sm_stage_ref, :sm_trade_ref, :cost_centre_ref, :tender,
                                                  sm_schedule_master: [:sm_stage_ref, :sm_trade_ref, :cost_centre_ref, :tender]])

        cost_budgets = @job.job_cost_budgets.includes(:cost_centre)

        # Pre-load tenders + their tender headers for efficient lookup (avoids N+1)
        # SSoT priority: PO direct > SmTask (synced) > SmScheduleMaster (template)
        tender_ids = purchase_orders.filter_map { |po|
          po.tender_id || po.sm_task&.tender_id || po.sm_task&.sm_schedule_master&.tender_id
        }.uniq
        tenders_by_id = tender_ids.any? ? Tender.where(id: tender_ids).includes(:tender_header).index_by(&:id) : {}

        # Pre-load Databuild BOQ line items (SmScheduleMaster records linked to cost centres)
        cc_ids = cost_budgets.filter_map { |b| b.cost_centre&.id }
        sm_by_cc = if cc_ids.any?
          SmScheduleMaster.where(cost_centre: cc_ids).group_by(&:cost_centre)
        else
          {}
        end

        # Build cost centre lookup for PO matching
        cc_lookup = {}
        cost_budgets.each do |budget|
          next unless budget.cost_centre
          cc_lookup[budget.cost_centre.id] = budget
          cc_lookup[budget.cost_centre.code&.to_s] = budget
        end

        # Match POs to cost centres via their SM task's cost_centre
        po_by_cc = Hash.new { |h, k| h[k] = [] }
        unmatched_pos = []

        purchase_orders.each do |po|
          sm = po.sm_task&.sm_schedule_master
          cc_key = sm&.cost_centre&.to_s
          budget = cc_key.present? ? cc_lookup[cc_key] : nil

          if budget
            po_by_cc[budget.id] << po
          else
            unmatched_pos << po
          end
        end

        # Build BOQGroup[] - one group per PO (cost_centre + load number)
        # Databuild items are grouped by Ld (load number) within each cost centre.
        # Each load becomes a separate PO group: "102 - Engineering 1", "102 - Engineering 2", etc.
        boq_groups = if cost_budgets.any?
          groups = []

          cost_budgets.sort_by { |b| b.cost_centre&.code&.to_i || 0 }.each do |budget|
            cc = budget.cost_centre
            matched_pos = po_by_cc[budget.id] || []
            cc_name = cc ? "#{cc.code} - #{cc.name}" : "Budget ##{budget.id}"

            databuild_items = sm_by_cc[cc&.id] || []
            if databuild_items.any?
              # Group Databuild items by load number (Ld) → one BOQ group per load = one PO
              by_load = databuild_items.group_by do |sm|
                d = sm.po_line_items.is_a?(Hash) ? sm.po_line_items : {}
                d["load_number"] || 0
              end

              by_load.sort_by { |load_num, _| load_num.to_i }.each do |load_num, load_items|
                items = load_items.map do |sm|
                  line_data = sm.po_line_items.is_a?(Hash) ? sm.po_line_items : {}
                  {
                    id: "sm-#{sm.id}",
                    description: sm.name,
                    quantity: (line_data["quantity"] || 1).to_f,
                    unitPrice: (line_data["unit_price"] || 0).to_f,
                    gstCode: "BUD",
                    subtotal: (line_data["total_price"] || 0).to_f,
                    pricebookItemCode: line_data["code"]
                  }
                end

                po_name = load_num.to_i > 0 ? "#{cc_name} #{load_num}" : cc_name

                groups << {
                  id: "cc-#{budget.id}-ld-#{load_num}",
                  name: po_name,
                  supplierId: nil,
                  supplierName: nil,
                  taskName: nil,
                  taskPosition: nil,
                  tradeName: nil,
                  stageName: nil,
                  stagePosition: nil,
                  costCentreName: cc_name,
                  tenderName: nil,
                  tenderHeaderName: nil,
                  profitCentreName: nil,
                  items: items
                }
              end
            else
              # Fallback: single budget allocation line when no Databuild line items
              groups << {
                id: "cc-#{budget.id}",
                name: cc_name,
                supplierId: nil,
                supplierName: nil,
                taskName: nil,
                taskPosition: nil,
                tradeName: nil,
                stageName: nil,
                stagePosition: nil,
                costCentreName: cc_name,
                tenderName: nil,
                tenderHeaderName: nil,
                profitCentreName: nil,
                items: [{
                  id: "budget-#{budget.id}",
                  description: "Budget allocation",
                  quantity: 1,
                  unitPrice: (budget.total_budget || 0).to_f,
                  gstCode: "BUD",
                  subtotal: (budget.total_budget || 0).to_f,
                  pricebookItemCode: nil
                }]
              }
            end

            # Add matched PO line items as their own group
            matched_pos.each do |po|
              sm = po.sm_task&.sm_schedule_master
              items = po.line_items.sort_by(&:line_number).map do |item|
                pc = item.profit_centre
                {
                  id: item.id,
                  description: item.description,
                  quantity: item.quantity.to_f,
                  unitPrice: item.unit_price.to_f,
                  gstCode: item.gst_code || "GST",
                  subtotal: item.total_amount.to_f,
                  pricebookItemCode: item.pricebook_item&.item_code,
                  hasPricebookImage: item.pricebook_item&.image_storage_blob_id.present?,
                  pricebookItemId: item.pricebook_item_id,
                  profitCentreId: item.profit_centre_id,
                  profitCentreName: pc ? "#{pc.code} - #{pc.name}" : nil
                }
              end

              groups << {
                id: "po-#{po.id}",
                name: po.purchase_order_number || "PO-#{po.id}",
                supplierId: po.supplier_id,
                supplierName: po.supplier&.display_name,
                poStatus: po.status,
                poStatusName: po.po_status&.name,
                poStatusColor: po.po_status&.color,
                poStatusPosition: po.po_status&.position,
                taskName: po.sm_task&.name || po.description,
                taskPosition: po.sm_task&.sequence_order,
                tradeName: po.trade_from_task,
                stageName: po.stage_from_task,
                stagePosition: sm&.sequence_order,
                costCentreName: po.cost_centre_from_task,
                tenderName: (tenders_by_id[po.tender_id || po.sm_task&.tender_id || po.sm_task&.sm_schedule_master&.tender_id]&.name),
                tenderHeaderName: (tenders_by_id[po.tender_id || po.sm_task&.tender_id || po.sm_task&.sm_schedule_master&.tender_id]&.tender_header&.name),
                profitCentreName: po.profit_centre_from_line_items,
                items: items
              }
            end
          end

          groups
        else
          # Fallback: PO-only mode (no cost budgets)
          purchase_orders.map do |po|
            sm = po.sm_task&.sm_schedule_master
            {
              id: po.id,
              name: po.purchase_order_number || "PO-#{po.id}",
              supplierId: po.supplier_id,
              supplierName: po.supplier&.display_name,
              poStatus: po.status,
              poStatusName: po.po_status&.name,
              poStatusColor: po.po_status&.color,
              poStatusPosition: po.po_status&.position,
              taskName: po.sm_task&.name || po.description,
              taskPosition: po.sm_task&.sequence_order,
              tradeName: po.trade_from_task,
              stageName: po.stage_from_task,
              stagePosition: sm&.sequence_order,
              costCentreName: po.cost_centre_from_task,
              tenderName: (tenders_by_id[po.tender_id || po.sm_task&.tender_id || po.sm_task&.sm_schedule_master&.tender_id]&.name),
              tenderHeaderName: (tenders_by_id[po.tender_id || po.sm_task&.tender_id || po.sm_task&.sm_schedule_master&.tender_id]&.tender_header&.name),
              profitCentreName: po.profit_centre_from_line_items,
              items: po.line_items.sort_by(&:line_number).map do |item|
                pc = item.profit_centre
                {
                  id: item.id,
                  description: item.description,
                  quantity: item.quantity.to_f,
                  unitPrice: item.unit_price.to_f,
                  gstCode: item.gst_code || "GST",
                  subtotal: item.total_amount.to_f,
                  pricebookItemCode: item.pricebook_item&.item_code,
                  hasPricebookImage: item.pricebook_item&.image_storage_blob_id.present?,
                  pricebookItemId: item.pricebook_item_id,
                  profitCentreId: item.profit_centre_id,
                  profitCentreName: pc ? "#{pc.code} - #{pc.name}" : nil
                }
              end
            }
          end
        end

        # Add unmatched POs as individual groups with "X - No Task" (sorts to bottom)
        if cost_budgets.any? && unmatched_pos.any?
          unmatched_pos.each do |po|
            items = po.line_items.sort_by(&:line_number).map do |item|
              pc = item.profit_centre
              {
                id: item.id,
                description: item.description,
                quantity: item.quantity.to_f,
                unitPrice: item.unit_price.to_f,
                gstCode: item.gst_code || "GST",
                subtotal: item.total_amount.to_f,
                pricebookItemCode: item.pricebook_item&.item_code,
                hasPricebookImage: item.pricebook_item&.image_storage_blob_id.present?,
                pricebookItemId: item.pricebook_item_id,
                profitCentreId: item.profit_centre_id,
                profitCentreName: pc ? "#{pc.code} - #{pc.name}" : nil
              }
            end

            next if items.empty?

            boq_groups << {
              id: "po-#{po.id}",
              name: po.purchase_order_number || "PO-#{po.id}",
              supplierId: po.supplier_id,
              supplierName: po.supplier&.display_name,
              poStatus: po.status,
              poStatusName: po.po_status&.name,
              poStatusColor: po.po_status&.color,
              poStatusPosition: po.po_status&.position,
              taskName: "X - No Task",
              taskPosition: nil,
              tradeName: nil,
              stageName: nil,
              stagePosition: nil,
              costCentreName: "X - No Task",
              tenderName: nil,
              tenderHeaderName: nil,
              profitCentreName: po.profit_centre_from_line_items,
              items: items
            }
          end
        end

        # Calculate summary from cost budgets + POs
        total_boq = cost_budgets.sum { |b| (b.total_budget || 0).to_f }
        total_po = purchase_orders.sum { |po| (po.total || 0).to_f }
        total_po_ex_gst = purchase_orders.sum { |po| (po.sub_total || 0).to_f }
        total_po_gst = purchase_orders.sum { |po| (po.tax || 0).to_f }
        total_variance = total_po - total_boq

        # Profit centres available for this tenant (templates + job-specific)
        available_profit_centres = ProfitCentre.where(job_id: [nil, @job.id])
                                               .order(:code)
                                               .map { |pc| { id: pc.id, code: pc.code, name: pc.name, label: "#{pc.code} - #{pc.name}" } }

        # Tender markup % from SM template (fallback to global SmSetting default)
        template_markup = @job.schedule_template&.default_tender_markup_percent&.to_f
        global_markup = SmSetting.first&.default_tender_markup_percent&.to_f || 0.0
        tender_markup_percent = template_markup || global_markup

        render json: {
          success: true,
          job: {
            id: @job.id,
            name: @job.name,
            contract_value: (@job.contract_price || 0).to_f
          },
          groups: boq_groups,
          profitCentres: available_profit_centres,
          tenderMarkupPercent: tender_markup_percent,
          summary: {
            boq_total: total_boq.round(2),
            po_total: total_po.round(2),
            po_subtotal: total_po_ex_gst.round(2),
            po_gst: total_po_gst.round(2),
            variance: total_variance.round(2),
            variance_percent: total_boq > 0 ? (total_variance / total_boq * 100).round(1) : 0,
            contract_value: (@job.contract_price || 0).to_f,
            po_count: purchase_orders.count,
            category_count: cost_budgets.count
          }
        }
      end

      # GET /api/v1/jobs/:id/price_analysis
      # Compares PO line item prices against latest price_only contact reference prices
      def price_analysis
        # Query 1: Load POs with eager-loaded line items + pricebook items
        purchase_orders = @job.purchase_orders
                              .where.not(status: "cancelled")
                              .includes(:supplier, line_items: :pricebook_item)

        # Query 2: Collect all pricebook_item_ids from line items
        all_line_items = purchase_orders.flat_map(&:line_items)
        pricebook_item_ids = all_line_items.filter_map(&:pricebook_item_id).uniq

        # Query 3: Get price_only contact IDs
        price_only_ids = Contact.where(entity_type: "price_only").pluck(:id)

        # Query 4: Bulk lookup latest price per pricebook item from price_only contacts
        # Uses DISTINCT ON to get the most recent price history per pricebook item
        reference_prices = {}
        if pricebook_item_ids.any? && price_only_ids.any?
          # FRC (Mar 2026): Batch load suppliers to fix N+1 (was 317x Contact.find_by per request)
          price_histories = PriceHistory
            .where(pricebook_item_id: pricebook_item_ids, supplier_id: price_only_ids)
            .select("DISTINCT ON (pricebook_item_id) pricebook_item_id, new_price, supplier_id, date_effective, created_at")
            .order("pricebook_item_id, date_effective DESC NULLS LAST, created_at DESC")
            .to_a

          supplier_ids = price_histories.map(&:supplier_id).compact.uniq
          suppliers_by_id = Contact.where(id: supplier_ids).index_by(&:id)

          price_histories.each do |ph|
            supplier = suppliers_by_id[ph.supplier_id]
            reference_prices[ph.pricebook_item_id] = {
              price: ph.new_price,
              supplier_id: ph.supplier_id,
              supplier_name: supplier&.display_name || supplier&.company_name_or_trust || "Unknown",
            }
          end
        end

        # Build response
        missing_count = 0
        unlinked_count = 0
        current_total = 0.0
        ref_total = 0.0

        po_groups = purchase_orders.map do |po|
          po_current = 0.0
          po_ref = 0.0
          po_missing = 0

          items = po.line_items.sort_by(&:line_number).map do |item|
            subtotal = ((item.quantity || 0) * (item.unit_price || 0)).to_f.round(2)
            po_current += subtotal

            if item.pricebook_item_id.nil?
              unlinked_count += 1
              {
                id: item.id,
                description: item.description,
                quantity: item.quantity.to_f,
                unit_price: item.unit_price.to_f,
                current_subtotal: subtotal,
                pricebook_item_code: nil,
                price_only_price: nil,
                price_only_subtotal: nil,
                price_only_supplier: nil,
                difference: nil,
                difference_pct: nil,
                status: "no_pricebook_link"
              }
            elsif reference_prices[item.pricebook_item_id].nil?
              missing_count += 1
              po_missing += 1
              {
                id: item.id,
                description: item.description,
                quantity: item.quantity.to_f,
                unit_price: item.unit_price.to_f,
                current_subtotal: subtotal,
                pricebook_item_code: item.pricebook_item&.item_code,
                price_only_price: nil,
                price_only_subtotal: nil,
                price_only_supplier: nil,
                difference: nil,
                difference_pct: nil,
                status: "missing_price_only"
              }
            else
              ref = reference_prices[item.pricebook_item_id]
              ref_price = ref[:price].to_f

              # Always compare unit prices: ref_subtotal = qty * ref_price
              # Both PO line items and reference prices are stored as per-unit values.
              qty = (item.quantity || 0).to_f
              ref_subtotal = (qty * ref_price).to_f.round(2)

              po_ref += ref_subtotal
              diff = (ref_subtotal - subtotal).round(2)
              diff_pct = subtotal.abs > 0.01 ? ((diff / subtotal) * 100).round(1) : 0.0

              status = if (item.unit_price.to_f - ref_price).abs < 0.01
                "equal"
              elsif ref_price < item.unit_price.to_f
                "cheaper"  # reference is cheaper = we potentially overpaid
              else
                "expensive"  # reference is more expensive = we got a good deal
              end

              {
                id: item.id,
                description: item.description,
                quantity: item.quantity.to_f,
                unit_price: item.unit_price.to_f,
                current_subtotal: subtotal,
                pricebook_item_code: item.pricebook_item&.item_code,
                price_only_price: ref_price.round(2),
                price_only_subtotal: ref_subtotal,
                price_only_supplier: ref[:supplier_name],
                price_only_supplier_id: ref[:supplier_id],
                difference: diff,
                difference_pct: diff_pct,
                status: status
              }
            end
          end

          current_total += po_current
          po_diff = po_ref > 0 ? (po_ref - po_current).round(2) : nil

          {
            id: po.id,
            po_number: po.purchase_order_number,
            supplier_id: po.supplier_id,
            supplier_name: po.supplier&.display_name || po.supplier&.company_name || "Unknown Supplier",
            status: po.status,
            current_total: po_current.round(2),
            price_only_total: po_ref > 0 ? po_ref.round(2) : nil,
            difference: po_diff,
            missing_count: po_missing,
            line_items: items
          }
        end

        # Only sum ref_total from POs that have reference pricing
        ref_total = po_groups.sum { |g| g[:price_only_total] || 0 }

        render json: {
          success: true,
          summary: {
            current_total: current_total.round(2),
            price_only_total: ref_total.round(2),
            difference: (ref_total - current_total).round(2),
            missing_prices: missing_count,
            unlinked_lines: unlinked_count,
            total_pos: purchase_orders.size,
            total_line_items: all_line_items.size
          },
          po_groups: po_groups
        }
      end

      # POST /api/v1/jobs/:id/merge
      # Merges secondary jobs into the primary job (this job)
      # Transfers all related records and then deletes the secondary jobs
      def merge
        secondary_job_ids = params[:secondary_job_ids]

        if secondary_job_ids.blank?
          render_error("No secondary jobs provided", status: :unprocessable_entity)
          return
        end

        secondary_jobs = Job.where(id: secondary_job_ids)

        if secondary_jobs.count != secondary_job_ids.length
          render_error("Some secondary jobs not found", status: :not_found)
          return
        end

        merged_count = 0

        ActiveRecord::Base.transaction do
          secondary_jobs.each do |secondary_job|
            # Transfer all related records to the primary job
            # Job Contacts
            secondary_job.job_contacts.update_all(job_id: @job.id)

            # Purchase Orders
            secondary_job.purchase_orders.update_all(job_id: @job.id) if secondary_job.respond_to?(:purchase_orders)

            # Quotes
            secondary_job.quotes.update_all(job_id: @job.id) if secondary_job.respond_to?(:quotes)

            # Tasks
            secondary_job.tasks.update_all(job_id: @job.id) if secondary_job.respond_to?(:tasks)

            # Chat Messages
            secondary_job.chat_messages.update_all(job_id: @job.id) if secondary_job.respond_to?(:chat_messages)

            # Emails
            secondary_job.emails.update_all(job_id: @job.id) if secondary_job.respond_to?(:emails)

            # Documents
            secondary_job.documents.update_all(job_id: @job.id) if secondary_job.respond_to?(:documents)

            # Notes
            secondary_job.notes.update_all(job_id: @job.id) if secondary_job.respond_to?(:notes)

            # Attachments
            secondary_job.attachments.update_all(attachable_id: @job.id) if secondary_job.respond_to?(:attachments)

            # FRC (Feb 2026): Removed dead code that queried warehouse_folders.job_id
            # (column doesn't exist - warehouse_folders are tenant-scoped, not per-job)

            # Fill in any blank fields on primary job from secondary job
            Job.column_names.each do |col|
              next if %w[id created_at updated_at].include?(col)
              if @job.send(col).blank? && secondary_job.send(col).present?
                @job.send("#{col}=", secondary_job.send(col))
              end
            end

            # Delete the secondary job
            secondary_job.destroy!
            merged_count += 1
          end

          @job.save!
        end

        render json: {
          success: true,
          message: "Successfully merged #{merged_count} job(s) into #{@job.title || "Job ##{@job.id}"}",
          primary_job: @job
        }
      rescue ActiveRecord::RecordInvalid => e
        render_error(e.message, status: :unprocessable_entity)
      rescue => e
        render_error(e.message, status: :internal_server_error)
      end

      # GET /api/v1/jobs/:id/plan_set
      # Get the list of plans from WarehouseDocument (blob storage SSoT)
      def plan_set
        plans_folder = WarehouseFolder.where(warehouse_type: "job", tab_key: "plans").enabled.first

        documents = WarehouseDocument
          .where(linkable: @job, source_type: "job")
          .where(warehouse_folder_id: plans_folder&.id)
          .where.not(storage_blob_id: nil)
          .includes(:storage_blob)
          .order(created_at: :desc)

        plans = documents.map do |doc|
          blob = doc.storage_blob
          {
            id: doc.id,
            name: doc.ui_name || doc.original_filename,
            size: blob&.file_size || doc.file_size,
            created_at: doc.created_at,
            type: :file,
            content_type: blob&.content_type || "application/pdf",
            is_all_plans: (doc.ui_name || doc.original_filename)&.start_with?("All Plans")
          }
        end

        # Sort: All Plans first, then alphabetically
        plans.sort_by! { |p| [p[:is_all_plans] ? 0 : 1, p[:name].to_s] }

        render json: {
          success: true,
          data: {
            plans: plans,
            folder_exists: plans.any?
          }
        }
      rescue => e
        Rails.logger.error("plan_set error: #{e.message}")
        render_error(e.message, status: :internal_server_error)
      end

      # POST /api/v1/jobs/:id/generate_contract
      # Enqueues async QBCC contract PDF generation
      def generate_contract
        enqueue_pdf_and_respond(
          generator_type: "contract_overlay",
          generator_params: { template_key: "qbcc_contract", job_id: @job.id }
        )
      rescue => e
        Rails.logger.error("generate_contract error: #{e.message}")
        render_error(e.message, status: :internal_server_error)
      end

      # POST /api/v1/jobs/:id/save_contract
      # Generate QBCC contract PDF and save to job documents
      # SSoT: Uses DocumentProviderAware for provider-agnostic storage
      def save_contract
        enqueue_pdf_and_respond(
          generator_type: "contract_overlay",
          generator_params: {
            template_key: "qbcc_contract",
            job_id: @job.id,
            save_to_storage: true
          }
        )
      rescue => e
        Rails.logger.error("save_contract error: #{e.message}")
        Rails.logger.error(e.backtrace.first(5).join("\n"))
        render_error(e.message, status: :internal_server_error)
      end

      # POST /api/v1/jobs/:id/send_contract_for_signing
      # Generate QBCC contract PDF, save to blob storage, and send for e-signing
      # Blob-only (Mar 2026): No legacy S3 folder upload
      def send_contract_for_signing
        # Step 1: Generate the QBCC contract PDF
        engine = Engines::PdfOverlayEngine.new(:qbcc_contract)
        pdf_content = engine.generate(job: @job)

        filename = "QBCC_Contract_#{@job.job_number || @job.id}_#{Date.current.strftime('%Y%m%d')}.pdf"

        # Step 2: Store as blob + WarehouseDocument
        blob = StorageBlob.find_or_create_for_content!(
          pdf_content, filename: filename, content_type: "application/pdf"
        )

        contracts_folder = WarehouseFolder.where(warehouse_type: "job", tab_key: "contracts").enabled.first
        WarehouseDocumentCreator.create!(
          filename: filename, source_type: "job", linkable: @job,
          storage_blob: blob, warehouse_folder_id: contracts_folder&.id,
          file_size: pdf_content.bytesize, content_type: "application/pdf"
        )

        # Step 3: Get signers from job contacts (clients only)
        client_contacts = @job.job_contacts
          .where(role: "client")
          .includes(:contact)
          .order(primary: :desc)
          .map(&:contact)
          .compact

        if client_contacts.empty?
          return render_error("No client contacts found on this job", status: :unprocessable_entity)
        end

        # Validate all contacts have emails
        missing_emails = client_contacts.select { |c| c.email.blank? }.map(&:display_name)
        if missing_emails.any?
          return render_error("Missing email for: #{missing_emails.join(', ')}", status: :unprocessable_entity)
        end

        # Step 4: Create e-signature request (blob ID as storage reference)
        request = ESignatureRequest.new(
          title: "QBCC Contract - #{@job.name}",
          description: "Building Contract for #{@job.address || @job.name}",
          documentable: @job,
          created_by_id: current_user&.id,
          signing_order: 0, # Parallel signing
          expires_at: 30.days.from_now,
          send_reminders: true,
          original_storage_file_id: blob.id.to_s
        )

        # Add client contacts as signers
        client_contacts.each_with_index do |contact, index|
          request.signers.build(
            name: contact.display_name,
            email: contact.email,
            role: "client",
            signing_order: index,
            contact_id: contact.id
          )
        end

        # Calculate document hash
        request.original_document_hash = Digest::SHA256.hexdigest(pdf_content)

        unless request.save
          return render_error(request.errors.full_messages.join(", "), status: :unprocessable_entity)
        end

        # Step 5: Send for signing
        request.send_for_signing!

        render json: {
          success: true,
          data: {
            request_number: request.request_number,
            title: request.title,
            filename: filename,
            signers: request.signers.map { |s| { name: s.name, email: s.email, status: s.status } },
            status: request.status,
            expires_at: request.expires_at
          }
        }
      rescue => e
        Rails.logger.error("send_contract_for_signing error: #{e.message}")
        Rails.logger.error(e.backtrace.first(5).join("\n"))
        render_error(e.message, status: :internal_server_error)
      end

      # GET /api/v1/jobs/:id/linked_schedule_template
      # Returns the schedule template linked to this job's tasks (if any)
      # Used by frontend to skip template selection in sync dialog when job already has synced tasks
      def linked_schedule_template
        job = Job.find(params[:id])

        # Find distinct template IDs from this job's tasks via their sm_schedule_master links
        template_ids = SmTask.where(job_id: job.id)
                             .joins(:sm_schedule_master)
                             .where.not(sm_schedule_masters: { sm_template_ids: nil })
                             .pluck(Arel.sql("DISTINCT jsonb_array_elements_text(sm_schedule_masters.sm_template_ids)::integer"))

        if template_ids.any?
          # Get the most common template (in case tasks are linked to different templates)
          template_counts = SmTask.where(job_id: job.id)
                                  .joins(:sm_schedule_master)
                                  .where.not(sm_schedule_masters: { sm_template_ids: nil })
                                  .group(Arel.sql("jsonb_array_elements_text(sm_schedule_masters.sm_template_ids)::integer"))
                                  .count

          most_common_template_id = template_counts.max_by { |_, count| count }&.first&.to_i
          template = SmScheduleMasterTemplate.find_by(id: most_common_template_id)

          if template
            render json: {
              success: true,
              has_linked_template: true,
              template: {
                id: template.id,
                name: template.name,
                is_default: template.is_default
              },
              task_count: job.sm_tasks.count
            }
          else
            render json: { success: true, has_linked_template: false, task_count: job.sm_tasks.count }
          end
        else
          render json: { success: true, has_linked_template: false, task_count: job.sm_tasks.count }
        end
      rescue ActiveRecord::RecordNotFound
        render_error("Job not found", status: :not_found)
      end

      # POST /api/v1/jobs/:id/create_storage_folders
      # Creates storage folders for a job that doesn't have them yet
      def create_storage_folders
        if @job.storage_folder_status == "completed"
          render json: { success: true, status: "completed", message: "Folders already exist" }
          return
        end

        @job.create_folders_if_needed!
        render json: { success: true, status: @job.reload.storage_folder_status }
      rescue StandardError => e
        render_error(e.message, status: :unprocessable_entity)
      end

      # GET /api/v1/jobs/:id/markup
      # Returns pricing table data for the Job Markup & Pricing tab
      def markup
        tasks = @job.sm_tasks
                    .where(po_required: true)
                    .includes(:purchase_order, :sm_schedule_master,
                              tender: :tender_header,
                              purchase_order: :supplier)
                    .order(:sequence_order)

        sm_setting = SmSetting.instance

        # Calculate charges via SSoT calculator
        calculator = MarkupChargeCalculator.new(@job)
        calc_result = calculator.calculate

        render json: {
          success: true,
          job: {
            id: @job.id,
            builderMarginPercent: @job.builder_margin_percent&.to_f || 0,
            contractPrice: @job.contract_price&.to_f,
            pcPsMarkupCap: sm_setting.pc_ps_markup_cap_percent&.to_f || 25.0
          },
          items: tasks.map { |task|
            po = task.purchase_order
            t = task.tender
            {
              smTaskId: task.id,
              taskName: task.name,
              supplierName: po&.supplier&.display_name,
              tenderSection: t&.name,
              tenderHeader: t&.tender_header&.name,
              isPcPs: task.pc_ps_item?,
              sectionType: t&.section_type,
              cost: po&.sub_total&.to_f || 0,
              poNumber: po&.purchase_order_number,
              escalationPercent: task.escalation_percent&.to_f || 0,
              markupPercent: task.markup_percent&.to_f || 0,
              markupCap: task.pc_ps_item? ? (sm_setting.pc_ps_markup_cap_percent&.to_f || 25.0) : nil,
              escalatedCost: task.escalated_cost.round(2),
              sellPrice: task.sell_price.round(2)
            }
          },
          charges: calc_result[:charges].map { |_type, c|
            {
              chargeType: c[:charge_type],
              label: JobMarkupCharge::LABELS[c[:charge_type]] || c[:charge_type].humanize,
              ratePercent: c[:rate_percent]&.to_f,
              overrideAmount: c[:override_amount]&.to_f,
              calculatedAmount: c[:calculated_amount].to_f,
              effectiveAmount: c[:effective_amount].to_f,
              basisValue: c[:basis_value].to_f,
              usingOverride: c[:using_override],
              purchaseOrderId: c[:purchase_order_id],
              purchaseOrderNumber: c[:purchase_order_number]
            }
          },
          summary: {
            costTotal: calc_result[:cost_total],
            escalatedTotal: tasks.sum(&:escalated_cost).round(2),
            sellSubtotal: calc_result[:sell_subtotal],
            chargesTotal: calc_result[:charges_total],
            subtotalWithCharges: calc_result[:subtotal_with_charges],
            builderMarginPercent: @job.builder_margin_percent&.to_f || 0,
            contractExGst: calc_result[:contract_ex_gst],
            gstAmount: calc_result[:gst_amount],
            contractIncGst: calc_result[:contract_inc_gst],
            qbccAmount: calc_result[:qbcc_amount],
            finalContractIncGst: calc_result[:final_contract_inc_gst],
            existingContractPrice: @job.contract_price&.to_f
          }
        }
      end

      # PATCH /api/v1/jobs/:id/markup
      # Update escalation %, markup %, builder margin, charges, and optionally apply to contract price
      def update_markup
        ActiveRecord::Base.transaction do
          if params[:items].present?
            params[:items].each do |item|
              task = @job.sm_tasks.find(item[:smTaskId])
              updates = {}
              updates[:escalation_percent] = item[:escalationPercent] if item.key?(:escalationPercent)
              if item.key?(:markupPercent)
                cap = task.pc_ps_item? ? (SmSetting.instance.pc_ps_markup_cap_percent || 25.0) : Float::INFINITY
                updates[:markup_percent] = [item[:markupPercent].to_f, cap].min
              end
              task.update!(updates) if updates.any?
            end
          end

          if params.key?(:builderMarginPercent)
            @job.update!(builder_margin_percent: params[:builderMarginPercent])
          end

          # Update charges (insurance, QLeave, overheads, QBCC)
          if params[:charges].present?
            params[:charges].each do |charge_params|
              charge_type = charge_params[:chargeType]
              next unless JobMarkupCharge::CHARGE_TYPES.include?(charge_type)

              record = @job.job_markup_charges.find_or_initialize_by(charge_type: charge_type)
              record.tenant_id = @job.tenant_id
              record.rate_percent = charge_params[:ratePercent] if charge_params.key?(:ratePercent)
              record.override_amount = charge_params[:overrideAmount] if charge_params.key?(:overrideAmount)
              record.purchase_order_id = charge_params[:purchaseOrderId] if charge_params.key?(:purchaseOrderId)
              record.save!
            end
          end

          # Recalculate and persist charge amounts
          @job.reload
          calculator = MarkupChargeCalculator.new(@job)
          calc_result = calculator.calculate(persist: true)

          # Sync charge amounts to linked Purchase Orders
          calculator.sync_charge_purchase_orders(calc_result[:charges])

          if params[:applyToContractPrice]
            @job.update!(contract_price: calc_result[:final_contract_inc_gst])
          end
        end

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound => e
        render_error(e.message, status: :not_found)
      rescue ActiveRecord::RecordInvalid => e
        render_error(e.message, status: :unprocessable_entity)
      end

      # POST /api/v1/jobs/:id/target_margin
      # Back-calculate builder margin % needed to hit a target final contract price
      def target_margin
        target = params[:targetFinalIncGst].to_f
        if target <= 0
          return render_error("Target price must be positive", status: :unprocessable_entity)
        end

        calculator = MarkupChargeCalculator.new(@job)
        result = calculator.calculate_margin_for_target(target)

        if result[:error]
          render_error(result[:error], status: :unprocessable_entity)
        else
          render json: {
            success: true,
            requiredMarginPercent: result[:required_margin_percent],
            subtotalWithCharges: result[:subtotal_with_charges],
            contractExGst: result[:contract_ex_gst],
            contractIncGst: result[:contract_inc_gst],
            qbccAmount: result[:qbcc_amount],
            finalContractIncGst: result[:final_contract_inc_gst]
          }
        end
      end

      private

      # Format amount for P&L display (comma-separated, 2 decimals)
      def format_pl_amount(value)
        return "-" if value.nil? || value.zero?
        ActionController::Base.helpers.number_with_delimiter(value.round(2), delimiter: ",")
      end

      # Step a date range back by i periods, using smart month/quarter/year alignment
      def step_period_back(from_date, to_date, duration_days, i)
        return [from_date, to_date] if i == 0

        if duration_days > 300 # ~year/FY
          [from_date << (12 * i), to_date << (12 * i)]
        elsif duration_days > 80 # ~quarter
          [from_date << (3 * i), to_date << (3 * i)]
        elsif duration_days > 25 # ~month
          pf = from_date << i
          pt = (pf >> 1) - 1 # last day of that month
          [pf, pt]
        else # custom range
          offset = (duration_days + 1) * i
          [from_date - offset, to_date - offset]
        end
      end

      def format_period_label(from_date, to_date)
        days = (to_date - from_date).to_i
        if days > 300 # ~year / FY
          fy_start = from_date.month >= 7 ? from_date.year : from_date.year - 1
          "FY#{fy_start}/#{(fy_start + 1).to_s[-2..]}"
        elsif days > 80 # ~quarter
          "Q#{((from_date.month - 1) / 3) + 1} #{from_date.year}"
        else # month or custom
          from_date.strftime("%b %Y")
        end
      end

      # Single-link mode: link one tracking option (backward compatible)
      def link_xero_tracking_single
        tracking_option_id = params[:tracking_option_id]
        tracking_option_name = params[:tracking_option_name]

        unless tracking_option_id.present?
          return render_error("tracking_option_id is required", status: :bad_request)
        end

        ActiveRecord::Base.transaction do
          # Create or update link row
          link = XeroJobTrackingLink.find_or_initialize_by(tracking_option_id: tracking_option_id)
          link.assign_attributes(
            job: @job,
            tracking_option_name: tracking_option_name,
            is_primary: true,
            tenant_id: @job.tenant_id
          )
          link.save!

          # Unset previous primary (if different)
          @job.xero_tracking_links.where.not(id: link.id).update_all(is_primary: false)

          # Backward compat: update job columns
          @job.update_columns(
            xero_tracking_option_id: tracking_option_id,
            xero_tracking_option_name: tracking_option_name
          )
        end

        render json: { success: true, job: @job.reload.as_json }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: [e.message] }, status: :unprocessable_entity
      end

      # Multi-link mode: replace all tracking links with the provided set
      def link_xero_tracking_multi
        options = params[:tracking_options]

        unless options.is_a?(Array) && options.any?
          return render_error("tracking_options must be a non-empty array", status: :bad_request)
        end

        ActiveRecord::Base.transaction do
          incoming_ids = options.map { |o| o[:id] }.compact

          # Remove links no longer in the set
          @job.xero_tracking_links.where.not(tracking_option_id: incoming_ids).destroy_all

          # Create or update each link
          primary_set = false
          options.each do |opt|
            link = XeroJobTrackingLink.find_or_initialize_by(tracking_option_id: opt[:id])
            is_primary = opt[:is_primary].present? ? ActiveModel::Type::Boolean.new.cast(opt[:is_primary]) : false
            link.assign_attributes(
              job: @job,
              tracking_option_name: opt[:name],
              is_primary: is_primary,
              tenant_id: @job.tenant_id
            )
            link.save!
            primary_set = true if is_primary
          end

          # If no explicit primary, set the first as primary
          unless primary_set
            first_link = @job.xero_tracking_links.reload.first
            first_link&.update!(is_primary: true)
          end

          # Backward compat: update job columns from primary
          primary_link = @job.xero_tracking_links.reload.find_by(is_primary: true)
          if primary_link
            @job.update_columns(
              xero_tracking_option_id: primary_link.tracking_option_id,
              xero_tracking_option_name: primary_link.tracking_option_name
            )
          end
        end

        # Return updated options
        current_options = @job.xero_tracking_links.reload.order(is_primary: :desc).map do |link|
          { id: link.tracking_option_id, name: link.tracking_option_name, variant: link.variant, is_primary: link.is_primary }
        end

        render json: { success: true, current_options: current_options }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: [e.message] }, status: :unprocessable_entity
      end


      def set_job
        # Support lookup by ID or slug (title-based)
        id_or_slug = params[:id]

        # Eager load associations for show action to avoid N+1 queries
        # This reduces the show action from ~820ms to ~100ms
        eager_load_associations = if action_name == "show"
          [:job_type, :job_status, :job_stage, :email_job_proposal,
           { job_contacts: { contact: :outgoing_relationships } }]
        else
          []
        end

        # Build base scope - only add includes if we have associations to eager load
        base_scope = eager_load_associations.any? ? Job.includes(*eager_load_associations) : Job

        if id_or_slug.to_s.match?(/\A\d+\z/)
          # Numeric ID - direct lookup
          @job = base_scope.find(id_or_slug)
        else
          # Slug - search by name (convert slug back to search term)
          # Remove the _God_Loves_You_ suffix if present
          slug = id_or_slug.to_s.gsub(/_God_Loves_You_$/i, "")
          search_term = slug.gsub("-", " ")
          @job = base_scope.where("LOWER(name) LIKE ?", "%#{search_term.downcase}%").first
          raise ActiveRecord::RecordNotFound, "Job not found with slug: #{id_or_slug}" unless @job
        end
      end

      def job_params
        params.require(:job).permit(
          :name,
          :title, # Keep for backward compatibility during transition
          :description,
          :lot_number,
          :street_number,
          :street_name,
          :street_type,
          :suburb,
          :postcode,
          :state,
          :council,
          # Construction details
          :level,
          :dwelling_type,
          :contract_price,
          # live_profit and profit_percentage are calculated fields, not user-editable
          :stage,
          :status,
          :ted_number,
          :certifier_job_no,
          :start_date,
          :location,
          :latitude,
          :longitude,
          # Note: site_supervisor_name/email/phone columns removed (Jan 2026) - use job_contacts SSoT
          :design_id,
          :design_name,
          :job_design_id,
          :job_type_id,
          :job_status_id,
          :job_stage_id,
          # Contract fields
          :plan_number,
          :contract_price,
          :deposit,
          :prime_cost,
          :provisional_sums,
          :external_sales_fee,
          :contract_date,
          # Build schedule
          :build_period,
          :construction_days,
          :stage_slab,
          :stage_frame,
          :stage_enclosed,
          :stage_fixing,
          :stage_practical,
          :stage_weather,
          :weekend_work,
          # Contract terms (Items 13 & 14)
          :liquidated_damages,
          :certification_by_owner,
          # Item 12: Finance Approval
          :finance_approval_required,
          :finance_approval_date,
          # Item 15: Prime Cost/Provisional Sums details and Special Conditions
          :prime_cost_details,
          :provisional_sums_details,
          :has_special_conditions,
          :special_conditions,
          # Important dates
          :plan_date,
          :spec_date,
          :practical_completion_date,
          :warranty_end_date,
          # Tender details
          :estate,
          :facade,
          :developer_approval,
          :developer_contact,
          :land_registration,
          :building_contract_type,
          :development_application,
          :sales_centre,
          :wind_classification,
          :soil_classification,
          :specification,
          # Profit centre
          :default_profit_centre_id
        )
      end

      def serialize_activity(activity)
        {
          id: activity.id,
          activity_type: activity.activity_type,
          formatted_type: activity.formatted_activity_type,
          description: activity.description,
          occurred_at: activity.occurred_at.iso8601,
          time_ago: activity.time_ago,
          performed_by: activity.performed_by_name,
          user_id: activity.user_id,
          icon: activity.icon_name,
          icon_color: activity.icon_color,
          related_type: activity.related_type,
          related_id: activity.related_id,
          related_url: activity.related_url,
          metadata: activity.metadata
        }
      end

      # Serialize job for pipeline view (lightweight version)
      def pipeline_job_to_json(job)
        # Get primary client contact
        client_contact = job.job_contacts.find { |jc| jc.role == "client" }&.contact

        {
          id: job.id,
          title: job.title,
          location: job.location,
          # SSoT: contract_price is THE ONE
          contract_value: job.contract_price || 0,
          job_type: job.job_type&.name,
          job_status: job.job_status&.name,
          job_stage: job.job_stage&.name,
          job_stage_id: job.job_stage_id,
          client_name: client_contact&.display_name,
          client_email: client_contact&.email,
          client_company: client_contact&.company_name_or_trust,
          created_at: job.created_at,
          updated_at: job.updated_at
        }
      end

      def instantiate_schedule_template(template_id)
        # Use SmScheduleMasterTemplate (THE ONE template system - SSoT)
        template = SmScheduleMasterTemplate.find_by(id: template_id)
        unless template
          Rails.logger.warn("Template #{template_id} not found for job #{@job.id}")
          return { success: false, error: "Template not found" }
        end

        # Use SmScheduleMasterTemplateCopyService (THE ONE template copy service - SSoT)
        result = SmScheduleMasterTemplateCopyService.new(template, @job, {
          start_date: Date.current,
          user: current_user
        }).call

        if result[:success]
          Rails.logger.info("Successfully instantiated template #{template.name} for job #{@job.id}")
          {
            success: true,
            template_name: template.name,
            tasks_created: result[:tasks]&.count || 0,
            tasks_needing_pos: result[:tasks_needing_pos] || []
          }
        else
          Rails.logger.error("Failed to instantiate template: #{result[:errors]&.join(', ')}")
          {
            success: false,
            errors: result[:errors]
          }
        end
      rescue StandardError => e
        Rails.logger.error("Exception instantiating template: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
        {
          success: false,
          error: e.message
        }
      end
    end
  end
end
