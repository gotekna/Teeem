module Api
  module V1
    class FeatureRequestsController < ApplicationController
      before_action :set_feature_request, only: [ :update, :follow, :unfollow ]

      # GET /api/v1/feature_requests
      # Shared across all tenants - no tenant scoping
      def index
        requests = FeatureRequest.ordered

        # Filter by status if provided
        requests = requests.by_status(params[:status]) if params[:status].present?

        # Hide declined by default unless explicitly requested
        requests = requests.active unless params[:include_declined] == "true"

        render_success({
          feature_requests: requests.map { |fr| serialize(fr) },
          counts: {
            submitted: FeatureRequest.active.where(status: "submitted").count,
            planned: FeatureRequest.where(status: "planned").count,
            in_progress: FeatureRequest.where(status: "in_progress").count,
            completed: FeatureRequest.where(status: "completed").count
          }
        })
      end

      # POST /api/v1/feature_requests
      def create
        fr = FeatureRequest.new(create_params)
        fr.submitted_by_user_id = current_user.id
        fr.submitted_by_tenant_id = current_tenant&.id
        fr.submitted_by_name = current_user.name
        fr.submitted_by_company = current_tenant&.name

        if fr.save
          # Auto-follow on submit
          fr.add_follower(current_user.id)
          render_success(serialize(fr))
        else
          render_validation_errors(fr)
        end
      end

      # PATCH /api/v1/feature_requests/:id
      # Admin only - update status, priority, notes
      def update
        unless current_user&.admin?
          return render_error("Admin access required", status: :forbidden)
        end

        if @feature_request.update(update_params)
          render_success(serialize(@feature_request))
        else
          render_validation_errors(@feature_request)
        end
      end

      # POST /api/v1/feature_requests/:id/follow
      def follow
        @feature_request.add_follower(current_user.id)
        render_success(serialize(@feature_request))
      end

      # DELETE /api/v1/feature_requests/:id/follow
      def unfollow
        @feature_request.remove_follower(current_user.id)
        render_success(serialize(@feature_request))
      end

      private

      def set_feature_request
        @feature_request = FeatureRequest.find(params[:id])
      end

      def create_params
        params.require(:feature_request).permit(:title, :description, :category)
      end

      def update_params
        params.require(:feature_request).permit(
          :title, :description, :category, :status,
          :priority_order, :admin_notes, :status_update
        )
      end

      def serialize(fr)
        data = {
          id: fr.id,
          title: fr.title,
          description: fr.description,
          category: fr.category,
          status: fr.status,
          priorityOrder: fr.priority_order,
          submittedByName: fr.submitted_by_name,
          submittedByCompany: fr.submitted_by_company,
          submittedByUserId: fr.submitted_by_user_id,
          adminNotes: fr.admin_notes,
          statusUpdate: fr.status_update,
          followerCount: fr.follower_count,
          isFollowing: fr.followed_by?(current_user.id),
          createdAt: fr.created_at,
          updatedAt: fr.updated_at
        }

        # Only include admin_notes for admins
        data.delete(:adminNotes) unless current_user&.admin?

        data
      end
    end
  end
end
