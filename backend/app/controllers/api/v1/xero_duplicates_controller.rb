# frozen_string_literal: true

module Api
  module V1
    # Controller for managing Xero duplicate contacts
    # Provides endpoints for detecting, reviewing, and merging duplicates
    class XeroDuplicatesController < ApplicationController
      before_action :set_duplicate_group, only: [:approve, :reject, :select_target]

      # GET /api/v1/xero_duplicates/pending
      # Returns next batch of pending duplicate groups
      # Params: limit (default: 5)
      def pending
        limit = params[:limit]&.to_i || 5
        offset = params[:offset]&.to_i || 0

        groups = XeroDuplicateGroup
                   .pending
                   .prioritized
                   .includes(xero_duplicate_items: { contact: :contact_external_links })
                   .limit(limit)
                   .offset(offset)

        total_pending = XeroDuplicateGroup.pending.count

        render json: {
          success: true,
          groups: groups.map { |g| serialize_duplicate_group(g) },
          total_pending: total_pending,
          showing: groups.count,
          offset: offset,
          has_more: (offset + groups.count) < total_pending
        }
      end

      # GET /api/v1/xero_duplicates/for_contact/:contact_id
      # Returns duplicate groups for a specific contact
      def for_contact
        contact_id = params[:contact_id]

        groups = XeroDuplicateGroup
                   .pending
                   .joins(:xero_duplicate_items)
                   .where(xero_duplicate_items: { contact_id: contact_id })
                   .includes(xero_duplicate_items: { contact: :contact_external_links })
                   .distinct

        render json: {
          success: true,
          groups: groups.map { |g| serialize_duplicate_group(g) },
          count: groups.count
        }
      end

      # POST /api/v1/xero_duplicates/:id/approve
      # Approves a duplicate group and triggers merge
      # Params: merge_target_id (required)
      def approve
        unless @duplicate_group.pending?
          return render json: {
            success: false,
            error: "This duplicate group has already been processed (status: #{@duplicate_group.status})"
          }, status: :unprocessable_entity
        end

        merge_target_id = params[:merge_target_id]&.to_i

        unless merge_target_id
          return render json: {
            success: false,
            error: "merge_target_id is required"
          }, status: :unprocessable_entity
        end

        # Verify target is in the group
        unless @duplicate_group.contact_ids.include?(merge_target_id)
          return render json: {
            success: false,
            error: "merge_target_id must be one of the contacts in this duplicate group"
          }, status: :unprocessable_entity
        end

        # Mark target in items
        target_item = @duplicate_group.xero_duplicate_items.find_by(contact_id: merge_target_id)
        target_item.mark_as_merge_target!

        # Mark group as approved
        @duplicate_group.mark_approved!(current_user&.email || params[:reviewer_email])

        # Get duplicate IDs (all except target)
        duplicate_ids = @duplicate_group.contact_ids - [merge_target_id]

        # Perform merge
        merger = XeroContactMerger.new
        result = merger.merge_contacts(merge_target_id, duplicate_ids, reviewer_email: current_user&.email)

        if result[:success]
          # Mark group as merged
          @duplicate_group.mark_merged!(merge_target_id, current_user&.email)

          render json: {
            success: true,
            message: "Contacts merged successfully",
            result: result
          }
        else
          render json: {
            success: false,
            error: "Merge failed: #{result[:errors].join(', ')}",
            result: result
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/xero_duplicates/:id/reject
      # Rejects a duplicate group (marks as not duplicates)
      def reject
        unless @duplicate_group.pending?
          return render json: {
            success: false,
            error: "This duplicate group has already been processed"
          }, status: :unprocessable_entity
        end

        @duplicate_group.mark_rejected!(current_user&.email || params[:reviewer_email])

        render json: {
          success: true,
          message: "Duplicate group rejected"
        }
      end

      # POST /api/v1/xero_duplicates/:id/select_target
      # Updates the merge target for a duplicate group
      # Params: merge_target_id (required)
      def select_target
        merge_target_id = params[:merge_target_id]&.to_i

        unless merge_target_id
          return render json: {
            success: false,
            error: "merge_target_id is required"
          }, status: :unprocessable_entity
        end

        # Verify target is in the group
        unless @duplicate_group.contact_ids.include?(merge_target_id)
          return render json: {
            success: false,
            error: "merge_target_id must be one of the contacts in this duplicate group"
          }, status: :unprocessable_entity
        end

        # Update target in items
        target_item = @duplicate_group.xero_duplicate_items.find_by(contact_id: merge_target_id)
        target_item.mark_as_merge_target!

        render json: {
          success: true,
          message: "Merge target updated",
          merge_target_id: merge_target_id
        }
      end

      # POST /api/v1/xero_duplicates/scan
      # Triggers a new duplicate detection scan
      def scan
        detector = XeroDuplicateDetector.new
        summary = detector.detect_duplicates

        render json: {
          success: true,
          message: "Duplicate detection complete",
          summary: summary
        }
      rescue StandardError => e
        render json: {
          success: false,
          error: "Detection failed: #{e.message}"
        }, status: :internal_server_error
      end

      private

      def set_duplicate_group
        @duplicate_group = XeroDuplicateGroup.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Duplicate group not found"
        }, status: :not_found
      end

      def serialize_duplicate_group(group)
        {
          id: group.id,
          group_key: group.group_key,
          match_type: group.match_type,
          confidence_score: group.confidence_score,
          status: group.status,
          merge_target_id: group.merge_target_id,
          reviewed_at: group.reviewed_at,
          reviewed_by: group.reviewed_by,
          contacts: group.xero_duplicate_items.map { |item| serialize_duplicate_item(item) },
          created_at: group.created_at,
          updated_at: group.updated_at
        }
      end

      def serialize_duplicate_item(item)
        contact = item.contact
        xero_links = contact.contact_external_links.where(source: "xero")

        {
          id: item.id,
          contact_id: contact.id,
          is_merge_target: item.is_merge_target,
          contact: {
            id: contact.id,
            display_name: contact.display_name,
            company_name: contact.company_name,
            first_name: contact.first_name,
            last_name: contact.last_name,
            tax_number: contact.tax_number,
            email: contact.email,
            mobile_phone: contact.mobile_phone,
            xero_contact_status: contact.xero_contact_status,
            last_synced_at: contact.last_synced_at,
            xero_links_count: xero_links.count,
            xero_orgs: xero_links.map { |link|
              {
                tenant_id: link.tenant_id,
                external_contact_id: link.external_contact_id,
                last_synced_at: link.last_synced_at
              }
            },
            invoices_count: contact.external_invoices.count,
            created_at: contact.created_at,
            updated_at: contact.updated_at
          },
          data_snapshot: item.data_snapshot
        }
      end
    end
  end
end
