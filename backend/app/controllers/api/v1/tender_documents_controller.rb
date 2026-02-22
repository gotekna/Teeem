# frozen_string_literal: true

module Api
  module V1
    class TenderDocumentsController < ApplicationController
      include AsyncPdfGeneration

      before_action :set_job, only: [:index, :create, :latest_builder_state, :save_builder_state]
      before_action :set_tender_document, only: [
        :show, :update, :destroy,
        :generate_pdf, :send_to_client,
        :request_revision, :accept, :decline,
        :diff
      ]

      # GET /api/v1/jobs/:job_id/tender_documents
      def index
        docs = @job.tender_documents
                   .includes(:created_by, :locked_by, :pdf_generation)
                   .order(version: :desc)

        render json: {
          success: true,
          data: {
            tender_documents: docs.map { |d| summary_json(d) },
            total_count: docs.count
          }
        }
      end

      # POST /api/v1/jobs/:job_id/tender_documents
      def create
        item_classifications = params[:item_classifications]&.to_unsafe_h || {}
        po_classifications = params[:po_classifications]&.to_unsafe_h || {}
        item_overrides = params[:item_overrides]&.to_unsafe_h || {}
        additional_items = params[:additional_items]&.map { |ai| ai.to_unsafe_h } || []
        section_notes = params[:section_notes]&.to_unsafe_h || {}
        section_document_types = params[:section_document_types]&.to_unsafe_h || {}
        builder_state = params[:builder_state]&.to_unsafe_h || {}

        service = TenderDocumentService.new(
          job: @job,
          user: current_user,
          item_classifications: item_classifications,
          po_classifications: po_classifications,
          item_overrides: item_overrides,
          additional_items: additional_items,
          section_notes: section_notes,
          section_document_types: section_document_types,
          builder_state: builder_state
        )
        doc = service.create!

        render json: { success: true, data: doc.as_json }, status: :created
      rescue TenderDocumentService::CreationError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/jobs/:job_id/tender_documents/latest_builder_state
      def latest_builder_state
        latest = @job.tender_documents
                     .where.not(status: "superseded")
                     .order(version: :desc)
                     .first

        if latest&.settings&.dig("builder_state").present?
          render json: {
            success: true,
            data: {
              builder_state: latest.settings["builder_state"],
              version: latest.version,
              created_at: latest.created_at.iso8601
            }
          }
        else
          render json: { success: true, data: nil }
        end
      end

      # POST /api/v1/jobs/:job_id/tender_documents/save_builder_state
      # PO is SSoT — saves edits, new lines, and deletions back to actual PO line items
      def save_builder_state
        builder_state = params[:builder_state]&.to_unsafe_h || {}
        created_count = 0
        updated_count = 0
        deleted_count = 0

        ActiveRecord::Base.transaction do
          po_ids = @job.purchase_orders.pluck(:id)

          # 1. Apply edit overrides back to PO line items (description, quantity, unit_price)
          overrides = builder_state.dig("editOverrides") || {}
          overrides.each do |key, override|
            override = override.to_unsafe_h if override.respond_to?(:to_unsafe_h)
            line_item_id = key.to_s.split(":")[1]
            next unless line_item_id.present?

            line_item = PurchaseOrderLineItem.find_by(id: line_item_id, purchase_order_id: po_ids)
            next unless line_item

            attrs = {}
            attrs[:description] = override["description"] if override["description"].present?
            attrs[:quantity] = override["quantity"].to_d if override["quantity"].present?
            attrs[:unit_price] = override["unitPrice"].to_d if override["unitPrice"].present?
            if attrs.any?
              line_item.update!(attrs)
              updated_count += 1
            end
          end
          builder_state["editOverrides"] = {}

          # 2. Delete PO line items marked as excluded (X button)
          item_classifications = builder_state.dig("itemClassifications") || {}
          excluded_ids = builder_state.dig("excludedIds") || []

          # Collect all excluded line item IDs from both sources
          excluded_line_item_ids = Set.new
          item_classifications.each do |key, cls|
            next unless cls.to_s == "excluded"
            line_item_id = key.to_s.split(":")[1]
            excluded_line_item_ids << line_item_id.to_i if line_item_id.present?
          end
          excluded_ids.each do |key|
            line_item_id = key.to_s.split(":")[1]
            excluded_line_item_ids << line_item_id.to_i if line_item_id.present?
          end

          if excluded_line_item_ids.any?
            deleted_count = PurchaseOrderLineItem
              .where(id: excluded_line_item_ids.to_a, purchase_order_id: po_ids)
              .destroy_all
              .count
          end

          # Clear excluded classifications from builder state (items are gone from PO)
          item_classifications.reject! { |_k, v| v.to_s == "excluded" }
          builder_state["itemClassifications"] = item_classifications
          builder_state["excludedIds"] = []

          # 3. Persist new lines as real PurchaseOrderLineItem records on their POs
          new_lines = builder_state.dig("newLines") || []
          surviving_new_lines = []

          new_lines.each do |nl|
            nl = nl.to_unsafe_h if nl.respond_to?(:to_unsafe_h)
            po_id = nl["poId"]
            description = nl["description"].to_s.strip
            next if description.blank?

            po = po_id.present? ? @job.purchase_orders.find_by(id: po_id) : nil
            unless po
              surviving_new_lines << nl
              next
            end

            pricebook_item = nil
            if nl["pricebookItemId"].present?
              pricebook_item = PricebookItem.find_by(id: nl["pricebookItemId"])
            end

            po.line_items.create!(
              tenant: current_tenant,
              description: description,
              quantity: (nl["quantity"] || 1).to_d,
              unit_price: (nl["unitPrice"] || 0).to_d,
              gst_code: "GST",
              pricebook_item: pricebook_item
            )
            created_count += 1
          end

          builder_state["newLines"] = surviving_new_lines

          # 4. Save remaining builder state (classifications, notes, settings)
          latest = @job.tender_documents
                       .where.not(status: "superseded")
                       .order(version: :desc)
                       .first

          if latest
            latest.settings ||= {}
            latest.settings["builder_state"] = builder_state
            latest.save!
          else
            @job.tender_documents.create!(
              tenant: current_tenant,
              created_by: current_user,
              document_number: "TD-#{@job.job_code || @job.id}-DRAFT",
              version: 0,
              status: "draft",
              date_prepared: Date.current,
              settings: { "builder_state" => builder_state }
            )
          end
        end

        render json: {
          success: true,
          data: { created_count: created_count, updated_count: updated_count, deleted_count: deleted_count }
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/tender_documents/:id
      def show
        render json: { success: true, data: @tender_document.as_json }
      end

      # PATCH /api/v1/tender_documents/:id
      def update
        unless @tender_document.editable?
          return render json: { success: false, error: "Only draft tender documents can be edited" }, status: :unprocessable_entity
        end

        if @tender_document.update(update_params)
          render json: { success: true, data: @tender_document.as_json }
        else
          render json: { success: false, error: @tender_document.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/tender_documents/:id
      def destroy
        unless @tender_document.status == "draft"
          return render json: { success: false, error: "Only draft tender documents can be deleted" }, status: :unprocessable_entity
        end

        @tender_document.destroy!
        render json: { success: true }
      end

      # POST /api/v1/tender_documents/:id/generate_pdf
      def generate_pdf
        pdf_gen = PdfGeneration.create!(
          user: current_user,
          tenant: current_tenant,
          generator_type: "tender_document",
          generator_params: { tender_document_id: @tender_document.id },
          status: "pending"
        )

        @tender_document.update!(pdf_generation: pdf_gen)
        GeneratePdfJob.perform_later(pdf_gen.id)

        render json: {
          success: true,
          data: {
            pdf_generation_id: pdf_gen.id,
            status: "pending"
          }
        }
      end

      # POST /api/v1/tender_documents/:id/send_to_client
      def send_to_client
        unless @tender_document.status.in?(%w[locked sent])
          return render json: { success: false, error: "Tender must be locked before sending" }, status: :unprocessable_entity
        end

        @tender_document.mark_sent!(current_user)
        render json: { success: true, data: @tender_document.as_json }
      end

      # POST /api/v1/tender_documents/:id/request_revision
      def request_revision
        unless @tender_document.status.in?(%w[locked sent])
          return render json: { success: false, error: "Can only request revision on locked/sent tenders" }, status: :unprocessable_entity
        end

        reason = params[:reason] || "Client requested changes"
        @tender_document.request_revision!(current_user, reason: reason)

        render json: { success: true, data: @tender_document.reload.as_json }
      end

      # POST /api/v1/tender_documents/:id/accept
      def accept
        unless @tender_document.status == "sent"
          return render json: { success: false, error: "Can only accept sent tenders" }, status: :unprocessable_entity
        end

        @tender_document.mark_accepted!
        render json: { success: true, data: @tender_document.as_json }
      end

      # POST /api/v1/tender_documents/:id/decline
      def decline
        unless @tender_document.status == "sent"
          return render json: { success: false, error: "Can only decline sent tenders" }, status: :unprocessable_entity
        end

        @tender_document.mark_declined!
        render json: { success: true, data: @tender_document.as_json }
      end

      # GET /api/v1/tender_documents/:id/diff/:other_id
      def diff
        other = TenderDocument.find(params[:other_id])

        # Group items by section for both documents
        current_sections = @tender_document.sections_grouped
        other_sections = other.sections_grouped

        all_section_names = (current_sections.keys + other_sections.keys).uniq.sort

        diff_data = all_section_names.map do |section_name|
          current_items = current_sections[section_name] || []
          other_items = other_sections[section_name] || []

          {
            section_name: section_name,
            current_items: current_items.map(&:as_json),
            other_items: other_items.map(&:as_json),
            current_subtotal: current_items.select { |i| i.item_type.in?(%w[priced provisional included included_qty]) }.sum(&:total_amount),
            other_subtotal: other_items.select { |i| i.item_type.in?(%w[priced provisional included included_qty]) }.sum(&:total_amount)
          }
        end

        render json: {
          success: true,
          data: {
            current_version: summary_json(@tender_document),
            other_version: summary_json(other),
            sections: diff_data,
            total_diff: @tender_document.total - other.total
          }
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_tender_document
        @tender_document = TenderDocument.find(params[:id])
      end

      def update_params
        params.permit(
          :cover_letter_html,
          :terms_and_conditions_html,
          :base_specification_html,
          :acceptance_page_html,
          :notes_html,
          :valid_until,
          :validity_days,
          settings: {}
        )
      end

      def summary_json(doc)
        {
          id: doc.id,
          document_number: doc.document_number,
          version: doc.version,
          status: doc.status,
          date_prepared: doc.date_prepared,
          valid_until: doc.valid_until,
          subtotal: doc.subtotal,
          gst: doc.gst,
          total: doc.total,
          job_name: doc.job_name,
          job_code: doc.job_code,
          client_name: doc.client_name,
          created_by_name: doc.created_by&.name,
          locked_at: doc.locked_at&.iso8601,
          sent_at: doc.sent_at&.iso8601,
          accepted_at: doc.accepted_at&.iso8601,
          declined_at: doc.declined_at&.iso8601,
          revision_notes: doc.revision_notes,
          has_pdf: doc.storage_blob.present?,
          pdf_status: doc.pdf_generation&.status,
          item_count: doc.tender_document_items.count,
          created_at: doc.created_at.iso8601,
          updated_at: doc.updated_at.iso8601
        }
      end
    end
  end
end
