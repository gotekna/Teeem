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

          # Trigger sync restart immediately after reconnection
          # This resumes syncing without waiting for scheduled jobs
          sync_result = XeroTokenManager.trigger_sync_restart(reason: "oauth_reconnection")
          Rails.logger.info("[XeroController] Reconnection sync restart triggered: #{sync_result[:jobs_triggered].join(', ')}")

          render json: {
            success: true,
            message: "Successfully connected to Xero",
            data: {
              tenant_name: result[:tenant_name],
              tenant_id: result[:tenant_id],
              expires_at: result[:expires_at],
              sync_restart: sync_result
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
      #
      # SSoT: Backend computes token status - frontend should NOT calculate from expires_at
      # Use status_display and expires_in_human instead of client-side Date calculations
      #
      def tenants
        tenants = XeroCredential.all.map do |cred|
          {
            id: cred.id,
            tenant_id: cred.tenant_id,
            tenant_name: cred.tenant_name,
            connected_at: cred.created_at,
            is_primary: cred.is_primary,
            expires_at: cred.expires_at,
            expired: cred.expired?,
            # SSoT: Include credential health status for auto-expand UI logic
            status: cred.status,
            needs_reauth: %w[disconnected degraded].include?(cred.status),
            # SSoT: Computed fields for frontend display (Option C refactor)
            # Frontend should use these instead of calculating from expires_at
            status_display: cred.status_for_display,      # 'connected', 'warning', 'expired', 'disconnected'
            expires_in_human: cred.time_until_expiry_human, # "28m", "1h 15m", "Expired"
            needs_attention: cred.needs_attention?          # true if user action required
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
          # Get the most recent sync time from ContactExternalLink (SSoT for sync status)
          last_xero_link = ContactExternalLink.xero
                                              .where.not(last_synced_at: nil)
                                              .order(last_synced_at: :desc)
                                              .first

          # Get sync statistics (SSoT: ContactExternalLink for sync status)
          total_contacts = Contact.count
          synced_contacts = Contact.joins(:external_links).where(contact_external_links: { source: "xero" }).distinct.count
          sync_enabled = ContactExternalLink.xero.enabled.count
          contacts_with_errors = ContactExternalLink.xero.with_errors.count

          # Check for active sync jobs
          active_job = find_active_sync_job

          response_data = {
            last_synced_at: last_xero_link&.last_synced_at,  # SSoT: ContactExternalLink.last_synced_at
            last_sync_at: last_xero_link&.last_synced_at,    # Deprecated: kept for backwards compatibility
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
      # SSoT: Includes all 3 sync timestamps (contact, invoices, PDFs) per contact
      def contacts_sync_list
        begin
          contacts = Contact.includes(:primary_company, :external_invoices, :external_links).all

          # Pre-calculate invoice/bill counts and PDF sync stats per contact
          invoice_counts = ExternalInvoice.where.not(contact_id: nil)
                                          .group(:contact_id, :invoice_type)
                                          .count

          # Get latest invoice sync time per contact
          invoice_sync_times = ExternalInvoice.where.not(contact_id: nil)
                                               .group(:contact_id)
                                               .maximum(:last_synced_at)

          # Count PDFs per contact (documents linked to their invoices)
          pdf_counts_by_contact = CorporateCompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                                  .where(corporate_company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                                  .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                                  .group("external_invoices.contact_id")
                                                  .count

          # Get latest PDF sync time per contact
          pdf_sync_times = CorporateCompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                           .where(corporate_company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                           .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                           .group("external_invoices.contact_id")
                                           .maximum("corporate_company_documents.created_at")

          contacts_data = contacts.map do |contact|
            # Get invoice/bill counts for this contact
            invoices_count = invoice_counts[[ contact.id, "sales_invoice" ]] || 0
            bills_count = invoice_counts[[ contact.id, "bill" ]] || 0
            total_docs = invoices_count + bills_count

            # Get PDF sync count
            pdfs_synced = pdf_counts_by_contact[contact.id] || 0
            pdf_sync_percent = total_docs > 0 ? ((pdfs_synced.to_f / total_docs) * 100).round(0) : nil

            # Get sync info from ContactExternalLink (SSoT for sync status)
            xero_link = contact.external_links.xero.first

            {
              id: contact.id,
              display_name: contact.display_name,
              xero_name: xero_link&.external_name,  # Name from Xero for comparison
              xero_tenant_name: xero_link&.tenant_name,  # Which Xero company this is synced to
              email: contact.email,
              contact_type: contact.entity_type,
              entity_type: contact.entity_type,
              primary_company_id: contact.primary_company_id,
              primary_company_name: contact.primary_company&.display_name,
              is_team_contact: contact.is_team_contact,
              is_customer: contact.is_customer?,
              is_supplier: contact.is_supplier?,
              xero_id: contact.xero_id,
              synced: contact.xero_id.present?,
              last_synced_at: xero_link&.last_synced_at,
              sync_enabled: xero_link&.sync_enabled || false,
              sync_error: xero_link&.sync_error,
              has_error: xero_link&.sync_error.present?,
              invoices_count: invoices_count,
              bills_count: bills_count,
              pdfs_synced: pdfs_synced,
              pdf_sync_percent: pdf_sync_percent,
              # SSoT: All 3 sync timestamps per contact
              sync_status: {
                contact_synced_at: xero_link&.last_synced_at&.iso8601,
                invoices_synced_at: invoice_sync_times[contact.id]&.iso8601,
                pdfs_synced_at: pdf_sync_times[contact.id]&.iso8601
              }
            }
          end.sort_by { |c| c[:display_name]&.downcase || "" }

          # Get Xero data stats (invoices, bills, quotes synced from Xero)
          xero_data_stats = calculate_xero_data_stats

          # Get global sync health from SSoT table
          sync_health = XeroSyncStatus.health_summary

          render json: {
            success: true,
            contacts: contacts_data,
            total: contacts_data.count,
            synced_count: contacts_data.count { |c| c[:synced] },
            error_count: contacts_data.count { |c| c[:has_error] },
            xero_data: xero_data_stats,
            sync_health: sync_health
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
      # Returns recent sync activity for contacts (from ContactExternalLink SSoT)
      def sync_history
        begin
          # Get recently synced links (last 50) from ContactExternalLink SSoT
          recent_links = ContactExternalLink.xero
                                            .where.not(last_synced_at: nil)
                                            .includes(:contact)
                                            .order(last_synced_at: :desc)
                                            .limit(50)

          history_items = recent_links.map do |link|
            contact = link.contact
            next unless contact

            {
              id: contact.id,
              contact_name: contact.display_name || "#{contact.first_name} #{contact.last_name}".strip,
              email: contact.email,
              synced_at: link.last_synced_at,
              has_error: link.sync_error.present?,
              error_message: link.sync_error,
              action: determine_sync_action_from_link(link),
              xero_id: contact.xero_id
            }
          end.compact

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
          # Filter by tenant_id if provided (for per-organization view)
          tenant_id = params[:tenant_id]

          # ============================================
          # STAGE 1: Invoice DATA Sync (Xero -> Database)
          # ============================================
          base_scope = tenant_id.present? ? ExternalInvoice.active.where(tenant_id: tenant_id) : ExternalInvoice.active
          total_invoices_in_db = base_scope.count
          invoices_with_contacts = base_scope.where.not(contact_id: nil)
          total_with_contacts = invoices_with_contacts.count
          # SSoT: Count unlinked invoices that have a real contact name (same logic as unlinked_contacts endpoint)
          # Excludes blank names and "No Contact" since those can't be matched
          invoices_without_contacts = base_scope.where(contact_id: nil)
            .where.not(contact_name: [nil, "", "No Contact"])
            .count

          # SSoT: Use XeroSyncStatus for last sync time, fallback to record timestamps
          invoice_sync_status_query = XeroSyncStatus.where(sync_type: "invoices")
          invoice_sync_status_query = invoice_sync_status_query.where(tenant_id: tenant_id) if tenant_id.present?
          invoice_sync_status = invoice_sync_status_query.order(last_synced_at: :desc).first
          last_invoice_sync = invoice_sync_status&.last_synced_at || base_scope.maximum(:last_synced_at)

          # Invoice breakdown by type
          invoice_breakdown = {
            bills: base_scope.bills.count,
            sales_invoices: base_scope.sales_invoices.count,
            credit_notes: base_scope.where(invoice_type: "credit_note").count,
            quotes: base_scope.quotes.count
          }

          # Stage 1 blocker info - why aren't all invoices linked?
          stage1_blocker = if invoices_without_contacts > 0
            # Count unique Xero contacts (same grouping as unlinked_contacts endpoint)
            unlinked_contact_count = base_scope.where(contact_id: nil)
              .where.not(contact_name: [nil, "", "No Contact"])
              .distinct
              .count(:contact_name)
            # Find example unlinked invoices to help diagnose
            unlinked_sample = base_scope.where(contact_id: nil).limit(5).pluck(:external_id, :contact_name)
            {
              reason: "#{unlinked_contact_count} Xero contact#{'s' if unlinked_contact_count != 1} with #{invoices_without_contacts} invoice#{'s' if invoices_without_contacts != 1} not linked",
              detail: "Xero contacts need to be matched to TEEEM contacts first",
              unlinked_count: invoices_without_contacts,
              unlinked_contact_count: unlinked_contact_count,
              sample_unlinked: unlinked_sample.map { |ext_id, name| { xero_id: ext_id, contact_name: name } }
            }
          else
            nil
          end

          # ============================================
          # STAGE 2: PDF Download (Xero -> Active Storage)
          # ============================================
          # SSoT: Exclude DRAFT invoices from PDF count - Xero doesn't generate PDFs until finalized
          # Draft invoices have no invoice number and can never have PDFs
          pdf_eligible_invoices = invoices_with_contacts.where.not(status: "draft")
          total_pdf_eligible = pdf_eligible_invoices.count

          # Count invoices that have PDFs downloaded (filter by tenant if provided)
          # SSoT FIX: Must use EXACT same filters as total_pdf_eligible:
          #   1. contact_id not nil (contacts)
          #   2. status not 'draft' (non-draft)
          #   3. status not in ['voided', 'deleted'] (ExternalInvoice.active scope)
          # Otherwise downloaded count can exceed total when invoices are voided/deleted
          pdf_query = CorporateCompanyDocument.where(source: "xero")
                                              .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                              .where(documentable_type: "ExternalInvoice")
                                              .joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                              .where.not(external_invoices: { contact_id: nil })  # SSoT: Match pdf_eligible_invoices
                                              .where.not(external_invoices: { status: "draft" })  # SSoT: Match pdf_eligible_invoices
                                              .where.not(external_invoices: { status: %w[voided deleted] })  # SSoT: Match ExternalInvoice.active scope

          if tenant_id.present?
            pdf_query = pdf_query.where(external_invoices: { tenant_id: tenant_id })
          end

          invoices_with_pdfs = pdf_query.distinct.count(:documentable_id)

          pdfs_pending = [total_pdf_eligible - invoices_with_pdfs, 0].max  # Ensure non-negative
          pdf_progress = total_pdf_eligible.zero? ? 100 : [((invoices_with_pdfs.to_f / total_pdf_eligible) * 100).round(1), 100].min  # Cap at 100%

          # SSoT: Use XeroSyncStatus for last sync time, fallback to record timestamps
          pdf_sync_status_query = XeroSyncStatus.where(sync_type: "pdfs")
          pdf_sync_status_query = pdf_sync_status_query.where(tenant_id: tenant_id) if tenant_id.present?
          pdf_sync_status = pdf_sync_status_query.order(last_synced_at: :desc).first

          pdf_docs_query = CorporateCompanyDocument.where(source: "xero").where(documentable_type: "ExternalInvoice")
          if tenant_id.present?
            pdf_docs_query = pdf_docs_query.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                           .where(external_invoices: { tenant_id: tenant_id })
          end
          last_pdf_sync = pdf_sync_status&.last_synced_at || pdf_docs_query.maximum(:created_at)

          # Recent PDF activity (last 24 hours)
          pdfs_last_24h_query = CorporateCompanyDocument.where(source: "xero")
                                         .where(documentable_type: "ExternalInvoice")
                                         .where("corporate_company_documents.created_at > ?", 24.hours.ago)
          if tenant_id.present?
            pdfs_last_24h_query = pdfs_last_24h_query.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                                     .where(external_invoices: { tenant_id: tenant_id })
          end
          pdfs_last_24h = pdfs_last_24h_query.count

          # ============================================
          # STAGE 3: SharePoint Upload (Active Storage -> SharePoint)
          # ============================================
          # SSoT: Count PDFs ACTUALLY uploaded to SharePoint (have sharepoint_file_id set)
          # sharepoint_file_id is set by SharePoint after successful upload - this is the SSoT
          # expected_sharepoint_path is just the PLAN, not the reality
          # Only count PDFs (not attachments) to match Stage 2's count
          # SSoT FIX: Must use same filters as total_pdf_eligible (contacts + non-draft)
          sharepoint_query = CorporateCompanyDocument.where(source: "xero")
                                                    .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                                    .where.not(sharepoint_file_id: nil)  # SSoT: Actually uploaded
                                                    .where(documentable_type: "ExternalInvoice")
                                                    .joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                                    .where.not(external_invoices: { contact_id: nil })  # SSoT: Match pdf_eligible_invoices
                                                    .where.not(external_invoices: { status: "draft" })  # SSoT: Match pdf_eligible_invoices
                                                    .where.not(external_invoices: { status: %w[voided deleted] })  # SSoT: Match ExternalInvoice.active scope
          if tenant_id.present?
            sharepoint_query = sharepoint_query.where(external_invoices: { tenant_id: tenant_id })
          end
          sharepoint_pdfs_uploaded = sharepoint_query.count

          # PDFs downloaded but not yet on SharePoint
          sharepoint_pending = [ invoices_with_pdfs - sharepoint_pdfs_uploaded, 0 ].max
          sharepoint_progress = invoices_with_pdfs.zero? ? 0 : ((sharepoint_pdfs_uploaded.to_f / invoices_with_pdfs) * 100).round(1)
          sharepoint_progress = [ sharepoint_progress, 100 ].min # Cap at 100%

          # SSoT: Use XeroSyncStatus for last sync time, fallback to record timestamps
          sharepoint_sync_status_query = XeroSyncStatus.where(sync_type: "sharepoint")
          sharepoint_sync_status_query = sharepoint_sync_status_query.where(tenant_id: tenant_id) if tenant_id.present?
          sharepoint_sync_status = sharepoint_sync_status_query.order(last_synced_at: :desc).first

          sharepoint_docs_query = CorporateCompanyDocument.where(source: "xero")
                                                         .where(documentable_type: "ExternalInvoice")
                                                         .where.not(sharepoint_file_id: nil)
          if tenant_id.present?
            sharepoint_docs_query = sharepoint_docs_query.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                                         .where(external_invoices: { tenant_id: tenant_id })
          end
          last_sharepoint_sync = sharepoint_sync_status&.last_synced_at || sharepoint_docs_query.maximum(:updated_at)

          # ============================================
          # Breakdown by invoice type (for PDF stage)
          # ============================================
          bills_total = invoices_with_contacts.bills.count
          bills_query = CorporateCompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                           .where(corporate_company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                           .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                           .where(external_invoices: { invoice_type: "bill" })
          bills_query = bills_query.where(external_invoices: { tenant_id: tenant_id }) if tenant_id.present?
          bills_with_pdfs = bills_query.distinct.count("corporate_company_documents.documentable_id")

          sales_total = invoices_with_contacts.sales_invoices.count
          sales_query = CorporateCompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                           .where(corporate_company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                           .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                           .where(external_invoices: { invoice_type: "sales_invoice" })
          sales_query = sales_query.where(external_invoices: { tenant_id: tenant_id }) if tenant_id.present?
          sales_with_pdfs = sales_query.distinct.count("corporate_company_documents.documentable_id")

          quotes_total = invoices_with_contacts.quotes.count
          quotes_query = CorporateCompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                            .where(corporate_company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                            .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                            .where(external_invoices: { invoice_type: "quote" })
          quotes_query = quotes_query.where(external_invoices: { tenant_id: tenant_id }) if tenant_id.present?
          quotes_with_pdfs = quotes_query.distinct
                                            .count("corporate_company_documents.documentable_id")

          # Credit notes breakdown (SSoT fix - was missing from PDF breakdown)
          credit_notes_total = invoices_with_contacts.where(invoice_type: "credit_note").count
          credit_notes_query = CorporateCompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
                                                  .where(corporate_company_documents: { source: "xero", documentable_type: "ExternalInvoice" })
                                                  .where("corporate_company_documents.external_id LIKE ?", "xero:%:pdf")
                                                  .where(external_invoices: { invoice_type: "credit_note" })
          credit_notes_query = credit_notes_query.where(external_invoices: { tenant_id: tenant_id }) if tenant_id.present?
          credit_notes_with_pdfs = credit_notes_query.distinct.count("corporate_company_documents.documentable_id")

          # Estimate time remaining for PDF sync (based on 10s per invoice)
          estimated_remaining_seconds = pdfs_pending * 10
          estimated_remaining_minutes = (estimated_remaining_seconds / 60.0).round(0)

          # Calculate next scheduled sync times (in Brisbane time AEST/AEDT)
          brisbane_tz = ActiveSupport::TimeZone["Australia/Brisbane"]
          now_brisbane = Time.current.in_time_zone(brisbane_tz)

          # Invoice sync runs every 5 minutes
          next_invoice_sync = calculate_next_run(now_brisbane, 5, 0)

          # SSoT: Check actual rate limit status to determine if sync is paused
          credential = XeroCredential.where(status: %w[connected degraded]).first
          rate_usage = credential ? XeroRateLimitTracker.usage_for(credential.tenant_id) : nil
          daily_percentage = rate_usage&.dig(:daily, :percentage) || 0
          is_rate_limited = daily_percentage >= 80

          # PDF sync uses smart rate limiting - calculates next run based on pending count AND rate limit status
          # SSoT: If rate limited, show when we'll resume (next recurring run or rate limit reset)
          next_pdf_sync = if is_rate_limited
            # Rate limited - next run is either recurring job (2 hours) or midnight reset
            # Use the stored next_sync_at from XeroSyncStatus if available
            pdf_sync_status&.next_sync_at || 2.hours.from_now
          elsif pdfs_pending > 100
            5.minutes.from_now
          elsif pdfs_pending > 0
            10.minutes.from_now
          else
            30.minutes.from_now
          end

          # Stage 2 info - smart rate-limited sync status
          # SSoT: Show actual status including rate limit pauses
          # Xero daily rate limit resets at midnight UTC (00:00:00)
          # Midnight UTC = 10:00 AM Brisbane (AEST, UTC+10)
          # The NEXT reset is: today 10 AM if before 10 AM, tomorrow 10 AM if after
          brisbane_10am_today = now_brisbane.change(hour: 10, min: 0, sec: 0)

          resets_at_display = if now_brisbane < brisbane_10am_today
            # Before 10 AM Brisbane - reset happens today
            "Today 10:00 AM"
          else
            # After 10 AM Brisbane - reset happens tomorrow
            "Tomorrow 10:00 AM"
          end
          brisbane_reset = now_brisbane < brisbane_10am_today ? brisbane_10am_today : brisbane_10am_today + 1.day

          stage2_blocker = if is_rate_limited && pdfs_pending > 0
            {
              reason: "Rate limited - paused until headroom available",
              detail: "Daily API usage at #{daily_percentage.round(0)}%. #{pdfs_pending} PDFs waiting. Will resume when usage drops below 80%.",
              pending_count: pdfs_pending,
              sync_mode: "rate_limited",
              daily_percentage: daily_percentage.round(1),
              resets_at: brisbane_reset.iso8601,
              resets_at_display: resets_at_display
            }
          elsif pdfs_pending > 100
            {
              reason: "Catching up - syncing at max safe speed",
              detail: "Processing ~20 PDFs per batch, auto-queuing next batch. #{pdfs_pending} remaining.",
              pending_count: pdfs_pending,
              sync_mode: "catching_up"
            }
          elsif pdfs_pending > 0
            {
              reason: "Almost caught up - slowing down",
              detail: "#{pdfs_pending} PDFs remaining, will be near-live soon.",
              pending_count: pdfs_pending,
              sync_mode: "almost_done"
            }
          else
            nil
          end

          # Stage 3 blocker info
          stage3_blocker = if sharepoint_pending > 0
            {
              reason: "Uploading to SharePoint",
              detail: "#{sharepoint_pending} PDFs queued for SharePoint upload",
              pending_count: sharepoint_pending
            }
          else
            nil
          end

          # ============================================
          # SSoT VIOLATION TRACKING
          # ============================================
          # Check for documents with wrong external_id format
          # SSoT (Bible #16.002): external_id for attachments should be "xero:attachment:ID" NOT "xero:invoice-uuid:attachment:ID"
          # This catches both old formats:
          #   - xero:invoice:123:attachment:456 (old integer format)
          #   - xero:uuid:attachment:uuid (current wrong format with invoice UUID)
          wrong_format_count = CorporateCompanyDocument.where(source: "xero")
                                                       .where("external_id LIKE ? OR external_id LIKE ?",
                                                              "%:invoice:%:attachment:%",
                                                              "xero:%:attachment:%")
                                                       .where.not("external_id LIKE ?", "xero:attachment:%")
                                                       .count

          # Check for PDF documents missing expected_sharepoint_path (should all have it after upload)
          pdfs_missing_sharepoint_path = CorporateCompanyDocument.where(source: "xero")
                                                                 .where("external_id LIKE ?", "xero:%:pdf")
                                                                 .where(documentable_type: "ExternalInvoice")
                                                                 .where(expected_sharepoint_path: nil)
                                                                 .count

          # Build violations array for Stage 3 display
          stage3_violations = []
          if wrong_format_count > 0
            stage3_violations << {
              type: "external_id_format",
              count: wrong_format_count,
              severity: "warning",
              description: "Attachments with old external_id format (should be 'xero:attachment:ID')",
              action_required: "Run: rails xero:fix_external_id_format"
            }
          end

          if pdfs_missing_sharepoint_path > 0 && sharepoint_pdfs_uploaded > 0
            # Only flag as violation if we have uploads (meaning system is working)
            stage3_violations << {
              type: "missing_sharepoint_path",
              count: pdfs_missing_sharepoint_path,
              severity: "info",
              description: "PDFs without SharePoint path (may be in progress)",
              action_required: nil
            }
          end

          # Get SharePoint URL for Contacts folder
          sharepoint_contacts_url = nil
          begin
            credential = MicrosoftCredential.sharepoint_credential
            if credential&.metadata&.dig("site_web_url")
              settings = CorporateCompanySetting.first
              contacts_folder = settings&.contact_documents_path || "Contacts"
              encoded_folder = ERB::Util.url_encode(contacts_folder)
              sharepoint_contacts_url = "#{credential.metadata["site_web_url"]}/Shared%20Documents/#{encoded_folder}"
            end
          rescue => e
            Rails.logger.warn("[pdf_sync_status] Could not get SharePoint URL: #{e.message}")
          end

          render json: {
            success: true,
            data: {
              # Stage 1: Invoice DATA sync (Xero -> Database)
              stage1_data_sync: {
                total_in_database: total_invoices_in_db,
                linked_to_contacts: total_with_contacts,
                unlinked_count: invoices_without_contacts,
                last_synced_at: last_invoice_sync,           # SSoT: Use last_synced_at consistently
                last_sync_at: last_invoice_sync,             # Deprecated: kept for backwards compatibility
                next_sync_at: next_invoice_sync,
                schedule: "Every 5 minutes",
                breakdown: invoice_breakdown,
                blocker: stage1_blocker
              },

              # Stage 2: PDF Download (Xero -> Active Storage)
              # SSoT: Excludes DRAFT invoices since Xero doesn't generate PDFs for drafts
              stage2_pdf_download: {
                total_to_sync: total_pdf_eligible,
                downloaded: invoices_with_pdfs,
                pending: pdfs_pending,
                progress_percentage: pdf_progress,
                last_synced_at: last_pdf_sync,               # SSoT: Use last_synced_at consistently
                last_sync_at: last_pdf_sync,                 # Deprecated: kept for backwards compatibility
                next_sync_at: next_pdf_sync,
                schedule: pdfs_pending > 100 ? "Smart sync: max speed (every 5 min)" : pdfs_pending > 0 ? "Smart sync: slowing down (every 10 min)" : "Smart sync: near-live (every 30 min)",
                synced_last_24h: pdfs_last_24h,
                breakdown: {
                  bills: { total: bills_total, synced: bills_with_pdfs },
                  sales_invoices: { total: sales_total, synced: sales_with_pdfs },
                  credit_notes: { total: credit_notes_total, synced: credit_notes_with_pdfs },
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
                last_synced_at: last_sharepoint_sync,
                schedule: "Uploads with PDF sync",
                blocker: stage3_blocker,
                sharepoint_url: sharepoint_contacts_url,
                violations: stage3_violations  # SSoT: Show data quality issues
              },

              # Overall metrics (for backwards compatibility)
              total_invoices: total_with_contacts,
              pdfs_synced: invoices_with_pdfs,
              pending: pdfs_pending,
              progress_percentage: pdf_progress,
              sharepoint_uploads: sharepoint_pdfs_uploaded,
              synced_last_24h: pdfs_last_24h,
              last_synced_at: last_pdf_sync,              # SSoT: Use last_synced_at consistently
              last_sync_at: last_pdf_sync,                # Deprecated: kept for backwards compatibility
              next_sync_at: next_pdf_sync,
              breakdown: {
                bills: { total: bills_total, synced: bills_with_pdfs },
                sales_invoices: { total: sales_total, synced: sales_with_pdfs },
                credit_notes: { total: credit_notes_total, synced: credit_notes_with_pdfs },
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

      # GET /api/v1/xero/sync_health
      # Returns unified sync health status from XeroSyncStatus SSoT table
      # This is the single source of truth for all Xero sync timestamps
      def sync_health
        begin
          health = XeroSyncStatus.health_summary

          render json: {
            success: true,
            data: health
          }
        rescue StandardError => e
          Rails.logger.error("Xero sync_health error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to get sync health: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/sync_stats
      # Returns comprehensive sync statistics for the Xero dashboard
      # Includes per-tenant stats, global stats, and cross-tenant matching info
      def sync_stats
        begin
          # Get all Xero credentials (tenants)
          credentials = XeroCredential.all

          # Per-tenant statistics
          tenant_stats = credentials.map do |cred|
            tenant_id = cred.tenant_id

            # Count external links for this tenant
            tenant_links = ContactExternalLink.xero.for_tenant(tenant_id)
            links_count = tenant_links.count
            enabled_count = tenant_links.enabled.count
            pending_review_count = tenant_links.pending_review.count
            with_errors_count = tenant_links.with_errors.count

            # Count invoices/bills for this tenant
            # SSoT: Use .active scope to match Stage 1 sync count (excludes voided/deleted)
            tenant_invoices = ExternalInvoice.xero.active.where(tenant_id: tenant_id)
            invoices_count = tenant_invoices.sales_invoices.count
            bills_count = tenant_invoices.bills.count
            quotes_count = tenant_invoices.quotes.count
            credit_notes_count = tenant_invoices.credit_notes.count

            # Last sync timestamps
            last_contact_sync = tenant_links.maximum(:last_synced_at)
            last_invoice_sync = tenant_invoices.maximum(:last_synced_at)

            # Cross-tenant matches (contacts linked to multiple tenants)
            cross_tenant_contact_ids = ContactExternalLink.xero
                                                          .for_tenant(tenant_id)
                                                          .joins("INNER JOIN contact_external_links cel2 ON cel2.contact_id = contact_external_links.contact_id AND cel2.tenant_id != contact_external_links.tenant_id AND cel2.source = 'xero'")
                                                          .distinct
                                                          .pluck(:contact_id)
            cross_tenant_count = cross_tenant_contact_ids.count

            # Match type breakdown for this tenant
            match_breakdown = tenant_links.group(:match_type).count

            # Rate limit status for this tenant
            rate_usage = XeroRateLimitTracker.usage_for(tenant_id) rescue nil

            {
              tenant_id: tenant_id,
              tenant_name: cred.tenant_name,
              status: cred.status,
              is_primary: cred.is_primary,
              contacts: {
                total_links: links_count,
                sync_enabled: enabled_count,
                pending_review: pending_review_count,
                with_errors: with_errors_count,
                cross_tenant_matches: cross_tenant_count,
                last_synced_at: last_contact_sync
              },
              documents: {
                invoices: invoices_count,
                bills: bills_count,
                quotes: quotes_count,
                credit_notes: credit_notes_count,
                total: invoices_count + bills_count + quotes_count + credit_notes_count,
                last_synced_at: last_invoice_sync
              },
              match_breakdown: {
                exact_abn: match_breakdown["exact_abn"] || 0,
                exact_email: match_breakdown["exact_email"] || 0,
                fuzzy_name: match_breakdown["fuzzy_name"] || 0,
                manual: match_breakdown["manual"] || 0
              },
              rate_limits: rate_usage ? {
                daily_percentage: rate_usage.dig(:daily, :percentage)&.round(1) || 0,
                minute_percentage: rate_usage.dig(:minute, :percentage)&.round(1) || 0,
                is_limited: (rate_usage.dig(:daily, :percentage) || 0) >= 80
              } : nil
            }
          end

          # Global statistics (across all tenants)
          # SSoT: Use .active scope to match Stage 1 sync count (excludes voided/deleted)
          all_xero_links = ContactExternalLink.xero
          all_invoices = ExternalInvoice.xero.active

          # Total pending reviews
          total_pending_reviews = all_xero_links.pending_review.count

          # Contacts linked to multiple Xero tenants
          multi_tenant_contact_ids = all_xero_links.group(:contact_id)
                                                    .having("COUNT(DISTINCT tenant_id) > 1")
                                                    .pluck(:contact_id)
          multi_tenant_contacts_count = multi_tenant_contact_ids.count

          # Global match type breakdown
          global_match_breakdown = all_xero_links.group(:match_type).count

          # Total unique contacts with any Xero link
          total_contacts_with_links = all_xero_links.distinct.count(:contact_id)

          # Total invoices/bills across all tenants
          total_invoices = all_invoices.sales_invoices.count
          total_bills = all_invoices.bills.count
          total_quotes = all_invoices.quotes.count
          total_credit_notes = all_invoices.credit_notes.count

          # Recent sync activity (last 24 hours)
          recent_contact_syncs = all_xero_links.where("last_synced_at > ?", 24.hours.ago).count
          recent_invoice_syncs = all_invoices.where("last_synced_at > ?", 24.hours.ago).count

          # Get pending review items with details for display
          pending_review_items = all_xero_links.pending_review
                                                .includes(:contact)
                                                .limit(10)
                                                .map do |link|
            tenant = credentials.find { |c| c.tenant_id == link.tenant_id }
            {
              id: link.id,
              contact_id: link.contact_id,
              contact_name: link.contact&.display_name,
              tenant_id: link.tenant_id,
              tenant_name: tenant&.tenant_name || link.tenant_name,
              external_contact_id: link.external_contact_id,
              external_contact_name: link.metadata&.dig("name") || link.external_contact_id,
              match_type: link.match_type,
              match_confidence: link.match_confidence,
              created_at: link.created_at
            }
          end

          render json: {
            success: true,
            data: {
              tenant_count: credentials.count,
              tenants: tenant_stats,
              global: {
                pending_reviews: {
                  count: total_pending_reviews,
                  items: pending_review_items
                },
                cross_tenant: {
                  contacts_linked_to_multiple_tenants: multi_tenant_contacts_count,
                  multi_tenant_contact_ids: multi_tenant_contact_ids.first(100)  # Limit for response size
                },
                match_breakdown: {
                  exact_abn: global_match_breakdown["exact_abn"] || 0,
                  exact_email: global_match_breakdown["exact_email"] || 0,
                  fuzzy_name: global_match_breakdown["fuzzy_name"] || 0,
                  manual: global_match_breakdown["manual"] || 0,
                  total: all_xero_links.count
                },
                totals: {
                  contacts_with_links: total_contacts_with_links,
                  total_links: all_xero_links.count,
                  invoices: total_invoices,
                  bills: total_bills,
                  quotes: total_quotes,
                  credit_notes: total_credit_notes,
                  all_documents: total_invoices + total_bills + total_quotes + total_credit_notes
                },
                recent_activity: {
                  contact_syncs_24h: recent_contact_syncs,
                  invoice_syncs_24h: recent_invoice_syncs
                }
              }
            }
          }
        rescue StandardError => e
          Rails.logger.error("Xero sync_stats error: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: {
            success: false,
            error: "Failed to get sync stats: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/xero/common_contacts
      # Returns contacts linked to multiple Xero organizations
      def common_contacts
        begin
          credentials = XeroCredential.all

          # Find contacts linked to 2+ Xero tenants
          contact_ids_with_multiple_links = ContactExternalLink
            .xero
            .group(:contact_id)
            .having("COUNT(DISTINCT tenant_id) >= 2")
            .count
            .keys

          # Get full contact info with their links
          contacts = Contact.where(id: contact_ids_with_multiple_links)
                           .includes(:external_links)
                           .order(:display_name)

          common_contacts_data = contacts.map do |contact|
            xero_links = contact.external_links.xero.to_a
            tenant_ids = xero_links.map(&:tenant_id).uniq

            {
              id: contact.id,
              display_name: contact.display_name,
              entity_type: contact.entity_type,
              email: contact.email,
              tax_number: contact.tax_number,
              tenant_count: tenant_ids.count,
              tenants: tenant_ids.map do |tid|
                cred = credentials.find { |c| c.tenant_id == tid }
                link = xero_links.find { |l| l.tenant_id == tid }
                {
                  tenant_id: tid,
                  tenant_name: cred&.tenant_name || "Unknown",
                  external_contact_id: link&.external_contact_id,
                  external_contact_name: link&.metadata&.dig("name") || link&.external_contact_id,
                  match_type: link&.match_type,
                  sync_enabled: link&.sync_enabled,
                  last_synced_at: link&.last_synced_at
                }
              end
            }
          end

          render json: {
            success: true,
            data: {
              total_count: common_contacts_data.count,
              contacts: common_contacts_data
            }
          }
        rescue StandardError => e
          Rails.logger.error("Xero common_contacts error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to get common contacts: #{e.message}"
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

      # GET /api/v1/xero/unlinked_contacts
      # Returns grouped unlinked Xero contacts with potential TEEEM contact matches
      def unlinked_contacts
        begin
          # Get all unlinked invoices grouped by contact_name
          unlinked = ExternalInvoice.where(contact_id: nil)
            .where.not(contact_name: [ nil, "", "No Contact" ])
            .group(:contact_name, :external_contact_id)
            .select("contact_name, external_contact_id, COUNT(*) as invoice_count, SUM(total) as total_amount")
            .order("invoice_count DESC")

          # Build response with potential matches for each
          contacts_with_matches = unlinked.map do |record|
            name = record.contact_name
            potential_matches = find_potential_teeem_matches(name)

            # Fetch Xero contact details from one of the invoices' raw_data
            xero_details = extract_xero_contact_details(record.external_contact_id)

            {
              xero_contact_name: name,
              xero_contact_id: record.external_contact_id,
              invoice_count: record.invoice_count,
              total_amount: record.total_amount&.to_f || 0,
              potential_matches: potential_matches,
              best_match: potential_matches.first,
              xero_details: xero_details
            }
          end

          render json: {
            success: true,
            data: {
              total_unlinked: contacts_with_matches.size,
              total_invoices: contacts_with_matches.sum { |c| c[:invoice_count] },
              contacts: contacts_with_matches
            }
          }
        rescue StandardError => e
          Rails.logger.error("Xero unlinked_contacts error: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: {
            success: false,
            error: "Failed to get unlinked contacts: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/link_unlinked_contact
      # Links all invoices with a given Xero contact name to a TEEEM contact
      # Can optionally create a new contact if create_new: true
      def link_unlinked_contact
        xero_contact_name = params[:xero_contact_name]
        contact_id = params[:contact_id]
        create_new = params[:create_new] == true || params[:create_new] == "true"

        unless xero_contact_name.present?
          return render json: { success: false, error: "xero_contact_name is required" }, status: :bad_request
        end

        unless contact_id.present? || create_new
          return render json: { success: false, error: "contact_id or create_new is required" }, status: :bad_request
        end

        begin
          ActiveRecord::Base.transaction do
            # Find the TEEEM contact (or create new)
            if create_new
              # Create a new contact with the Xero contact name
              # Default to "company" entity_type since most Xero contacts are businesses
              @contact = Contact.create!(
                display_name: xero_contact_name,
                company_name_or_trust: xero_contact_name,
                entity_type: "company",
                is_active: true
              )
            else
              @contact = Contact.find(contact_id)
            end

            # Update all unlinked invoices with this contact name
            updated_count = ExternalInvoice.where(contact_id: nil, contact_name: xero_contact_name)
              .update_all(contact_id: @contact.id)

            render json: {
              success: true,
              data: {
                contact_id: @contact.id,
                contact_name: @contact.display_name,
                invoices_linked: updated_count,
                created_new: create_new
              }
            }
          end
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Contact not found" }, status: :not_found
        rescue StandardError => e
          Rails.logger.error("Xero link_unlinked_contact error: #{e.message}")
          render json: { success: false, error: "Failed to link contact: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/auto_match_contacts
      # Automatically matches unlinked Xero contacts to TEEEM contacts by name
      def auto_match_contacts
        begin
          matched_count = 0
          skipped_count = 0
          results = []

          # Get all unique unlinked contact names
          unlinked = ExternalInvoice.where(contact_id: nil)
            .where.not(contact_name: [ nil, "", "No Contact" ])
            .distinct
            .pluck(:contact_name)

          unlinked.each do |xero_name|
            # Normalize name - trim whitespace and squish multiple spaces
            normalized_name = xero_name.to_s.strip.squish.downcase

            # Try to find exact match first (also normalize DB values)
            teeem_contact = Contact.find_by("LOWER(TRIM(display_name)) = ?", normalized_name)

            # Try company name match
            teeem_contact ||= Contact.find_by("LOWER(TRIM(company_name_or_trust)) = ?", normalized_name)

            if teeem_contact
              # Link all invoices with this name
              count = ExternalInvoice.where(contact_id: nil, contact_name: xero_name)
                .update_all(contact_id: teeem_contact.id)

              matched_count += 1
              results << {
                xero_name: xero_name,
                matched_to: teeem_contact.display_name,
                contact_id: teeem_contact.id,
                invoices_linked: count
              }
            else
              skipped_count += 1
            end
          end

          render json: {
            success: true,
            data: {
              matched_count: matched_count,
              skipped_count: skipped_count,
              results: results
            }
          }
        rescue StandardError => e
          Rails.logger.error("Xero auto_match_contacts error: #{e.message}")
          render json: { success: false, error: "Failed to auto-match: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/push_contact_names
      # Updates Xero contact names to match TEEEM contact display names
      # Takes an array of xero_link_ids and pushes the TEEEM name to Xero
      def push_contact_names
        xero_link_ids = params[:xero_link_ids]

        unless xero_link_ids.present? && xero_link_ids.is_a?(Array)
          return render json: { success: false, error: "xero_link_ids array is required" }, status: :bad_request
        end

        begin
          results = { success: 0, failed: 0, errors: [] }
          xero_client = XeroApiClient.new

          xero_link_ids.each do |link_id|
            link = ContactExternalLink.find_by(id: link_id)
            unless link
              results[:failed] += 1
              results[:errors] << { link_id: link_id, error: "Link not found" }
              next
            end

            contact = link.contact
            unless contact
              results[:failed] += 1
              results[:errors] << { link_id: link_id, error: "Contact not found" }
              next
            end

            # Build the Xero payload - just update the name
            xero_payload = {
              Contacts: [
                {
                  ContactID: link.external_contact_id,
                  Name: contact.display_name
                }
              ]
            }

            # Push to Xero
            result = xero_client.post("Contacts", xero_payload, tenant_id: link.tenant_id)

            if result[:success]
              # Update the external_name to match what we pushed
              link.update!(
                external_name: contact.display_name,
                match_confidence: 1.0,
                last_synced_at: Time.current
              )
              results[:success] += 1
              Rails.logger.info("[Xero] Pushed name '#{contact.display_name}' to Xero contact #{link.external_contact_id}")
            else
              results[:failed] += 1
              results[:errors] << {
                link_id: link_id,
                contact_name: contact.display_name,
                error: result[:error] || "Failed to update Xero contact"
              }
              Rails.logger.error("[Xero] Failed to push name for link #{link_id}: #{result[:error]}")
            end
          end

          render json: {
            success: true,
            data: results
          }
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("[Xero] push_contact_names auth error: #{e.message}")
          render json: { success: false, error: "Xero authentication failed: #{e.message}" }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("[Xero] push_contact_names error: #{e.message}")
          render json: { success: false, error: "Failed to push contact names: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/xero/sync_all_companies
      # Syncs all corporate companies with Xero connections
      # Used from the Corporate page to sync all 10 companies at once
      def sync_all_companies
        begin
          Rails.logger.info("[Xero] Starting sync_all_companies")

          # Get all corporate companies with Xero connections
          companies_with_xero = CorporateCompany.joins(:corporate_company_xero_connection)
            .includes(:corporate_company_xero_connection)
            .where(corporate_company_xero_connections: { xero_tenant_id: XeroCredential.pluck(:tenant_id) })

          if companies_with_xero.empty?
            return render json: {
              success: false,
              error: "No companies are connected to Xero"
            }, status: :bad_request
          end

          results = []
          successful = 0
          failed = 0

          companies_with_xero.find_each do |company|
            connection = company.corporate_company_xero_connection
            next unless connection&.connected?

            begin
              Rails.logger.info("[Xero] Syncing company #{company.id}: #{company.name}")

              # Refresh tokens if needed
              if connection.needs_refresh?
                unless connection.refresh_tokens!
                  results << {
                    company_id: company.id,
                    company_name: company.name,
                    success: false,
                    error: "Token refresh failed"
                  }
                  failed += 1
                  next
                end
              end

              # 1. Sync Xero bank accounts and transactions
              bank_result = { success: true }
              tx_result = { success: true }
              begin
                sync_service = XeroBankSyncService.new(company)
                bank_result = sync_service.sync_bank_accounts(auto_create: true)
                tx_result = sync_service.sync_transactions(
                  from_date: 3.months.ago.to_date,
                  to_date: Date.today
                )
              rescue StandardError => e
                Rails.logger.warn("[Xero] Bank sync failed for #{company.name}: #{e.message}")
                bank_result = { success: false, error: e.message }
              end

              # 2. Sync Monthly P&L data
              pl_result = { success: true }
              begin
                pl_sync_service = CorporateCompanyXeroSyncService.new(company)
                pl_result = pl_sync_service.sync_all(force: false)
              rescue StandardError => e
                Rails.logger.warn("[Xero] P&L sync failed for #{company.name}: #{e.message}")
                pl_result = { success: false, error: e.message }
              end

              # 3. Sync GL data (if adapter available)
              gl_result = { success: true, skipped: true }
              begin
                if defined?(Gl::Adapters) && Gl::Adapters.respond_to?(:for)
                  adapter = Gl::Adapters.for(company)
                  if adapter && !adapter.standalone?
                    gl_sync_service = Gl::SyncService.new(adapter)
                    gl_sync_service.sync_incremental
                    gl_result = { success: true, synced: true }
                  end
                end
              rescue StandardError => e
                Rails.logger.warn("[Xero] GL sync failed for #{company.name}: #{e.message}")
                gl_result = { success: false, error: e.message }
              end

              # Update connection sync time
              connection.sync_successful! if bank_result[:success] && tx_result[:success]

              results << {
                company_id: company.id,
                company_name: company.name,
                xero_tenant_name: connection.xero_tenant_name,
                success: true,
                bank_accounts_synced: bank_result[:auto_created_count] || 0,
                transactions_synced: tx_result[:total_transactions_synced] || 0,
                pl_synced: pl_result[:success],
                gl_synced: gl_result[:success] && !gl_result[:skipped]
              }
              successful += 1

            rescue StandardError => e
              Rails.logger.error("[Xero] Sync failed for company #{company.id}: #{e.message}")
              results << {
                company_id: company.id,
                company_name: company.name,
                success: false,
                error: e.message
              }
              failed += 1
            end
          end

          render json: {
            success: true,
            data: {
              total_companies: companies_with_xero.count,
              successful: successful,
              failed: failed,
              results: results
            }
          }
        rescue StandardError => e
          Rails.logger.error("[Xero] sync_all_companies error: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: {
            success: false,
            error: "Failed to sync companies: #{e.message}"
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

      # Determine what sync action was taken from a ContactExternalLink
      def determine_sync_action_from_link(link)
        if link.sync_error.present?
          "Sync Failed"
        elsif link.external_contact_id.present? && link.contact&.created_at && link.last_synced_at && link.contact.created_at < link.last_synced_at
          "Updated from Xero"
        elsif link.external_contact_id.present?
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

      # Find any active sync job
      # Uses XeroSyncStatus (SSoT) instead of scanning cache keys
      def find_active_sync_job
        # Check XeroSyncStatus for any sync in progress
        active_sync = XeroSyncStatus.where(status: "in_progress").order(updated_at: :desc).first
        return nil unless active_sync

        {
          status: "processing",
          sync_type: active_sync.sync_type,
          tenant_id: active_sync.tenant_id,
          started_at: active_sync.updated_at
        }
      end

      # Find potential TEEEM contact matches for a Xero contact name
      def find_potential_teeem_matches(xero_name)
        return [] unless xero_name.present?

        matches = []
        # Normalize name - same logic as auto_match_contacts for consistency
        name_lower = xero_name.to_s.strip.squish.downcase

        # Priority 1: Exact display_name match (with TRIM for whitespace normalization)
        exact = Contact.where("LOWER(TRIM(display_name)) = ?", name_lower).first
        if exact
          matches << { id: exact.id, name: exact.display_name, match_type: "exact", score: 100 }
        end

        # Priority 2: Exact company_name_or_trust match
        company_exact = Contact.where("LOWER(TRIM(company_name_or_trust)) = ?", name_lower).first
        if company_exact && company_exact.id != exact&.id
          matches << { id: company_exact.id, name: company_exact.display_name, match_type: "company_exact", score: 95 }
        end

        # Priority 3: Partial name match (TEEEM contains Xero name)
        partial = Contact.where("LOWER(display_name) LIKE ? OR LOWER(company_name_or_trust) LIKE ?", "%#{name_lower}%", "%#{name_lower}%")
          .where.not(id: matches.map { |m| m[:id] })
          .limit(5)

        partial.each do |p|
          score = calculate_name_similarity(name_lower, p.display_name&.downcase || "")
          matches << { id: p.id, name: p.display_name, match_type: "partial", score: score }
        end

        # Priority 3b: Reverse partial match (Xero name contains TEEEM name)
        # This catches "W2G Assets Pty Ltd" (Xero) containing "W2G Assets" (TEEEM)
        if matches.size < 5
          # Find contacts where the Xero name contains the TEEEM display_name
          escaped_name = ActiveRecord::Base.connection.quote_string(name_lower)
          reverse_partial = Contact.where("? LIKE '%' || LOWER(display_name) || '%'", name_lower)
            .where("LENGTH(display_name) >= 5") # Avoid tiny matches
            .where.not(id: matches.map { |m| m[:id] })
            .limit(5)

          reverse_partial.each do |p|
            # Higher score if TEEEM name is longer (more specific match)
            teeem_name = p.display_name&.downcase || ""
            base_score = ((teeem_name.length.to_f / name_lower.length) * 100).round
            score = [base_score, 90].min # Cap at 90 since it's not exact
            matches << { id: p.id, name: p.display_name, match_type: "partial", score: score }
          end
        end

        # Priority 4: Word-based matching (split name into words, match any)
        # SSoT: Remove common business suffixes that cause too many false matches
        common_suffixes = %w[pty ltd inc llc corp company co limited group]
        words = name_lower.split(/\s+/).reject { |w| w.length < 3 || common_suffixes.include?(w) }
        if words.any? && matches.size < 5
          word_conditions = words.map { |w| "LOWER(display_name) LIKE '%#{ActiveRecord::Base.connection.quote_string(w)}%'" }.join(" OR ")
          word_matches = Contact.where(word_conditions)
            .where.not(id: matches.map { |m| m[:id] })
            .limit(20) # Get more candidates for scoring

          # Score and sort by similarity, take top matches
          scored_word_matches = word_matches.map do |w|
            score = calculate_name_similarity(name_lower, w.display_name&.downcase || "")
            { contact: w, score: score }
          end.sort_by { |m| -m[:score] }.first(5 - matches.size)

          scored_word_matches.each do |m|
            matches << { id: m[:contact].id, name: m[:contact].display_name, match_type: "word", score: m[:score] }
          end
        end

        # Sort by score descending and return top 5
        matches.sort_by { |m| -m[:score] }.first(5)
      end

      # Calculate simple similarity score between two names
      def calculate_name_similarity(name1, name2)
        return 0 if name1.blank? || name2.blank?

        # Levenshtein-like scoring
        words1 = name1.split(/\s+/)
        words2 = name2.split(/\s+/)

        common_words = words1 & words2
        total_words = (words1 + words2).uniq.size

        return 0 if total_words == 0

        ((common_words.size.to_f / total_words) * 100).round
      end

      # Extract Xero contact details (email, phone, address) from an invoice's raw_data
      def extract_xero_contact_details(external_contact_id)
        return nil unless external_contact_id.present?

        # Get one invoice with this contact to extract details from raw_data
        invoice = ExternalInvoice.where(external_contact_id: external_contact_id)
          .where.not(raw_data: nil)
          .where("raw_data != '{}'::jsonb")
          .first

        return nil unless invoice&.raw_data.present?

        contact_data = invoice.raw_data["Contact"]
        return nil unless contact_data.is_a?(Hash)

        # Extract email
        email = contact_data["EmailAddress"]

        # Extract phone numbers from Phones array
        phones = contact_data["Phones"] || []
        phone_numbers = phones.map do |phone|
          next unless phone.is_a?(Hash)
          number = [ phone["PhoneCountryCode"], phone["PhoneAreaCode"], phone["PhoneNumber"] ]
            .compact.reject(&:blank?).join(" ")
          next if number.blank?
          { type: phone["PhoneType"]&.downcase, number: number }
        end.compact

        # Extract addresses from Addresses array
        addresses = contact_data["Addresses"] || []
        address_list = addresses.map do |addr|
          next unless addr.is_a?(Hash)
          address_type = addr["AddressType"]&.downcase

          # Build address lines
          lines = [
            addr["AddressLine1"],
            addr["AddressLine2"],
            addr["AddressLine3"],
            addr["AddressLine4"]
          ].compact.reject(&:blank?)

          city_state_postal = [
            addr["City"],
            addr["Region"],
            addr["PostalCode"]
          ].compact.reject(&:blank?).join(" ")

          lines << city_state_postal if city_state_postal.present?
          lines << addr["Country"] if addr["Country"].present?

          next if lines.empty?
          { type: address_type, lines: lines, formatted: lines.join(", ") }
        end.compact

        # Return structured contact details
        {
          email: email,
          phones: phone_numbers,
          addresses: address_list,
          website: contact_data["Website"],
          tax_number: contact_data["TaxNumber"],
          first_name: contact_data["FirstName"],
          last_name: contact_data["LastName"]
        }.compact
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
