# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for construction-specific features
      class ConstructionController < ApplicationController
        before_action :set_corporate

        # ===== LIEN WAIVERS =====

        # GET /api/v1/gl/construction/lien_waivers
        def lien_waivers
          waivers = @corporate.gl_lien_waivers
                                      .includes(:job, :contact, :progress_claim)
                                      .order(waiver_date: :desc)

          waivers = waivers.where(job_id: params[:job_id]) if params[:job_id].present?
          waivers = waivers.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          waivers = waivers.where(status: params[:status]) if params[:status].present?

          render json: { success: true, data: waivers.as_json(include: [:job, :contact]) }
        end

        # POST /api/v1/gl/construction/lien_waivers
        def create_lien_waiver
          job = Job.find(params[:job_id])
          contact = Contact.find(params[:contact_id])

          waiver = ::Gl::LienWaiver.request!(
            job: job,
            contact: contact,
            waiver_type: params[:waiver_type],
            through_amount: params[:through_amount],
            through_date: params[:through_date]
          )

          render json: { success: true, data: waiver }, status: :created
        end

        # POST /api/v1/gl/construction/lien_waivers/:id/receive
        def receive_lien_waiver
          waiver = @corporate.gl_lien_waivers.find(params[:id])
          waiver.mark_received!(from: params[:from], document_id: params[:document_id])

          render json: { success: true, data: waiver }
        end

        # POST /api/v1/gl/construction/lien_waivers/:id/approve
        def approve_lien_waiver
          waiver = @corporate.gl_lien_waivers.find(params[:id])

          if waiver.approve!
            render json: { success: true, data: waiver }
          else
            render json: { success: false, error: "Cannot approve waiver" }, status: :unprocessable_entity
          end
        end

        # ===== CHANGE ORDERS =====

        # GET /api/v1/gl/construction/change_orders
        def change_orders
          orders = @corporate.gl_change_orders
                                     .includes(:job, :contact, :lines)
                                     .order(created_at: :desc)

          orders = orders.where(job_id: params[:job_id]) if params[:job_id].present?
          orders = orders.where(status: params[:status]) if params[:status].present?

          render json: { success: true, data: orders.as_json(include: [:job, :lines]) }
        end

        # GET /api/v1/gl/construction/change_orders/:id
        def show_change_order
          order = @corporate.gl_change_orders.find(params[:id])

          render json: {
            success: true,
            data: order.as_json(include: { job: {}, contact: {}, lines: {} })
          }
        end

        # POST /api/v1/gl/construction/change_orders
        def create_change_order
          order = @corporate.gl_change_orders.build(change_order_params)
          order.requested_by = current_user

          if order.save
            render json: { success: true, data: order }, status: :created
          else
            render json: { success: false, error: order.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/construction/change_orders/:id
        def update_change_order
          order = @corporate.gl_change_orders.find(params[:id])

          if order.update(change_order_params)
            order.calculate_totals!
            render json: { success: true, data: order }
          else
            render json: { success: false, error: order.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/construction/change_orders/:id/submit
        def submit_change_order
          order = @corporate.gl_change_orders.find(params[:id])

          if order.submit!
            render json: { success: true, data: order }
          else
            render json: { success: false, error: "Cannot submit change order" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/construction/change_orders/:id/approve
        def approve_change_order
          order = @corporate.gl_change_orders.find(params[:id])

          if order.approve!(current_user)
            render json: { success: true, data: order }
          else
            render json: { success: false, error: "Cannot approve change order" }, status: :unprocessable_entity
          end
        end

        # ===== EQUIPMENT =====

        # GET /api/v1/gl/construction/equipment
        def equipment_list
          equipment = @corporate.gl_equipment.order(:equipment_number)
          equipment = equipment.where(status: params[:status]) if params[:status].present?
          equipment = equipment.where(category: params[:category]) if params[:category].present?

          render json: { success: true, data: equipment }
        end

        # GET /api/v1/gl/construction/equipment/:id
        def show_equipment
          equipment = @corporate.gl_equipment.find(params[:id])

          render json: {
            success: true,
            data: equipment.as_json.merge(
              usage_summary: equipment.usage_by_job.as_json
            )
          }
        end

        # POST /api/v1/gl/construction/equipment
        def create_equipment
          equipment = @corporate.gl_equipment.build(equipment_params)

          if equipment.save
            render json: { success: true, data: equipment }, status: :created
          else
            render json: { success: false, error: equipment.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/construction/equipment/:id
        def update_equipment
          equipment = @corporate.gl_equipment.find(params[:id])

          if equipment.update(equipment_params)
            render json: { success: true, data: equipment }
          else
            render json: { success: false, error: equipment.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/construction/equipment/:id/record_usage
        def record_usage
          equipment = @corporate.gl_equipment.find(params[:id])
          job = Job.find(params[:job_id])

          usage = equipment.record_usage!(
            job: job,
            hours: params[:hours].to_d,
            user: current_user,
            usage_date: params[:usage_date] || Date.current,
            notes: params[:notes]
          )

          render json: { success: true, data: usage }
        end

        # GET /api/v1/gl/construction/equipment/:id/usages
        def equipment_usages
          equipment = @corporate.gl_equipment.find(params[:id])
          usages = equipment.usages.includes(:job, :user).ordered

          usages = usages.for_job(Job.find(params[:job_id])) if params[:job_id].present?

          render json: { success: true, data: usages.as_json(include: [:job, :user]) }
        end

        # GET /api/v1/gl/construction/job/:job_id/equipment_costs
        def job_equipment_costs
          job = Job.find(params[:job_id])
          usages = ::Gl::EquipmentUsage.for_job(job).includes(:equipment)

          by_equipment = usages.group_by(&:equipment_id).map do |_id, group|
            {
              equipment: group.first.equipment.as_json(only: [:id, :name, :equipment_number]),
              total_hours: group.sum(&:hours),
              total_cost: group.sum(&:total_cost)
            }
          end

          render json: {
            success: true,
            data: {
              usages: usages.as_json(include: :equipment),
              by_equipment: by_equipment,
              totals: {
                total_hours: usages.sum(&:hours),
                total_cost: usages.sum(&:total_cost)
              }
            }
          }
        end

        private

        def set_corporate
          @corporate = Corporate.find(params[:corporate_id])
        end

        def change_order_params
          params.require(:change_order).permit(
            :job_id, :contact_id, :title, :description, :reason,
            :contract_amount_change, :cost_change, :schedule_days_change,
            lines_attributes: [:id, :sort_order, :description, :quantity, :unit_of_measure,
                               :unit_price, :amount, :cost_code, :cost_type, :_destroy]
          )
        end

        def equipment_params
          params.require(:equipment).permit(
            :equipment_number, :name, :description, :category, :status,
            :ownership_type, :purchase_price, :purchase_date, :current_value, :vendor_name,
            :hourly_rate, :daily_rate, :weekly_rate, :monthly_rate,
            :fuel_cost_per_hour, :maintenance_cost_per_hour
          )
        end
      end
    end
  end
end
