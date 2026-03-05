# frozen_string_literal: true

module Api
  module V1
    module Sda
      # Manages the SDA enrolment lifecycle for properties.
      #
      # Enrolment states are derived from the properties table:
      #   - sda_category present + sda_enrolled: false  → "pending"
      #   - sda_category present + sda_enrolled: true   → "enrolled"
      #   - no sda_category                             → not SDA (excluded)
      #
      # Mutations to sda_enrolled and sda_category go through this controller
      # rather than the generic PropertiesController to keep SDA workflow logic
      # in a single, auditable place.
      class EnrolmentsController < ApplicationController
        before_action :set_property, only: [:preflight, :update_status]

        # GET /api/v1/sda/enrolments
        # Returns all SDA-eligible properties grouped by enrolment status.
        def index
          sda_properties = Property
            .includes(:property_type, :property_status, :owner_contact)
            .where.not(sda_category: nil)
            .order(:sda_category, :street_address)

          grouped = sda_properties.group_by do |p|
            p.sda_enrolled? ? "enrolled" : "pending"
          end

          render json: {
            success: true,
            data: {
              enrolled: serialize_list(grouped["enrolled"] || []),
              pending:  serialize_list(grouped["pending"] || []),
              summary:  {
                total:    sda_properties.count,
                enrolled: (grouped["enrolled"] || []).count,
                pending:  (grouped["pending"] || []).count
              }
            }
          }
        end

        # GET /api/v1/sda/enrolments/:id/preflight
        # Runs SdaPreflightService checks for a property before enrolment submission.
        def preflight
          checks = run_preflight_checks(@property)

          render json: {
            success: true,
            data: {
              propertyId:   @property.id,
              propertyCode: @property.property_code,
              address:      @property.full_address,
              ready:        checks.all? { |c| c[:passed] },
              checks:       checks
            }
          }
        end

        # POST /api/v1/sda/enrolments/quick_enrol
        # Creates a property and marks it as SDA-eligible in one step.
        def quick_enrol
          property = Property.new(quick_enrol_params)

          if property.save
            render json: {
              success: true,
              data:    property.as_json(
                only: [:id, :property_code, :name, :street_address, :suburb, :state,
                       :postcode, :sda_category, :sda_enrolled, :sda_dwelling_id]
              )
            }, status: :created
          else
            render_validation_errors(property)
          end
        end

        # PATCH /api/v1/sda/enrolments/:id/update_status
        # Updates the enrolment status (sda_enrolled flag and optional enrolment date).
        def update_status
          new_enrolled = ActiveModel::Type::Boolean.new.cast(params[:sda_enrolled])
          update_attrs = { sda_enrolled: new_enrolled }

          if new_enrolled && @property.sda_enrolment_date.blank?
            update_attrs[:sda_enrolment_date] = Date.current
          end

          update_attrs[:sda_dwelling_id] = params[:sda_dwelling_id] if params[:sda_dwelling_id].present?

          if @property.update(update_attrs)
            render json: {
              success: true,
              data:    {
                id:                @property.id,
                sdaEnrolled:       @property.sda_enrolled,
                sdaEnrolmentDate:  @property.sda_enrolment_date,
                sdaDwellingId:     @property.sda_dwelling_id
              }
            }
          else
            render_validation_errors(@property)
          end
        end

        private

        def set_property
          @property = Property.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Property not found", status: :not_found)
        end

        def quick_enrol_params
          params.require(:property).permit(
            :name, :street_address, :suburb, :state, :postcode, :country,
            :property_type_id, :property_status_id,
            :bedrooms, :bathrooms, :parking_spaces,
            :floor_area_sqm, :land_area_sqm, :year_built,
            :sda_category, :sda_enrolled, :sda_dwelling_id, :sda_enrolment_date,
            :owner_contact_id, :description
          )
        end

        # Runs a set of preflight checks against a property before NDIS enrolment.
        # Returns an array of check result hashes.
        #
        # Each check:
        #   { key: String, label: String, passed: Boolean, message: String | nil }
        #
        # When SdaPreflightService is available, delegate to it.
        # For now, these checks are inline to avoid a missing-constant error.
        def run_preflight_checks(property)
          checks = []

          # 1. SDA category must be set
          checks << {
            key:     "sda_category",
            label:   "SDA Category",
            passed:  property.sda_category.present?,
            message: property.sda_category.present? ? nil : "SDA category must be set before enrolment"
          }

          # 2. Dwelling ID provided
          checks << {
            key:     "sda_dwelling_id",
            label:   "Dwelling ID",
            passed:  property.sda_dwelling_id.present?,
            message: property.sda_dwelling_id.present? ? nil : "NDIS dwelling ID is required"
          }

          # 3. Full address
          has_full_address = [property.street_address, property.suburb, property.state, property.postcode].all?(&:present?)
          checks << {
            key:     "full_address",
            label:   "Complete Address",
            passed:  has_full_address,
            message: has_full_address ? nil : "Property must have full address (street, suburb, state, postcode)"
          }

          # 4. Owner contact
          checks << {
            key:     "owner_contact",
            label:   "Owner Contact",
            passed:  property.owner_contact_id.present?,
            message: property.owner_contact_id.present? ? nil : "Owner contact must be assigned"
          }

          # 5. At least one SDA participant (active tenancy of type sda)
          has_sda_tenancy = property.tenancies.where(tenancy_type: "sda").exists?
          checks << {
            key:     "sda_tenancy",
            label:   "SDA Tenancy",
            passed:  has_sda_tenancy,
            message: has_sda_tenancy ? nil : "At least one SDA tenancy must be created"
          }

          checks
        end

        def serialize_list(properties)
          properties.map do |p|
            p.as_json(
              only: [:id, :property_code, :name, :street_address, :suburb, :state,
                     :sda_category, :sda_enrolled, :sda_enrolment_date, :sda_dwelling_id],
              include: {
                property_status: { only: [:id, :name, :color] },
                owner_contact:   { only: [:id, :display_name] }
              }
            )
          end
        end
      end
    end
  end
end
