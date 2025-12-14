module Api
  module V1
    class FolderTemplatesController < ApplicationController
      before_action :set_folder_template, only: [ :show, :update, :destroy, :duplicate ]

      # GET /api/v1/folder_templates
      def index
        @folder_templates = FolderTemplate.visible_to_user(current_user)
                                          .includes(:folder_template_items, :created_by)
                                          .order(is_system_default: :desc, created_at: :desc)

        render json: {
          folder_templates: @folder_templates.map do |template|
            {
              id: template.id,
              name: template.name,
              description: template.template_type,
              template_type: template.is_system_default ? "system" : "user",
              created_at: template.created_at,
              items: template.folder_template_items.map do |item|
                {
                  id: item.id,
                  name: item.name,
                  item_type: "folder",
                  parent_id: item.parent_id,
                  order: item.order,
                  description: item.description
                }
              end
            }
          end
        }
      end

      # GET /api/v1/folder_templates/:id
      def show
        render json: {
          folder_template: @folder_template.as_json(
            include: {
              folder_template_items: {}
            },
            methods: [ :folder_hierarchy ]
          )
        }
      end

      # POST /api/v1/folder_templates
      def create
        @folder_template = FolderTemplate.new(folder_template_params)
        @folder_template.created_by = current_user

        if @folder_template.save
          render json: { folder_template: @folder_template }, status: :created
        else
          render json: { errors: @folder_template.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/folder_templates/:id
      def update
        unless @folder_template.can_edit?(current_user)
          return render json: { error: "Unauthorized" }, status: :forbidden
        end

        begin
          if @folder_template.update(folder_template_params)
            # Return updated template with fresh item IDs
            @folder_template.reload
            render json: {
              folder_template: {
                id: @folder_template.id,
                name: @folder_template.name,
                description: @folder_template.template_type,
                template_type: @folder_template.is_system_default ? "system" : "user",
                created_at: @folder_template.created_at,
                items: @folder_template.folder_template_items.map do |item|
                  {
                    id: item.id,
                    name: item.name,
                    item_type: "folder",
                    parent_id: item.parent_id,
                    order: item.order,
                    description: item.description
                  }
                end
              }
            }
          else
            render json: { errors: @folder_template.errors.full_messages }, status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotFound => e
          # Nested attribute item not found - likely stale data
          render json: {
            error: "Template items out of sync. Please refresh and try again.",
            details: e.message
          }, status: :conflict
        end
      end

      # DELETE /api/v1/folder_templates/:id
      def destroy
        unless @folder_template.can_edit?(current_user)
          return render json: { error: "Unauthorized" }, status: :forbidden
        end

        if @folder_template.is_system_default
          return render json: { error: "Cannot delete system default template" }, status: :forbidden
        end

        @folder_template.destroy
        head :no_content
      end

      # POST /api/v1/folder_templates/:id/duplicate
      def duplicate
        new_name = params[:name] || "#{@folder_template.name} (Copy)"

        begin
          @new_template = @folder_template.duplicate_for_user(current_user, new_name)
          render json: { folder_template: @new_template }, status: :created
        rescue => e
          render json: { error: e.message }, status: :unprocessable_entity
        end
      end

      private

      def set_folder_template
        @folder_template = FolderTemplate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Template not found" }, status: :not_found
      end

      def folder_template_params
        params.require(:folder_template).permit(
          :name,
          :template_type,
          :is_active,
          folder_template_items_attributes: [
            :id,
            :name,
            :level,
            :order,
            :parent_id,
            :description,
            :_destroy
          ]
        )
      end
    end
  end
end
