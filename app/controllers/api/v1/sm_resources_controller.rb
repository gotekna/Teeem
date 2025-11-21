# frozen_string_literal: true

module Api
  module V1
    class SmResourcesController < ApplicationController
      before_action :set_resource, only: [:show, :update, :destroy]

      # GET /api/v1/sm_resources
      def index
        @resources = SmResource.includes(:user).ordered

        # Filter by type
        @resources = @resources.where(resource_type: params[:type]) if params[:type].present?

        # Filter by active status
        @resources = @resources.active if params[:active_only] == 'true'

        render json: {
          success: true,
          resources: @resources.map { |r| resource_to_json(r) },
          meta: {
            total_count: SmResource.count,
            active_count: SmResource.active.count,
            by_type: {
              people: SmResource.people.count,
              equipment: SmResource.equipment.count,
              materials: SmResource.materials.count
            }
          }
        }
      end

      # GET /api/v1/sm_resources/:id
      def show
        render json: {
          success: true,
          resource: resource_to_json(@resource, include_allocations: true)
        }
      end

      # POST /api/v1/sm_resources
      def create
        @resource = SmResource.new(resource_params)

        if @resource.save
          render json: {
            success: true,
            message: 'Resource created successfully',
            resource: resource_to_json(@resource)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @resource.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_resources/:id
      def update
        if @resource.update(resource_params)
          render json: {
            success: true,
            resource: resource_to_json(@resource)
          }
        else
          render json: {
            success: false,
            errors: @resource.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_resources/:id
      def destroy
        # Check if resource has allocations or time entries
        if @resource.resource_allocations.exists? || @resource.time_entries.exists?
          # Soft delete by marking inactive
          @resource.update!(is_active: false)
          render json: {
            success: true,
            message: 'Resource deactivated (has associated allocations)'
          }
        else
          @resource.destroy
          render json: {
            success: true,
            message: 'Resource deleted successfully'
          }
        end
      end

      # GET /api/v1/sm_resources/availability
      # Check resource availability for a date range
      def availability
        start_date = Date.parse(params[:start_date])
        end_date = Date.parse(params[:end_date])

        resources = SmResource.active
        resources = resources.where(resource_type: params[:type]) if params[:type].present?

        availability_data = resources.map do |resource|
          allocated = resource.allocated_hours_for_range(start_date, end_date)
          logged = resource.logged_hours_for_range(start_date, end_date)
          days = (end_date - start_date).to_i + 1
          capacity = (resource.availability_hours_per_day || 8) * days

          {
            resource_id: resource.id,
            resource_name: resource.name,
            resource_type: resource.resource_type,
            capacity_hours: capacity,
            allocated_hours: allocated,
            logged_hours: logged,
            available_hours: capacity - allocated,
            utilization_percentage: capacity.positive? ? ((allocated / capacity) * 100).round(1) : 0
          }
        end

        render json: {
          success: true,
          start_date: start_date,
          end_date: end_date,
          availability: availability_data
        }
      rescue ArgumentError => e
        render json: {
          success: false,
          error: 'Invalid date format'
        }, status: :unprocessable_entity
      end

      private

      def set_resource
        @resource = SmResource.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Resource not found'
        }, status: :not_found
      end

      def resource_params
        params.require(:sm_resource).permit(
          :name,
          :code,
          :description,
          :resource_type,
          :user_id,
          :trade,
          :hourly_rate,
          :daily_rate,
          :unit,
          :unit_cost,
          :is_active,
          :availability_hours_per_day
        )
      end

      def resource_to_json(resource, include_allocations: false)
        json = {
          id: resource.id,
          name: resource.name,
          code: resource.code,
          description: resource.description,
          resource_type: resource.resource_type,
          user_id: resource.user_id,
          user_name: resource.user&.name,
          trade: resource.trade,
          hourly_rate: resource.hourly_rate,
          daily_rate: resource.daily_rate,
          unit: resource.unit,
          unit_cost: resource.unit_cost,
          is_active: resource.is_active,
          availability_hours_per_day: resource.availability_hours_per_day,
          created_at: resource.created_at,
          updated_at: resource.updated_at
        }

        if include_allocations
          json[:allocations] = resource.resource_allocations.includes(:task).limit(50).map do |alloc|
            {
              id: alloc.id,
              task_id: alloc.task_id,
              task_name: alloc.task.name,
              allocation_date: alloc.allocation_date,
              allocated_hours: alloc.allocated_hours,
              allocated_quantity: alloc.allocated_quantity,
              status: alloc.status
            }
          end
        end

        json
      end
    end
  end
end
