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
              message: "Xero integration not configured"
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
            id: cred.id,
            tenant_id: cred.tenant_id,
            tenant_name: cred.tenant_name,
            connected_at: cred.created_at,
            is_primary: cred.is_primary,
            expires_at: cred.expires_at,
            expired: cred.expired?
          }
        end

        render json: {
          success: true,
          tenants: tenants
        }
      end

      # POST /api/v1/xero/set_primary
      # Set a specific Xero organization as the primary one for contact sync
      def set_primary
        tenant_id = params[:tenant_id]

        unless tenant_id.present?
          return render json: {
            success: false,
            error: "Tenant ID is required"
          }, status: :bad_request
        end

        credential = XeroCredential.find_by(tenant_id: tenant_id)

        unless credential
          return render json: {
            success: false,
            error: "Xero organization not found"
          }, status: :not_found
        end

        begin
          credential.set_as_primary!

          render json: {
            success: true,
            message: "#{credential.tenant_name} set as primary Xero organization",
            primary_tenant: {
              tenant_id: credential.tenant_id,
              tenant_name: credential.tenant_name,
              is_primary: true
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to set primary Xero: #{e.message}")
          render json: {
            success: false,
            error: "Failed to set primary organization"
          }, status: :internal_server_error
        end
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
          where_clauses = []

          # Filter by contact_id if provided
          if params[:contact_id].present?
            where_clauses << "Contact.ContactID == Guid(\"#{params[:contact_id]}\")"
          end

          # Filter by date range if provided
          if params[:from_date].present?
            where_clauses << "Date >= DateTime(#{params[:from_date]})"
          end

          # Filter by status
          if params[:status].present?
            where_clauses << "Status == \"#{params[:status]}\""
          end

          # Filter by type (ACCREC for invoices/receivables, ACCPAY for bills/payables)
          if params[:type].present?
            where_clauses << "Type == \"#{params[:type]}\""
          end

          # Combine where clauses
          if where_clauses.any?
            query_params[:where] = where_clauses.join(" AND ")
          end

          # Add pagination
          query_params[:page] = params[:page] || 1

          # Include line items for description display (summaryOnly=false is default, but explicit)
          query_params[:unitdp] = 4

          result = client.get("Invoices", query_params)

          if result[:success]
            invoices = result[:data]["Invoices"] || []

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
              error: "Failed to fetch invoices"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero invoices auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
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

      # GET /api/v1/xero/invoices/:id
      # Fetches a single invoice with full details including line items and tracking
      def invoice_detail
        begin
          client = XeroApiClient.new
          invoice_id = params[:id]

          # Fetch single invoice with full details (including line items and tracking)
          # unitdp=4 gives full decimal precision, and Xero returns Tracking on LineItems by default
          result = client.get("Invoices/#{invoice_id}", { unitdp: 4 })

          if result[:success]
            invoice = result[:data]["Invoices"]&.first

            if invoice
              render json: {
                success: true,
                data: invoice
              }
            else
              render json: { success: false, error: "Invoice not found" }, status: :not_found
            end
          else
            render json: { success: false, error: "Failed to fetch invoice" }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero invoice detail auth error: #{e.message}")
          render json: { success: false, error: "Not authenticated with Xero" }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero invoice detail error: #{e.message}")
          render json: { success: false, error: "Failed to fetch invoice details" }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/payments
      # Fetches payments from Xero (with optional contact filter)
      def payments
        begin
          client = XeroApiClient.new

          query_params = {}
          where_clauses = []

          # Filter by contact_id - payments are linked via Invoice.Contact
          if params[:contact_id].present?
            where_clauses << "Invoice.Contact.ContactID == Guid(\"#{params[:contact_id]}\")"
          end

          if where_clauses.any?
            query_params[:where] = where_clauses.join(" AND ")
          end

          result = client.get("Payments", query_params)

          if result[:success]
            payments = result[:data]["Payments"] || []

            render json: {
              success: true,
              data: {
                payments: payments,
                count: payments.length
              }
            }
          else
            render json: { success: false, error: "Failed to fetch payments" }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Xero payments error: #{e.message}")
          render json: { success: false, error: "Failed to fetch payments" }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/credit_notes
      # Fetches credit notes from Xero (with optional contact filter)
      def credit_notes
        begin
          client = XeroApiClient.new

          query_params = {}
          where_clauses = []

          if params[:contact_id].present?
            where_clauses << "Contact.ContactID == Guid(\"#{params[:contact_id]}\")"
          end

          if where_clauses.any?
            query_params[:where] = where_clauses.join(" AND ")
          end

          result = client.get("CreditNotes", query_params)

          if result[:success]
            credit_notes = result[:data]["CreditNotes"] || []

            render json: {
              success: true,
              data: {
                credit_notes: credit_notes,
                count: credit_notes.length
              }
            }
          else
            render json: { success: false, error: "Failed to fetch credit notes" }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Xero credit_notes error: #{e.message}")
          render json: { success: false, error: "Failed to fetch credit notes" }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/quotes
      # Fetches quotes from Xero (with optional contact filter)
      def quotes
        begin
          client = XeroApiClient.new

          query_params = {}
          where_clauses = []

          # Quotes API requires different GUID syntax than Invoices
          # See: https://developer.xero.com/documentation/api/accounting/quotes
          if params[:contact_id].present?
            where_clauses << "Contact.ContactID.ToString().Equals(\"#{params[:contact_id]}\")"
          end

          if where_clauses.any?
            query_params[:where] = where_clauses.join(" AND ")
          end

          result = client.get("Quotes", query_params)

          if result[:success]
            quotes = result[:data]["Quotes"] || []

            render json: {
              success: true,
              data: {
                quotes: quotes,
                count: quotes.length
              }
            }
          else
            render json: { success: false, error: "Failed to fetch quotes" }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Xero quotes error: #{e.message}")
          render json: { success: false, error: "Failed to fetch quotes" }, status: :internal_server_error
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

          invoice_data = result[:data]["Invoices"]&.first

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
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero match_invoice error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to match invoice: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/invoices_by_tracking
      # Fetches all invoices (bills and sales invoices) that have a specific tracking category
      # This is used for the Job Xero Activity tab to show all invoices/bills for a job
      def invoices_by_tracking
        tracking_option_name = params[:tracking_option_name]

        unless tracking_option_name.present?
          return render json: {
            success: false,
            error: "tracking_option_name is required"
          }, status: :bad_request
        end

        begin
          client = XeroApiClient.new

          # Xero API only returns line item details (including tracking) when using pagination
          # Without pagination, it returns summary data only (no line items)
          # We need to paginate through all invoices to get line item tracking info
          all_invoices = []
          page = 1
          max_pages = 50  # Safety limit (100 invoices per page = 5000 invoices max)

          loop do
            Rails.logger.info("Fetching Xero invoices page #{page}")
            result = client.get("Invoices", {
              page: page,
              unitdp: 4
            })

            unless result[:success]
              return render json: {
                success: false,
                error: "Failed to fetch invoices from Xero"
              }, status: :unprocessable_entity
            end

            invoices_page = result[:data]["Invoices"] || []
            break if invoices_page.empty?

            all_invoices.concat(invoices_page)
            page += 1
            break if page > max_pages
          end

          Rails.logger.info("Fetched #{all_invoices.length} total invoices from Xero")

          # Filter invoices that have line items with matching tracking category
          matching_invoices = all_invoices.select do |invoice|
            line_items = invoice["LineItems"] || []
            line_items.any? do |line_item|
              tracking = line_item["Tracking"] || []
              tracking.any? { |t| t["Option"] == tracking_option_name }
            end
          end

          Rails.logger.info("Found #{matching_invoices.length} invoices matching tracking '#{tracking_option_name}'")

          # Separate into invoices (ACCREC = sales) and bills (ACCPAY = purchases)
          invoices = matching_invoices.select { |inv| inv["Type"] == "ACCREC" }
          bills = matching_invoices.select { |inv| inv["Type"] == "ACCPAY" }

          render json: {
            success: true,
            data: {
              invoices: invoices,
              bills: bills,
              total_invoices: invoices.length,
              total_bills: bills.length,
              tracking_option_name: tracking_option_name
            }
          }
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero invoices_by_tracking auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero invoices_by_tracking error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch invoices: #{e.message}"
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
            error: "Invalid webhook signature"
          }, status: :unauthorized
        end

        # Parse webhook payload
        payload = JSON.parse(request.body.read)
        events = payload["events"] || []

        # Process events (can be expanded for specific event types)
        events.each do |event|
          Rails.logger.info("Xero webhook event: #{event['eventType']} - Resource: #{event['resourceId']}")

          case event["eventType"]
          when "CREATE", "UPDATE"
            if event["eventType"].include?("INVOICE")
              # Queue background job to sync invoice
              # XeroInvoiceSyncJob.perform_later(event['resourceId'])
            elsif event["eventType"].include?("CONTACT")
              # Queue background job to sync contact
              # XeroContactSyncJob.perform_later(event['resourceId'])
            end
          end
        end

        render json: {
          success: true,
          message: "Webhook received and queued for processing"
        }, status: :ok
      rescue JSON::ParserError => e
        Rails.logger.error("Failed to parse Xero webhook: #{e.message}")
        render json: { success: false, error: "Invalid JSON payload" }, status: :bad_request
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
              error: "Not authenticated with Xero. Please connect to Xero first."
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
                status: "queued",
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
            message: "Contact sync job queued successfully",
            data: {
              job_id: job_id,
              status: "queued",
              queued_at: Time.current
            }
          }
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero sync_contacts auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero. Please connect to Xero first."
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
            error: "Job ID is required"
          }, status: :bad_request
        end

        begin
          # Retrieve job metadata from cache
          job_data = Rails.cache.read("xero_sync_job_#{job_id}")

          if job_data.nil?
            return render json: {
              success: false,
              error: "Job not found or expired"
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

      # GET /api/v1/xero/contacts_sync_list
      # Returns all TEEEM contacts with their Xero sync status
      def contacts_sync_list
        begin
          contacts = Contact.includes(:primary_company, :external_invoices).all

          # Pre-calculate invoice/bill counts and PDF sync stats per contact
          invoice_counts = ExternalInvoice.where.not(contact_id: nil)
                                          .group(:contact_id, :invoice_type)
                                          .count

          # Count PDFs per contact (documents linked to their invoices)
          pdf_counts_by_contact = CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                                                  .where(company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                                  .where("company_documents.external_id LIKE ?", "xero:%:pdf")
                                                  .group("external_invoices.contact_id")
                                                  .count

          contacts_data = contacts.map do |contact|
            # Get invoice/bill counts for this contact
            invoices_count = invoice_counts[[contact.id, "sales_invoice"]] || 0
            bills_count = invoice_counts[[contact.id, "bill"]] || 0
            total_docs = invoices_count + bills_count

            # Get PDF sync count
            pdfs_synced = pdf_counts_by_contact[contact.id] || 0
            pdf_sync_percent = total_docs > 0 ? ((pdfs_synced.to_f / total_docs) * 100).round(0) : nil

            {
              id: contact.id,
              display_name: contact.display_name,
              email: contact.email,
              contact_type: contact.entity_type,
              entity_type: contact.entity_type,
              primary_company_id: contact.primary_company_id,
              primary_company_name: contact.primary_company&.display_name,
              is_team_contact: contact.is_team_contact,
              xero_id: contact.xero_id,
              synced: contact.xero_id.present?,
              last_synced_at: contact.last_synced_at,
              sync_enabled: contact.sync_with_xero,
              sync_error: contact.xero_sync_error,
              has_error: contact.xero_sync_error.present?,
              invoices_count: invoices_count,
              bills_count: bills_count,
              pdfs_synced: pdfs_synced,
              pdf_sync_percent: pdf_sync_percent
            }
          end.sort_by { |c| c[:display_name]&.downcase || "" }

          # Get Xero data stats (invoices, bills, quotes synced from Xero)
          xero_data_stats = calculate_xero_data_stats

          render json: {
            success: true,
            contacts: contacts_data,
            total: contacts_data.count,
            synced_count: contacts_data.count { |c| c[:synced] },
            error_count: contacts_data.count { |c| c[:has_error] },
            xero_data: xero_data_stats
          }
        rescue StandardError => e
          Rails.logger.error("Xero contacts_sync_list error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to get contacts sync list"
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
                                .select(:id, :display_name, :first_name, :last_name, :email, :last_synced_at, :xero_sync_error, :xero_id, :created_at, :updated_at)

          history_items = recent_syncs.map do |contact|
            {
              id: contact.id,
              contact_name: contact.display_name || "#{contact.first_name} #{contact.last_name}".strip,
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
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero tax_rates error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch tax rates"
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
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero accounts error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch accounts"
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
              error: "Not authenticated with Xero. Please connect to Xero first."
            }, status: :unauthorized
          end

          service = XeroTrackingImportService.new
          result = service.import_all

          render json: result
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero import_tracking_categories auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
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
              error: "Not authenticated with Xero. Please connect to Xero first."
            }, status: :unauthorized
          end

          service = XeroFullBillImportService.new
          result = service.import_all

          render json: result
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero import_all_bills auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
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
              error: "Not authenticated with Xero. Please connect to Xero first."
            }, status: :unauthorized
          end

          service = XeroClaimImportService.new
          result = service.import_all

          render json: result
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero import_all_claims auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
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
              error: "Not authenticated with Xero. Please connect to Xero first."
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
            error: "Not authenticated with Xero"
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
            error: "Search query is required"
          }, status: :bad_request
        end

        # Require minimum 2 characters for search
        if query.length < 2
          return render json: {
            success: false,
            error: "Search query must be at least 2 characters"
          }, status: :bad_request
        end

        begin
          client = XeroApiClient.new

          # Sanitize query to prevent OData injection
          # Escape double quotes and backslashes in the query string
          sanitized_query = query.gsub("\\", "\\\\\\\\").gsub('"', '\\"')

          # Search Xero contacts with a WHERE clause
          # Search by name, email, or tax number
          where_clause = "Name.Contains(\"#{sanitized_query}\") OR EmailAddress.Contains(\"#{sanitized_query}\") OR TaxNumber.Contains(\"#{sanitized_query}\")"

          Rails.logger.info("Xero contact search - Original query: '#{query}', Sanitized: '#{sanitized_query}'")

          result = client.get("Contacts", { where: where_clause })

          if result[:success]
            contacts = result[:data]["Contacts"] || []

            Rails.logger.info("Xero contact search - Found #{contacts.length} contacts")

            # Format contacts for the frontend
            formatted_contacts = contacts.map do |contact|
              {
                xero_id: contact["ContactID"],
                name: contact["Name"],
                email: contact["EmailAddress"],
                tax_number: contact["TaxNumber"],
                first_name: contact["FirstName"],
                last_name: contact["LastName"],
                phones: contact["Phones"]
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
              error: "Failed to search Xero contacts"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero search_contacts auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero. Please connect to Xero first."
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
            error: "Contact ID is required"
          }, status: :bad_request
        end

        begin
          # Find the credential for the specific tenant if provided
          credential = if tenant_id.present?
            XeroCredential.find_by(tenant_id: tenant_id)
          else
            XeroCredential.current
          end

          unless credential
            return render json: {
              success: false,
              error: tenant_id.present? ? "No Xero credential found for tenant #{tenant_id}" : "Not connected to Xero"
            }, status: :unauthorized
          end

          # Make direct request using the specific credential
          result = make_xero_request(credential, "Contacts/#{xero_contact_id}")

          if result[:success]
            xero_contact = result[:data]["Contacts"]&.first

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
                error: "Contact not found in Xero"
              }, status: :not_found
            end
          else
            render json: {
              success: false,
              error: "Failed to fetch contact from Xero"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero show_contact auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero show_contact error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch contact: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/organisation
      # Fetch organisation details from Xero (for validation testing)
      def organisation
        begin
          client = XeroApiClient.new
          result = client.get("Organisation")

          if result[:success]
            render json: {
              success: true,
              data: result[:data]
            }
          else
            render json: {
              success: false,
              error: "Failed to fetch organisation"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero organisation auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero organisation error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch organisation: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/contacts
      # Fetch contacts from Xero (for validation testing)
      def contacts
        begin
          client = XeroApiClient.new
          page = params[:page] || 1
          result = client.get("Contacts", { page: page })

          if result[:success]
            render json: {
              success: true,
              data: result[:data]
            }
          else
            render json: {
              success: false,
              error: "Failed to fetch contacts"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero contacts auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero contacts error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch contacts: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/tracking_categories
      # Fetch tracking categories from Xero (for validation testing)
      def tracking_categories
        begin
          client = XeroApiClient.new
          result = client.get("TrackingCategories")

          if result[:success]
            render json: {
              success: true,
              data: result[:data]
            }
          else
            render json: {
              success: false,
              error: "Failed to fetch tracking categories"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("Xero tracking_categories auth error: #{e.message}")
          render json: {
            success: false,
            error: "Not authenticated with Xero"
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero tracking_categories error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to fetch tracking categories: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/pdf_sync_status
      # Returns PDF sync progress and health status for the Xero integration dashboard
      def pdf_sync_status
        begin
          # ============================================
          # STAGE 1: Invoice DATA Sync (Xero -> Database)
          # ============================================
          total_invoices_in_db = ExternalInvoice.count
          invoices_with_contacts = ExternalInvoice.where.not(contact_id: nil)
          total_with_contacts = invoices_with_contacts.count
          invoices_without_contacts = total_invoices_in_db - total_with_contacts
          last_invoice_sync = ExternalInvoice.maximum(:last_synced_at)

          # Invoice breakdown by type
          invoice_breakdown = {
            bills: ExternalInvoice.bills.count,
            sales_invoices: ExternalInvoice.sales_invoices.count,
            credit_notes: ExternalInvoice.where(invoice_type: "credit_note").count,
            quotes: ExternalInvoice.quotes.count
          }

          # Stage 1 blocker info - why aren't all invoices linked?
          stage1_blocker = if invoices_without_contacts > 0
            # Find example unlinked invoices to help diagnose
            unlinked_sample = ExternalInvoice.where(contact_id: nil).limit(5).pluck(:external_id, :contact_name)
            {
              reason: "#{invoices_without_contacts} invoices not linked to TEEEM contacts",
              detail: "Xero contacts need to be matched to TEEEM contacts first",
              unlinked_count: invoices_without_contacts,
              sample_unlinked: unlinked_sample.map { |ext_id, name| { xero_id: ext_id, contact_name: name } }
            }
          else
            nil
          end

          # ============================================
          # STAGE 2: PDF Download (Xero -> Active Storage)
          # ============================================
          # Count invoices that have PDFs downloaded
          invoices_with_pdfs = CompanyDocument.where(source: "xero")
                                              .where("external_id LIKE ?", "xero:%:pdf")
                                              .where(documentable_type: "ExternalInvoice")
                                              .distinct
                                              .count(:documentable_id)

          pdfs_pending = total_with_contacts - invoices_with_pdfs
          pdf_progress = total_with_contacts.zero? ? 0 : ((invoices_with_pdfs.to_f / total_with_contacts) * 100).round(1)

          # Get last PDF sync time
          last_pdf_sync = CompanyDocument.where(source: "xero")
                                         .where(documentable_type: "ExternalInvoice")
                                         .maximum(:created_at)

          # Recent PDF activity (last 24 hours)
          pdfs_last_24h = CompanyDocument.where(source: "xero")
                                         .where(documentable_type: "ExternalInvoice")
                                         .where("created_at > ?", 24.hours.ago)
                                         .count

          # ============================================
          # STAGE 3: SharePoint Upload (Active Storage -> OneDrive)
          # ============================================
          # Count PDFs that have been uploaded to SharePoint (have expected_onedrive_path set)
          # Only count PDFs (not attachments) to match Stage 2's count
          sharepoint_pdfs_uploaded = CompanyDocument.where(source: "xero")
                                                    .where("external_id LIKE ?", "xero:%:pdf")
                                                    .where.not(expected_onedrive_path: nil)
                                                    .where(documentable_type: "ExternalInvoice")
                                                    .count

          # PDFs downloaded but not yet on SharePoint
          sharepoint_pending = [invoices_with_pdfs - sharepoint_pdfs_uploaded, 0].max
          sharepoint_progress = invoices_with_pdfs.zero? ? 0 : ((sharepoint_pdfs_uploaded.to_f / invoices_with_pdfs) * 100).round(1)
          sharepoint_progress = [sharepoint_progress, 100].min # Cap at 100%

          # ============================================
          # Breakdown by invoice type (for PDF stage)
          # ============================================
          bills_total = invoices_with_contacts.bills.count
          bills_with_pdfs = CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                                           .where(company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                           .where("company_documents.external_id LIKE ?", "xero:%:pdf")
                                           .where(external_invoices: { invoice_type: "bill" })
                                           .distinct
                                           .count("company_documents.documentable_id")

          sales_total = invoices_with_contacts.sales_invoices.count
          sales_with_pdfs = CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                                           .where(company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                           .where("company_documents.external_id LIKE ?", "xero:%:pdf")
                                           .where(external_invoices: { invoice_type: "sales_invoice" })
                                           .distinct
                                           .count("company_documents.documentable_id")

          quotes_total = invoices_with_contacts.quotes.count
          quotes_with_pdfs = CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                                            .where(company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                            .where("company_documents.external_id LIKE ?", "xero:%:pdf")
                                            .where(external_invoices: { invoice_type: "quote" })
                                            .distinct
                                            .count("company_documents.documentable_id")

          # Estimate time remaining for PDF sync (based on 10s per invoice)
          estimated_remaining_seconds = pdfs_pending * 10
          estimated_remaining_minutes = (estimated_remaining_seconds / 60.0).round(0)

          # Calculate next scheduled sync times (in Brisbane time AEST/AEDT)
          brisbane_tz = ActiveSupport::TimeZone["Australia/Brisbane"]
          now_brisbane = Time.current.in_time_zone(brisbane_tz)

          # Invoice sync runs every 30 minutes
          next_invoice_sync = calculate_next_run(now_brisbane, 30, 0)

          # PDF sync runs every 2 hours at minute 45
          next_pdf_sync = calculate_next_run(now_brisbane, 120, 45)

          # Stage 2 blocker info - why isn't PDF sync faster?
          stage2_blocker = if pdfs_pending > 0
            hours_remaining = (estimated_remaining_minutes / 60.0).round(1)
            days_remaining = (hours_remaining / 24.0).round(1)
            {
              reason: "Rate limited: 50 PDFs every 2 hours",
              detail: "Xero API limits prevent faster syncing. #{pdfs_pending} PDFs pending.",
              pending_count: pdfs_pending,
              estimated_hours: hours_remaining,
              estimated_days: days_remaining > 1 ? days_remaining : nil
            }
          else
            nil
          end

          # Stage 3 blocker info
          stage3_blocker = if sharepoint_pending > 0
            {
              reason: "Waiting for PDF downloads",
              detail: "SharePoint uploads happen automatically when PDFs are downloaded",
              pending_count: sharepoint_pending
            }
          else
            nil
          end

          render json: {
            success: true,
            data: {
              # Stage 1: Invoice DATA sync (Xero -> Database)
              stage1_data_sync: {
                total_in_database: total_invoices_in_db,
                linked_to_contacts: total_with_contacts,
                unlinked_count: invoices_without_contacts,
                last_sync_at: last_invoice_sync,
                next_sync_at: next_invoice_sync,
                schedule: "Every 30 minutes",
                breakdown: invoice_breakdown,
                blocker: stage1_blocker
              },

              # Stage 2: PDF Download (Xero -> Active Storage)
              stage2_pdf_download: {
                total_to_sync: total_with_contacts,
                downloaded: invoices_with_pdfs,
                pending: pdfs_pending,
                progress_percentage: pdf_progress,
                last_sync_at: last_pdf_sync,
                next_sync_at: next_pdf_sync,
                schedule: "Every 2 hours (50 per batch)",
                synced_last_24h: pdfs_last_24h,
                breakdown: {
                  bills: { total: bills_total, synced: bills_with_pdfs },
                  sales_invoices: { total: sales_total, synced: sales_with_pdfs },
                  quotes: { total: quotes_total, synced: quotes_with_pdfs }
                },
                blocker: stage2_blocker
              },

              # Stage 3: SharePoint Upload (Active Storage -> OneDrive)
              stage3_sharepoint: {
                total_to_upload: invoices_with_pdfs,
                uploaded: sharepoint_pdfs_uploaded,
                pending: sharepoint_pending,
                progress_percentage: sharepoint_progress,
                blocker: stage3_blocker
              },

              # Overall metrics (for backwards compatibility)
              total_invoices: total_with_contacts,
              pdfs_synced: invoices_with_pdfs,
              pending: pdfs_pending,
              progress_percentage: pdf_progress,
              sharepoint_uploads: sharepoint_pdfs_uploaded,
              synced_last_24h: pdfs_last_24h,
              last_sync_at: last_pdf_sync,
              next_sync_at: next_pdf_sync,
              breakdown: {
                bills: { total: bills_total, synced: bills_with_pdfs },
                sales_invoices: { total: sales_total, synced: sales_with_pdfs },
                quotes: { total: quotes_total, synced: quotes_with_pdfs }
              },
              estimated_remaining_minutes: estimated_remaining_minutes,
              health: determine_pdf_sync_health(pdf_progress, pdfs_pending, last_pdf_sync)
            }
          }
        rescue StandardError => e
          Rails.logger.error("Xero pdf_sync_status error: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: {
            success: false,
            error: "Failed to get PDF sync status: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/validate_contacts
      # Validate all contacts that should be synced to Xero
      def validate_contacts
        begin
          # Get all contacts that are enabled for Xero sync (or all if no flag exists)
          contacts = Contact.where.not(entity_type: "price_only")
                           .where(is_team_contact: false)
                           .limit(1000) # Limit to prevent timeout

          validation_results = {
            total_contacts: contacts.count,
            valid_contacts: 0,
            invalid_contacts: 0,
            errors_by_type: {},
            sample_errors: []
          }

          contacts.each do |contact|
            validator = XeroContactValidator.new(contact)

            if validator.valid?
              validation_results[:valid_contacts] += 1
            else
              validation_results[:invalid_contacts] += 1

              # Group errors by field
              validator.errors.each do |error|
                field = error[:field].to_s
                validation_results[:errors_by_type][field] ||= 0
                validation_results[:errors_by_type][field] += 1
              end

              # Keep first 10 sample errors for display
              if validation_results[:sample_errors].length < 10
                validation_results[:sample_errors] << {
                  contact_id: contact.id,
                  contact_name: contact.display_name || "#{contact.first_name} #{contact.last_name}".strip,
                  errors: validator.errors
                }
              end
            end
          end

          render json: {
            success: true,
            data: validation_results
          }
        rescue StandardError => e
          Rails.logger.error("Xero validate_contacts error: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: {
            success: false,
            error: "Failed to validate contacts: #{e.message}"
          }, status: :internal_server_error
        end
      end

      private

      # Calculate Xero data statistics for sync dashboard
      def calculate_xero_data_stats
        # Get Xero invoices data
        xero_invoices = ExternalInvoice.xero

        # Sales invoices (ACCREC)
        sales_invoices_count = xero_invoices.sales_invoices.count
        sales_invoices_total = xero_invoices.sales_invoices.sum(:total) || 0

        # Bills (ACCPAY)
        bills_count = xero_invoices.bills.count
        bills_total = xero_invoices.bills.sum(:total) || 0

        # Quotes
        quotes_count = xero_invoices.quotes.count
        quotes_total = xero_invoices.quotes.sum(:total) || 0

        # Credit notes
        credit_notes_count = xero_invoices.credit_notes.count

        # Contacts with Xero data (have at least one invoice/bill/quote)
        contacts_with_xero_data = ExternalInvoice.xero.where.not(contact_id: nil).distinct.count(:contact_id)

        # Last synced
        last_data_sync = xero_invoices.maximum(:last_synced_at)

        # Unpaid invoices
        unpaid_invoices = xero_invoices.invoices_and_bills.unpaid.count

        # Synced today
        synced_today = xero_invoices.where("last_synced_at > ?", 24.hours.ago).count

        {
          sales_invoices: {
            count: sales_invoices_count,
            total: sales_invoices_total.to_f.round(2)
          },
          bills: {
            count: bills_count,
            total: bills_total.to_f.round(2)
          },
          quotes: {
            count: quotes_count,
            total: quotes_total.to_f.round(2)
          },
          credit_notes: credit_notes_count,
          contacts_with_data: contacts_with_xero_data,
          unpaid_count: unpaid_invoices,
          synced_today: synced_today,
          last_sync_at: last_data_sync
        }
      rescue StandardError => e
        Rails.logger.error("Xero data stats error: #{e.message}")
        {
          sales_invoices: { count: 0, total: 0 },
          bills: { count: 0, total: 0 },
          quotes: { count: 0, total: 0 },
          credit_notes: 0,
          contacts_with_data: 0,
          unpaid_count: 0,
          synced_today: 0,
          last_sync_at: nil,
          error: e.message
        }
      end

      # Make a direct Xero API request using a specific credential
      # This allows us to support multi-tenant (multi-org) requests
      def make_xero_request(credential, endpoint, params = {})
        # Refresh token if expired
        if credential.expired?
          client = XeroApiClient.new
          client.refresh_access_token_for(credential)
          credential.reload
        end

        url = "https://api.xero.com/api.xro/2.0/#{endpoint}"

        headers = {
          "Authorization" => "Bearer #{credential.access_token}",
          "Xero-tenant-id" => credential.tenant_id,
          "Content-Type" => "application/json",
          "Accept" => "application/json"
        }

        response = HTTParty.get(url, headers: headers, query: params, timeout: 30)

        if response.success?
          {
            success: true,
            data: JSON.parse(response.body)
          }
        else
          Rails.logger.error("Xero API error: #{response.code} - #{response.body}")
          {
            success: false,
            error: "Xero API error: #{response.code}"
          }
        end
      rescue StandardError => e
        Rails.logger.error("Xero request error: #{e.message}")
        {
          success: false,
          error: e.message
        }
      end

      # Determine what sync action was taken for a contact
      def determine_sync_action(contact)
        if contact.xero_sync_error.present?
          "Sync Failed"
        elsif contact.xero_id.present? && contact.created_at < contact.last_synced_at
          "Updated from Xero"
        elsif contact.xero_id.present?
          "Created from Xero"
        else
          "Synced to Xero"
        end
      end

      # Determine PDF sync health status based on progress and activity
      def determine_pdf_sync_health(progress_percentage, pending_count, last_sync)
        # Health status: healthy, partial, warning, not_started
        # Note: We can't detect if a sync is actively running, so we show status based on completion
        if progress_percentage == 0 && pending_count > 0
          {
            status: "not_started",
            message: "PDF sync has not started yet",
            color: "gray"
          }
        elsif progress_percentage >= 95
          {
            status: "healthy",
            message: "PDF sync is up to date",
            color: "green"
          }
        elsif last_sync.present? && last_sync > 1.hour.ago
          # Recently synced (within last hour) - likely still running or just finished a batch
          {
            status: "in_progress",
            message: "PDF sync recently active",
            color: "blue"
          }
        elsif last_sync.present? && last_sync < 7.days.ago
          {
            status: "warning",
            message: "PDF sync hasn't run in over a week",
            color: "yellow"
          }
        elsif pending_count > 0
          # Has pending items but not recently synced
          {
            status: "partial",
            message: "#{pending_count} PDFs pending sync",
            color: "amber"
          }
        else
          {
            status: "healthy",
            message: "PDF sync complete",
            color: "green"
          }
        end
      end

      # Calculate the next scheduled run time for a recurring job
      # @param now [Time] Current time in the target timezone
      # @param interval_minutes [Integer] How often the job runs (in minutes)
      # @param at_minute [Integer] Which minute of the interval it runs at (0 for start of interval)
      # @return [Time] Next scheduled run time
      def calculate_next_run(now, interval_minutes, at_minute = 0)
        if interval_minutes >= 60
          # For hourly+ intervals (e.g., every 2 hours at minute 45)
          hours_interval = interval_minutes / 60
          current_hour = now.hour
          current_minute = now.min

          # Find the next hour that matches the interval pattern
          # Jobs run at hours: 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22 (for 2-hour intervals)
          next_hour = current_hour
          next_hour += 1 if current_minute >= at_minute && current_hour % hours_interval == (hours_interval - 1) % hours_interval

          # Round up to next interval
          next_hour = ((next_hour / hours_interval) + 1) * hours_interval if current_minute >= at_minute || current_hour % hours_interval != 0
          next_hour = (current_hour / hours_interval) * hours_interval if current_minute < at_minute && current_hour % hours_interval == 0

          # Simple approach: find next occurrence
          candidate = now.beginning_of_hour.change(min: at_minute)
          candidate += hours_interval.hours while candidate <= now
          candidate
        else
          # For sub-hourly intervals (e.g., every 30 minutes)
          minutes_since_midnight = now.hour * 60 + now.min
          current_slot = minutes_since_midnight / interval_minutes
          next_slot_minutes = (current_slot + 1) * interval_minutes + at_minute

          now.beginning_of_day + next_slot_minutes.minutes
        end
      end

      # Find the most recent active sync job
      def find_active_sync_job
        # This is a simple implementation using cache
        # In production, you might want to use a proper job tracking mechanism
        cache_keys = Rails.cache.instance_variable_get(:@data)&.keys || []
        job_keys = cache_keys.select { |k| k.to_s.start_with?("xero_sync_job_") }

        job_keys.each do |key|
          job_data = Rails.cache.read(key)
          if job_data && [ "queued", "processing" ].include?(job_data[:status])
            return job_data
          end
        end

        nil
      end

      # Verify Xero webhook signature using HMAC-SHA256
      def verify_xero_webhook_signature
        webhook_key = ENV["XERO_WEBHOOK_KEY"]

        unless webhook_key.present?
          Rails.logger.error("XERO_WEBHOOK_KEY not configured")
          return false
        end

        # Get signature from header
        signature = request.headers["X-Xero-Signature"]

        unless signature.present?
          Rails.logger.warn("Missing X-Xero-Signature header")
          return false
        end

        # Read and verify the request body
        body = request.body.read
        request.body.rewind # Reset for later reading

        # Calculate expected signature
        expected_signature = Base64.strict_encode64(
          OpenSSL::HMAC.digest("SHA256", webhook_key, body)
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
