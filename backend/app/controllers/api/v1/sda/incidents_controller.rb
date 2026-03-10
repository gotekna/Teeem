# frozen_string_literal: true

module Api
  module V1
    module Sda
      class IncidentsController < ApplicationController
        before_action :set_incident, only: [:show, :update, :destroy, :report_to_ndis]

        # GET /api/v1/sda/incidents
        # Filterable by property_id, status, severity, incident_type
        def index
          incidents = SdaIncident
            .includes(:property, :tenancy, :contact, :reported_by_user, :investigated_by_user)
            .order(incident_datetime: :desc)

          incidents = apply_filters(incidents)

          render_success(serialize_list(incidents))
        end

        # GET /api/v1/sda/incidents/:id
        def show
          render_success(serialize_detail(@incident))
        end

        # POST /api/v1/sda/incidents
        def create
          incident = SdaIncident.new(incident_params)

          if incident.save
            render_success(serialize_detail(incident), status: :created)
          else
            render_validation_errors(incident)
          end
        end

        # PATCH /api/v1/sda/incidents/:id
        def update
          if @incident.update(incident_params)
            render_success(serialize_detail(@incident))
          else
            render_validation_errors(@incident)
          end
        end

        # DELETE /api/v1/sda/incidents/:id
        def destroy
          @incident.destroy
          render_success
        end

        # POST /api/v1/sda/incidents/:id/report_to_ndis
        # Marks the incident as reported to the NDIS Commission.
        def report_to_ndis
          if @incident.ndis_reported?
            return render_error("Incident has already been reported to the NDIS Commission", status: :unprocessable_entity)
          end

          attrs = {
            ndis_reported: true,
            ndis_reported_date: params[:ndis_reported_date].presence || Date.current,
            status: "reported_to_commission"
          }
          attrs[:ndis_report_reference] = params[:ndis_report_reference] if params[:ndis_report_reference].present?

          # Flag whether the report landed within the 24-hour window
          if @incident.incident_datetime.present?
            hours_elapsed = (Time.current - @incident.incident_datetime) / 1.hour
            attrs[:reported_within_24hrs] = hours_elapsed <= 24
          end

          if @incident.update(attrs)
            render_success(serialize_detail(@incident))
          else
            render_validation_errors(@incident)
          end
        end

        # GET /api/v1/sda/incidents/overdue_reports
        # Returns incidents that are NDIS-reportable but have not been reported,
        # and whose incident_datetime is more than 24 hours ago.
        def overdue_reports
          cutoff = 24.hours.ago

          incidents = SdaIncident
            .includes(:property, :tenancy, :contact, :reported_by_user)
            .where(ndis_reported: false)
            .where(incident_datetime: ..cutoff)
            .where(
              "incident_type IN (?) OR severity IN (?)",
              SdaIncident::NDIS_REPORTABLE_TYPES,
              %w[serious critical]
            )
            .order(incident_datetime: :asc)

          render_success(
            incidents.map do |incident|
              hours_overdue = ((Time.current - incident.incident_datetime) / 1.hour).round(1)
              serialize_detail(incident).merge(hoursOverdue: hours_overdue)
            end
          )
        end

        private

        def set_incident
          @incident = SdaIncident.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Incident not found", status: :not_found)
        end

        def incident_params
          params.require(:sda_incident).permit(
            :property_id,
            :tenancy_id,
            :contact_id,
            :incident_type,
            :severity,
            :status,
            :incident_datetime,
            :location,
            :description,
            :immediate_action_taken,
            :root_cause,
            :corrective_actions,
            :preventive_measures,
            :ndis_reportable,
            :ndis_reported,
            :ndis_reported_date,
            :ndis_report_reference,
            :reported_within_24hrs,
            :reported_by_name,
            :witnesses,
            :reported_by_user_id,
            :investigated_by_user_id,
            :resolved_date,
            :review_date,
            :five_day_form_due_date,
            :five_day_form_submitted,
            :five_day_form_submitted_date,
            :five_day_form_submitted_by_user_id,
            :ndis_commission_portal_ref,
            :ri_approver_user_id,
            :ri_notifier_user_id
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(severity: params[:severity]) if params[:severity].present?
          scope = scope.where(incident_type: params[:incident_type]) if params[:incident_type].present?
          scope
        end

        def serialize_list(incidents)
          incidents.map do |incident|
            incident.as_json(
              only: [
                :id, :incident_number, :incident_type, :severity, :status,
                :incident_datetime, :location, :description,
                :ndis_reportable, :ndis_reported, :ndis_reported_date,
                :reported_within_24hrs, :resolved_date, :review_date,
                :created_at, :updated_at
              ],
              include: {
                property: { only: [:id, :street_address, :suburb, :property_code] },
                contact:  { only: [:id, :display_name] }
              }
            ).merge(
              overdue: incident.overdue_for_reporting?
            )
          end
        end

        def serialize_detail(incident)
          incident.as_json(
            only: [
              :id, :incident_number, :incident_type, :severity, :status,
              :incident_datetime, :location, :description,
              :immediate_action_taken, :root_cause, :corrective_actions, :preventive_measures,
              :ndis_reportable, :ndis_reported, :ndis_reported_date, :ndis_report_reference,
              :reported_within_24hrs, :reported_by_name, :witnesses,
              :resolved_date, :review_date, :created_at, :updated_at
            ],
            include: {
              property:              { only: [:id, :street_address, :suburb, :property_code] },
              tenancy:               { only: [:id, :tenancy_type, :start_date, :end_date] },
              contact:               { only: [:id, :display_name, :ndis_number] },
              reported_by_user:      { only: [:id, :name, :email] },
              investigated_by_user:  { only: [:id, :name, :email] }
            }
          ).merge(
            ndisReportable: incident.ndis_reportable?,
            overdue:        incident.overdue_for_reporting?
          )
        end
      end
    end
  end
end
