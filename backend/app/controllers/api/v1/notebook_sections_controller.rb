# frozen_string_literal: true

module Api
  module V1
    class NotebookSectionsController < ApplicationController
      before_action :set_notebook
      before_action :set_section, only: [:show, :update, :destroy, :reorder]

      # GET /api/v1/notebooks/:notebook_id/sections
      def index
        unless @notebook.accessible_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        sections = @notebook.sections.active.ordered.includes(:pages)

        render json: {
          success: true,
          sections: sections.map { |s| section_json(s, include_pages: true) }
        }
      end

      # GET /api/v1/notebooks/:notebook_id/sections/:id
      def show
        unless @notebook.accessible_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        render json: {
          success: true,
          section: section_json(@section, include_pages: true)
        }
      end

      # POST /api/v1/notebooks/:notebook_id/sections
      def create
        unless @notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        section = @notebook.sections.new(section_params)

        if section.save
          NotebookActivity.track(
            "section_created",
            notebook: @notebook,
            user: current_user,
            section: section,
            metadata: { section_name: section.name }
          )

          render json: {
            success: true,
            section: section_json(section)
          }, status: :created
        else
          render json: {
            success: false,
            errors: section.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/notebooks/:notebook_id/sections/:id
      def update
        unless @notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        if @section.update(section_params)
          NotebookActivity.track(
            "section_updated",
            notebook: @notebook,
            user: current_user,
            section: @section,
            metadata: { section_name: @section.name }
          )

          render json: {
            success: true,
            section: section_json(@section)
          }
        else
          render json: {
            success: false,
            errors: @section.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/notebooks/:notebook_id/sections/:id
      def destroy
        unless @notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        section_name = @section.name
        @section.archive!

        NotebookActivity.track(
          "section_deleted",
          notebook: @notebook,
          user: current_user,
          metadata: { section_name: section_name }
        )

        render json: { success: true }
      end

      # POST /api/v1/notebooks/:notebook_id/sections/:id/reorder
      def reorder
        unless @notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        new_position = params[:position].to_i

        @section.move_to(new_position)

        NotebookActivity.track(
          "section_moved",
          notebook: @notebook,
          user: current_user,
          section: @section,
          metadata: { section_name: @section.name, new_position: new_position }
        )

        render json: {
          success: true,
          section: section_json(@section)
        }
      end

      private

      def set_notebook
        @notebook = Notebook.find(params[:notebook_id])
      end

      def set_section
        @section = @notebook.sections.find(params[:id])
      end

      def section_params
        params.permit(:name, :color, :position)
      end

      def section_json(section, include_pages: false)
        json = {
          id: section.id,
          notebook_id: section.notebook_id,
          name: section.name,
          position: section.position,
          color: section.color,
          page_count: section.page_count,
          created_at: section.created_at,
          updated_at: section.updated_at
        }

        if include_pages
          json[:pages] = section.pages.active.ordered.map { |p| page_summary_json(p) }
        end

        json
      end

      def page_summary_json(page)
        {
          id: page.id,
          title: page.title,
          position: page.position,
          is_pinned: page.is_pinned,
          preview: page.preview(100),
          word_count: page.word_count,
          last_edited_by: page.last_edited_by&.display_name,
          updated_at: page.updated_at
        }
      end
    end
  end
end
