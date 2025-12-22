Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # API health check
  get "/health", to: "health#index"
  get "/version", to: "health#version"
  post "/version/increment", to: "health#increment_version"

  # API routes
  namespace :api do
    namespace :v1 do
      # Feature Trackers
      resources :feature_trackers, only: [ :index, :create, :update, :destroy ]

      # Batch Operations - Global routes for folder_scan, folder_process
      # (Job-scoped routes are also nested under /jobs/:job_id/batch_operations)
      resources :batch_operations, only: [ :create, :show ] do
        collection do
          get :active  # GET /api/v1/batch_operations/active
        end
      end

      # AI Processing Pipeline (Admin: configure OCR/AI settings per service)
      # Dashboard: /admin/system/ai-processing
      resources :ai_processing, only: [] do
        collection do
          get :configs           # GET /api/v1/ai_processing/configs - list all service configs
          get :logs              # GET /api/v1/ai_processing/logs - paginated processing logs
          get :stats             # GET /api/v1/ai_processing/stats - accuracy per service
          get :learning_summary  # GET /api/v1/ai_processing/learning_summary - overall insights
        end
      end
      patch "ai_processing/configs/:id", to: "ai_processing#update_config"
      get "ai_processing/logs/:id", to: "ai_processing#show_log"
      post "ai_processing/logs/:id/record_correction", to: "ai_processing#record_correction"
      get "ai_processing/insights/:service_type", to: "ai_processing#insights"

      # PDF Field Positions (Admin: manage text overlay positions on PDF templates)
      resources :pdf_field_positions, only: [:index, :show, :create, :update, :destroy] do
        collection do
          get :detect_fields   # GET /api/v1/pdf_field_positions/detect_fields - parse PDF for form fields
          get :preview_values  # GET /api/v1/pdf_field_positions/preview_values - get computed values for job
          get :template        # GET /api/v1/pdf_field_positions/template - get blank PDF template
          post :preview        # POST /api/v1/pdf_field_positions/preview - generate preview PDF
          post :bulk_update    # POST /api/v1/pdf_field_positions/bulk_update - update multiple positions
        end
      end

      # Plan Folder Scans (for Revit plan import workflow)
      resources :plan_folder_scans, only: [:index, :destroy] do
        collection do
          get :pending_count  # GET /api/v1/plan_folder_scans/pending_count - for nav badge
          post :scan_all      # POST /api/v1/plan_folder_scans/scan_all - scan all job folders
        end
        member do
          post :process_scan  # POST /api/v1/plan_folder_scans/:id/process
          post :skip          # POST /api/v1/plan_folder_scans/:id/skip
        end
      end

      # Notifications
      resources :notifications, only: [ :index ] do
        collection do
          get :unread_count
          post :mark_all_read
        end
        member do
          patch :mark_read
        end
      end

      # Authentication routes
      post "auth/signup", to: "authentication#signup"
      post "auth/login", to: "authentication#login"
      get "auth/me", to: "authentication#me"
      get "auth/dev_login", to: "authentication#dev_login"  # Dev mode only
      get "auth/users", to: "authentication#users"  # Admin: list users for impersonation
      post "auth/impersonate/:user_id", to: "authentication#impersonate"  # Admin: impersonate user

      # Import routes
      post "imports/upload", to: "imports#upload"
      post "imports/execute", to: "imports#execute"
      get "imports/status/:session_key", to: "imports#status"

      # CSV Import routes
      post "csv_imports/job_with_pos", to: "csv_imports#import_job_with_pos"

      # Email to Contacts extraction
      resources :email_to_contacts, only: [] do
        collection do
          post :analyze
          post :bulk_create
        end
      end

      # Grok AI integration
      post "grok/chat", to: "grok#chat"
      get "grok/suggest-features", to: "grok#suggest_features"
      post "grok/plans", to: "grok#create_plan"
      get "grok/plans", to: "grok#list_plans"
      get "grok/plans/:id", to: "grok#show_plan"
      patch "grok/plans/:id", to: "grok#update_plan"

      # Git integration
      get "git/branch_status", to: "git#branch_status"

      # System & Performance Monitoring
      get "system/health", to: "system#health"
      get "system/performance", to: "system#performance"
      get "system/metrics", to: "system#metrics"
      get "system/scheduled_jobs", to: "system#scheduled_jobs"

      # Navigation (sidebar menu - SSoT is NavigationItem, user stores collapse only)
      get "navigation", to: "navigation#index"
      post "navigation/reset", to: "navigation#reset"
      patch "navigation/:id/toggle_collapse", to: "navigation#toggle_collapse"

      # Admin: Navigation system config
      resources :navigation_groups, only: [ :index, :create, :update, :destroy ] do
        collection do
          post :reorder
        end
      end
      resources :navigation_items, only: [ :index, :create, :update, :destroy ] do
        collection do
          post :reorder
        end
        member do
          patch :move_to_group
          patch :set_parent
        end
      end

      # Health checks - NEW unified endpoints
      get "health/unified", to: "health#unified"       # Main unified health dashboard
      post "health/fix", to: "health#fix"              # Fix health issues
      get "health/leaderboard", to: "health#leaderboard"  # Kudos leaderboard

      # Health checks - Legacy endpoints (kept for backwards compatibility)
      get "health/system", to: "health#system"
      get "health/pricebook", to: "health#pricebook"
      get "health/pricebook/missing_items", to: "health#missing_items"
      get "pricebook/price_health_check", to: "pricebook_items#price_health_check"

      # Geocoding proxy (uses Mapbox on backend to avoid CORS issues)
      get "geocode/search", to: "geocode#search"

      # Job setup (types, statuses, and stages)
      resources :job_types do
        collection do
          post :reorder
        end
        resources :statuses, controller: "job_type_statuses", only: [ :index, :create ] do
          collection do
            post :reorder
          end
        end
        # Claim Stage Templates (per job type)
        resources :claim_stage_templates, only: [ :index, :create ] do
          collection do
            post :reorder
          end
        end
      end

      # Claim Stage Templates (non-nested routes)
      resources :claim_stage_templates, only: [ :show, :update, :destroy ]

      resources :job_status do
        collection do
          post :reorder
        end
      end

      resources :job_stages do
        collection do
          post :reorder
        end
      end

      # Suburbs lookup
      resources :suburbs do
        collection do
          get :search
          post :reorder
          post :bulk_update_council
        end
      end

      # Junction table routes
      resources :job_type_statuses, only: [ :destroy ]

      # Nested route for stages within type+status
      get "job_types/:job_type_id/statuses/:job_status_id/stages",
        to: "job_status_stages#index"
      post "job_types/:job_type_id/statuses/:job_status_id/stages",
        to: "job_status_stages#create"
      post "job_types/:job_type_id/statuses/:job_status_id/stages/reorder",
        to: "job_status_stages#reorder"
      delete "job_status_stages/:id", to: "job_status_stages#destroy"

      # Documents (simple alias for company documents)
      resources :documents, only: [ :index, :show, :update, :destroy ] do
        collection do
          post :analyze
        end
      end

      # Tekna Document Templates (HTML → PDF generation)
      resources :tekna_documents, only: [] do
        collection do
          get :templates
        end
        member do
          get :preview
          post :generate
          post :generate_and_send
        end
      end

      # Leads management
      resources :leads do
        member do
          patch :status, action: :update_status
        end
      end

      # Jobs management
      resources :jobs do
        collection do
          get :pipeline  # GET /api/v1/jobs/pipeline - Enquiry jobs grouped by stage
        end
        member do
          get :saved_messages
          get :emails
          get :sms_messages
          get :documentation_tabs
          get :activities
          get :budget_tracking
          patch :stage, action: :update_stage  # PATCH /api/v1/jobs/:id/stage - Update job stage
          patch :mark_lost  # PATCH /api/v1/jobs/:id/mark_lost - Mark job as lost
          # Xero bill import
          post :import_xero_bills
          post :link_xero_tracking
          get :xero_tracking_options
          # AI job analysis
          post :analyze, to: "job_estimator#analyze"
          # Merge jobs
          post :merge
          # Plan set management
          get :plan_set
          post :upload_plan_set
          post :rename_plans
          # Contract generation
          post :generate_contract
          post :save_contract
          post :send_contract_for_signing
        end

        # Job contacts (nested under jobs)
        resources :job_contacts, only: [ :index, :create, :update, :destroy ]

        # Job specifications (nested under jobs)
        resources :specifications, controller: "job_specifications", only: [ :index, :show, :create, :update, :destroy ] do
          collection do
            post :initialize_from_template
            post :bulk_update
            get :generate_pdf
          end
        end

        # Job colour selections (nested under jobs)
        resources :colour_selections, controller: "job_colour_selections", only: [ :index, :show, :create, :update, :destroy ] do
          collection do
            post :initialize_from_template
            post :bulk_update
            get :generate_pdf
          end
        end

        # Document tasks (nested under jobs)
        resources :document_tasks, only: [ :index ] do
          member do
            post :upload
            post :validate
          end
        end

        # Rain logs (nested under jobs)
        resources :rain_logs, only: [ :index, :show, :create, :update, :destroy ] do
          collection do
            get :weather_status
            post :fetch_weather
            post :auto_log
          end
        end

        # Job plans (nested under jobs) - Plans tab with revision tracking
        resources :job_plans, only: [ :index, :show, :create, :update, :destroy ] do
          collection do
            get :on_issue             # GET /api/v1/jobs/:job_id/job_plans/on_issue
            get :tabs                 # GET /api/v1/jobs/:job_id/job_plans/tabs
            get :suggested_recipients # GET /api/v1/jobs/:job_id/job_plans/suggested_recipients
            post :email               # POST /api/v1/jobs/:job_id/job_plans/email
            post :upload_plan_set     # POST /api/v1/jobs/:job_id/job_plans/upload_plan_set - AI split (legacy)
            post :fix_categories      # POST /api/v1/jobs/:job_id/job_plans/fix_categories - Reassign to correct tabs
            post :rerun_ai            # POST /api/v1/jobs/:job_id/job_plans/rerun_ai - Re-run AI analysis
          end
          member do
            post :add_revision    # POST /api/v1/jobs/:job_id/job_plans/:id/add_revision
            put :set_on_issue     # PUT /api/v1/jobs/:job_id/job_plans/:id/set_on_issue
            post :reprocess       # POST /api/v1/jobs/:job_id/job_plans/:id/reprocess - Re-run AI/OCR
          end
          resources :revisions, controller: "job_plan_revisions", only: [ :index, :show, :create, :update, :destroy ]
        end

        # Plan uploads - Progress-tracked plan set uploads (SSoT for plan uploads)
        resources :plan_uploads, only: [ :index, :show, :create ] do
          collection do
            get :active               # GET /api/v1/jobs/:job_id/plan_uploads/active
          end
          member do
            post :resume              # POST /api/v1/jobs/:job_id/plan_uploads/:id/resume
          end
        end

        # Plan reextractions - Batch re-extraction with progress tracking
        resources :plan_reextractions, only: [ :create, :show ]

        # Batch operations - THE SSoT for all batch operation progress tracking
        # Replaces: plan_uploads, plan_reextractions (backward compatible routes kept above)
        resources :batch_operations, only: [ :create, :show ] do
          collection do
            get :active  # GET /api/v1/jobs/:job_id/batch_operations/active
          end
        end

        # Meetings (nested under jobs)
        resources :meetings, only: [ :index, :create ]

        # Job claims (nested under jobs)
        resources :job_claims, only: [ :index, :create ]

        # Job claim stages (progress claims tracking)
        resources :claim_stages, controller: "job_claim_stages", only: [ :index, :show, :create, :update, :destroy ] do
          collection do
            post :auto_match
            post :reset_from_template
            post :reorder
            post :sync_payments
          end
          member do
            post :match
            delete :unmatch
            post :create_invoice
            post :generate_pdf
          end
        end
      end

      # Job claims (non-nested routes)
      resources :job_claims, only: [ :show, :update, :destroy ] do
        collection do
          post :bulk_delete
          post :bulk_create
        end
      end

      # Master Schedule - Projects
      # Note: Project tasks removed in Phase 6 Tier 4 - SmTask is THE ONE task system
      resources :projects do
        member do
          get :gantt
        end
      end

      # Meetings (non-nested routes)
      resources :meetings, only: [ :index, :show, :update, :destroy ] do
        member do
          post :start
          post :complete
          post :cancel
        end
      end

      # Meeting Types configuration
      resources :meeting_types, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          get :categories
        end
      end

      # Document Templates for mail merge
      # SSoT: TeknaDocumentGenerator::TEMPLATES is the source of truth (Dec 2024)
      resources :document_templates, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          get :categories
          get :sharepoint_files
          get :ssot  # SSoT templates from TeknaDocumentGenerator
          get "ssot/:template_key", to: "document_templates#ssot_show", as: :ssot_template
          put "ssot/:template_key", to: "document_templates#ssot_update"
          # Layout endpoints for editor
          get :layouts
          get "layouts/:name", to: "document_templates#layout_show", as: :layout
          put "layouts/:name", to: "document_templates#layout_update"
          # SharePoint file download
          get "sharepoint_download/:item_id", to: "document_templates#sharepoint_download", as: :sharepoint_download
        end
        member do
          get :preview
          post :link_sharepoint
          post :generate_and_send  # Generate document and send for e-signature
        end
      end

      # Bank Statement Templates (SSoT for PDF statement generation branding)
      # Admin UI: Admin > System > Company > Doc Templates > Bank Statements
      resources :bank_statement_templates, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          get :test_pdf        # Generate sample PDF with this template
          get :reference_image # Serve reference image for comparison
        end
      end

      # Specification Templates (for job specifications)
      resources :specification_templates, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          get "for_job_type/:job_type_id", action: :for_job_type
        end
      end

      # Colour Selection Templates (for job colour selections)
      resources :colour_selection_templates, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          get "for_job_type/:job_type_id", action: :for_job_type
        end
      end

      # Invoice Templates (code-driven invoice PDF generation)
      resources :invoice_templates do
        collection do
          get :default_sections
        end
        member do
          post :duplicate
          post :set_default
        end
      end

      # E-Signature Requests
      resources :e_signature_requests, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :send_for_signing, path: "send"
          post :cancel
          get :audit_trail
          get :certificate
        end
        resources :signers, controller: "e_signature_requests", only: [] do
          collection do
            post :add_signer, path: "", action: :add_signer
          end
          member do
            delete :remove_signer, path: "", action: :remove_signer
          end
        end
      end

      # Public Signing Ceremony (token-based, no auth)
      scope :sign do
        get ":token", to: "signing_ceremony#verify_token"
        post ":token/view", to: "signing_ceremony#mark_viewed"
        post ":token/send_verification", to: "signing_ceremony#send_verification_code"
        post ":token/verify", to: "signing_ceremony#verify_code"
        post ":token/sign", to: "signing_ceremony#sign"
        post ":token/decline", to: "signing_ceremony#decline"
        get ":token/document", to: "signing_ceremony#download_document"
        post ":token/fields/:field_id/complete", to: "signing_ceremony#complete_field"
      end

      # Purchase Orders management
      resources :purchase_orders do
        collection do
          post :smart_lookup
          post :smart_create
          post :bulk_create
        end
        member do
          post :approve
          post :send_to_supplier
          post :mark_received
          get :available_documents
          post :attach_documents
          get :generate_pdf
        end
        # Payments nested under purchase orders
        resources :payments, only: [ :index, :create ]
      end

      # Payments (standalone routes)
      resources :payments, only: [ :show, :update, :destroy ] do
        member do
          post :sync_to_xero
        end
      end

      # Price Book Categories (lookup table for pricebook items)
      resources :pricebook_categories do
        collection do
          post :reorder
          get :dropdown
        end
      end

      # Price Book management
      resources :pricebook, controller: "pricebook_items", path: "pricebook", constraints: { id: /[^\/]+/ } do
        member do
          get :history
          post :fetch_image
          post :update_image
          post :add_price
          post :set_default_supplier
          delete "price_histories/:history_id", to: "pricebook_items#delete_price_history"
          patch "price_histories/:history_id", to: "pricebook_items#update_price_history"
          get "proxy_image/:file_type", to: "pricebook_items#proxy_image", as: :proxy_image
        end
        collection do
          patch :bulk_update
          post :import
          post :preview
          post :fetch_all_images
          get :image_stats
          get :export_price_history
          post :import_price_history
          get :all_price_histories
        end
      end

      # Gold Standard Table (Demo/Reference Price Book)
      resources :gold_standard_table, only: [ :index, :create, :update, :destroy ] do
        collection do
          post :bulk_delete
        end
        member do
          post :merge
        end
      end

      # Column Types - Single Source of Truth from Gold Standard Reference Table
      resources :column_types, only: [ :index, :show, :update ]

      # Gold Table Sync Check - Compare column types across all sources
      get "gold_table_sync", to: "gold_table_sync#index"


      # Global shareholdings view (all shareholdings across all companies)
      resources :shareholdings, only: [ :index ]

      # Global beneficiaries view (all trust beneficiaries)
      resources :beneficiaries, only: [ :index ]

      # Contacts management
      resources :contacts do
        collection do
          patch :bulk_update
          post :bulk_delete
          post :merge
          post :fix_name_casing
          post :fix_email_assignment
          post :match_supplier
          get :validate_abn
          get :possible_duplicates
          get :duplicates, action: :possible_duplicates  # Alias for frontend-next
          get :read_only_fields
          # SSoT: Contact choices from Contact model constants
          get :entity_types        # Contact::ENTITY_TYPES
          get :employment_statuses # Contact::EMPLOYMENT_STATUSES
          get :roles               # Contact::ROLES
          # Health check endpoints (SSoT validation)
          get :invalid_entity_types
          get :price_only_with_xero
          get :company_with_first_name
          get :person_without_name
          get :missing_contact_info
          get :connected_mailboxes
          get :preview_employee_extraction
          post :extract_employees
          get :health  # Quick health score for header display
          # Data quality review endpoints
          get :quality_reviews      # List pending quality reviews
          post :quality_scan        # Run quality detection scan
          # ABN verification
          post :find_missing_abns   # Find and populate missing ABNs via ABR API
        end
        member do
          post :reorder_employees
          post :reorder_companies
          get :categories
          get :internal_messages
          get :company_group_memberships
          get :directorships
          get :shareholdings
          get :trust_roles
          get :ownership_chain
          get :case_relationships
          get :coworkers  # Get people at the same company(ies)
          post :copy_price_history
          delete :remove_from_categories
          post :bulk_update_prices
          delete :delete_price_column
          get :activities
          post :link_xero_contact
          post :link_to_xero_tenant
          post :sync_from_xero
          post :sync_to_xero
          post :portal_user, to: "contacts#create_portal_user"
          patch :portal_user, to: "contacts#update_portal_user"
          delete :portal_user, to: "contacts#delete_portal_user"
          post :enrich_from_web
          patch :update_from_bill    # Update contact fields from extracted invoice data
          # Data quality endpoints
          post :verify_abn           # Verify ABN via ABR
          get :analyze_quality       # Analyze contact for quality issues
        end

        # Contact relationships (nested under contacts)
        resources :relationships, controller: "contact_relationships", only: [ :index, :create, :show, :update, :destroy ] do
          collection do
            get :summary
          end
        end

        # Xero links (nested under contacts)
        resources :xero_links, controller: "contact_xero_links", only: [ :index, :create, :show, :update, :destroy ] do
          member do
            post :sync
            post :resolve_conflict
            post :approve
            post :reject
            post :transfer
          end
          collection do
            get :conflicts
          end
        end

        # SMS messages (nested under contacts)
        resources :sms_messages, only: [ :index, :create ]

        # Contact persons (nested under contacts) - for Xero sync
        resources :contact_persons, only: [ :index, :create, :update, :destroy ]

        # Contact groups (nested under contacts)
        resources :contact_groups, only: [ :index ]
      end

      # Duplicate contacts management (Xero multi-tenant sync)
      get "duplicate_contacts/groups", to: "duplicate_contacts#groups"
      get "duplicate_contacts/groups/:id", to: "duplicate_contacts#show"
      post "duplicate_contacts/groups/:id/merge", to: "duplicate_contacts#merge"
      post "duplicate_contacts/groups/:id/dismiss", to: "duplicate_contacts#dismiss"

      # Contact quality reviews (data quality management)
      resources :contact_quality_reviews, only: [] do
        member do
          post :approve, to: "contacts#approve_quality_review"
          post :reject, to: "contacts#reject_quality_review"
          post :skip, to: "contacts#skip_quality_review"
        end
        collection do
          post :bulk_approve, to: "contacts#bulk_approve_quality_reviews"
        end
      end

      # SMS webhooks (Twilio callbacks - not nested)
      post "sms/webhook", to: "sms_messages#webhook"
      post "sms/status", to: "sms_messages#status_webhook"

      # Global Xero links endpoints (not nested under contacts)
      get "xero_links/pending_review", to: "contact_xero_links#pending_review"

      # Chat messages
      resources :chat_messages, only: [ :index, :create, :destroy ] do
        collection do
          get :unread_count
          get :online_users
          get :conversations
          post :mark_as_read
          post :save_conversation_to_job
        end
        member do
          post :save_to_job
        end
      end

      # Users management
      resources :users, only: [ :index, :show, :update, :destroy ] do
        collection do
          post :bulk_delete
        end
      end

      # User groups management
      resources :user_groups, only: [ :index, :create, :destroy ]

      # BPMN Workflow Engine
      resources :bpmn_processes do
        collection do
          post :import
        end
        member do
          post :publish
          post :unpublish
          post :duplicate
          get :validate
          post :test_run
        end
        resources :bpmn_triggers, only: [ :index, :show, :create, :update, :destroy ] do
          member do
            post :activate
            post :deactivate
            post :fire
          end
        end
      end

      resources :bpmn_process_instances, only: [ :index, :show, :create ] do
        collection do
          get :for_subject
        end
        member do
          post :cancel
          post :suspend
          post :resume
        end
      end

      resources :bpmn_tasks, only: [ :index, :show ] do
        collection do
          get :all
        end
        member do
          post :complete
          post :claim
          post :unclaim
          post :skip
        end
      end

      # Emails management
      resources :emails do
        collection do
          post :webhook
        end
        member do
          post :assign_to_job
        end
      end

      # Microsoft unified auth (Outlook + OneDrive + SharePoint) - User-level OAuth
      resources :microsoft, only: [], controller: "microsoft_auth" do
        collection do
          get :auth_url
          get :callback
          get :status
          get :connections
          get :my_data_stats
          post :refresh
          delete :disconnect
          # Admin consent for organization-wide permissions (legacy)
          get :admin_consent_url
          get :admin_consent_callback
        end
      end

      # Microsoft App-level access (Client Credentials) - Org-wide email & SharePoint access
      # Uses Application permissions - no per-user OAuth needed
      resources :microsoft_app, only: [], controller: "microsoft_app" do
        collection do
          get :status
          get :health_dashboard  # 4-square health dashboard for self-healing visibility
          post :setup
          post :setup_from_env  # Quick setup using existing OUTLOOK_* env vars
          get :admin_consent_url
          get :admin_consent_callback
          post :test
          get :users
          post :configure_sync
          post :sync_to_sharepoint
          delete :disconnect
          # Mailbox access configuration (who can see which mailboxes)
          get :organizations_with_mailboxes
          # SharePoint/OneDrive endpoints
          get :sharepoint_sites
          get :site_drives
          get :browse
          get :user_onedrive
          get :search_files
          post :test_sharepoint
          # SharePoint Configuration for Attachments (TEEEM's Single SharePoint)
          get :sharepoint_config
          post :configure_sharepoint
          put :update_sharepoint_config
          post :backfill_attachments
        end
        member do
          put :user_mailbox_access, action: :update_user_mailbox_access
        end
      end

      # Outlook integration (legacy - kept for backward compatibility)
      resources :outlook, only: [] do
        collection do
          get :auth_url
          get :callback
          get :status
          delete :disconnect
          get :folders
          post :search
          post :import
          post :import_for_job
          post :search_for_job
          get "job_search_suggestions/:job_id", action: :job_search_suggestions
        end
      end

      # Email Warehouse
      resources :email_warehouse, only: [ :index, :show ] do
        collection do
          get :unassigned
          get :search
          get :stats
          get :sync_status
          post :sync
          post :sync_for_job
          get "for_job/:job_id", action: :for_job
          get :spam
          post :bulk_delete_spam
          get :rules
        end
        member do
          post :assign_to_job
          post :unassign
          post :mark_as_spam
          delete :delete_from_outlook
        end
      end

      # Email Blacklist (spam/marketing filters)
      resources :email_blacklist, only: [ :index, :create, :update, :destroy ] do
        collection do
          post :test
        end
      end

      # IMAP Email Credentials (unified inbox)
      resources :imap_credentials, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          post :test
          get :providers
          get :all_accounts
          post :send_email
          get :folders  # Fetch folders for a specific account (pass account_id param)
        end
        member do
          post :sync
        end
      end

      # Email Job Proposals (AI-powered job creation from emails)
      resources :email_job_proposals, only: [ :index, :show, :create ] do
        member do
          post :approve
          post :reject
          post :re_extract
        end
      end

      # Email Case Proposals (AI-powered case creation from emails)
      resources :email_case_proposals, only: [ :index, :show, :create ] do
        collection do
          get :relationship_types
        end
        member do
          post :approve
          post :reject
          post :re_extract
        end
      end

      # Designs library
      resources :designs

      # Company Settings
      resource :company_settings, only: [ :show, :update ] do
        post :test_twilio, on: :collection
      end

      # Corporate Company Settings (document paths & SharePoint SSoT)
      resource :corporate_company_settings, only: [] do
        get :document_paths, on: :collection
        patch :document_paths, on: :collection, action: :update_document_paths

        # SharePoint SSoT Configuration
        get :sharepoint, on: :collection
        patch :sharepoint, on: :collection, action: :update_sharepoint
        post "sharepoint/test", on: :collection, action: :test_sharepoint
      end

      # Folder Templates for OneDrive sync
      resources :folder_templates do
        member do
          post :duplicate
        end
      end

      # Task Templates for Schedule Master
      resources :task_templates

      # Setup data management
      post "setup/pull_from_local", to: "setup#pull_from_local"
      post "setup/sync_users", to: "setup#sync_users"
      post "setup/sync_documentation_categories", to: "setup#sync_documentation_categories"
      post "setup/sync_supervisor_checklists", to: "setup#sync_supervisor_checklists"
      post "setup/sync_folder_templates", to: "setup#sync_folder_templates"

      # Documentation Categories (Global)
      resources :documentation_categories do
        collection do
          post :reorder
        end
      end

      # Plan Categories and Types (Admin settings for Plans tab)
      resources :plan_categories do
        collection do
          post :reorder
        end
      end
      # Plan Types - independent of categories (many-to-many relationship)
      resources :plan_types do
        collection do
          post :reorder
          get :defaults
          patch :defaults, action: :update_defaults
        end
        member do
          post :assign_categories
        end
      end
      resources :revision_formats

      # TEEEM_DOCS Documentation Viewer
      get "documentation", to: "documentation#index"
      get "documentation/search", to: "documentation#search"
      get "documentation/:id", to: "documentation#show"

      # Trinity (Bible + Lexicon + Teacher combined)
      resources :trinity do
        collection do
          get :stats
          get :constants
          get :search
          post :export_lexicon
          post :export_teacher
        end
      end

      # Inspiring Quotes
      resources :inspiring_quotes do
        collection do
          get :daily
          get :random
        end
      end

      # Agent definitions
      resources :agents, only: [ :index ] do
        collection do
          get :shortcuts
        end
      end

      # User roles
      resources :roles, only: [ :index ]
      resources :user_roles, only: [ :index, :create, :destroy ]

      # Permissions management
      get "permissions", to: "permissions#index"
      get "permissions/roles", to: "permissions#roles"
      get "permissions/user/:id", to: "permissions#user_permissions"
      post "permissions/grant", to: "permissions#grant"

      # Contact types (full CRUD for admin management)
      resources :contact_types do
        collection do
          post :reorder
        end
      end

      # Legacy routes for backwards compatibility
      resources :documentation_entries, controller: "trinity" do
        collection do
          get :stats
          post :export_lexicon
          post :export_teacher
        end
      end

      resources :documented_bugs, controller: "trinity" do
        collection do
          get :stats
          post :export_to_markdown, action: :export_lexicon
        end
      end

      # Agent Definitions (Chapter 20)
      resources :agent_definitions, param: :agent_id do
        member do
          post :record_run
        end
      end

      # Supervisor Checklist Templates (Global)
      resources :supervisor_checklist_templates do
        collection do
          post :reorder
          get :categories
        end
      end

      # ============================================
      # SM Gantt (Schedule Master v2)
      # ============================================

      # SM Tasks (nested under jobs)
      resources :jobs, only: [] do
        resources :sm_tasks, only: [ :create ] do
          collection do
            get "/", action: :job_index
            get :gantt_data
            post :copy_from_template
            post :import
          end
        end
      end

      # SM Tasks (non-nested routes)
      resources :sm_tasks, only: [ :index, :show, :update, :destroy ] do
        collection do
          post :bulk_update
        end
        member do
          post :start
          post :complete
          get :spawn_preview
          post :hold
          post :release_hold
          # Cascade endpoints
          post :cascade_preview
          post :cascade_execute
          post :move
          # Working drawings AI
          get :working_drawings
          post "working_drawings/process", to: "sm_tasks#process_working_drawings"
          patch "working_drawings/pages/:page_id/override", to: "sm_tasks#override_page_category"
        end

        # Dependencies (nested under sm_tasks)
        resources :dependencies, controller: "sm_dependencies", only: [ :index, :create ]
      end

      # SM Dependencies (non-nested routes)
      resources :sm_dependencies, only: [ :show, :update, :destroy ] do
        member do
          post :restore
        end
      end

      # SM Hold Reasons (admin)
      resources :sm_hold_reasons, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          post :reorder
          post :seed_defaults
        end
      end

      # SM Templates (Schedule Master templates for SM Gantt)
      resources :sm_templates, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :set_default
          post :copy_to_job
          post :duplicate
        end
        collection do
          get :default
        end
        resources :rows, controller: "sm_template_rows", only: [ :index, :show, :create, :update, :destroy ] do
          member do
            post :move
          end
          collection do
            post :bulk_create
            post :reorder
          end
        end
      end

      # SM Settings (singleton - admin)
      resource :sm_settings, only: [ :show, :update ]

      # ============================================
      # SM Gantt Phase 2 - Resource Allocation
      # ============================================

      # SM Resources (people, equipment, materials)
      resources :sm_resources, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          get :schedule           # Resource schedule in Gantt format
          get :allocations        # Resource allocations list
          post :allocate          # Allocate resource to task
        end
        collection do
          get :availability       # Availability for a date
          get :utilization        # Utilization report
          delete "allocations/:allocation_id", action: :remove_allocation
        end
      end

      # SM Resource Allocations (nested under tasks)
      resources :sm_tasks, only: [] do
        resources :resource_allocations, controller: "sm_resource_allocations", only: [ :index, :create ]
        resources :time_entries, controller: "sm_time_entries", only: [ :index, :create ]
      end

      # SM Resource Allocations (non-nested)
      resources :sm_resource_allocations, only: [ :show, :update, :destroy ] do
        member do
          post :confirm
          post :start
          post :complete
        end
        collection do
          get "by_resource/:resource_id", action: :by_resource
          get :gantt_data
        end
      end

      # SM Time Entries (non-nested)
      resources :sm_time_entries, only: [ :show, :update, :destroy ] do
        member do
          post :approve
        end
        collection do
          post :bulk_approve
          get "by_resource/:resource_id", action: :by_resource
          get :timesheet
          # SmTimesheetService endpoints
          get "resource_timesheet/:resource_id", action: :resource_timesheet
          get "task_timesheet/:task_id", action: :task_timesheet
          get :pending_approvals
          get "weekly_summary/:resource_id", action: :weekly_summary
          post :log_time
          get :export_payroll
        end
      end

      # SM Reports & Dashboard
      resources :sm_reports, only: [] do
        collection do
          get :dashboard
          get :utilization
          get :costs
          get :trends
          get :forecast
          get :export
          get "resource/:resource_id", action: :resource
          get "task/:task_id", action: :task
        end
      end

      # SM Field Operations (Mobile)
      resources :sm_field, only: [] do
        collection do
          # Photos
          post :upload_photo
          delete "photos/:id", action: :delete_photo

          # GPS Check-ins
          post :checkin
          get :checkins
          get "site_status/:job_id", action: :site_status

          # Voice Notes
          post :record_voice_note
          post "voice_notes/:id/transcribe", action: :transcribe_voice_note

          # Offline Sync
          post :sync
        end
      end

      # Field endpoints nested under tasks
      resources :sm_tasks, only: [] do
        member do
          get "photos", to: "sm_field#task_photos"
          get "voice_notes", to: "sm_field#task_voice_notes"
        end
      end

      # ============================================
      # SM Gantt Phase 3 - Collaboration
      # ============================================

      # Activities (Activity Feed)
      resources :sm_activities, only: [] do
        collection do
          get :feed
          get :my_activity
          get :summary
        end
      end

      # Activities nested under jobs
      resources :jobs, only: [] do
        resources :sm_activities, only: [ :index ], controller: "sm_activities"
      end

      # Activities nested under tasks
      resources :sm_tasks, only: [] do
        member do
          get :activities, to: "sm_activities#task_activities"
        end
        resources :comments, controller: "sm_comments", only: [ :index, :create ]
      end

      # Comments (non-nested)
      resources :sm_comments, only: [ :show, :update, :destroy ] do
        member do
          get :replies
          post :reply
        end
        collection do
          get :mentions
          post "mentions/:id/read", action: :mark_mention_read
          post "mentions/read_all", action: :mark_all_mentions_read
        end
      end

      # ============================================
      # SM Gantt - Advanced Analytics
      # ============================================

      resources :jobs, only: [] do
        scope module: :sm do
          # Analytics endpoints
          resources :sm_analytics, only: [], controller: "/api/v1/sm_analytics" do
            collection do
              get :critical_path
              get :delay_impact
              get :evm
              get :s_curve
              get :baselines
              post :baselines, action: :create_baseline
              get "baselines/:id/compare", action: :compare_baseline
              get :variance
              get :summary
            end
          end

          # AI endpoints
          resources :sm_ai, only: [], controller: "/api/v1/sm_ai" do
            collection do
              get :suggestions
              get :predictions
              get :resource_optimization
              get :summary
            end
          end
        end
      end

      # AI duration estimation (no construction required)
      post "sm_ai/estimate_duration", to: "sm_ai#estimate_duration"

      # ============================================
      # SM Gantt - Integrations
      # ============================================

      resources :sm_integrations, only: [] do
        collection do
          # MS Project
          post :import_ms_project
          get :export_ms_project
          # Calendar sync
          post :sync_calendar
          get :calendar_events
          # Notifications
          post :send_notification
          get :notification_settings
          patch :notification_settings, action: :update_notification_settings
        end
      end

      # ============================================
      # End SM Gantt
      # ============================================

      # Public Holidays
      resources :public_holidays, only: [ :index, :create, :destroy ] do
        collection do
          get :dates
        end
      end

      # Bug Hunter Tests
      resources :bug_hunter_tests, only: [ :index ] do
        collection do
          get :history
          delete :cleanup
        end
        member do
          post :run
        end
      end

      # Agent Status
      resources :agents, only: [] do
        collection do
          get :status
        end
      end

      # Bill Inbox (AP Automation)
      resources :bill_inbox, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          get :stats
        end
        member do
          get :download
          post :extract
          post :match
          post :approve
          post :reject
        end
      end

      # Bill Payment Batches (ABA file generation)
      resources :bill_payment_batches, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          get :eligible_bills
        end
        member do
          post :add_bill
          delete "remove_bill/:bill_payment_id", action: :remove_bill
          post :generate_aba
          get :download_aba
          post :submit_for_approval
          post :approve
          post :mark_submitted
          post :mark_completed
        end
      end

      # Company Approval Rules (per-company AP approval config)
      resources :company_approval_rules

      # Xero integration
      resources :xero, only: [] do
        collection do
          get :auth_url
          post :callback
          get :status
          delete :disconnect
          get :invoices
          get "invoices/:id", action: :invoice_detail, as: :invoice_detail
          get :invoices_by_tracking
          get :payments
          get :credit_notes
          get :quotes
          post :match_invoice
          post :sync_contacts
          get :sync_status
          get :sync_history
          get :contacts_sync_list
          get :tax_rates
          get :accounts
          get :search_contacts
          post :import_tracking_categories
          post :import_all_bills
          post :import_all_claims
          post :full_import
          post :set_primary
          get :organisation
          get :contacts
          get :tracking_categories
          get :validate_contacts
          get :pdf_sync_status
          get :sync_health
          get :sync_stats
          get :common_contacts
          get :unlinked_contacts
          post :link_unlinked_contact
          post :auto_match_contacts
        end
        member do
          get :sync_contacts_status
        end
      end

      # Xero contact lookup (separate route for /api/v1/xero/contacts/:id)
      get "xero/contacts/:id", to: "xero#show_contact"

      # Xero tenants (available organizations)
      get "xero/tenants", to: "xero#tenants"

      # Xero Webhooks (separate controller for webhook handling)
      post "xero/webhooks", to: "xero_webhooks#receive"
      get "xero/webhooks/intent", to: "xero_webhooks#verify_intent"

      # Xero Alerts (notification system for Xero health issues)
      get "xero/alerts", to: "xero_alerts#index"
      get "xero/alerts/count", to: "xero_alerts#count"
      post "xero/alerts/:id/dismiss", to: "xero_alerts#dismiss"
      get "xero/health", to: "xero_alerts#health"

      # Xero Health Monitoring (SSoT observability)
      get "xero/health/dashboard", to: "xero_health#index"
      get "xero/health/events", to: "xero_health#events"
      get "xero/health/analytics", to: "xero_health#analytics"
      post "xero/health/check", to: "xero_health#check"
      # Predictive Health Analysis (Phase 5)
      get "xero/health/predictions", to: "xero_health#predictions"
      get "xero/health/warnings", to: "xero_health#warnings"
      get "xero/health/patterns", to: "xero_health#patterns"
      get "xero/health/trends", to: "xero_health#trends"

      # Xero rate limits (for API monitoring)
      get "xero/rate_limits", to: "xero_alerts#rate_limits"

      # Xero Duplicate Detection & Merge
      get "xero_duplicates/pending", to: "xero_duplicates#pending"
      get "xero_duplicates/for_contact/:contact_id", to: "xero_duplicates#for_contact"
      post "xero_duplicates/scan", to: "xero_duplicates#scan"
      post "xero_duplicates/:id/approve", to: "xero_duplicates#approve"
      post "xero_duplicates/:id/reject", to: "xero_duplicates#reject"
      post "xero_duplicates/:id/select_target", to: "xero_duplicates#select_target"

      # Sync Configurations (per-Xero-org settings for contact sync)
      resources :sync_configurations, param: :xero_tenant_id, only: [ :index, :show, :update ] do
        member do
          post :preview
        end
        collection do
          get :field_mappings
          get :health
        end
      end

      # External Invoices (cached invoice data from Xero/MYOB/QuickBooks)
      resources :external_invoices, only: [ :index, :show, :create, :update ] do
        collection do
          get :sync_status
          get :by_tracking
          post :trigger_sync
          post :push_pending
        end
        member do
          get :pdf          # GET /api/v1/external_invoices/:id/pdf - Download/fetch invoice PDF
          get :attachments  # GET /api/v1/external_invoices/:id/attachments - List all attachments
        end
      end
      get "external_invoices/by_job/:job_id", to: "external_invoices#by_job", as: :external_invoices_by_job
      get "external_invoices/by_contact/:contact_id", to: "external_invoices#by_contact", as: :external_invoices_by_contact
      get "external_invoices/by_external_id/:external_id", to: "external_invoices#by_external_id", as: :external_invoice_by_external_id

      # Warehouse Bank Transactions (Xero bank statement data)
      resources :warehouse_bank_transactions, only: [ :index, :show ] do
        collection do
          get :bank_accounts
          get :financial_years
          get :monthly_summary
          get :sync_status
          post :trigger_sync
          get :download_report
        end
      end

      # Warehouse Contacts (Xero contact data - SSoT for Xero↔TEEEM contact linking)
      resources :warehouse_contacts, only: [ :index, :show ] do
        collection do
          get :stats
          get :tenants
          get :sync_status
          post :trigger_sync
        end
        member do
          post :link
          delete :unlink
          post :auto_link
        end
      end
      get "warehouse_contacts/by_xero_id/:xero_id", to: "warehouse_contacts#by_xero_id", as: :warehouse_contact_by_xero_id

      # Bank Statement Reports (stored PDFs for ATO compliance)
      resources :bank_statement_reports, only: [ :index, :show ] do
        collection do
          post :generate_all
          get :by_structure
        end
        member do
          get :download
          post :regenerate
        end
      end

      # SharePoint integration (per-job - legacy, URLs kept for backwards compatibility)
      get "onedrive/authorize", to: "sharepoint_files#authorize"
      get "onedrive/callback", to: "sharepoint_files#callback"
      get "onedrive/status", to: "sharepoint_files#status"
      delete "onedrive/disconnect", to: "sharepoint_files#disconnect"
      post "onedrive/create_folders", to: "sharepoint_files#create_folders"
      get "onedrive/folders", to: "sharepoint_files#list_items"
      post "onedrive/upload", to: "sharepoint_files#upload"
      get "onedrive/download", to: "sharepoint_files#download"

      # SharePoint integration (organization-wide, URLs kept for backwards compatibility)
      get "organization_onedrive/status", to: "organization_sharepoint#status"
      get "organization_onedrive/authorize", to: "organization_sharepoint#authorize"
      get "organization_onedrive/callback", to: "organization_sharepoint#callback"
      delete "organization_onedrive/disconnect", to: "organization_sharepoint#disconnect"
      get "organization_onedrive/browse_folders", to: "organization_sharepoint#browse_folders"
      post "organization_onedrive/create_root_folder", to: "organization_sharepoint#create_root_folder"
      get "organization_onedrive/validate_folder", to: "organization_sharepoint#validate_folder"
      patch "organization_onedrive/change_root_folder", to: "organization_sharepoint#change_root_folder"
      post "organization_onedrive/create_job_folders", to: "organization_sharepoint#create_job_folders"
      post "organization_onedrive/create_all_job_folders", to: "organization_sharepoint#create_all_job_folders"
      get "organization_onedrive/job_folders", to: "organization_sharepoint#list_job_items"
      post "organization_onedrive/upload", to: "organization_sharepoint#upload"
      get "organization_onedrive/download", to: "organization_sharepoint#download"
      get "organization_onedrive/folder_contents", to: "organization_sharepoint#folder_contents"
      get "organization_onedrive/sharepoint_sites", to: "organization_sharepoint#sharepoint_sites"
      post "organization_onedrive/use_sharepoint_site", to: "organization_sharepoint#use_sharepoint_site"
      post "organization_onedrive/use_personal_drive", to: "organization_sharepoint#use_personal_drive"
      post "organization_onedrive/sync_corporate_documents", to: "organization_sharepoint#sync_corporate_documents"
      get "organization_onedrive/search", to: "organization_sharepoint#search"
      get "organization_onedrive/preview_private_folders", to: "organization_sharepoint#preview_private_folders"
      post "organization_onedrive/create_private_folders", to: "organization_sharepoint#create_private_folders"
      post "organization_onedrive/copy_files", to: "organization_sharepoint#copy_files"
      get "organization_onedrive/legacy_files", to: "organization_sharepoint#legacy_files"
      post "organization_onedrive/import_legacy", to: "organization_sharepoint#import_legacy"
      post "organization_onedrive/run_migration", to: "organization_sharepoint#run_migration"
      get "organization_onedrive/job_all_files", to: "organization_sharepoint#job_all_files"
      post "organization_onedrive/sync_job_documents", to: "organization_sharepoint#sync_job_documents"

      # AI document analysis endpoints
      post "organization_onedrive/analyze_job_documents", to: "organization_sharepoint#analyze_job_documents"
      get "organization_onedrive/documents_needing_review", to: "organization_sharepoint#documents_needing_review"
      post "organization_onedrive/approve_document_rename", to: "organization_sharepoint#approve_document_rename"
      post "organization_onedrive/bulk_approve_renames", to: "organization_sharepoint#bulk_approve_renames"

      # Organization-wide data stats
      get "organization/data_stats", to: "organization#data_stats"
      get "organization/microsoft_org_stats", to: "organization#microsoft_org_stats"

      # Organization settings (job folder name format, etc.)
      get "organization_settings", to: "organization#settings"
      patch "organization_settings", to: "organization#update_settings"

      # Schema information
      get "schema", to: "schema#index"
      get "schema/tables", to: "schema#tables"
      get "schema/in_memory_tables", to: "schema#in_memory_tables"
      get "schema/system_table_columns/:table_name", to: "schema#system_table_columns"
      get "schema/columns", to: "schema#all_columns"  # All columns across all tables for Developer Tools
      post "schema/sync_system_tables", to: "schema#sync_system_tables"  # Audit system tables sync status
      post "schema/sync_has_ui_from_production", to: "schema#sync_has_ui_from_production"  # Sync has_ui from production

      # Foundation management (tables renamed to foundations)
      # Backward-compatible alias for /api/v1/tables
      resources :tables, controller: "foundations", only: [ :index, :show, :create, :update, :destroy ]

      resources :foundations do
        collection do
          get :table_ids  # GET /api/v1/foundations/table_ids - Key table ID mappings for frontend
        end
        member do
          get :health  # GET /api/v1/foundations/:id/health - Health checks for this table
          get :schema  # GET /api/v1/foundations/:id/schema - Column schema for this table
          get :groups  # GET /api/v1/foundations/:id/groups - Server-side group counts by column
        end

        # Column management
        resources :columns, only: [ :create, :update, :destroy ] do
          collection do
            post :test_formula
          end
          member do
            get :lookup_options
            get :lookup_search
            get :choices
            post :add_choice
            post :reorder_choices
            post :rename_choice
            post :merge_choices
            delete :delete_choice
          end
        end

        # Record management for dynamic foundations
        resources :records do
          member do
            post :merge
          end
          collection do
            post :bulk_delete
            post :bulk_update
            post :bulk_create
          end
        end
      end

      # Foundation views (user-specific saved views)
      # Backward-compatible alias for /api/v1/table_views
      resources :table_views, controller: "foundation_views", only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          post :reorder
          post :create_all_setup_views
        end
      end

      resources :foundation_views, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          post :reorder
          post :create_all_setup_views
          post :save_global
        end
      end

      # Estimates management (from Unreal Engine or other sources)
      resources :estimates, only: [ :index, :show, :destroy ] do
        member do
          patch :match
          post :generate_purchase_orders
          post :ai_review, to: "estimate_reviews#create"
        end
        resources :reviews, controller: "estimate_reviews", only: [ :index ]
      end

      # Estimate Reviews (AI Plan Analysis)
      resources :estimate_reviews, only: [ :show, :destroy ]

      # Unreal Variables management
      resources :unreal_variables

      # Corporate Entity Management
      resources :companies, controller: "corporate_companies" do
        collection do
          post :import
          post :reload
          post :create_from_contact  # SSoT: Add Existing Contact to Corporate
          get :health_report
          get :asic_logins
          get :xero_setup_overview
        end
        member do
          get :directors
          post :add_director
          put "directors/:director_id", action: :update_director
          delete "directors/:director_id", action: :remove_director
          get :compliance_items
          get :activities
          get :documents
          get :assets
          get :hierarchy
          get :shareholders
          get :investments
          get :trust_roles  # SSoT: Trustee, Beneficiaries, Appointor for Trust/Superfund entities
          get :data_stats   # Data warehouse statistics for this company
          get :warehouse_health   # Data warehouse health checks for this company
          get :health   # Single company health score (fast - loads only this company)
        end

        # Bank Accounts (nested under companies)
        resources :bank_accounts, only: [ :index ]

        # Bill Payment Batches (AP automation - nested under companies)
        resources :bill_payment_batches, only: [ :index, :create ] do
          collection do
            get :eligible_bills
          end
        end

        # Shareholdings (nested under companies)
        resources :shareholdings, controller: "corporate_company_shareholdings", only: [ :index, :show, :create, :update, :destroy ] do
          collection do
            post :transfer
          end
        end

        # Share Transfers (nested under companies)
        resources :share_transfers, only: [ :index, :show, :create, :update, :destroy ]

        # Loans (nested under companies)
        resources :loans, controller: "corporate_company_loans", only: [ :index, :show, :create, :update, :destroy ] do
          member do
            post :payment
          end
        end

        # Dividends (nested under companies)
        resources :dividends, only: [ :index, :show, :create, :update, :destroy ] do
          member do
            get :payments
            post :calculate_payments
            post :create_payments
            post :mark_paid
          end
        end

        # Minutes (nested under companies)
        resources :minutes, controller: "corporate_company_minutes", only: [ :index, :show, :create, :update, :destroy ] do
          member do
            post :sign
            post :generate_from_template
          end
          collection do
            post :create_from_template
          end
        end

        # Per-Company Xero Integration
        get "xero/status", to: "corporate_company_xero#status"
        get "xero/setup_status", to: "corporate_company_xero#setup_status"
        get "xero/authorize", to: "corporate_company_xero#authorize"
        get "xero/callback", to: "corporate_company_xero#callback"
        post "xero/link", to: "corporate_company_xero#link"
        post "xero/disconnect", to: "corporate_company_xero#disconnect"
        post "xero/sync", to: "corporate_company_xero#sync"
        get "xero/tenants", to: "corporate_company_xero#tenants"
        # Bank sync endpoints
        get "xero/bank_accounts", to: "corporate_company_xero#bank_accounts"
        post "xero/link_bank_account", to: "corporate_company_xero#link_bank_account"
        post "xero/sync_transactions", to: "corporate_company_xero#sync_transactions"
        get "xero/transactions", to: "corporate_company_xero#transactions"
        # Chart of Accounts from Xero
        get "xero/accounts", to: "corporate_company_xero#accounts"
        get "xero/accounts/compare", to: "corporate_company_xero#compare_accounts"
        post "xero/accounts/:account_id/rename", to: "corporate_company_xero#rename_account"
        post "xero/accounts/standardize_names", to: "corporate_company_xero#standardize_account_names"
        # Financial Reports from Xero
        get "xero/profit_loss", to: "corporate_company_xero#profit_loss"
        get "xero/profit_loss_monthly", to: "corporate_company_xero#profit_loss_monthly"
        get "xero/balance_sheet", to: "corporate_company_xero#balance_sheet"
        # Group reports (for consolidated company groups)
        get "xero/group/companies", to: "corporate_company_xero#group_companies"
        get "xero/group/profit_loss", to: "corporate_company_xero#group_profit_loss"
        get "xero/group/balance_sheet", to: "corporate_company_xero#group_balance_sheet"
        # Bank transactions by account
        get "xero/bank_transactions", to: "corporate_company_xero#bank_transactions"

        # PDF Financial Reports (Gold Standard tables)
        resources :profit_loss_reports, only: [ :index, :show ] do
          collection do
            post :generate
          end
          member do
            post :regenerate
            get :download
          end
        end
        resources :balance_sheet_reports, only: [ :index, :show ] do
          collection do
            post :generate
          end
          member do
            post :regenerate
            get :download
          end
        end
      end

      # Company Groups
      resources :company_groups, controller: "corporate_groups" do
        member do
          get :companies
          get :structure
          get :contacts  # SSoT: Get all contacts/memberships in this group
        end
      end

      # Cases/Actions System (Investigation & Audit)
      resources :cases do
        collection do
          get :types  # Get available case types, statuses, action types
        end
        member do
          # Case content
          get :actions
          get :documents
          get :emails
          get :timeline
          get :contacts
          get :companies
          get :jobs

          # Relationship visualization
          get :relationship_graph

          # Warehouse integration
          get :warehouse_summary
          get :search_emails
          get :search_documents
          get :financial_analysis
          post :build_timeline

          # Add items to case
          post :add_document
          post :add_email
          post :add_contact
          post :add_company
          post :add_job

          # Run actions
          post :run_action

          # Contact positions for chart
          patch "contacts/:contact_id/position", action: :update_contact_position
          # Case contact relationship details
          get "contacts/:contact_id", action: :get_case_contact
          patch "contacts/:contact_id", action: :update_case_contact
          delete "contacts/:contact_id", action: :remove_contact

          # Create sub-case
          post :create_child

          # Document management
          get :qa_pairs
          patch "qa_pairs/:qa_id", action: :update_qa_pair
          get :duplicates
          post :resolve_duplicate
          get :processing_status
          post :reprocess_documents
          patch :folder_settings, action: :update_folder_settings

          # OneDrive folder management
          post :create_folder
          get :folder_info
        end
      end

      # Consolidation / Intercompany Reconciliation
      resources :consolidation, only: [ :index ] do
        collection do
          get :mismatches
          get "company/:company_id", to: "consolidation#company_summary", as: :company_summary
        end
      end
      resources :consolidation, param: :company_group_id, only: [ :show ] do
        member do
          post :reconcile
          get :relationships
          get :reports
        end
      end

      # Company Loans (global view)
      get "company_loans", to: "corporate_company_loans#all"

      # Minute Templates
      resources :minute_templates do
        member do
          post :preview
        end
      end

      # Xero Chart of Accounts (Standard COA per group)
      resources :xero_chart_of_accounts do
        collection do
          get "for_company/:company_id", action: :for_company
          get :with_company_presence
          get :company_accounts
          post :sync_from_xero
          post :copy_to_group
        end
      end

      # Director Onboarding (self-service director compliance portal)
      resources :director_onboarding_requests do
        member do
          post :approve
          post :reject
          post :resend_invitation
        end
        collection do
          # Public routes (no auth required)
          get "public/:access_token", action: :show_public
          post "public/:access_token/submit", action: :submit
          post "public/:access_token/upload", action: :upload_document
        end
      end

      # ASIC Lookup (ABR API for ABN/ACN lookups)
      resources :asic, only: [] do
        collection do
          get :lookup_abn
          get :lookup_acn
          get :search
          get :validate_abn
          get :validate_acn
          post :auto_populate
        end
      end

      # Corporate SharePoint (document scanning for corporate entities)
      # URL kept as corporate_onedrive for backwards compatibility
      resources :corporate_onedrive, only: [], controller: "corporate_sharepoint" do
        collection do
          get :status
          get :preview
          get :browse
          post :scan
          post :scan_company
          post :import_documents
        end
      end

      # Document Types
      resources :document_types do
        collection do
          get :tabs
        end
      end

      # Entity Tabs (SSoT: Unified tab configuration)
      # Replaces: corporate_entity_tabs, job_tabs, document_folders config
      resources :entity_tabs do
        collection do
          post :reorder
          get 'for_scope/:scope', action: :for_scope, as: :for_scope
          get :entity_types
          put :entity_types, action: :update_entity_types
          get :document_type_counts
        end
        member do
          post :toggle
        end
      end

      # System Settings
      resources :system_settings, only: [ :index, :update ] do
        collection do
          get :sharepoint_path_templates
          put :update_sharepoint_path_templates
        end
      end

      # Bank Accounts
      resources :bank_accounts

      # Assets (World-Class Asset Register)
      resources :assets do
        member do
          # Service history
          get :service_history
          post :add_service

          # Insurance
          get :insurance
          post :insurance, to: "assets#update_insurance"
          put :insurance, to: "assets#update_insurance"

          # Documents
          get :documents

          # Depreciation (Asset Register)
          get :depreciation_profile
          patch :depreciation_profile, to: "assets#update_depreciation_profile"
          get :depreciation_schedule
          post :calculate_depreciation
          get :depreciation_forecast

          # Disposal
          post :dispose

          # Expenses
          get :expenses
          post :expenses, to: "assets#add_expense"

          # Odometer readings
          get :odometer_readings
          post :odometer_readings, to: "assets#add_odometer_reading"

          # User assignment
          patch :assign_user
        end
      end

      # Asset Reports (World-Class Asset Register Reports)
      resources :asset_reports, only: [] do
        collection do
          get :entity_types    # Available entity types for filtering
          get :register        # Full asset register report
          get :depreciation    # Depreciation schedule report
          get :insurance       # Insurance summary report
          get :summary         # Dashboard summary metrics
        end
      end

      # Company Documents (routes to CorporateCompanyDocumentsController)
      resources :company_documents, controller: "corporate_company_documents" do
        collection do
          get :duplicates
          post :analyze_duplicates
          post :resolve_duplicates
          post :auto_resolve_duplicates
          get :marked_for_deletion
          post :permanently_delete
          get :counts
        end
        member do
          get :download
          get :preview
          get :content
          post :validate
          post :ai_verify
          post :apply_ai_suggestion
          post :relocate
          post :feedback
          post :upload_edited
          post :split
          post :restore
        end
      end

      # Company Xero Connections
      resources :company_xero_connections, controller: "corporate_company_xero_connections", only: [ :index, :show, :destroy ] do
        collection do
          get :auth_url
          post :callback
        end
        member do
          post :sync_accounts
          get :status
          delete :disconnect
        end
      end

      # Company Compliance Items (routes to CorporateCompanyComplianceItemsController)
      resources :company_compliance_items, controller: "corporate_company_compliance_items", only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :mark_completed
        end
      end

      # Compliance Calendar (dashboard view)
      resources :compliance_calendar, only: [ :index ] do
        collection do
          get :summary
          get :overdue
          get :upcoming
          get :by_company
          post :generate
          post :send_reminders
        end
      end

      # WHS (Workplace Health & Safety) Module
      # WHS Dashboard & Stats
      get "whs/stats", to: "whs#stats"
      get "whs/incidents", to: "whs#incidents"
      get "whs/swms", to: "whs#swms"

      # SWMS (Safe Work Method Statements)
      resources :whs_swms, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :submit_for_approval
          post :approve
          post :reject
          post :supersede
          post :acknowledge
        end
      end

      # WHS Inspections
      resources :whs_inspections, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :start
          post :complete
        end
      end

      # WHS Inspection Templates
      resources :whs_inspection_templates, only: [ :index, :show, :create, :update, :destroy ]

      # WHS Incidents
      resources :whs_incidents, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :investigate
          post :close
          post :notify_workcov
        end
      end

      # WHS Inductions
      resources :whs_inductions, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :complete
          post :mark_expired
        end
      end

      # WHS Induction Templates
      resources :whs_induction_templates, only: [ :index, :show, :create, :update, :destroy ]

      # WHS Action Items
      resources :whs_action_items, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          post :start
          post :complete
          post :cancel
        end
      end

      # WHS Settings
      resources :whs_settings, only: [ :index, :show, :create, :update, :destroy ] do
        collection do
          get "key/:key", action: :show_by_key
          patch "key/:key", action: :update_by_key
        end
      end

      # Financial Tracking & Reporting
      resources :financial_transactions do
        member do
          post :post # Post a draft transaction
        end
        collection do
          get :summary
          get :categories
        end
      end

      # Financial Reports
      get "financial_reports/balance_sheet", to: "financial_reports#balance_sheet"
      get "financial_reports/profit_loss", to: "financial_reports#profit_loss"
      get "financial_reports/job_profitability", to: "financial_reports#job_profitability"
      get "financial_reports/account_balances", to: "financial_reports#account_balances"
      get "financial_reports/trial_balance", to: "financial_reports#trial_balance"

      # Financial Exports
      get "financial_exports/transactions", to: "financial_exports#transactions"
      get "financial_exports/balance_sheet", to: "financial_exports#balance_sheet"
      get "financial_exports/profit_loss", to: "financial_exports#profit_loss"
      get "financial_exports/job_profitability", to: "financial_exports#job_profitability"
      get "financial_exports/chart_of_accounts", to: "financial_exports#chart_of_accounts"
      get "financial_exports/accountant_package", to: "financial_exports#accountant_package"

      # Chart of Accounts
      resources :chart_of_accounts, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          get :balance
        end
        collection do
          get :kinds
        end
      end

      # Pay Now Requests (admin/supervisor interface)
      resources :pay_now_requests, only: [ :index, :show ] do
        member do
          post :approve
          post :reject
        end
        collection do
          get :dashboard_stats
          get :pending_approval
        end
      end

      # Pay Now Weekly Limits (builder settings)
      resources :pay_now_weekly_limits, only: [] do
        collection do
          get :current
          post :set_limit
          get :history
          get :usage_report
        end
      end

      # Portal Users Admin Management (uses regular auth, not portal auth)
      # This is an admin-only endpoint at /api/v1/portal/users
      scope "/portal" do
        resources :portal_users, path: "users", only: [ :index, :show ]
      end

      # Subcontractor Portal routes (for external subcontractor access)
      namespace :portal do
        # Portal authentication
        post "auth/login", to: "authentication#login"
        post "auth/signup", to: "authentication#signup"
        post "auth/forgot_password", to: "authentication#forgot_password"
        post "auth/reset_password", to: "authentication#reset_password"
        get "auth/me", to: "authentication#me"

        # Quote requests (subcontractor view)
        resources :quote_requests, only: [ :index, :show ] do
          member do
            post :reject
          end
        end

        # Quote responses (submit and manage quotes)
        resources :quote_responses, only: [ :create, :update, :show ]

        # Jobs tracking
        resources :jobs, only: [ :index, :show ] do
          member do
            post :mark_arrival
            post :mark_complete
            post :upload_photos
            post :report_issue
          end
        end

        # SM Gantt Tasks (supplier schedule view)
        resources :sm_tasks, only: [ :index, :show, :update ] do
          member do
            post :add_comment
            get :comments
            get :photos
            post :upload_photo
          end
          collection do
            get :activities
            get :schedule
          end
        end

        # Invoices
        resources :invoices, only: [ :index, :show, :create, :update, :destroy ] do
          member do
            post :retry_sync
          end
          collection do
            get :stats
          end
        end

        # Accounting integrations
        resources :accounting_integrations, only: [ :index, :show, :destroy ] do
          collection do
            get :oauth_url
            post :oauth_callback
          end
          member do
            post :refresh
            get :test_connection
          end
        end

        # Kudos system
        resources :kudos, only: [ :index ] do
          collection do
            get :leaderboard
            get :events
            get :trends
            post :recalculate
          end
        end

        # Pay Now requests (supplier early payment)
        resources :pay_now_requests, only: [ :index, :show, :create, :destroy ] do
          member do
            post :upload_documents
          end
          collection do
            get :eligible_purchase_orders
          end
        end
      end

      # Quote Requests (internal builder interface)
      resources :quote_requests do
        member do
          post :accept_quote
          post :close
          post :convert_to_po
        end
        collection do
          get :stats
        end
      end

      # Data Warehouse API
      namespace :warehouse do
        # Metadata (data dictionary)
        get "/", to: "warehouse_metadata#index", as: :metadata_index
        get "metadata", to: "warehouse_metadata#index", as: :metadata
        get "metadata/:id", to: "warehouse_metadata#show", as: :metadata_show

        # Export endpoints
        get "export", to: "warehouse_exports#index", as: :export
        get "export/:id", to: "warehouse_exports#show", as: :export_view

        # Status and health
        get "status", to: "warehouse_status#index", as: :status
        get "status/:id", to: "warehouse_status#show", as: :status_view
        get "health", to: "warehouse_status#health", as: :health
        post "refresh", to: "warehouse_status#refresh", as: :refresh
      end

      # External integrations (API endpoints for third-party systems)
      namespace :external do
        post "unreal_estimates", to: "unreal_estimates#create"
      end
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
