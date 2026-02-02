# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for custom report builder
      class ReportsBuilderController < ApplicationController
        before_action :set_corporate

        # GET /api/v1/gl/reports_builder
        def index
          reports = @corporate.gl_custom_reports
                                      .includes(:created_by)
                                      .order(last_run_at: :desc)

          reports = reports.for_entity(params[:entity]) if params[:entity].present?
          reports = reports.public_reports if params[:public_only] == "true"
          reports = reports.where(category: params[:category]) if params[:category].present?

          render json: {
            success: true,
            data: reports.as_json(include: { created_by: { only: [:id, :name] } })
          }
        end

        # GET /api/v1/gl/reports_builder/:id
        def show
          report = @corporate.gl_custom_reports.find(params[:id])
          render json: {
            success: true,
            data: report.as_json(include: [:report_columns, :report_filters])
          }
        end

        # POST /api/v1/gl/reports_builder
        def create
          report = @corporate.gl_custom_reports.build(report_params)
          report.created_by = current_user

          if report.save
            render json: { success: true, data: report }, status: :created
          else
            render json: { success: false, error: report.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/reports_builder/:id
        def update
          report = @corporate.gl_custom_reports.find(params[:id])

          if report.update(report_params)
            render json: { success: true, data: report }
          else
            render json: { success: false, error: report.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/reports_builder/:id
        def destroy
          report = @corporate.gl_custom_reports.find(params[:id])
          report.destroy!
          render json: { success: true, message: "Report deleted" }
        end

        # POST /api/v1/gl/reports_builder/:id/run
        def run
          report = @corporate.gl_custom_reports.find(params[:id])
          parameters = params[:parameters]&.to_unsafe_h || {}

          results = report.run!(user: current_user, parameters: parameters)

          render json: { success: true, data: results }
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/reports_builder/:id/export
        def export
          report = @corporate.gl_custom_reports.find(params[:id])
          format = params[:format] || "csv"
          parameters = params[:parameters]&.to_unsafe_h || {}

          data = report.export!(format, user: current_user, parameters: parameters)

          send_data data,
                    filename: "#{report.name.parameterize}_#{Date.current}.#{format}",
                    type: export_content_type(format),
                    disposition: "attachment"
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/reports_builder/:id/duplicate
        def duplicate
          report = @corporate.gl_custom_reports.find(params[:id])
          new_report = report.duplicate!(current_user)

          render json: { success: true, data: new_report }, status: :created
        end

        # GET /api/v1/gl/reports_builder/fields/:entity
        def fields
          entity = params[:entity]
          fields = ::Gl::CustomReport::ENTITY_FIELDS[entity] || {}

          render json: { success: true, data: fields }
        end

        # GET /api/v1/gl/reports_builder/templates
        def templates
          templates = ::Gl::ReportTemplate.active

          templates = templates.for_category(params[:category]) if params[:category].present?
          templates = templates.for_entity(params[:entity]) if params[:entity].present?

          render json: { success: true, data: templates.popular }
        end

        # POST /api/v1/gl/reports_builder/from_template/:template_id
        def create_from_template
          template = ::Gl::ReportTemplate.find(params[:template_id])
          report = ::Gl::CustomReport.from_template(template, @corporate, current_user)

          render json: { success: true, data: report }, status: :created
        end

        # GET /api/v1/gl/reports_builder/:id/history
        def history
          report = @corporate.gl_custom_reports.find(params[:id])
          runs = report.report_runs.includes(:run_by).recent.limit(50)

          render json: {
            success: true,
            data: runs.as_json(include: { run_by: { only: [:id, :name] } })
          }
        end

        # POST /api/v1/gl/reports_builder/:id/favorite
        def add_favorite
          report = @corporate.gl_custom_reports.find(params[:id])
          ::Gl::ReportFavorite.add!(current_user, report)

          render json: { success: true, message: "Added to favorites" }
        rescue ActiveRecord::RecordNotUnique
          render json: { success: false, error: "Already in favorites" }, status: :unprocessable_entity
        end

        # DELETE /api/v1/gl/reports_builder/:id/favorite
        def remove_favorite
          report = @corporate.gl_custom_reports.find(params[:id])
          ::Gl::ReportFavorite.find_by!(user: current_user, custom_report: report).destroy!

          render json: { success: true, message: "Removed from favorites" }
        end

        # GET /api/v1/gl/reports_builder/favorites
        def favorites
          favorites = ::Gl::ReportFavorite.where(user: current_user)
                                          .includes(custom_report: :created_by)
                                          .ordered

          reports = favorites.map(&:custom_report)
          render json: { success: true, data: reports }
        end

        # Dashboards

        # GET /api/v1/gl/reports_builder/dashboards
        def dashboards
          dashboards = @corporate.gl_report_dashboards
                                         .includes(:created_by, :widgets)
                                         .order(is_default: :desc, name: :asc)

          render json: {
            success: true,
            data: dashboards.as_json(include: [:created_by, :widgets])
          }
        end

        # GET /api/v1/gl/reports_builder/dashboards/:id
        def show_dashboard
          dashboard = @corporate.gl_report_dashboards.find(params[:id])

          render json: {
            success: true,
            data: dashboard.as_json(include: { widgets: { include: :custom_report } })
          }
        end

        # POST /api/v1/gl/reports_builder/dashboards
        def create_dashboard
          dashboard = @corporate.gl_report_dashboards.build(dashboard_params)
          dashboard.created_by = current_user

          if dashboard.save
            render json: { success: true, data: dashboard }, status: :created
          else
            render json: { success: false, error: dashboard.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/reports_builder/dashboards/:id
        def update_dashboard
          dashboard = @corporate.gl_report_dashboards.find(params[:id])

          if dashboard.update(dashboard_params)
            render json: { success: true, data: dashboard }
          else
            render json: { success: false, error: dashboard.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/reports_builder/dashboards/:id
        def destroy_dashboard
          dashboard = @corporate.gl_report_dashboards.find(params[:id])
          dashboard.destroy!
          render json: { success: true, message: "Dashboard deleted" }
        end

        # POST /api/v1/gl/reports_builder/dashboards/:id/add_widget
        def add_widget
          dashboard = @corporate.gl_report_dashboards.find(params[:id])

          widget = dashboard.widgets.build(widget_params)
          if widget.save
            render json: { success: true, data: widget }, status: :created
          else
            render json: { success: false, error: widget.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/reports_builder/dashboards/:dashboard_id/widgets/:id
        def update_widget
          dashboard = @corporate.gl_report_dashboards.find(params[:dashboard_id])
          widget = dashboard.widgets.find(params[:id])

          if widget.update(widget_params)
            render json: { success: true, data: widget }
          else
            render json: { success: false, error: widget.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/reports_builder/dashboards/:dashboard_id/widgets/:id
        def remove_widget
          dashboard = @corporate.gl_report_dashboards.find(params[:dashboard_id])
          widget = dashboard.widgets.find(params[:id])
          widget.destroy!

          render json: { success: true, message: "Widget removed" }
        end

        # POST /api/v1/gl/reports_builder/dashboards/:id/refresh
        def refresh_dashboard
          dashboard = @corporate.gl_report_dashboards.find(params[:id])

          dashboard.widgets.each(&:refresh!)

          render json: { success: true, message: "Dashboard refreshed" }
        end

        private

        def set_corporate
          @corporate = Corporate.find(params[:corporate_id])
        end

        def report_params
          params.require(:report).permit(
            :name, :description, :report_type, :base_entity, :category,
            :is_public, :is_template,
            columns: [], groupings: [], sort_order: [],
            filters: [:field, :operator, :value, :value_type, :conjunction],
            aggregations: [:field, :operation],
            chart_config: {},
            formatting: {}
          )
        end

        def dashboard_params
          params.require(:dashboard).permit(:name, :description, :is_public, layout: [])
        end

        def widget_params
          params.require(:widget).permit(
            :custom_report_id, :widget_type, :title, :row, :col, :width, :height,
            config: {}
          )
        end

        def export_content_type(format)
          case format
          when "csv" then "text/csv"
          when "excel" then "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          when "pdf" then "application/pdf"
          else "text/plain"
          end
        end
      end
    end
  end
end
