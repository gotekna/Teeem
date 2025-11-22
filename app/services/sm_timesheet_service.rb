# frozen_string_literal: true

# SmTimesheetService - Manages time entries and timesheet operations for SM Gantt Phase 2
#
# Handles:
# - Time entry CRUD
# - Timesheet approval workflow
# - Payroll export
# - Time reports
#
# See GANTT_ARCHITECTURE_PLAN.md Section 16 (Phase 2)
#
class SmTimesheetService
  attr_reader :errors

  def initialize(user: nil)
    @user = user
    @errors = []
  end

  # Log time entry
  def log_time(task:, resource:, date:, hours:, entry_type: 'regular', description: nil, start_time: nil, end_time: nil, break_minutes: 0)
    @errors = []

    entry = SmTimeEntry.new(
      task: task,
      resource: resource,
      entry_date: date,
      total_hours: hours,
      entry_type: entry_type,
      description: description,
      start_time: start_time,
      end_time: end_time,
      break_minutes: break_minutes,
      created_by: @user
    )

    # Try to link to an allocation
    allocation = SmResourceAllocation.find_by(
      task: task,
      resource: resource,
      allocation_date: date
    )
    entry.allocation = allocation if allocation

    if entry.save
      # Update allocation status if linked
      allocation&.update(status: 'in_progress') if allocation&.planned?

      { success: true, time_entry: entry, errors: [] }
    else
      { success: false, time_entry: nil, errors: entry.errors.full_messages }
    end
  end

  # Get timesheet for a resource and date range
  def timesheet_for_resource(resource_id:, start_date:, end_date:)
    resource = SmResource.find(resource_id)

    entries = resource.time_entries
      .includes(:task, :approved_by)
      .where(entry_date: start_date..end_date)
      .ordered

    # Group by date
    by_date = entries.group_by(&:entry_date)

    {
      resource: {
        id: resource.id,
        name: resource.name,
        type: resource.resource_type,
        trade: resource.trade,
        hourly_rate: resource.hourly_rate.to_f
      },
      period: { start_date: start_date, end_date: end_date },
      summary: {
        total_hours: entries.sum(&:total_hours).to_f,
        regular_hours: entries.regular.sum(&:total_hours).to_f,
        overtime_hours: entries.overtime.sum(&:total_hours).to_f,
        approved_hours: entries.approved.sum(&:total_hours).to_f,
        pending_hours: entries.pending_approval.sum(&:total_hours).to_f,
        entry_count: entries.count
      },
      days: (start_date..end_date).map do |date|
        day_entries = by_date[date] || []
        {
          date: date,
          day_name: date.strftime('%A'),
          is_weekend: date.saturday? || date.sunday?,
          total_hours: day_entries.sum(&:total_hours).to_f,
          entries: day_entries.map { |e| entry_to_json(e) }
        }
      end
    }
  end

  # Get timesheet for a task
  def timesheet_for_task(task_id:)
    task = SmTask.find(task_id)

    entries = task.time_entries
      .includes(:resource, :approved_by)
      .ordered

    {
      task: {
        id: task.id,
        name: task.name,
        task_number: task.task_number,
        start_date: task.start_date,
        end_date: task.end_date
      },
      summary: {
        total_hours: entries.sum(&:total_hours).to_f,
        approved_hours: entries.approved.sum(&:total_hours).to_f,
        pending_hours: entries.pending_approval.sum(&:total_hours).to_f
      },
      by_resource: entries.group_by(&:resource).map do |resource, res_entries|
        {
          resource_id: resource.id,
          resource_name: resource.name,
          total_hours: res_entries.sum(&:total_hours).to_f,
          entries: res_entries.map { |e| entry_to_json(e) }
        }
      end
    }
  end

  # Approve time entries
  def approve_entries(entry_ids:, approver:)
    @errors = []
    approved = []

    entry_ids.each do |entry_id|
      entry = SmTimeEntry.find_by(id: entry_id)
      next unless entry
      next if entry.approved?

      entry.approve!(approver)
      approved << entry
    end

    { success: true, approved_count: approved.count, entries: approved }
  end

  # Reject/delete time entry
  def reject_entry(entry_id:, reason: nil)
    entry = SmTimeEntry.find_by(id: entry_id)
    return { success: false, errors: ['Entry not found'] } unless entry
    return { success: false, errors: ['Cannot delete approved entry'] } if entry.approved?

    entry.destroy
    { success: true }
  end

  # Get pending approvals (for managers)
  def pending_approvals(limit: 50)
    entries = SmTimeEntry
      .pending_approval
      .includes(:task, :resource, :created_by)
      .order(entry_date: :desc)
      .limit(limit)

    entries.map { |e| entry_to_json(e) }
  end

  # Export timesheet for payroll
  def export_for_payroll(start_date:, end_date:, resource_ids: nil)
    entries = SmTimeEntry
      .approved
      .includes(:task, :resource)
      .where(entry_date: start_date..end_date)
      .ordered

    entries = entries.where(resource_id: resource_ids) if resource_ids.present?

    # Group by resource
    entries.group_by(&:resource).map do |resource, res_entries|
      regular = res_entries.select(&:regular?).sum(&:total_hours)
      overtime = res_entries.select(&:overtime?).sum(&:total_hours)
      travel = res_entries.select(&:travel?).sum(&:total_hours)
      standby = res_entries.select(&:standby?).sum(&:total_hours)

      {
        resource_id: resource.id,
        resource_code: resource.code,
        resource_name: resource.name,
        resource_type: resource.resource_type,
        user_id: resource.user_id,
        hourly_rate: resource.hourly_rate.to_f,
        period: { start_date: start_date, end_date: end_date },
        hours: {
          regular: regular.to_f,
          overtime: overtime.to_f,
          travel: travel.to_f,
          standby: standby.to_f,
          total: res_entries.sum(&:total_hours).to_f
        },
        cost: {
          regular: (regular * (resource.hourly_rate || 0)).to_f.round(2),
          overtime: (overtime * (resource.hourly_rate || 0) * 1.5).to_f.round(2), # 1.5x overtime
          total: ((regular + overtime * 1.5 + travel + standby) * (resource.hourly_rate || 0)).to_f.round(2)
        },
        entries: res_entries.map { |e| entry_to_json(e, include_task: true) }
      }
    end
  end

  # Weekly summary for a resource
  def weekly_summary(resource_id:, week_start:)
    week_end = week_start + 6.days
    resource = SmResource.find(resource_id)

    entries = resource.time_entries
      .where(entry_date: week_start..week_end)
      .ordered

    (week_start..week_end).map do |date|
      day_entries = entries.select { |e| e.entry_date == date }
      {
        date: date,
        day_name: date.strftime('%a'),
        hours: day_entries.sum(&:total_hours).to_f,
        entry_count: day_entries.count,
        is_approved: day_entries.all?(&:approved?)
      }
    end
  end

  private

  def entry_to_json(entry, include_task: false)
    json = {
      id: entry.id,
      entry_date: entry.entry_date,
      start_time: entry.start_time&.strftime('%H:%M'),
      end_time: entry.end_time&.strftime('%H:%M'),
      break_minutes: entry.break_minutes,
      total_hours: entry.total_hours.to_f,
      entry_type: entry.entry_type,
      description: entry.description,
      approved: entry.approved?,
      approved_at: entry.approved_at,
      approved_by: entry.approved_by&.slice(:id, :first_name, :last_name),
      created_at: entry.created_at
    }

    if include_task
      json[:task] = {
        id: entry.task.id,
        name: entry.task.name,
        task_number: entry.task.task_number
      }
    end

    json
  end
end
