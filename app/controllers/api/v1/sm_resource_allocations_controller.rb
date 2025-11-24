# frozen_string_literal: true

module Api
  module V1
    class SmResourceAllocationsController < ApplicationController
      before_action :set_task, only: [:index, :create]
      before_action :set_allocation, only: [:show, :update, :destroy]

      # GET /api/v1/sm_tasks/:sm_task_id/resource_allocations
      def index
        @allocations = @task.resource_allocations.includes(:resource)

        # Filter by status
        @allocations = @allocations.where(status: params[:status]) if params[:status].present?

        # Filter by date
        if params[:date].present?
          @allocations = @allocations.for_date(Date.parse(params[:date]))
        end

        render json: {
          success: true,
          allocations: @allocations.map { |a| allocation_to_json(a) },
          task: {
            id: @task.id,
            name: @task.name,
            start_date: @task.start_date,
            end_date: @task.end_date
          }
        }
      end

      # GET /api/v1/sm_resource_allocations/:id
      def show
        render json: {
          success: true,
          allocation: allocation_to_json(@allocation, include_details: true)
        }
      end

      # POST /api/v1/sm_tasks/:sm_task_id/resource_allocations
      def create
        @allocation = @task.resource_allocations.new(allocation_params)

        if @allocation.save
          render json: {
            success: true,
            message: 'Resource allocated successfully',
            allocation: allocation_to_json(@allocation)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @allocation.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_resource_allocations/:id
      def update
        if @allocation.update(allocation_params)
          render json: {
            success: true,
            allocation: allocation_to_json(@allocation)
          }
        else
          render json: {
            success: false,
            errors: @allocation.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_resource_allocations/:id
      def destroy
        @allocation.destroy

        render json: {
          success: true,
          message: 'Allocation removed successfully'
        }
      end

      # POST /api/v1/sm_resource_allocations/:id/confirm
      def confirm
        set_allocation
        @allocation.update!(status: 'confirmed')

        render json: {
          success: true,
          message: 'Allocation confirmed',
          allocation: allocation_to_json(@allocation)
        }
      end

      # POST /api/v1/sm_resource_allocations/:id/start
      def start
        set_allocation
        @allocation.update!(status: 'in_progress')

        render json: {
          success: true,
          message: 'Allocation started',
          allocation: allocation_to_json(@allocation)
        }
      end

      # POST /api/v1/sm_resource_allocations/:id/complete
      def complete
        set_allocation
        @allocation.update!(status: 'completed')

        render json: {
          success: true,
          message: 'Allocation completed',
          allocation: allocation_to_json(@allocation)
        }
      end

      # GET /api/v1/sm_resource_allocations/by_resource/:resource_id
      def by_resource
        resource = SmResource.find(params[:resource_id])
        allocations = resource.resource_allocations.includes(:task)

        # Filter by date range
        if params[:start_date].present? && params[:end_date].present?
          start_date = Date.parse(params[:start_date])
          end_date = Date.parse(params[:end_date])
          allocations = allocations.for_date_range(start_date, end_date)
        end

        render json: {
          success: true,
          resource: {
            id: resource.id,
            name: resource.name,
            resource_type: resource.resource_type
          },
          allocations: allocations.map { |a| allocation_to_json(a) }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Resource not found' }, status: :not_found
      end

      # GET /api/v1/sm_resource_allocations/gantt_data
      # Returns data formatted for resource Gantt view
      def gantt_data
        construction_id = params[:construction_id]

        tasks = SmTask.where(construction_id: construction_id)
          .includes(resource_allocations: :resource)
          .where.not(resource_allocations: { id: nil })

        gantt_data = tasks.map do |task|
          {
            task_id: task.id,
            task_name: task.name,
            task_number: task.task_number,
            start_date: task.start_date,
            end_date: task.end_date,
            resources: task.resource_allocations.map do |alloc|
              {
                allocation_id: alloc.id,
                resource_id: alloc.resource_id,
                resource_name: alloc.resource.name,
                resource_type: alloc.resource.resource_type,
                allocated_hours: alloc.allocated_hours,
                allocated_quantity: alloc.allocated_quantity,
                allocation_date: alloc.allocation_date,
                status: alloc.status
              }
            end
          }
        end

        render json: {
          success: true,
          gantt_data: gantt_data
        }
      end

      private

      def set_task
        @task = SmTask.find(params[:sm_task_id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Task not found'
        }, status: :not_found
      end

      def set_allocation
        @allocation = SmResourceAllocation.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Allocation not found'
        }, status: :not_found
      end

      def allocation_params
        params.require(:sm_resource_allocation).permit(
          :resource_id,
          :allocated_hours,
          :allocated_quantity,
          :allocation_date,
          :status
        )
      end

      def allocation_to_json(allocation, include_details: false)
        json = {
          id: allocation.id,
          task_id: allocation.task_id,
          resource_id: allocation.resource_id,
          resource_name: allocation.resource.name,
          resource_type: allocation.resource.resource_type,
          allocated_hours: allocation.allocated_hours,
          allocated_quantity: allocation.allocated_quantity,
          allocation_date: allocation.allocation_date,
          status: allocation.status,
          created_at: allocation.created_at,
          updated_at: allocation.updated_at
        }

        if include_details
          json[:task] = {
            id: allocation.task_id,
            name: allocation.task.name,
            start_date: allocation.task.start_date,
            end_date: allocation.task.end_date,
            status: allocation.task.status
          }
          json[:resource] = {
            id: allocation.resource.id,
            name: allocation.resource.name,
            resource_type: allocation.resource.resource_type,
            hourly_rate: allocation.resource.hourly_rate,
            trade: allocation.resource.trade
          }
        end

        json
      end
    end
  end
end
