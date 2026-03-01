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

        # GET /api/v1/portal/quote_trackers/:id/job_documents
        #
        # Returns ALL WarehouseDocuments for the job associated with this CQS record.
        # Allows supplier to browse all job plans, not just the RFQ-filtered subset.
        def job_documents
          source, record_id = parse_quote_id(params[:id])
          return render json: { success: false, error: "Invalid quote ID" }, status: :bad_request unless source == "cqs" && record_id

          record = find_owned_record(source, record_id)
          return render json: { success: false, error: "Quote not found" }, status: :not_found unless record

          job = record.custom_quote_line&.custom_quote&.job
          return render json: { success: false, error: "Job not found" }, status: :not_found unless job

          tenant = record.custom_quote_line.custom_quote.job.tenant
          docs = ActsAsTenant.with_tenant(tenant) do
            WarehouseDocument
              .where(
                "((documentable_type = 'Job' AND documentable_id = :id) OR (linkable_type = 'Job' AND linkable_id = :id))",
                id: job.id
              )
              .where("is_latest_version = true OR version_group_id IS NULL")
              .includes(:storage_blob)
              .where.not(storage_blobs: { id: nil })
              .order(:ui_name)
              .map { |doc| portal_rfq_doc_json(doc) }
          end

          render json: { success: true, data: docs }
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

          # Pre-load job documents and WFDT mappings to avoid N+1 queries
          job_ids = suppliers.filter_map { |cqs| cqs.custom_quote_line&.custom_quote&.job_id }.uniq
          job_docs_cache = preload_job_documents(job_ids)
          wfdt_map = preload_wfdt_mappings(suppliers)

          # Pre-load version histories for all job documents (batch to avoid N+1)
          all_group_ids = job_docs_cache.values.flatten.filter_map(&:version_group_id).uniq
          version_histories = preload_version_histories(all_group_ids)

          suppliers.each do |cqs|
            record = serialize_custom_quote_supplier(cqs, tenant, job_docs_cache, wfdt_map, version_histories)
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

        def serialize_custom_quote_supplier(cqs, tenant, job_docs_cache = {}, wfdt_map = {}, version_histories = {})
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
            isDocumentNew: doc.present? && (cqs.document_viewed_at.nil? || doc.updated_at > cqs.document_viewed_at),
            rfqDocuments: resolve_rfq_documents(line, job, job_docs_cache, wfdt_map, cqs.sent_at, version_histories)
          }
        end

        # Pre-load all WarehouseDocuments for the given jobs (avoids N+1)
        def preload_job_documents(job_ids)
          return {} if job_ids.blank?

          docs = WarehouseDocument
            .where(
              "((documentable_type = 'Job' AND documentable_id IN (:ids)) OR (linkable_type = 'Job' AND linkable_id IN (:ids)))",
              ids: job_ids
            )
            .where("is_latest_version = true OR version_group_id IS NULL")
            .includes(:storage_blob, :warehouse_folder_document_type)
            .where.not(storage_blobs: { id: nil })

          # Group by job_id (check both documentable and linkable)
          cache = Hash.new { |h, k| h[k] = [] }
          docs.each do |doc|
            job_id = (doc.documentable_type == "Job") ? doc.documentable_id : doc.linkable_id
            cache[job_id] << doc
          end
          cache
        end

        # Pre-load WFDT → document_type_id mappings for all relevant document_type_ids
        def preload_wfdt_mappings(suppliers)
          all_type_ids = suppliers.filter_map { |cqs| cqs.custom_quote_line&.document_type_ids }.flatten.compact.uniq
          return {} if all_type_ids.blank?

          WarehouseFolderDocumentType
            .where(document_type_id: all_type_ids)
            .pluck(:id, :document_type_id)
            .to_h  # { wfdt_id => document_type_id }
        end

        # Resolve RFQ documents for a custom quote line (reuses rfq_documents matching logic)
        def resolve_rfq_documents(line, job, job_docs_cache, wfdt_map, sent_at = nil, version_histories = {})
          return [] unless line && job

          type_ids = line.document_type_ids
          return [] if type_ids.blank?

          all_docs = job_docs_cache[job.id] || []
          return [] if all_docs.empty?

          doc_types = DocumentType.where(id: type_ids).index_by(&:id)
          matched = []

          all_docs.each do |doc|
            # Strategy 1: Match via WFDT link
            if doc.warehouse_folder_document_type_id && wfdt_map[doc.warehouse_folder_document_type_id]
              dt_id = wfdt_map[doc.warehouse_folder_document_type_id]
              if type_ids.include?(dt_id)
                matched << portal_rfq_doc_json(doc, sent_at, version_histories)
                next
              end
            end

            # Strategy 2: Filename match against document type names
            fname = (doc.original_filename || doc.ui_name || "").downcase
            next if fname.blank?

            type_ids.each do |tid|
              dt_name = doc_types[tid]&.name
              next unless dt_name
              if fname.include?(dt_name.downcase)
                matched << portal_rfq_doc_json(doc, sent_at, version_histories)
                break
              end
            end
          end

          matched
        end

        def portal_rfq_doc_json(doc, sent_at = nil, version_histories = {})
          current_letter = doc.version_letter || "A"
          sent_letter = current_letter

          if sent_at.present? && doc.version_group_id.present?
            versions = version_histories[doc.version_group_id] || []
            if versions.any?
              # Find what version was current when the RFQ was sent
              # (latest version created before or at sent_at)
              version_at_send = versions.select { |v| v.created_at <= sent_at }.last
              sent_letter = version_at_send&.version_letter || versions.first&.version_letter || "A"
              # Current is always the latest version
              latest = versions.last
              current_letter = latest&.version_letter || current_letter
            end
          end

          {
            name: doc.original_filename || doc.ui_name,
            downloadUrl: (doc.download_url(expires_in: DocumentStorageConstants::PRESIGNED_URL_EXPIRY_DEFAULT, disposition: :attachment) rescue nil),
            viewUrl: (doc.download_url(expires_in: DocumentStorageConstants::PRESIGNED_URL_EXPIRY_DEFAULT, disposition: :inline) rescue nil),
            versionLetter: current_letter,
            currentVersionLetter: current_letter,
            sentVersionLetter: sent_letter,
            hasNewerVersion: sent_letter != current_letter
          }
        end

        # Batch-load version histories for all given version_group_ids
        # Returns: { version_group_id => [doc1(v1), doc2(v2), ...] } ordered by version_number
        def preload_version_histories(group_ids)
          return {} if group_ids.blank?

          WarehouseDocument
            .where(version_group_id: group_ids)
            .order(:version_group_id, :version_number)
            .select(:id, :version_group_id, :version_number, :version_letter, :created_at)
            .group_by(&:version_group_id)
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
