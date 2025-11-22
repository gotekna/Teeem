# frozen_string_literal: true

# SmResourceService - Manages resources and capacity planning for SM Gantt Phase 2
#
# Handles:
# - Resource CRUD operations
# - Capacity calculations
# - Availability checking
# - Utilization reports
#
# See GANTT_ARCHITECTURE_PLAN.md Section 16 (Phase 2)
#
class SmResourceService
  attr_reader :errors

  def initialize
    @errors = []
  end

  # Get resource utilization for a date range
  def utilization_report(start_date:, end_date:, resource_ids: nil)
    resources = SmResource.active.ordered
    resources = resources.where(id: resource_ids) if resource_ids.present?

    resources.map do |resource|
      allocated = resource.allocated_hours_for_range(start_date, end_date)
      logged = resource.logged_hours_for_range(start_date, end_date)
      working_days = calculate_working_days(start_date, end_date)
      capacity = working_days * (resource.availability_hours_per_day || 8.0)

      {
        resource_id: resource.id,
        resource_name: resource.name,
        resource_type: resource.resource_type,
        trade: resource.trade,
        period: { start_date: start_date, end_date: end_date },
        capacity_hours: capacity,
        allocated_hours: allocated.to_f,
        logged_hours: logged.to_f,
        utilization_percent: capacity > 0 ? ((allocated / capacity) * 100).round(1) : 0,
        variance_hours: (allocated - logged).to_f.round(2),
        daily_breakdown: daily_breakdown(resource, start_date, end_date)
      }
    end
  end

  # Get availability for a specific date
  def availability_for_date(date, resource_type: nil)
    resources = SmResource.active.ordered
    resources = resources.where(resource_type: resource_type) if resource_type.present?

    resources.map do |resource|
      allocated_hours = resource.resource_allocations
        .where(allocation_date: date)
        .sum(:allocated_hours)
      capacity = resource.availability_hours_per_day || 8.0
      available = [capacity - allocated_hours, 0].max

      {
        resource_id: resource.id,
        resource_name: resource.name,
        resource_type: resource.resource_type,
        trade: resource.trade,
        date: date,
        capacity_hours: capacity,
        allocated_hours: allocated_hours.to_f,
        available_hours: available.to_f,
        is_available: available > 0
      }
    end
  end

  # Find available resources for a task
  def find_available_for_task(task, required_hours:, resource_type: nil)
    return [] unless task.start_date && task.end_date

    resources = SmResource.active.ordered
    resources = resources.where(resource_type: resource_type) if resource_type.present?

    available_resources = []

    resources.each do |resource|
      # Check each day of the task
      can_allocate = true
      (task.start_date..task.end_date).each do |date|
        allocated = resource.resource_allocations
          .where(allocation_date: date)
          .sum(:allocated_hours)
        capacity = resource.availability_hours_per_day || 8.0

        if (allocated + required_hours) > capacity
          can_allocate = false
          break
        end
      end

      available_resources << resource if can_allocate
    end

    available_resources
  end

  # Allocate resource to task
  def allocate_to_task(task:, resource:, hours_per_day:, dates: nil)
    dates ||= (task.start_date..task.end_date).to_a
    allocations = []
    @errors = []

    ActiveRecord::Base.transaction do
      dates.each do |date|
        # Check capacity
        existing = resource.resource_allocations
          .where(allocation_date: date)
          .sum(:allocated_hours)
        capacity = resource.availability_hours_per_day || 8.0

        if (existing + hours_per_day) > capacity
          @errors << "Resource #{resource.name} is over-allocated on #{date}"
          raise ActiveRecord::Rollback
        end

        allocation = SmResourceAllocation.find_or_initialize_by(
          task: task,
          resource: resource,
          allocation_date: date
        )
        allocation.allocated_hours = hours_per_day
        allocation.status = 'planned'
        allocation.save!
        allocations << allocation
      end
    end

    if @errors.any?
      { success: false, errors: @errors, allocations: [] }
    else
      { success: true, errors: [], allocations: allocations }
    end
  end

  # Remove allocation
  def remove_allocation(allocation)
    allocation.destroy
    { success: true }
  rescue StandardError => e
    { success: false, errors: [e.message] }
  end

  # Get resource schedule (Gantt data format)
  def resource_schedule(resource_id:, start_date:, end_date:)
    resource = SmResource.find(resource_id)

    allocations = resource.resource_allocations
      .includes(:task)
      .where(allocation_date: start_date..end_date)
      .order(:allocation_date)

    # Group by task
    tasks_data = allocations.group_by(&:task).map do |task, task_allocations|
      dates = task_allocations.map(&:allocation_date)
      {
        task_id: task.id,
        task_name: task.name,
        task_number: task.task_number,
        start_date: dates.min,
        end_date: dates.max,
        total_hours: task_allocations.sum(&:allocated_hours).to_f,
        status: task.status,
        allocations: task_allocations.map do |a|
          { date: a.allocation_date, hours: a.allocated_hours.to_f, status: a.status }
        end
      }
    end

    {
      resource: {
        id: resource.id,
        name: resource.name,
        type: resource.resource_type,
        trade: resource.trade,
        hourly_rate: resource.hourly_rate.to_f
      },
      period: { start_date: start_date, end_date: end_date },
      tasks: tasks_data
    }
  end

  private

  def calculate_working_days(start_date, end_date)
    calculator = WorkingDaysCalculator.new
    calculator.working_days_between(start_date, end_date)
  rescue StandardError
    # Fallback: simple weekday calculation
    (start_date..end_date).count { |d| (1..5).cover?(d.wday) }
  end

  def daily_breakdown(resource, start_date, end_date)
    (start_date..end_date).map do |date|
      allocated = resource.resource_allocations
        .where(allocation_date: date)
        .sum(:allocated_hours)
      logged = resource.time_entries
        .where(entry_date: date)
        .sum(:total_hours)

      {
        date: date,
        allocated_hours: allocated.to_f,
        logged_hours: logged.to_f
      }
    end
  end
end
