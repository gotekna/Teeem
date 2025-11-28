module Api
  module V1
    class XeroController < ApplicationController
      # GET /api/v1/xero/auth_url
      # Returns the Xero OAuth authorization URL
      def auth_url
        begin
          client = XeroApiClient.new
          url = client.authorization_url

          render json: {
            success: true,
            auth_url: url
          }
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero auth_url error: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :service_unavailable
        rescue StandardError => e
          Rails.logger.error("Xero auth_url unexpected error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to generate authorization URL"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/callback
      # Handles the OAuth callback and exchanges code for tokens
      def callback
        code = params[:code]

        unless code.present?
          return render json: {
            success: false,
            error: "Authorization code is required"
          }, status: :bad_request
        end

        begin
          client = XeroApiClient.new
          result = client.exchange_code_for_token(code)

          render json: {
            success: true,
            message: "Successfully connected to Xero",
            data: {
              tenant_name: result[:tenant_name],
              tenant_id: result[:tenant_id],
              expires_at: result[:expires_at]
            }
          }
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero callback auth error: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :unauthorized
        rescue XeroApiClient::ApiError => e
          Rails.logger.error("Xero callback API error: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error("Xero callback unexpected error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to connect to Xero"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/status
      # Returns the current Xero connection status
      def status
        begin
          client = XeroApiClient.new
          status = client.connection_status

          render json: {
            success: true,
            data: status
          }
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.warn("Xero status - credentials not configured: #{e.message}")
          render json: {
            success: true,
            data: {
              connected: false,
              message: 'Xero integration not configured'
            }
          }
        rescue StandardError => e
          Rails.logger.error("Xero status error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to get connection status"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/tenants
      # Returns all available Xero tenants (organizations) from stored credentials
      def tenants
        tenants = XeroCredential.all.map do |cred|
          {
            tenant_id: cred.tenant_id,
            tenant_name: cred.tenant_name,
            connected_at: cred.created_at
          }
        end

        render json: {
          success: true,
          tenants: tenants
        }
      end

      # DELETE /api/v1/xero/disconnect
      # Disconnects from Xero and removes stored credentials
      def disconnect
        begin
          client = XeroApiClient.new
          result = client.disconnect

          if result[:success]
            render json: {
              success: true,
              message: result[:message]
            }
          else
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Xero disconnect error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to disconnect from Xero"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/invoices
      # Fetches invoices from Xero (with optional filters)
      def invoices
        begin
          client = XeroApiClient.new

          # Build query parameters
          query_params = {}

          # Filter by date range if provided
          if params[:from_date].present?
            query_params[:where] = "Date >= DateTime(#{params[:from_date]})"
          end

          # Filter by status
          if params[:status].present?
            status_filter = "Status == \"#{params[:status]}\""
            query_params[:where] = query_params[:where].present? ?
              "#{query_params[:where]} AND #{status_filter}" : status_filter
          end

          # Add pagination
          query_params[:page] = params[:page] || 1

          result = client.get('Invoices', query_params)

          if result[:success]
            invoices = result[:data]['Invoices'] || []

            render json: {
              success: true,
              data: {
                invoices: invoices,
                count: invoices.length
              }
            }
          else
            render json: {
              success: false,
              error: 'Failed to fetch invoices'
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero invoices auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue XeroApiClient::ApiError => e
          Rails.logger.error("Xero invoices API error: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error("Xero invoices unexpected error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch invoices"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/match_invoice
      # Matches a Xero invoice to a Purchase Order
      def match_invoice
        invoice_id = params[:invoice_id]
        purchase_order_id = params[:purchase_order_id]

        unless invoice_id.present?
          return render json: {
            success: false,
            error: "Invoice ID is required"
          }, status: :bad_request
        end

        begin
          # Fetch invoice from Xero
          client = XeroApiClient.new
          result = client.get("Invoices/#{invoice_id}")

          unless result[:success]
            return render json: {
              success: false,
              error: "Failed to fetch invoice from Xero"
            }, status: :unprocessable_entity
          end

          invoice_data = result[:data]['Invoices']&.first

          unless invoice_data
            return render json: {
              success: false,
              error: "Invoice not found in Xero"
            }, status: :not_found
          end

          # Match invoice to PO
          match_result = InvoiceMatchingService.call(
            invoice_data: invoice_data,
            purchase_order_id: purchase_order_id
          )

          if match_result[:success]
            render json: {
              success: true,
              message: match_result[:message],
              data: {
                purchase_order_id: match_result[:purchase_order].id,
                purchase_order_number: match_result[:purchase_order].purchase_order_number,
                payment_status: match_result[:payment_status],
                invoice_total: match_result[:invoice_total],
                po_total: match_result[:po_total],
                percentage: match_result[:percentage]
              }
            }
          else
            render json: {
              success: false,
              error: match_result[:error]
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero match_invoice auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero match_invoice error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to match invoice: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/webhook
      # Receives Xero webhooks (for future use)
      def webhook
        # Verify webhook signature
        unless verify_xero_webhook_signature
          return render json: {
            success: false,
            error: 'Invalid webhook signature'
          }, status: :unauthorized
        end

        # Parse webhook payload
        payload = JSON.parse(request.body.read)
        events = payload['events'] || []

        # Process events (can be expanded for specific event types)
        events.each do |event|
          Rails.logger.info("Xero webhook event: #{event['eventType']} - Resource: #{event['resourceId']}")

          case event['eventType']
          when 'CREATE', 'UPDATE'
            if event['eventType'].include?('INVOICE')
              # Queue background job to sync invoice
              # XeroInvoiceSyncJob.perform_later(event['resourceId'])
            elsif event['eventType'].include?('CONTACT')
              # Queue background job to sync contact
              # XeroContactSyncJob.perform_later(event['resourceId'])
            end
          end
        end

        render json: {
          success: true,
          message: 'Webhook received and queued for processing'
        }, status: :ok
      rescue JSON::ParserError => e
        Rails.logger.error("Failed to parse Xero webhook: #{e.message}")
        render json: { success: false, error: 'Invalid JSON payload' }, status: :bad_request
      end

      # POST /api/v1/xero/sync_contacts
      # Queues a background job for full two-way contact sync between TEEEM and Xero
      def sync_contacts
        begin
          Rails.logger.info("Contact sync job queued via API")

          # Check if Xero is authenticated before queuing
          client = XeroApiClient.new
          status = client.connection_status

          unless status[:connected] && !status[:expired]
            return render json: {
              success: false,
              error: 'Not authenticated with Xero. Please connect to Xero first.'
            }, status: :unauthorized
          end

          # Queue the background job
          job = XeroContactSyncJob.perform_later
          job_id = job.job_id

          # Initialize job metadata (skip cache write if cache is not configured)
          begin
            Rails.cache.write(
              "xero_sync_job_#{job_id}",
              {
                job_id: job_id,
                status: 'queued',
                queued_at: Time.current,
                total: 0,
                processed: 0
              },
              expires_in: 24.hours
            )
          rescue StandardError => cache_error
            Rails.logger.warn("Failed to write job metadata to cache: #{cache_error.message}")
          end

          render json: {
            success: true,
            message: 'Contact sync job queued successfully',
            data: {
              job_id: job_id,
              status: 'queued',
              queued_at: Time.current
            }
          }
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero sync_contacts auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero. Please connect to Xero first.'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero sync_contacts unexpected error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: {
            success: false,
            error: "Failed to queue contact sync: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/sync_contacts/:job_id
      # Check the status of a contact sync job
      def sync_contacts_status
        job_id = params[:id]

        unless job_id.present?
          return render json: {
            success: false,
            error: 'Job ID is required'
          }, status: :bad_request
        end

        begin
          # Retrieve job metadata from cache
          job_data = Rails.cache.read("xero_sync_job_#{job_id}")

          if job_data.nil?
            return render json: {
              success: false,
              error: 'Job not found or expired'
            }, status: :not_found
          end

          render json: {
            success: true,
            data: job_data
          }
        rescue StandardError => e
          Rails.logger.error("Xero sync_contacts_status error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to get job status"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/sync_status
      # Returns the last contact sync time and statistics, plus any active job info
      def sync_status
        begin
          # Get the most recent sync time from contacts
          last_synced_contact = Contact.where.not(last_synced_at: nil)
                                       .order(last_synced_at: :desc)
                                       .first

          # Get sync statistics
          total_contacts = Contact.count
          synced_contacts = Contact.where.not(xero_id: nil).count
          sync_enabled = Contact.where(sync_with_xero: true).count
          contacts_with_errors = Contact.where.not(xero_sync_error: nil).count

          # Check for active sync jobs
          active_job = find_active_sync_job

          response_data = {
            last_sync_at: last_synced_contact&.last_synced_at,
            total_contacts: total_contacts,
            synced_contacts: synced_contacts,
            sync_enabled_contacts: sync_enabled,
            contacts_with_errors: contacts_with_errors,
            sync_percentage: total_contacts.zero? ? 0 : ((synced_contacts.to_f / total_contacts) * 100).round(2)
          }

          # Add active job info if present
          response_data[:active_job] = active_job if active_job

          render json: {
            success: true,
            data: response_data
          }
        rescue StandardError => e
          Rails.logger.error("Xero sync_status error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to get sync status"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/sync_history
      # Returns recent sync activity for contacts
      def sync_history
        begin
          # Get recently synced contacts (last 50)
          recent_syncs = Contact.where.not(last_synced_at: nil)
                                .order(last_synced_at: :desc)
                                .limit(50)
                                .select(:id, :full_name, :first_name, :last_name, :email, :last_synced_at, :xero_sync_error, :xero_id, :created_at, :updated_at)

          history_items = recent_syncs.map do |contact|
            {
              id: contact.id,
              contact_name: contact.full_name || "#{contact.first_name} #{contact.last_name}".strip,
              email: contact.email,
              synced_at: contact.last_synced_at,
              has_error: contact.xero_sync_error.present?,
              error_message: contact.xero_sync_error,
              action: determine_sync_action(contact),
              xero_id: contact.xero_id
            }
          end

          render json: {
            success: true,
            history: history_items
          }
        rescue StandardError => e
          Rails.logger.error("Xero sync_history error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch sync history"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/tax_rates
      # Fetches and syncs tax rates from Xero
      def tax_rates
        begin
          client = XeroApiClient.new
          result = client.get_tax_rates

          if result[:success]
            render json: {
              success: true,
              tax_rates: result[:tax_rates].map { |tr|
                {
                  code: tr.code,
                  name: tr.name,
                  rate: tr.rate,
                  display_rate: tr.display_rate,
                  tax_type: tr.tax_type
                }
              }
            }
          else
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero tax_rates auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero tax_rates error: #{e.message}")
          render json: {
            success: false,
            error: 'Failed to fetch tax rates'
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/accounts
      # Fetches and syncs chart of accounts from Xero
      def accounts
        begin
          client = XeroApiClient.new
          result = client.get_accounts

          if result[:success]
            # Allow filtering by account class (e.g., EXPENSE for purchase accounts)
            accounts = result[:accounts]
            if params[:account_class].present?
              accounts = accounts.where(account_class: params[:account_class])
            end

            render json: {
              success: true,
              accounts: accounts.map { |acc|
                {
                  code: acc.code,
                  name: acc.name,
                  display_name: acc.display_name,
                  account_type: acc.account_type,
                  account_class: acc.account_class,
                  tax_type: acc.tax_type,
                  description: acc.description
                }
              }
            }
          else
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero accounts auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero accounts error: #{e.message}")
          render json: {
            success: false,
            error: 'Failed to fetch accounts'
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/import_tracking_categories
      # Import all Xero tracking categories as Jobs
      def import_tracking_categories
        begin
          client = XeroApiClient.new
          status = client.connection_status

          unless status[:connected] && !status[:expired]
            return render json: {
              success: false,
              error: 'Not authenticated with Xero. Please connect to Xero first.'
            }, status: :unauthorized
          end

          service = XeroTrackingImportService.new
          result = service.import_all

          render json: result
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero import_tracking_categories auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero import_tracking_categories error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: {
            success: false,
            error: "Failed to import tracking categories: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/import_all_bills
      # Import all Xero bills as Purchase Orders
      def import_all_bills
        begin
          client = XeroApiClient.new
          status = client.connection_status

          unless status[:connected] && !status[:expired]
            return render json: {
              success: false,
              error: 'Not authenticated with Xero. Please connect to Xero first.'
            }, status: :unauthorized
          end

          service = XeroFullBillImportService.new
          result = service.import_all

          render json: result
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero import_all_bills auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero import_all_bills error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: {
            success: false,
            error: "Failed to import bills: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/import_all_claims
      # Import all Xero sales invoices (ACCREC) as JobClaims
      def import_all_claims
        begin
          client = XeroApiClient.new
          status = client.connection_status

          unless status[:connected] && !status[:expired]
            return render json: {
              success: false,
              error: 'Not authenticated with Xero. Please connect to Xero first.'
            }, status: :unauthorized
          end

          service = XeroClaimImportService.new
          result = service.import_all

          render json: result
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero import_all_claims auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero import_all_claims error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: {
            success: false,
            error: "Failed to import claims: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/full_import
      # Run full import: contacts, tracking categories, bills, and claims
      def full_import
        begin
          client = XeroApiClient.new
          status = client.connection_status

          unless status[:connected] && !status[:expired]
            return render json: {
              success: false,
              error: 'Not authenticated with Xero. Please connect to Xero first.'
            }, status: :unauthorized
          end

          results = {
            contacts: nil,
            tracking_categories: nil,
            bills: nil,
            claims: nil,
            success: true
          }

          # Step 1: Sync contacts
          Rails.logger.info("Full import: Starting contact sync")
          contact_service = XeroContactSyncService.new
          results[:contacts] = contact_service.sync

          # Step 2: Import tracking categories as jobs
          Rails.logger.info("Full import: Starting tracking category import")
          tracking_service = XeroTrackingImportService.new
          results[:tracking_categories] = tracking_service.import_all

          # Step 3: Import bills as purchase orders
          Rails.logger.info("Full import: Starting bill import")
          bill_service = XeroFullBillImportService.new
          results[:bills] = bill_service.import_all

          # Step 4: Import sales invoices as claims
          Rails.logger.info("Full import: Starting claims import")
          claim_service = XeroClaimImportService.new
          results[:claims] = claim_service.import_all

          Rails.logger.info("Full import completed")

          render json: results
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero full_import auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero full_import error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: {
            success: false,
            error: "Full import failed: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/search_contacts?query=search_term
      # Search for Xero contacts by name, email, or tax number
      def search_contacts
        query = params[:query]

        if query.blank?
          return render json: {
            success: false,
            error: 'Search query is required'
          }, status: :bad_request
        end

        # Require minimum 2 characters for search
        if query.length < 2
          return render json: {
            success: false,
            error: 'Search query must be at least 2 characters'
          }, status: :bad_request
        end

        begin
          client = XeroApiClient.new

          # Sanitize query to prevent OData injection
          # Escape double quotes and backslashes in the query string
          sanitized_query = query.gsub('\\', '\\\\\\\\').gsub('"', '\\"')

          # Search Xero contacts with a WHERE clause
          # Search by name, email, or tax number
          where_clause = "Name.Contains(\"#{sanitized_query}\") OR EmailAddress.Contains(\"#{sanitized_query}\") OR TaxNumber.Contains(\"#{sanitized_query}\")"

          Rails.logger.info("Xero contact search - Original query: '#{query}', Sanitized: '#{sanitized_query}'")

          result = client.get('Contacts', { where: where_clause })

          if result[:success]
            contacts = result[:data]['Contacts'] || []

            Rails.logger.info("Xero contact search - Found #{contacts.length} contacts")

            # Format contacts for the frontend
            formatted_contacts = contacts.map do |contact|
              {
                xero_id: contact['ContactID'],
                name: contact['Name'],
                email: contact['EmailAddress'],
                tax_number: contact['TaxNumber'],
                first_name: contact['FirstName'],
                last_name: contact['LastName'],
                phones: contact['Phones']
              }
            end

            render json: {
              success: true,
              contacts: formatted_contacts,
              count: formatted_contacts.length
            }
          else
            render json: {
              success: false,
              error: 'Failed to search Xero contacts'
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero search_contacts auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero. Please connect to Xero first.'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero search_contacts error: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: {
            success: false,
            error: "Failed to search contacts: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/contacts/:id
      # Fetch a single contact from Xero by ContactID
      def show_contact
        xero_contact_id = params[:id]
        tenant_id = params[:tenant_id]

        if xero_contact_id.blank?
          return render json: {
            success: false,
            error: 'Contact ID is required'
          }, status: :bad_request
        end

        begin
          client = XeroApiClient.new

          # Use tenant_id if provided (for multi-org support)
          result = if tenant_id.present?
            client.get("Contacts/#{xero_contact_id}", {}, tenant_id)
          else
            client.get("Contacts/#{xero_contact_id}")
          end

          if result[:success]
            xero_contact = result[:data]['Contacts']&.first

            if xero_contact
              render json: {
                success: true,
                data: {
                  contact: xero_contact
                }
              }
            else
              render json: {
                success: false,
                error: 'Contact not found in Xero'
              }, status: :not_found
            end
          else
            render json: {
              success: false,
              error: 'Failed to fetch contact from Xero'
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero show_contact auth error: #{e.message}")
          render json: {
            success: false,
            error: 'Not authenticated with Xero'
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero show_contact error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch contact: #{e.message}"
          }, status: :internal_server_error
        end
      end

      private

      # Determine what sync action was taken for a contact
      def determine_sync_action(contact)
        if contact.xero_sync_error.present?
          'Sync Failed'
        elsif contact.xero_id.present? && contact.created_at < contact.last_synced_at
          'Updated from Xero'
        elsif contact.xero_id.present?
          'Created from Xero'
        else
          'Synced to Xero'
        end
      end

      # Find the most recent active sync job
      def find_active_sync_job
        # This is a simple implementation using cache
        # In production, you might want to use a proper job tracking mechanism
        cache_keys = Rails.cache.instance_variable_get(:@data)&.keys || []
        job_keys = cache_keys.select { |k| k.to_s.start_with?('xero_sync_job_') }

        job_keys.each do |key|
          job_data = Rails.cache.read(key)
          if job_data && ['queued', 'processing'].include?(job_data[:status])
            return job_data
          end
        end

        nil
      end

      # Verify Xero webhook signature using HMAC-SHA256
      def verify_xero_webhook_signature
        webhook_key = ENV['XERO_WEBHOOK_KEY']

        unless webhook_key.present?
          Rails.logger.error("XERO_WEBHOOK_KEY not configured")
          return false
        end

        # Get signature from header
        signature = request.headers['X-Xero-Signature']

        unless signature.present?
          Rails.logger.warn("Missing X-Xero-Signature header")
          return false
        end

        # Read and verify the request body
        body = request.body.read
        request.body.rewind # Reset for later reading

        # Calculate expected signature
        expected_signature = Base64.strict_encode64(
          OpenSSL::HMAC.digest('SHA256', webhook_key, body)
        )

        # Compare signatures (use secure comparison to prevent timing attacks)
        ActiveSupport::SecurityUtils.secure_compare(signature, expected_signature)
      rescue StandardError => e
        Rails.logger.error("Webhook signature verification failed: #{e.message}")
        false
      end
    end
  end
end
