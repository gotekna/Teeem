# frozen_string_literal: true

module Api
  module V1
    module Portal
      class QuoteTrackersController < BaseController
        # GET /api/v1/portal/quote_trackers
        #
        # Returns QuoteTracker + CustomQuoteSupplier records across ALL tenants
        # where the supplier's email matches the portal user's email.
        #
        # A single supplier (email) can exist as a Contact in multiple tenants (builders).
        # We bypass tenant scoping to find all matching contacts, then fetch their quotes
        # grouped by status.
        def index
          email = current_portal_user.email
          quotes_by_status = { awaiting_response: [], responded: [], accepted: [], rejected: [] }
          builders = {}

          each_supplier_contact do |contact, tenant|
            builders[tenant.id] ||= { id: tenant.id, name: tenant.name }

            ActsAsTenant.with_tenant(tenant) do
              fetch_quote_trackers(contact, tenant, quotes_by_status)
              fetch_custom_quote_suppliers(contact, tenant, quotes_by_status)
            end
          end

          render json: {
            success: true,
            data: {
              builders: builders.values,
              **quotes_by_status
            }
          }
        end

        # POST /api/v1/portal/quote_trackers/:id/mark_document_viewed
        #
        # Marks the supplier's document as viewed (resets the "new" indicator).
        # Only applies to CustomQuoteSupplier records (cqs_ prefix).
        def mark_document_viewed
          source, record_id = parse_quote_id(params[:id])
          return render json: { success: false, error: "Invalid quote ID" }, status: :bad_request unless source == "cqs" && record_id

          record = find_owned_record(source, record_id)
          return render json: { success: false, error: "Quote not found" }, status: :not_found unless record

          record.update!(document_viewed_at: Time.current)
          render json: { success: true }
        end

        # PATCH /api/v1/portal/quote_trackers/:id
        #
        # Allows supplier to update valid_to (expiry date) on their quotes.
        # ID format: "qt_123" or "cqs_456" (prefixed to distinguish sources).
        def update
          source, record_id = parse_quote_id(params[:id])
          return render json: { success: false, error: "Invalid quote ID" }, status: :bad_request unless record_id

          record = find_owned_record(source, record_id)
          return render json: { success: false, error: "Quote not found" }, status: :not_found unless record

          valid_to = params[:valid_to]
          if valid_to.present?
            record.update!(valid_to: Date.parse(valid_to))
          elsif params.key?(:valid_to)
            record.update!(valid_to: nil)
          end

          render json: { success: true, data: { id: params[:id], validTo: record.valid_to&.to_s } }
        rescue Date::Error
          render json: { success: false, error: "Invalid date format" }, status: :unprocessable_entity
        end

        private

        # Iterate over all Contact records across tenants matching this portal user's email
        def each_supplier_contact
          email = current_portal_user.email
          contact_ids = ActsAsTenant.without_tenant {
            ContactEmail.where(email: email).pluck(:contact_id)
          }
          contacts = ActsAsTenant.without_tenant { Contact.where(id: contact_ids).includes(:tenant) }

          contacts.each do |contact|
            next unless contact.tenant&.active?
            yield contact, contact.tenant
          end
        end

        def fetch_quote_trackers(contact, tenant, quotes_by_status)
          trackers = QuoteTracker
            .where(supplier_id: contact.id)
            .where.not(status: "draft")
            .includes(:job, :sm_schedule_master, :sm_trade, :purchase_order)

          trackers.each do |qt|
            record = serialize_quote_tracker(qt, tenant)
            bucket = status_bucket(qt.status)
            quotes_by_status[bucket] << record if bucket
          end
        end

        def fetch_custom_quote_suppliers(contact, tenant, quotes_by_status)
          suppliers = CustomQuoteSupplier
            .where(supplier_id: contact.id)
            .where.not(status: "draft")
            .includes(:warehouse_document, custom_quote_line: { custom_quote: :job })

          suppliers.each do |cqs|
            record = serialize_custom_quote_supplier(cqs, tenant)
            bucket = status_bucket(cqs.status)
            quotes_by_status[bucket] << record if bucket
          end
        end

        def serialize_quote_tracker(qt, tenant)
          {
            id: "qt_#{qt.id}",
            source: "quote_tracker",
            builder: tenant.name,
            builderId: tenant.id,
            jobName: qt.job&.name,
            itemName: qt.task_name,
            priceQuoted: qt.price_quoted&.to_f,
            quoteNumber: qt.quote_number,
            sentAt: qt.sent_at&.iso8601,
            dateReceived: qt.date_received&.to_s,
            validTo: qt.valid_to&.to_s,
            status: qt.status,
            daysWaiting: qt.sent_at ? ((Time.current - qt.sent_at) / 1.day).round : nil,
            isBestPrice: qt.is_best_price,
            purchaseOrderId: qt.purchase_order_id,
            timeframe: qt.timeframe,
            responseNotes: qt.response_notes,
            instructions: qt.quote_request_instructions
          }
        end

        def serialize_custom_quote_supplier(cqs, tenant)
          line = cqs.custom_quote_line
          job = line&.custom_quote&.job
          doc = cqs.warehouse_document

          {
            id: "cqs_#{cqs.id}",
            source: "custom_quote",
            builder: tenant.name,
            builderId: tenant.id,
            jobName: job&.name,
            itemName: line&.name,
            priceQuoted: cqs.price_quoted&.to_f,
            quoteNumber: cqs.quote_number,
            sentAt: cqs.sent_at&.iso8601,
            dateReceived: cqs.date_received&.to_s,
            validTo: cqs.valid_to&.to_s,
            status: cqs.status,
            daysWaiting: cqs.sent_at ? ((Time.current - cqs.sent_at) / 1.day).round : nil,
            isBestPrice: cqs.is_best_price,
            purchaseOrderId: cqs.purchase_order_id,
            timeframe: cqs.timeframe,
            responseNotes: cqs.response_notes,
            instructions: line&.rfq_instructions,
            documentName: doc&.ui_name || doc&.original_filename,
            documentUrl: (doc&.download_url(expires_in: DocumentStorageConstants::PRESIGNED_URL_EXPIRY_DEFAULT) rescue nil),
            isDocumentNew: doc.present? && (cqs.document_viewed_at.nil? || doc.updated_at > cqs.document_viewed_at)
          }
        end

        def status_bucket(status)
          case status
          when "sent" then :awaiting_response
          when "responded" then :responded
          when "accepted" then :accepted
          when "rejected" then :rejected
          end
        end

        # Parse prefixed quote ID: "qt_123" → ["qt", 123], "cqs_456" → ["cqs", 456]
        def parse_quote_id(id_str)
          return [nil, nil] unless id_str.is_a?(String)
          match = id_str.match(/\A(qt|cqs)_(\d+)\z/)
          match ? [match[1], match[2].to_i] : [nil, nil]
        end

        # Find the record and verify the portal user owns it (is the supplier)
        def find_owned_record(source, record_id)
          record = nil

          each_supplier_contact do |contact, tenant|
            ActsAsTenant.with_tenant(tenant) do
              record = case source
              when "qt"
                QuoteTracker.find_by(id: record_id, supplier_id: contact.id)
              when "cqs"
                CustomQuoteSupplier.find_by(id: record_id, supplier_id: contact.id)
              end
            end
            break if record
          end

          record
        end
      end
    end
  end
end
