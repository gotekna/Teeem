# frozen_string_literal: true

module Api
  module V1
    module Sda
      class RestrictivePracticesController < ApplicationController
        before_action :set_record, only: [:show, :update, :destroy, :report_to_ndis]

        # GET /api/v1/sda/restrictive_practices
        def index
          records = SdaRestrictivePractice
            .includes(:property, :contact, :sda_incident, :recorded_by_user)
            .order(used_at: :desc)

          records = apply_filters(records)

          render_success(records.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            contact: { only: [:id, :display_name] },
            sda_incident: { only: [:id, :incident_number] }
          }))
        end

        # GET /api/v1/sda/restrictive_practices/:id
        def show
          render_success(@record.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            contact: { only: [:id, :display_name, :ndis_number] },
            sda_incident: { only: [:id, :incident_number, :incident_type] },
            recorded_by_user: { only: [:id, :name, :email] },
            approved_by_user: { only: [:id, :name, :email] }
          }))
        end

        # POST /api/v1/sda/restrictive_practices
        def create
          record = SdaRestrictivePractice.new(record_params)

          # Auto-flag unauthorized practices as NDIS reportable
          record.ndis_reportable = true unless record.authorized

          if record.save
            render_success(record, status: :created)
          else
            render_validation_errors(record)
          end
        end

        # PATCH /api/v1/sda/restrictive_practices/:id
        def update
          if @record.update(record_params)
            render_success(@record)
          else
            render_validation_errors(@record)
          end
        end

        # DELETE /api/v1/sda/restrictive_practices/:id
        def destroy
          @record.destroy
          render_success
        end

        # POST /api/v1/sda/restrictive_practices/:id/report_to_ndis
        def report_to_ndis
          if @record.ndis_reported
            return render_error("Already reported to NDIS", status: :unprocessable_entity)
          end

          attrs = {
            ndis_reported: true,
            ndis_reported_date: params[:ndis_reported_date].presence || Date.current,
            reported_within_5_days: !@record.overdue_for_reporting?
          }
          attrs[:ndis_report_reference] = params[:ndis_report_reference] if params[:ndis_report_reference].present?

          if @record.update(attrs)
            render_success(@record)
          else
            render_validation_errors(@record)
          end
        end

        # GET /api/v1/sda/restrictive_practices/overdue
        def overdue
          records = SdaRestrictivePractice
            .includes(:property, :contact)
            .unreported
            .order(used_at: :asc)

          overdue_records = records.select(&:overdue_for_reporting?)

          render_success(overdue_records.map do |r|
            r.as_json(include: {
              property: { only: [:id, :name, :street_address] },
              contact: { only: [:id, :display_name] }
            }).merge(daysUntilDue: r.days_until_report_due)
          end)
        end

        private

        def set_record
          @record = SdaRestrictivePractice.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Restrictive practice not found", status: :not_found)
        end

        def record_params
          params.require(:sda_restrictive_practice).permit(
            :property_id, :contact_id, :sda_incident_id,
            :practice_type, :status, :authorized, :authorization_source,
            :bsp_reference, :bsp_start_date, :bsp_end_date,
            :bsp_practitioner_name, :bsp_practitioner_number,
            :used_at, :duration_minutes, :reason, :description,
            :participant_response, :debrief_notes,
            :ndis_reportable, :ndis_reported, :ndis_reported_date,
            :ndis_report_reference, :reported_within_5_days,
            :recorded_by_user_id, :approved_by_user_id
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          scope = scope.where(practice_type: params[:practice_type]) if params[:practice_type].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(authorized: params[:authorized]) if params[:authorized].present?
          scope
        end
      end
    end
  end
end
