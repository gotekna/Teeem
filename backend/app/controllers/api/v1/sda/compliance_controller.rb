# frozen_string_literal: true

module Api
  module V1
    module Sda
      # Provides a compliance matrix for all SDA-enrolled properties.
      #
      # Compliance checks are derived from property and tenancy data that
      # already exists in the database. A dedicated compliance model/table
      # can be introduced later when NDIS audit requirements are clearer.
      class ComplianceController < ApplicationController
        # GET /api/v1/sda/compliance
        # Returns a compliance matrix for all enrolled SDA properties.
        def index
          enrolled = Property
            .includes(:owner_contact, :property_type, tenancies: :sda_participant_contact)
            .where(sda_enrolled: true)
            .order(:sda_category, :street_address)

          matrix = enrolled.map { |p| build_compliance_row(p) }

          overall_score = if matrix.any?
            (matrix.sum { |r| r[:complianceScore] }.to_f / matrix.count).round(1)
          else
            0.0
          end

          # Frontend expects a flat array of ComplianceProperty objects
          render json: {
            success: true,
            data: matrix
          }
        end

        private

        CATEGORY_ABBREV = {
          "high_physical_support" => "HPS",
          "fully_accessible" => "FA",
          "improved_liveability" => "IL",
          "robust" => "Robust"
        }.freeze

        # Builds a compliance row matching the frontend ComplianceProperty type.
        # Frontend expects: { id, address, suburb, sdaCategory, complianceScore, documents: { ... } }
        def build_compliance_row(property)
          checks = run_compliance_checks(property)
          passed = checks.count { |c| c[:status] == "pass" }
          score  = checks.any? ? ((passed.to_f / checks.count) * 100).round(0) : 0

          # Map checks to the document compliance format the frontend expects
          doc_status = ->(check_key) {
            check = checks.find { |c| c[:key] == check_key }
            return nil unless check
            {
              status: check[:status] == "pass" ? "valid" : (check[:status] == "warning" ? "missing" : "expired")
            }
          }

          {
            id: property.id,
            address: property.street_address,
            suburb: property.suburb,
            sdaCategory: CATEGORY_ABBREV[property.sda_category] || property.sda_category,
            complianceScore: score,
            documents: {
              sda_assessment: doc_status.call("sda_category"),
              fire_safety: doc_status.call("dwelling_id"),
              building_cert: doc_status.call("enrolment_date"),
              occupancy_cert: doc_status.call("owner_contact"),
              insurance: doc_status.call("active_sda_tenancy"),
              photos: doc_status.call("sda_plan_number")
            }
          }
        end

        # Returns an array of compliance check results.
        # Status is one of: "pass", "fail", "warning"
        def run_compliance_checks(property)
          active_sda_tenancy = property.tenancies.find { |t| t.tenancy_type == "sda" && t.status == "active" }

          [
            {
              key:     "dwelling_id",
              label:   "NDIS Dwelling ID registered",
              status:  property.sda_dwelling_id.present? ? "pass" : "fail",
              detail:  property.sda_dwelling_id.presence || "No dwelling ID recorded"
            },
            {
              key:     "enrolment_date",
              label:   "Enrolment date recorded",
              status:  property.sda_enrolment_date.present? ? "pass" : "warning",
              detail:  property.sda_enrolment_date&.iso8601 || "No enrolment date set"
            },
            {
              key:     "sda_category",
              label:   "SDA category assigned",
              status:  property.sda_category.present? ? "pass" : "fail",
              detail:  property.sda_category&.humanize || "Missing"
            },
            {
              key:     "owner_contact",
              label:   "Owner contact linked",
              status:  property.owner_contact_id.present? ? "pass" : "warning",
              detail:  property.owner_contact&.display_name || "No owner contact"
            },
            {
              key:     "active_sda_tenancy",
              label:   "Active SDA tenancy",
              status:  active_sda_tenancy.present? ? "pass" : "warning",
              detail:  active_sda_tenancy ? "Tenancy ##{active_sda_tenancy.id} active" : "No active SDA tenancy"
            },
            {
              key:     "sda_plan_number",
              label:   "Participant plan number",
              status:  active_sda_tenancy&.sda_plan_number.present? ? "pass" : (active_sda_tenancy ? "fail" : "warning"),
              detail:  active_sda_tenancy&.sda_plan_number || "No plan number"
            },
            {
              key:     "ndia_rate",
              label:   "NDIA payment rate set",
              status:  active_sda_tenancy&.ndia_payment_amount&.positive? ? "pass" : (active_sda_tenancy ? "fail" : "warning"),
              detail:  active_sda_tenancy ? "#{active_sda_tenancy.ndia_payment_amount || 0}/week" : "N/A"
            },
            {
              key:     "participant_contribution",
              label:   "Participant contribution calculated",
              status:  active_sda_tenancy&.participant_rent_contribution.present? ? "pass" : (active_sda_tenancy ? "warning" : "warning"),
              detail:  active_sda_tenancy&.participant_rent_contribution ? "$#{active_sda_tenancy.participant_rent_contribution}/week" : "Not calculated"
            }
          ]
        end

        def compliance_status(score)
          case score
          when 90..100 then "compliant"
          when 70..89  then "partial"
          else              "non_compliant"
          end
        end
      end
    end
  end
end
