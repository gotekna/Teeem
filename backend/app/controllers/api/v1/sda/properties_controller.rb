# frozen_string_literal: true

module Api
  module V1
    module Sda
      # Lists properties that have SDA data (sda_category set or sda_enrolled).
      # This is distinct from the main PropertiesController which handles all property CRUD.
      # SSoT: SDA-specific read views only; mutations go through /api/v1/properties.
      class PropertiesController < ApplicationController
        # GET /api/v1/sda/properties
        def index
          properties = Property
            .includes(:property_type, :property_status, :owner_contact, :tenancies)
            .where.not(sda_category: nil)
            .order(created_at: :desc)

          properties = apply_filters(properties)

          render json: {
            success: true,
            data: properties.map { |p| serialize_sda_property(p) }
          }
        end

        private

        def apply_filters(scope)
          scope = scope.where(sda_enrolled: params[:enrolled] == "true") if params[:enrolled].present?
          scope = scope.where(sda_category: params[:category]) if params[:category].present?
          scope = scope.where(suburb: params[:suburb]) if params[:suburb].present?
          scope
        end

        CATEGORY_ABBREV = {
          "high_physical_support" => "HPS",
          "fully_accessible" => "FA",
          "improved_liveability" => "IL",
          "robust" => "Robust"
        }.freeze

        def serialize_sda_property(property)
          active_tenancy = property.tenancies.find { |t| t.status == "active" && t.tenancy_type == "sda" }
          active_sda_count = property.tenancies.count { |t| t.tenancy_type == "sda" && t.status == "active" }

          {
            id: property.id,
            propertyCode: property.property_code,
            address: property.street_address,
            suburb: property.suburb,
            state: property.state,
            sdaCategory: CATEGORY_ABBREV[property.sda_category] || property.sda_category,
            buildingType: property.try(:sda_building_type),
            bedrooms: property.bedrooms,
            maxResidents: property.try(:sda_max_residents),
            currentResidents: active_sda_count,
            enrolled: property.sda_enrolled?,
            weeklyRate: active_tenancy&.sda_weekly_rate&.to_f,
            enrolmentStatus: property.try(:sda_enrolment_status),
          }
        end
      end
    end
  end
end
