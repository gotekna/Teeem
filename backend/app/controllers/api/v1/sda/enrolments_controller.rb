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
        # Returns all SDA-eligible properties grouped by enrolment status
        # in the kanban format the frontend expects.
        def index
          sda_properties = Property
            .includes(:property_type, :property_status, :owner_contact, :tenancies)
            .where.not(sda_category: nil)
            .order(:sda_category, :street_address)

          category_abbrev = {
            "high_physical_support" => "HPS",
            "fully_accessible" => "FA",
            "improved_liveability" => "IL",
            "robust" => "Robust"
          }

          # Group by enrolment status for kanban columns
          has_status_col = column_exists?(:properties, :sda_enrolment_status)

          grouped = { "not_started" => [], "in_progress" => [], "submitted" => [], "under_review" => [], "enrolled" => [] }

          sda_properties.each do |p|
            status = if p.sda_enrolled?
              "enrolled"
            elsif has_status_col && p.sda_enrolment_status.present? && p.sda_enrolment_status != "not_started"
              p.sda_enrolment_status
            else
              "not_started"
            end

            # Map to valid kanban column keys
            status = "not_started" unless grouped.key?(status)

            grouped[status] << {
              id: p.id,
              address: p.street_address,
              suburb: p.suburb,
              sdaCategory: category_abbrev[p.sda_category] || p.sda_category,
              completenessPercent: p.respond_to?(:sda_enrolment_completeness) ? p.sda_enrolment_completeness : 0,
              daysInStage: p.updated_at ? ((Time.current - p.updated_at) / 1.day).to_i : 0,
              enrolmentId: p.id,
              missingFields: [],
              missingDocuments: []
            }
          end

          render json: {
            success: true,
            data: {
              byStatus: grouped
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
        # Links an existing property or creates a new one and marks it as SDA-eligible.
        # Accepts flat params from the QuickEnrolDialog frontend.
        def quick_enrol
          if params[:existing_property_id].present?
            property = Property.find_by(id: params[:existing_property_id])
            return render json: { success: false, error: "Property not found" }, status: :not_found unless property

            sda_attrs = { sda_category: map_sda_category(params[:sda_design_category]) }
            sda_attrs[:bedrooms] = params[:bedrooms] if params[:bedrooms].present?

            if column_exists?(:properties, :sda_building_type)
              sda_attrs[:sda_building_type] = params[:building_type]
              sda_attrs[:sda_max_residents] = params[:max_residents]
              sda_attrs[:sda_assessor_name] = params[:assessor_name]
              sda_attrs[:sda_assessor_number] = params[:assessor_organisation]
              sda_attrs[:sda_assessment_date] = params[:assessment_date]
              sda_attrs[:sda_enrolment_status] = "not_started"
            end

            if property.update(sda_attrs)
              render json: {
                success: true,
                data: {
                  id: property.id,
                  propertyCode: property.property_code,
                  address: property.street_address,
                  suburb: property.suburb,
                  sdaCategory: params[:sda_design_category],
                  enrolled: false
                }
              }
            else
              render json: { success: false, error: property.errors.full_messages.join(", ") }, status: :unprocessable_entity
            end
          else
            attrs = {
              street_address: params[:address],
              suburb: params[:suburb],
              state: params[:state],
              postcode: params[:postcode],
              sda_category: map_sda_category(params[:sda_design_category]),
              bedrooms: params[:bedrooms]
            }

            if column_exists?(:properties, :sda_building_type)
              attrs[:sda_building_type] = params[:building_type]
              attrs[:sda_max_residents] = params[:max_residents]
              attrs[:sda_assessor_name] = params[:assessor_name]
              attrs[:sda_assessor_number] = params[:assessor_organisation]
              attrs[:sda_assessment_date] = params[:assessment_date]
              attrs[:sda_enrolment_status] = "not_started"
            end

            property = Property.new(attrs)

            if property.save
              render json: {
                success: true,
                data: {
                  id: property.id,
                  propertyCode: property.property_code,
                  address: property.street_address,
                  suburb: property.suburb,
                  sdaCategory: params[:sda_design_category],
                  enrolled: false
                }
              }, status: :created
            else
              render json: { success: false, error: property.errors.full_messages.join(", ") }, status: :unprocessable_entity
            end
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

        # Maps frontend SDA category abbreviations to database values
        def map_sda_category(frontend_value)
          mapping = {
            "HPS" => "high_physical_support",
            "FA" => "fully_accessible",
            "IL" => "improved_liveability",
            "Robust" => "robust"
          }
          mapping[frontend_value] || frontend_value
        end

        def column_exists?(table, column)
          ActiveRecord::Base.connection.column_exists?(table, column)
        rescue
          false
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
