# frozen_string_literal: true

module Api
  module V1
    class NotebookPagesController < ApplicationController
      before_action :set_page, only: [:show, :update, :destroy, :move, :toggle_pin]
      before_action :set_section, only: [:index, :create]

      # GET /api/v1/notebook_sections/:section_id/pages
      def index
        notebook = @section.notebook
        unless notebook.accessible_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        pages = @section.pages.active.ordered.includes(:created_by, :last_edited_by)

        render json: {
          success: true,
          pages: pages.map { |p| page_json(p) }
        }
      end

      # GET /api/v1/notebook_pages/:id
      def show
        notebook = @page.notebook
        unless notebook.accessible_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        render json: {
          success: true,
          page: page_json(@page, include_content: true)
        }
      end

      # POST /api/v1/notebook_sections/:section_id/pages
      def create
        notebook = @section.notebook
        unless notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        page = @section.pages.new(page_params)
        page.created_by = current_user
        page.last_edited_by = current_user

        if page.save
          NotebookActivity.track(
            "page_created",
            notebook: notebook,
            user: current_user,
            page: page,
            section: @section,
            metadata: { page_title: page.title }
          )

          render json: {
            success: true,
            page: page_json(page, include_content: true)
          }, status: :created
        else
          render json: {
            success: false,
            errors: page.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/notebook_pages/:id
      def update
        notebook = @page.notebook
        unless notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        @page.last_edited_by = current_user

        if @page.update(page_params)
          NotebookActivity.track(
            "page_updated",
            notebook: notebook,
            user: current_user,
            page: @page,
            section: @page.section,
            metadata: { page_title: @page.title }
          )

          render json: {
            success: true,
            page: page_json(@page, include_content: true)
          }
        else
          render json: {
            success: false,
            errors: @page.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/notebook_pages/:id
      def destroy
        notebook = @page.notebook
        unless notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        page_title = @page.title
        @page.archive!

        NotebookActivity.track(
          "page_deleted",
          notebook: notebook,
          user: current_user,
          metadata: { page_title: page_title }
        )

        render json: { success: true }
      end

      # POST /api/v1/notebook_pages/:id/move
      def move
        notebook = @page.notebook
        unless notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        if params[:section_id].present?
          new_section = notebook.sections.find(params[:section_id])
          @page.move_to_section(new_section)
        elsif params[:position].present?
          @page.move_to(params[:position].to_i)
        end

        NotebookActivity.track(
          "page_moved",
          notebook: notebook,
          user: current_user,
          page: @page,
          section: @page.section,
          metadata: { page_title: @page.title }
        )

        render json: {
          success: true,
          page: page_json(@page)
        }
      end

      # POST /api/v1/notebook_pages/:id/toggle_pin
      def toggle_pin
        notebook = @page.notebook
        unless notebook.editable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        @page.toggle_pin!

        NotebookActivity.track(
          @page.is_pinned ? "page_pinned" : "page_unpinned",
          notebook: notebook,
          user: current_user,
          page: @page,
          section: @page.section,
          metadata: { page_title: @page.title }
        )

        render json: {
          success: true,
          page: page_json(@page)
        }
      end

      # GET /api/v1/notebook_pages/recent
      # Recent pages across all accessible notebooks
      def recent
        notebooks = Notebook.accessible_by(current_user).active

        pages = NotebookPage
                .joins(section: :notebook)
                .where(notebook_sections: { notebook_id: notebooks.select(:id) })
                .active
                .recent
                .includes(:section, :created_by, :last_edited_by, section: :notebook)
                .limit(20)

        render json: {
          success: true,
          pages: pages.map { |p| page_json(p, include_notebook: true) }
        }
      end

      private

      def set_page
        @page = NotebookPage.find(params[:id])
      end

      def set_section
        @section = NotebookSection.find(params[:section_id])
      end

      def page_params
        params.permit(:title, :content, :position, :is_pinned)
      end

      def page_json(page, include_content: false, include_notebook: false)
        json = {
          id: page.id,
          section_id: page.section_id,
          title: page.title,
          position: page.position,
          is_pinned: page.is_pinned,
          preview: page.preview(150),
          word_count: page.word_count,
          char_count: page.char_count,
          created_by: page.created_by ? {
            id: page.created_by.id,
            name: page.created_by.display_name
          } : nil,
          last_edited_by: page.last_edited_by ? {
            id: page.last_edited_by.id,
            name: page.last_edited_by.display_name
          } : nil,
          created_at: page.created_at,
          updated_at: page.updated_at
        }

        if include_content
          json[:content] = page.content
          json[:attachments] = page.attachments.map do |a|
            {
              id: a.id,
              file_name: a.file_name,
              content_type: a.content_type,
              file_size: a.file_size,
              human_size: a.human_size,
              is_image: a.image?
            }
          end
        end

        if include_notebook
          json[:notebook] = {
            id: page.notebook.id,
            name: page.notebook.name
          }
          json[:section] = {
            id: page.section.id,
            name: page.section.name
          }
        end

        json
      end
    end
  end
end
