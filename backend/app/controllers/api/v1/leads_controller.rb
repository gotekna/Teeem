# frozen_string_literal: true

module Api
  module V1
    class LeadsController < ApplicationController
      before_action :set_lead, only: [ :show, :update, :destroy, :update_status ]

      # GET /api/v1/leads
      def index
        @leads = Lead.includes(:job).order(created_at: :desc)

        # Apply filters
        @leads = @leads.by_status(params[:status]) if params[:status].present?
        @leads = @leads.active if params[:active_only] == "true"

        render json: {
          success: true,
          leads: @leads.map { |lead| lead_to_json(lead) },
          meta: {
            total_count: Lead.count,
            active_count: Lead.active.count,
            won_count: Lead.by_status("won").count,
            lost_count: Lead.by_status("lost").count
          }
        }
      end

      # GET /api/v1/leads/:id
      def show
        render json: {
          success: true,
          lead: lead_to_json(@lead)
        }
      end

      # POST /api/v1/leads
      def create
        @lead = Lead.new(lead_params)

        if @lead.save
          render json: {
            success: true,
            message: "Lead created successfully",
            lead: lead_to_json(@lead)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @lead.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/leads/:id
      def update
        if @lead.update(lead_params)
          render json: {
            success: true,
            lead: lead_to_json(@lead)
          }
        else
          render json: {
            success: false,
            errors: @lead.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/leads/:id
      def destroy
        @lead.destroy

        render json: {
          success: true,
          message: "Lead deleted successfully"
        }
      end

      # PATCH /api/v1/leads/:id/status
      def update_status
        unless Lead::STATUSES.include?(params[:status])
          return render json: {
            success: false,
            error: "Invalid status. Valid statuses: #{Lead::STATUSES.join(', ')}"
          }, status: :unprocessable_entity
        end

        if @lead.update(status: params[:status])
          render json: {
            success: true,
            lead: lead_to_json(@lead)
          }
        else
          render json: {
            success: false,
            errors: @lead.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      private

      def set_lead
        @lead = Lead.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Lead not found"
        }, status: :not_found
      end

      def lead_params
        params.require(:lead).permit(
          :title,
          :status,
          :source,
          :client_name,
          :client_email,
          :client_phone,
          :client_company,
          :site_address,
          :site_suburb,
          :site_state,
          :site_postcode,
          :lot_plan_number,
          :project_type,
          :dwelling_type,
          :number_of_storeys,
          :estimated_floor_area,
          :estimated_value,
          :expected_start_date,
          :decision_timeline,
          :notes,
          :job_id,
          :contract_id
        )
      end

      def lead_to_json(lead)
        {
          id: lead.id,
          lead_number: lead.lead_number,
          title: lead.title,
          status: lead.status,
          source: lead.source,
          client_name: lead.client_name,
          client_email: lead.client_email,
          client_phone: lead.client_phone,
          client_company: lead.client_company,
          site_address: lead.site_address,
          site_suburb: lead.site_suburb,
          site_state: lead.site_state,
          site_postcode: lead.site_postcode,
          lot_plan_number: lead.lot_plan_number,
          project_type: lead.project_type,
          dwelling_type: lead.dwelling_type,
          number_of_storeys: lead.number_of_storeys,
          estimated_floor_area: lead.estimated_floor_area,
          estimated_value: lead.estimated_value,
          expected_start_date: lead.expected_start_date,
          decision_timeline: lead.decision_timeline,
          notes: lead.notes,
          job_id: lead.job_id,
          contract_id: lead.contract_id,
          created_at: lead.created_at,
          updated_at: lead.updated_at
        }
      end
    end
  end
end
