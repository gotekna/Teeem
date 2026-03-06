# frozen_string_literal: true

module Api
  module V1
    module Sda
      # REST controller for the SDA compliance and essential services register.
      #
      # Each SdaComplianceItem represents a single inspectable item at a property
      # (e.g. a smoke alarm, ceiling hoist, RCD switch). The register tracks
      # service schedules, certificate numbers, and current compliance status.
      #
      # Routes (under /api/v1/sda/compliance):
      #   GET    /              → index    (filterable by property_id, category, status)
      #   GET    /:id           → show
      #   POST   /              → create
      #   PATCH  /:id           → update
      #   DELETE /:id           → destroy
      #   GET    /overdue       → overdue  (all overdue items across tenant)
      #   GET    /due_soon      → due_soon (items due within 30 days)
      #   GET    /dashboard     → dashboard (compliance summary grouped by property)
      class ComplianceController < ApplicationController
        before_action :set_item, only: [:show, :update, :destroy]

        # GET /api/v1/sda/compliance
        def index
          items = SdaComplianceItem.includes(:property, :certificate_blob).order(created_at: :desc)
          items = apply_filters(items)
          render_success(serialize_items(items))
        end

        # GET /api/v1/sda/compliance/:id
        def show
          render_success(serialize_item(@item))
        end

        # POST /api/v1/sda/compliance
        def create
          item = SdaComplianceItem.new(compliance_item_params)

          if item.save
            render_success(serialize_item(item), status: :created)
          else
            render_validation_errors(item)
          end
        end

        # PATCH /api/v1/sda/compliance/:id
        def update
          if @item.update(compliance_item_params)
            render_success(serialize_item(@item))
          else
            render_validation_errors(@item)
          end
        end

        # DELETE /api/v1/sda/compliance/:id
        def destroy
          @item.destroy
          render_success
        end

        # GET /api/v1/sda/compliance/overdue
        # All compliance items that are currently overdue across the tenant.
        def overdue
          items = SdaComplianceItem.overdue.includes(:property, :certificate_blob).order(:next_service_date)
          render_success(serialize_items(items))
        end

        # GET /api/v1/sda/compliance/due_soon
        # All compliance items with next_service_date within the next 30 days.
        def due_soon
          items = SdaComplianceItem.due_soon.includes(:property, :certificate_blob).order(:next_service_date)
          render_success(serialize_items(items))
        end

        # GET /api/v1/sda/compliance/dashboard
        # Compliance summary grouped by property with counts broken down by status and category.
        def dashboard
          items = SdaComplianceItem.includes(:property).all

          # Group by property_id so we can build one summary row per property
          by_property = items.group_by(&:property_id)

          summaries = by_property.map do |property_id, property_items|
            property = property_items.first.property

            status_counts   = property_items.group_by(&:status).transform_values(&:count)
            category_counts = property_items.group_by(&:category).transform_values(&:count)

            total   = property_items.count
            # Items that are compliant or not_applicable are "passing"
            passing = status_counts.fetch("compliant", 0) + status_counts.fetch("not_applicable", 0)
            score   = total > 0 ? ((passing.to_f / total) * 100).round(0) : 0

            {
              propertyId:      property_id,
              propertyName:    property.name.presence || property.street_address,
              streetAddress:   property.street_address,
              suburb:          property.suburb,
              totalItems:      total,
              complianceScore: score,
              byStatus:        status_counts,
              byCategory:      category_counts
            }
          end

          # Sort by compliance score ascending so worst performers appear first
          summaries.sort_by! { |s| s[:complianceScore] }

          render_success({
            properties: summaries,
            totals: {
              properties:    summaries.count,
              items:         items.count,
              overdue:       items.count { |i| i.status == "overdue" },
              dueSoon:       items.count { |i| i.status == "due_soon" },
              compliant:     items.count { |i| i.status == "compliant" },
              nonCompliant:  items.count { |i| i.status == "non_compliant" },
              notApplicable: items.count { |i| i.status == "not_applicable" }
            }
          })
        end

        private

        def set_item
          @item = SdaComplianceItem.find(params[:id])
        end

        # Permitted params mirror the sda_compliance_items migration columns
        def compliance_item_params
          params.require(:sda_compliance_item).permit(
            :property_id,
            :category,
            :item_type,
            :item_name,
            :location,
            :status,
            :installed_date,
            :last_service_date,
            :next_service_date,
            :expiry_date,
            :service_interval_months,
            :service_provider_name,
            :service_provider_phone,
            :certificate_number,
            :certificate_blob_id,
            :notes
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.by_category(params[:category])           if params[:category].present?
          scope = scope.where(status: params[:status])           if params[:status].present?
          scope
        end

        def serialize_item(item)
          item.as_json(include: {
            property: { only: [:id, :name, :street_address, :suburb] }
          })
        end

        def serialize_items(items)
          items.map { |item| serialize_item(item) }
        end
      end
    end
  end
end
