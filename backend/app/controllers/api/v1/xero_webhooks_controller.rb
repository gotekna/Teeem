module Api
  module V1
    class XeroWebhooksController < ApplicationController
      # Skip authentication for webhooks (CSRF not applicable in API mode)
      skip_before_action :authorize_request

      # Xero webhook signature header
      XERO_SIGNATURE_HEADER = "x-xero-signature".freeze

      # POST /api/v1/xero/webhooks
      def receive
        # Get the raw body for signature verification
        raw_body = request.raw_post
        signature = request.headers[XERO_SIGNATURE_HEADER]

        # Verify webhook signature
        unless verify_signature(raw_body, signature)
          Rails.logger.warn("Xero webhook signature verification failed")
          head :unauthorized
          return
        end

        # Parse the webhook payload
        begin
          payload = JSON.parse(raw_body)
        rescue JSON::ParserError => e
          Rails.logger.error("Failed to parse Xero webhook payload: #{e.message}")
          head :bad_request
          return
        end

        # Handle different event types
        events = payload["events"] || []
        tenant_id = payload["tenantId"]

        Rails.logger.info("Received Xero webhook with #{events.length} events for tenant #{tenant_id}")

        events.each do |event|
          process_webhook_event(event, tenant_id)
        end

        # Acknowledge receipt
        head :ok
      end

      # POST /api/v1/xero/webhooks/intent
      # Xero sends this to verify webhook URL ownership
      def verify_intent
        # Return the challenge token to verify webhook URL
        challenge = params[:challenge]

        if challenge.present?
          render json: { challenge: challenge }
        else
          head :bad_request
        end
      end

      private

      def verify_signature(payload, signature)
        return false if signature.blank?

        webhook_key = ENV["XERO_WEBHOOK_KEY"]
        return true if webhook_key.blank? # Skip verification if no key configured

        # Xero uses HMAC-SHA256 for webhook signatures
        expected_signature = Base64.strict_encode64(
          OpenSSL::HMAC.digest("SHA256", webhook_key, payload)
        )

        ActiveSupport::SecurityUtils.secure_compare(expected_signature, signature)
      end

      def process_webhook_event(event, tenant_id)
        event_type = event["eventType"]
        event_category = event["eventCategory"]
        resource_id = event["resourceId"]

        Rails.logger.info("Processing Xero webhook: #{event_category}/#{event_type} for resource #{resource_id}")

        case event_category
        when "CONTACT"
          handle_contact_event(event_type, resource_id, tenant_id)
        when "INVOICE"
          handle_invoice_event(event_type, resource_id, tenant_id)
        when "PAYMENT"
          handle_payment_event(event_type, resource_id, tenant_id)
        when "ACCOUNT"
          handle_account_event(event_type, resource_id, tenant_id)
        when "BANK_TRANSACTION"
          handle_bank_transaction_event(event_type, resource_id, tenant_id)
        when "CREDIT_NOTE"
          handle_credit_note_event(event_type, resource_id, tenant_id)
        when "MANUAL_JOURNAL"
          handle_manual_journal_event(event_type, resource_id, tenant_id)
        else
          Rails.logger.info("Unhandled Xero webhook category: #{event_category}")
        end
      rescue StandardError => e
        Rails.logger.error("Error processing Xero webhook event: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
      end

      def handle_contact_event(event_type, xero_contact_id, tenant_id)
        # Find the link for this Xero contact
        link = ContactExternalLink.find_by(
          tenant_id: tenant_id,
          external_contact_id: xero_contact_id
        )

        case event_type
        when "CREATE", "UPDATE"
          if link
            # Contact already linked - queue sync job
            XeroContactSyncJob.perform_later(
              contact_id: link.contact_id,
              tenant_id: tenant_id,
              action: "sync_from_xero"
            )
            Rails.logger.info("Queued sync for contact #{link.contact_id} from Xero")
          else
            # New contact in Xero - queue import job
            XeroContactSyncJob.perform_later(
              xero_contact_id: xero_contact_id,
              tenant_id: tenant_id,
              action: "import_from_xero"
            )
            Rails.logger.info("Queued import for new Xero contact #{xero_contact_id}")
          end
        when "DELETE"
          if link
            # Contact deleted in Xero - handle based on cleanup options
            config = SyncConfiguration.find_by(xero_tenant_id: tenant_id)
            cleanup_options = config&.cleanup_options || {}

            if cleanup_options["unlink_deleted_xero_contacts"]
              link.destroy!
              Rails.logger.info("Deleted link for removed Xero contact #{xero_contact_id}")
            else
              link.update!(sync_error: "Contact was deleted in Xero")
              Rails.logger.info("Marked link as error for removed Xero contact #{xero_contact_id}")
            end
          end
        end
      end

      def handle_invoice_event(event_type, invoice_id, tenant_id)
        # Queue invoice sync job
        case event_type
        when "CREATE", "UPDATE"
          XeroInvoiceSyncJob.perform_later(
            xero_invoice_id: invoice_id,
            tenant_id: tenant_id,
            action: "sync_from_xero"
          ) if defined?(XeroInvoiceSyncJob)

          # Also sync to GL (creates journal entries)
          queue_gl_sync(tenant_id, 'invoices', invoice_id)
        end
      rescue StandardError => e
        Rails.logger.warn("Invoice sync job not available: #{e.message}")
      end

      def handle_payment_event(event_type, payment_id, tenant_id)
        # Queue payment sync job
        case event_type
        when "CREATE", "UPDATE"
          XeroPaymentSyncJob.perform_later(
            xero_payment_id: payment_id,
            tenant_id: tenant_id,
            action: "sync_from_xero"
          ) if defined?(XeroPaymentSyncJob)

          # Also sync to GL
          queue_gl_sync(tenant_id, 'payments', payment_id)
        end
      rescue StandardError => e
        Rails.logger.warn("Payment sync job not available: #{e.message}")
      end

      # ═══════════════════════════════════════════════════════════════
      # GL SYNC HANDLERS - Keep GL in sync with Xero changes
      # ═══════════════════════════════════════════════════════════════

      def handle_account_event(event_type, account_id, tenant_id)
        case event_type
        when "CREATE", "UPDATE"
          queue_gl_sync(tenant_id, 'accounts', account_id)
          Rails.logger.info("Queued GL account sync for #{account_id}")
        when "DELETE"
          # Mark account as inactive in GL
          gl_account = Gl::Account.find_by(
            external_provider: 'xero',
            external_tenant_id: tenant_id,
            external_id: account_id
          )
          gl_account&.update!(active: false)
          Rails.logger.info("Marked GL account #{account_id} as inactive")
        end
      end

      def handle_bank_transaction_event(event_type, transaction_id, tenant_id)
        case event_type
        when "CREATE", "UPDATE"
          queue_gl_sync(tenant_id, 'bank_transactions', transaction_id)
          Rails.logger.info("Queued GL bank transaction sync for #{transaction_id}")
        end
      end

      def handle_credit_note_event(event_type, credit_note_id, tenant_id)
        case event_type
        when "CREATE", "UPDATE"
          queue_gl_sync(tenant_id, 'credit_notes', credit_note_id)
          Rails.logger.info("Queued GL credit note sync for #{credit_note_id}")
        end
      end

      def handle_manual_journal_event(event_type, journal_id, tenant_id)
        case event_type
        when "CREATE", "UPDATE"
          queue_gl_sync(tenant_id, 'manual_journals', journal_id)
          Rails.logger.info("Queued GL manual journal sync for #{journal_id}")
        end
      end

      def queue_gl_sync(tenant_id, sync_type, resource_id = nil)
        # Find corporate company for this tenant
        xero_cred = XeroCredential.find_by(tenant_id: tenant_id)
        return unless xero_cred

        connection = xero_cred.corporate_xero_connections.first
        corporate = connection&.corporate
        return unless corporate

        # Queue the GL sync job
        GlSyncJob.perform_later(
          corporate.id,
          'xero',
          tenant_id,
          sync_type,
          resource_id
        )
      rescue StandardError => e
        Rails.logger.warn("GL sync queue failed: #{e.message}")
      end
    end
  end
end
