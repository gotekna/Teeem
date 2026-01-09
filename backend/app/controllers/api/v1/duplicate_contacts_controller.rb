# API controller for managing duplicate contacts from Xero multi-tenant sync
class Api::V1::DuplicateContactsController < ApplicationController
  # GET /api/v1/duplicate_contacts/groups
  # List all duplicate contact groups
  def groups
    service = XeroDuplicateFixService.new
    groups = service.find_duplicate_groups

    render json: {
      success: true,
      groups: groups,
      summary: {
        total_groups: groups.count,
        total_duplicate_contacts: groups.sum { |g| g[:contacts].count },
        total_contacts_after_merge: groups.count
      }
    }
  rescue => e
    Rails.logger.error("DuplicateContactsController#groups failed: #{e.message}")
    render json: {
      success: false,
      error: e.message
    }, status: :internal_server_error
  end

  # GET /api/v1/duplicate_contacts/groups/:id
  # Get details for one duplicate group
  def show
    service = XeroDuplicateFixService.new
    all_groups = service.find_duplicate_groups

    group = all_groups.find { |g| g[:id] == params[:id] }

    if group
      render json: {
        success: true,
        group: group
      }
    else
      render json: {
        success: false,
        error: "Group not found"
      }, status: :not_found
    end
  rescue => e
    Rails.logger.error("DuplicateContactsController#show failed: #{e.message}")
    render json: {
      success: false,
      error: e.message
    }, status: :internal_server_error
  end

  # POST /api/v1/duplicate_contacts/groups/:id/merge
  # Execute merge for a duplicate group
  # Params:
  #   - target_contact_id: The contact ID to merge into (SSoT)
  def merge
    unless params[:target_contact_id].present?
      return render json: {
        success: false,
        error: "target_contact_id is required"
      }, status: :bad_request
    end

    service = XeroDuplicateFixService.new
    result = service.merge_group(params[:id], params[:target_contact_id].to_i)

    if result[:success]
      if result[:merged_count] == 0
        # Nothing was merged - duplicates may have already been merged
        render json: {
          success: true,
          message: "No duplicates found to merge. This group may have already been merged.",
          merged_count: 0,
          deleted_contact_ids: [],
          target_contact_id: result[:target_id],
          already_merged: true
        }
      else
        render json: {
          success: true,
          message: "Successfully merged #{result[:merged_count]} contact(s) into Contact ##{result[:target_id]}",
          merged_count: result[:merged_count],
          deleted_contact_ids: result[:deleted_ids],
          target_contact_id: result[:target_id],
          already_merged: false
        }
      end
    else
      render json: {
        success: false,
        error: result[:error]
      }, status: :internal_server_error
    end
  rescue => e
    Rails.logger.error("DuplicateContactsController#merge failed: #{e.message}")
    render json: {
      success: false,
      error: e.message
    }, status: :internal_server_error
  end

  # POST /api/v1/duplicate_contacts/groups/:id/dismiss
  # Mark a group as "not duplicate" (skip for now - can implement later)
  def dismiss
    # TODO: Store dismissed groups in a table to prevent showing again
    render json: {
      success: true,
      message: "Group dismissed (feature not fully implemented yet)"
    }
  end
end
