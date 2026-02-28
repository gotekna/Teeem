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

          # Find all Contact records matching this email across ALL tenants
          contacts = ActsAsTenant.without_tenant { Contact.where(email: email).includes(:tenant) }

          contacts.each do |contact|
            next unless contact.tenant&.active?

            tenant = contact.tenant
            builders[tenant.id] ||= { id: tenant.id, name: tenant.name }

            # Fetch QuoteTrackers where this contact is the supplier
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

        private

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
            .includes(custom_quote_line: { custom_quote: :job })

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
            responseNotes: qt.response_notes
          }
        end

        def serialize_custom_quote_supplier(cqs, tenant)
          line = cqs.custom_quote_line
          job = line&.custom_quote&.job

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
            responseNotes: cqs.response_notes
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
      end
    end
  end
end
