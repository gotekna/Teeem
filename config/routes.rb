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
      resources :feature_trackers, only: [:index, :create, :update, :destroy]

      # Authentication routes
      post 'auth/signup', to: 'authentication#signup'
      post 'auth/login', to: 'authentication#login'
      get 'auth/me', to: 'authentication#me'
      get 'auth/dev_login', to: 'authentication#dev_login'  # Dev mode only

      # Import routes
      post 'imports/upload', to: 'imports#upload'
      post 'imports/execute', to: 'imports#execute'
      get 'imports/status/:session_key', to: 'imports#status'

      # CSV Import routes
      post 'csv_imports/job_with_pos', to: 'csv_imports#import_job_with_pos'

      # Grok AI integration
      post 'grok/chat', to: 'grok#chat'
      get 'grok/suggest-features', to: 'grok#suggest_features'
      post 'grok/plans', to: 'grok#create_plan'
      get 'grok/plans', to: 'grok#list_plans'
      get 'grok/plans/:id', to: 'grok#show_plan'
      patch 'grok/plans/:id', to: 'grok#update_plan'

      # Git integration
      get 'git/branch_status', to: 'git#branch_status'

      # System & Performance Monitoring
      get 'system/health', to: 'system#health'
      get 'system/performance', to: 'system#performance'
      get 'system/metrics', to: 'system#metrics'

      # Health checks
      get 'health/pricebook', to: 'health#pricebook'
      get 'health/pricebook/missing_items', to: 'health#missing_items'
      get 'pricebook/price_health_check', to: 'pricebook_items#price_health_check'

      # Construction jobs management
      resources :constructions do
        member do
          get :saved_messages
          get :emails
          get :documentation_tabs
        end

        # Construction contacts (nested under constructions)
        resources :construction_contacts, only: [:index, :create, :update, :destroy]

        # Schedule tasks (nested under constructions)
        resources :schedule_tasks, only: [:index, :create] do
          collection do
            post :import
            post :copy_from_template
            get :gantt_data
          end
        end

        # Document tasks (nested under constructions)
        resources :document_tasks, only: [:index] do
          member do
            post :upload
            post :validate
          end
        end

        # Rain logs (nested under constructions)
        resources :rain_logs, only: [:index, :show, :create, :update, :destroy]

        # Meetings (nested under constructions)
        resources :meetings, only: [:index, :create]

      end

      # Schedule tasks (non-nested routes)
      resources :schedule_tasks, only: [:show, :update, :destroy] do
        member do
          patch :match_po
          delete :unmatch_po
        end

        # Checklist items for supervisor checks
        resources :checklist_items, controller: 'schedule_task_checklist_items', only: [:index, :create, :update, :destroy] do
          member do
            post :toggle
          end
        end
      end

      # Master Schedule - Projects
      resources :projects do
        member do
          get :gantt
        end

        # Project tasks (nested under projects)
        resources :tasks, controller: 'project_tasks' do
          member do
            post :auto_complete_subtasks
          end
        end
      end

      # Meetings (non-nested routes)
      resources :meetings, only: [:index, :show, :update, :destroy] do
        member do
          post :start
          post :complete
          post :cancel
        end
      end

      # Meeting Types configuration
      resources :meeting_types, only: [:index, :show, :create, :update, :destroy] do
        collection do
          get :categories
        end
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
        end
        # Payments nested under purchase orders
        resources :payments, only: [:index, :create]
      end

      # Payments (standalone routes)
      resources :payments, only: [:show, :update, :destroy] do
        member do
          post :sync_to_xero
        end
      end

      # Price Book management
      resources :pricebook, controller: 'pricebook_items', path: 'pricebook' do
        member do
          get :history
          post :fetch_image
          post :update_image
          post :add_price
          post :set_default_supplier
          delete 'price_histories/:history_id', to: 'pricebook_items#delete_price_history'
          patch 'price_histories/:history_id', to: 'pricebook_items#update_price_history'
          get 'proxy_image/:file_type', to: 'pricebook_items#proxy_image', as: :proxy_image
        end
        collection do
          patch :bulk_update
          post :import
          post :preview
          post :fetch_all_images
          get :image_stats
          get :export_price_history
          post :import_price_history
        end
      end

      # Gold Standard Items (Demo/Reference Price Book)
      resources :gold_standard_items, only: [:index, :create, :update, :destroy]

      # Column Types - Single Source of Truth from Gold Standard Reference Table
      resources :column_types, only: [:index, :show, :update]

      # Gold Table Sync Check - Compare column types across all sources
      get 'gold_table_sync', to: 'gold_table_sync#index'

      # Suppliers management
      resources :suppliers do
        collection do
          get :unmatched
          get :needs_review
          post :auto_match
        end
        member do
          post :link_contact
          post :unlink_contact
          post :verify_match
          get 'pricebook/export', to: 'suppliers#export_pricebook'
          post 'pricebook/import', to: 'suppliers#import_pricebook'
          patch 'pricebook/:item_id', to: 'suppliers#update_pricebook_item'
        end
      end

      # Contact roles management
      resources :contact_roles, only: [ :index, :create, :update, :destroy ]

      # Contacts management
      resources :contacts do
        collection do
          patch :bulk_update
          post :merge
          post :match_supplier
          get :validate_abn
        end
        member do
          get :categories
          post :copy_price_history
          delete :remove_from_categories
          post :bulk_update_prices
          delete :delete_price_column
          get :activities
          post :link_xero_contact
          post :portal_user, to: 'contacts#create_portal_user'
          patch :portal_user, to: 'contacts#update_portal_user'
          delete :portal_user, to: 'contacts#delete_portal_user'
        end

        # Contact relationships (nested under contacts)
        resources :relationships, controller: 'contact_relationships', only: [:index, :create, :show, :update, :destroy]

        # SMS messages (nested under contacts)
        resources :sms_messages, only: [:index, :create]
      end

      # SMS webhooks (Twilio callbacks - not nested)
      post 'sms/webhook', to: 'sms_messages#webhook'
      post 'sms/status', to: 'sms_messages#status_webhook'

      # Chat messages
      resources :chat_messages, only: [:index, :create, :destroy] do
        collection do
          get :unread_count
          post :mark_as_read
          post :save_conversation_to_job
        end
        member do
          post :save_to_job
        end
      end

      # Users management
      resources :users, only: [:index, :show, :update, :destroy]

      # Workflow management
      resources :workflow_definitions
      resources :workflow_steps, only: [:index, :show] do
        member do
          post :approve
          post :reject
          post :request_changes
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

      # Outlook integration
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
        end
      end

      # Designs library
      resources :designs

      # Company Settings
      resource :company_settings, only: [:show, :update] do
        post :test_twilio, on: :collection
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
      post 'setup/pull_from_local', to: 'setup#pull_from_local'
      post 'setup/sync_users', to: 'setup#sync_users'
      post 'setup/sync_documentation_categories', to: 'setup#sync_documentation_categories'
      post 'setup/sync_supervisor_checklists', to: 'setup#sync_supervisor_checklists'
      post 'setup/sync_schedule_templates', to: 'setup#sync_schedule_templates'
      post 'setup/sync_folder_templates', to: 'setup#sync_folder_templates'

      # Documentation Categories (Global)
      resources :documentation_categories do
        collection do
          post :reorder
        end
      end

      # TRAPID_DOCS Documentation Viewer
      get 'documentation', to: 'documentation#index'
      get 'documentation/search', to: 'documentation#search'
      get 'documentation/:id', to: 'documentation#show'

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
      resources :agents, only: [:index] do
        collection do
          get :shortcuts
        end
      end

      # User roles
      resources :roles, only: [:index]

      # Permissions management
      get 'permissions', to: 'permissions#index'
      get 'permissions/roles', to: 'permissions#roles'
      get 'permissions/user/:id', to: 'permissions#user_permissions'
      post 'permissions/grant', to: 'permissions#grant'

      # Contact types
      resources :contact_types, only: [:index]

      # Legacy routes for backwards compatibility
      resources :documentation_entries, controller: 'trinity' do
        collection do
          get :stats
          post :export_lexicon
          post :export_teacher
        end
      end

      resources :documented_bugs, controller: 'trinity' do
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

      # Schedule Templates for Schedule Master
      resources :schedule_templates do
        collection do
          get :default
        end
        member do
          post :duplicate
          post :set_as_default
        end
        # Template rows (nested under schedule_templates)
        resources :rows, controller: 'schedule_template_rows', except: [:index, :show] do
          collection do
            post :bulk_update
            post :reorder
          end
          member do
            get :audit_logs
          end
        end
      end

      # ============================================
      # SM Gantt (Schedule Master v2)
      # ============================================

      # SM Tasks (nested under constructions)
      resources :constructions, only: [] do
        resources :sm_tasks, only: [:index, :create] do
          collection do
            get :gantt_data
            post :copy_from_template
          end
        end
      end

      # SM Tasks (non-nested routes)
      resources :sm_tasks, only: [:show, :update, :destroy] do
        member do
          post :start
          post :complete
          post :hold
          post :release_hold
        end

        # Dependencies (nested under sm_tasks)
        resources :dependencies, controller: 'sm_dependencies', only: [:index, :create]
      end

      # SM Dependencies (non-nested routes)
      resources :sm_dependencies, only: [:show, :update, :destroy] do
        member do
          post :restore
        end
      end

      # SM Hold Reasons (admin)
      resources :sm_hold_reasons, only: [:index, :show, :create, :update, :destroy] do
        collection do
          post :reorder
          post :seed_defaults
        end
      end

      # SM Settings (singleton - admin)
      resource :sm_settings, only: [:show, :update]

      # ============================================
      # SM Gantt Phase 2 - Resource Allocation
      # ============================================

      # SM Resources (people, equipment, materials)
      resources :sm_resources, only: [:index, :show, :create, :update, :destroy] do
        collection do
          get :availability
        end
      end

      # SM Resource Allocations (nested under tasks)
      resources :sm_tasks, only: [] do
        resources :resource_allocations, controller: 'sm_resource_allocations', only: [:index, :create]
        resources :time_entries, controller: 'sm_time_entries', only: [:index, :create]
      end

      # SM Resource Allocations (non-nested)
      resources :sm_resource_allocations, only: [:show, :update, :destroy] do
        member do
          post :confirm
          post :start
          post :complete
        end
        collection do
          get 'by_resource/:resource_id', action: :by_resource
          get :gantt_data
        end
      end

      # SM Time Entries (non-nested)
      resources :sm_time_entries, only: [:show, :update, :destroy] do
        member do
          post :approve
        end
        collection do
          post :bulk_approve
          get 'by_resource/:resource_id', action: :by_resource
          get :timesheet
        end
      end

      # ============================================
      # End SM Gantt
      # ============================================

      # Public Holidays
      resources :public_holidays, only: [:index, :create, :destroy] do
        collection do
          get :dates
        end
      end

      # Bug Hunter Tests
      resources :bug_hunter_tests, only: [:index] do
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

      # Xero integration
      resources :xero, only: [] do
        collection do
          get :auth_url
          post :callback
          get :status
          delete :disconnect
          get :invoices
          post :match_invoice
          post :webhook
          post :sync_contacts
          get :sync_status
          get :sync_history
          get :tax_rates
          get :accounts
          get :search_contacts
        end
        member do
          get :sync_contacts_status
        end
      end

      # OneDrive integration (per-job - legacy)
      get 'onedrive/authorize', to: 'one_drive#authorize'
      get 'onedrive/callback', to: 'one_drive#callback'
      get 'onedrive/status', to: 'one_drive#status'
      delete 'onedrive/disconnect', to: 'one_drive#disconnect'
      post 'onedrive/create_folders', to: 'one_drive#create_folders'
      get 'onedrive/folders', to: 'one_drive#list_items'
      post 'onedrive/upload', to: 'one_drive#upload'
      get 'onedrive/download', to: 'one_drive#download'

      # OneDrive integration (organization-wide)
      get 'organization_onedrive/status', to: 'organization_onedrive#status'
      get 'organization_onedrive/authorize', to: 'organization_onedrive#authorize'
      get 'organization_onedrive/callback', to: 'organization_onedrive#callback'
      delete 'organization_onedrive/disconnect', to: 'organization_onedrive#disconnect'
      get 'organization_onedrive/browse_folders', to: 'organization_onedrive#browse_folders'
      patch 'organization_onedrive/change_root_folder', to: 'organization_onedrive#change_root_folder'
      post 'organization_onedrive/create_job_folders', to: 'organization_onedrive#create_job_folders'
      get 'organization_onedrive/job_folders', to: 'organization_onedrive#list_job_items'
      post 'organization_onedrive/upload', to: 'organization_onedrive#upload'
      get 'organization_onedrive/download', to: 'organization_onedrive#download'
      get 'organization_onedrive/preview_pricebook_matches', to: 'organization_onedrive#preview_pricebook_matches'
      post 'organization_onedrive/apply_pricebook_matches', to: 'organization_onedrive#apply_pricebook_matches'
      post 'organization_onedrive/sync_pricebook_images', to: 'organization_onedrive#sync_pricebook_images'

      # Schema information
      get 'schema', to: 'schema#index'
      get 'schema/tables', to: 'schema#tables'
      get 'schema/system_table_columns/:table_name', to: 'schema#system_table_columns'

      # Table management
      resources :tables do
        # Column management
        resources :columns, only: [:create, :update, :destroy] do
          collection do
            post :test_formula
          end
          member do
            get :lookup_options
            get :lookup_search
          end
        end

        # Record management for dynamic tables
        resources :records
      end

      # Estimates management (from Unreal Engine or other sources)
      resources :estimates, only: [:index, :show, :destroy] do
        member do
          patch :match
          post :generate_purchase_orders
          post :ai_review, to: 'estimate_reviews#create'
        end
        resources :reviews, controller: 'estimate_reviews', only: [:index]
      end

      # Estimate Reviews (AI Plan Analysis)
      resources :estimate_reviews, only: [:show, :destroy]

      # Unreal Variables management
      resources :unreal_variables

      # Corporate Entity Management
      resources :companies do
        collection do
          post :import
        end
        member do
          get :directors
          post :add_director
          delete 'directors/:director_id', to: 'companies#remove_director'
          get :compliance_items
          get :activities
          get :documents
          get :assets
        end
      end

      # Bank Accounts
      resources :bank_accounts

      # Assets
      resources :assets do
        member do
          get :service_history
          post :add_service
          get :insurance
          post :insurance, to: 'assets#update_insurance'
          put :insurance, to: 'assets#update_insurance'
        end
      end

      # Company Documents
      resources :company_documents do
        member do
          get :download
        end
      end

      # Company Xero Connections
      resources :company_xero_connections, only: [:index, :show, :destroy] do
        collection do
          get :auth_url
          post :callback
        end
        member do
          post :sync_accounts
          get :status
          delete :disconnect, to: 'company_xero_connections#disconnect'
        end
      end

      # Company Compliance Items
      resources :company_compliance_items, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :mark_completed
        end
      end

      # WHS (Workplace Health & Safety) Module
      # SWMS (Safe Work Method Statements)
      resources :whs_swms, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :submit_for_approval
          post :approve
          post :reject
          post :supersede
          post :acknowledge
        end
      end

      # WHS Inspections
      resources :whs_inspections, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :start
          post :complete
        end
      end

      # WHS Inspection Templates
      resources :whs_inspection_templates, only: [:index, :show, :create, :update, :destroy]

      # WHS Incidents
      resources :whs_incidents, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :investigate
          post :close
          post :notify_workcov
        end
      end

      # WHS Inductions
      resources :whs_inductions, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :complete
          post :mark_expired
        end
      end

      # WHS Induction Templates
      resources :whs_induction_templates, only: [:index, :show, :create, :update, :destroy]

      # WHS Action Items
      resources :whs_action_items, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :start
          post :complete
          post :cancel
        end
      end

      # WHS Settings
      resources :whs_settings, only: [:index, :show, :create, :update, :destroy] do
        collection do
          get 'key/:key', action: :show_by_key
          patch 'key/:key', action: :update_by_key
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
      get 'financial_reports/balance_sheet', to: 'financial_reports#balance_sheet'
      get 'financial_reports/profit_loss', to: 'financial_reports#profit_loss'
      get 'financial_reports/job_profitability', to: 'financial_reports#job_profitability'
      get 'financial_reports/account_balances', to: 'financial_reports#account_balances'
      get 'financial_reports/trial_balance', to: 'financial_reports#trial_balance'

      # Financial Exports
      get 'financial_exports/transactions', to: 'financial_exports#transactions'
      get 'financial_exports/balance_sheet', to: 'financial_exports#balance_sheet'
      get 'financial_exports/profit_loss', to: 'financial_exports#profit_loss'
      get 'financial_exports/job_profitability', to: 'financial_exports#job_profitability'
      get 'financial_exports/chart_of_accounts', to: 'financial_exports#chart_of_accounts'
      get 'financial_exports/accountant_package', to: 'financial_exports#accountant_package'

      # Chart of Accounts
      resources :chart_of_accounts, only: [:index, :show, :create, :update, :destroy] do
        member do
          get :balance
        end
        collection do
          get :kinds
        end
      end

      # Pay Now Requests (admin/supervisor interface)
      resources :pay_now_requests, only: [:index, :show] do
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

      # Subcontractor Portal routes (for external subcontractor access)
      namespace :portal do
        # Portal authentication
        post 'auth/login', to: 'authentication#login'
        post 'auth/signup', to: 'authentication#signup'
        post 'auth/forgot_password', to: 'authentication#forgot_password'
        post 'auth/reset_password', to: 'authentication#reset_password'
        get 'auth/me', to: 'authentication#me'

        # Quote requests (subcontractor view)
        resources :quote_requests, only: [:index, :show] do
          member do
            post :reject
          end
        end

        # Quote responses (submit and manage quotes)
        resources :quote_responses, only: [:create, :update, :show]

        # Jobs tracking
        resources :jobs, only: [:index, :show] do
          member do
            post :mark_arrival
            post :mark_complete
            post :upload_photos
            post :report_issue
          end
        end

        # Invoices
        resources :invoices, only: [:index, :show, :create, :update, :destroy] do
          member do
            post :retry_sync
          end
          collection do
            get :stats
          end
        end

        # Accounting integrations
        resources :accounting_integrations, only: [:index, :show, :destroy] do
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
        resources :kudos, only: [:index] do
          collection do
            get :leaderboard
            get :events
            get :trends
            post :recalculate
          end
        end

        # Pay Now requests (supplier early payment)
        resources :pay_now_requests, only: [:index, :show, :create, :destroy] do
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

      # External integrations (API endpoints for third-party systems)
      namespace :external do
        post 'unreal_estimates', to: 'unreal_estimates#create'
      end
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
