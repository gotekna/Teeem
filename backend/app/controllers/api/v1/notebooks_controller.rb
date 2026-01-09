# frozen_string_literal: true

module Api
  module V1
    class NotebooksController < ApplicationController
      before_action :set_notebook, only: [:show, :update, :destroy, :share, :unshare]

      # GET /api/v1/notebooks
      # List notebooks accessible by current user
      def index
        notebooks = Notebook.accessible_by(current_user)
                            .active
                            .includes(:owner, :sections)

        # Filter by entity if provided
        if params[:notable_type].present? && params[:notable_id].present?
          notebooks = notebooks.where(
            notable_type: params[:notable_type],
            notable_id: params[:notable_id]
          )
        elsif params[:global] == "true"
          notebooks = notebooks.global
        end

        notebooks = notebooks.recent.limit(50)

        render json: {
          success: true,
          notebooks: notebooks.map { |n| notebook_json(n) },
          total: notebooks.count
        }
      end

      # GET /api/v1/notebooks/:id
      def show
        unless @notebook.accessible_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        render json: {
          success: true,
          notebook: notebook_json(@notebook, include_sections: true)
        }
      end

      # POST /api/v1/notebooks
      def create
        notebook = Notebook.new(notebook_params)
        notebook.owner = current_user

        if notebook.save
          NotebookActivity.track("notebook_created", notebook: notebook, user: current_user)

          render json: {
            success: true,
            notebook: notebook_json(notebook, include_sections: true)
          }, status: :created
        else
          render json: {
            success: false,
            errors: notebook.errors.full_messages
          }, status: :unprocessable_entity
        end
      rescue => e
        Rails.logger.error("[NotebooksController#create] Exception: #{e.class} - #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n"))
        render json: {
          success: false,
          error: "Failed to create notebook: #{e.message}"
        }, status: :internal_server_error
      end

      # PATCH /api/v1/notebooks/:id
      def update
        unless @notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        if @notebook.update(notebook_params)
          NotebookActivity.track("notebook_updated", notebook: @notebook, user: current_user)

          render json: {
            success: true,
            notebook: notebook_json(@notebook, include_sections: true)
          }
        else
          render json: {
            success: false,
            errors: @notebook.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/notebooks/:id
      def destroy
        unless @notebook.admin?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        @notebook.archive!
        NotebookActivity.track("notebook_archived", notebook: @notebook, user: current_user)

        render json: { success: true }
      end

      # POST /api/v1/notebooks/:id/share
      def share
        unless @notebook.admin?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        user = User.find(params[:user_id])
        permission = params[:permission] || "view"
        expires_at = params[:expires_at]

        share = @notebook.shares.find_or_initialize_by(user: user)
        share.assign_attributes(
          permission: permission,
          granted_by: current_user,
          expires_at: expires_at
        )

        if share.save
          NotebookActivity.track(
            share.previously_new_record? ? "share_added" : "share_updated",
            notebook: @notebook,
            user: current_user,
            metadata: { user_name: user.name, permission: permission }
          )

          render json: {
            success: true,
            share: share_json(share)
          }
        else
          render json: {
            success: false,
            errors: share.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/notebooks/:id/unshare
      def unshare
        unless @notebook.admin?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        share = @notebook.shares.find_by!(user_id: params[:user_id])
        user_name = share.user.name
        share.destroy!

        NotebookActivity.track(
          "share_removed",
          notebook: @notebook,
          user: current_user,
          metadata: { user_name: user_name }
        )

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Share not found" }, status: :not_found
      end

      private

      def set_notebook
        @notebook = Notebook.find(params[:id])
      end

      def notebook_params
        params.permit(:name, :description, :icon_name, :color, :notable_type, :notable_id, :is_default)
      end

      def notebook_json(notebook, include_sections: false)
        json = {
          id: notebook.id,
          name: notebook.name,
          description: notebook.description,
          icon_name: notebook.icon_name,
          color: notebook.color,
          owner: {
            id: notebook.owner_id,
            name: notebook.owner&.name
          },
          notable_type: notebook.notable_type,
          notable_id: notebook.notable_id,
          is_default: notebook.is_default,
          section_count: notebook.section_count,
          page_count: notebook.page_count,
          permission: notebook.permission_for(current_user),
          last_activity_at: notebook.last_activity_at,
          created_at: notebook.created_at,
          updated_at: notebook.updated_at
        }

        if include_sections
          json[:sections] = notebook.sections.active.ordered.includes(pages: :last_edited_by).map { |s| section_json(s) }
          json[:shares] = notebook.shares.active.includes(:user).map { |s| share_json(s) }
        end

        json
      end

      def section_json(section)
        {
          id: section.id,
          notebook_id: section.notebook_id,
          name: section.name,
          position: section.position,
          color: section.color,
          page_count: section.page_count,
          created_at: section.created_at,
          updated_at: section.updated_at,
          pages: section.pages.active.ordered.map { |p| page_summary_json(p) }
        }
      end

      def page_summary_json(page)
        {
          id: page.id,
          title: page.title,
          position: page.position,
          is_pinned: page.is_pinned,
          preview: page.preview,
          word_count: page.word_count,
          last_edited_by: page.last_edited_by&.name,
          updated_at: page.updated_at
        }
      end

      def share_json(share)
        {
          id: share.id,
          user: {
            id: share.user_id,
            name: share.user&.name,
            email: share.user&.email
          },
          permission: share.permission,
          granted_by: share.granted_by&.name,
          expires_at: share.expires_at,
          created_at: share.created_at
        }
      end
    end
  end
end
