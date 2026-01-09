# frozen_string_literal: true

# Phase 5: ProjectTask → SmTask Migration Tasks
#
# These tasks migrate existing WHS and Meeting records to use SmTask
# instead of ProjectTask. This is part of the SSoT consolidation.
#
# Usage:
#   rails phase5:backfill:all           # Backfill all models
#   rails phase5:backfill:whs_actions   # Backfill WHS Action Items only
#   rails phase5:backfill:whs_incidents # Backfill WHS Incidents only
#   rails phase5:backfill:whs_swms      # Backfill WHS SWMS only
#   rails phase5:backfill:meetings      # Backfill Meeting Agenda Items only
#   rails phase5:status                 # Show migration status
#
namespace :phase5 do
  desc "Show Phase 5 migration status"
  task status: :environment do
    puts "\n" + "=" * 60
    puts "Phase 5: ProjectTask → SmTask Migration Status"
    puts "=" * 60

    models = [
      { name: "WHS Action Items", model: WHSActionItem, old_fk: :project_task_id, new_fk: :sm_task_id },
      { name: "WHS Incidents", model: WHSIncident, old_fk: nil, new_fk: :sm_task_id },
      { name: "WHS SWMS", model: WHSSWMS, old_fk: nil, new_fk: :sm_task_id },
      { name: "Meeting Agenda Items", model: MeetingAgendaItem, old_fk: :created_task_id, new_fk: :sm_task_id }
    ]

    models.each do |m|
      total = m[:model].count
      with_sm_task = m[:model].where.not(sm_task_id: nil).count
      without_sm_task = m[:model].where(sm_task_id: nil).count

      if m[:old_fk]
        with_old = m[:model].where.not(m[:old_fk] => nil).count
        puts "\n#{m[:name]}:"
        puts "  Total: #{total}"
        puts "  With ProjectTask: #{with_old}"
        puts "  With SmTask: #{with_sm_task}"
        puts "  Needs migration: #{without_sm_task}"
      else
        puts "\n#{m[:name]}:"
        puts "  Total: #{total}"
        puts "  With SmTask: #{with_sm_task}"
        puts "  Needs migration: #{without_sm_task}"
      end
    end

    puts "\n" + "=" * 60
  end

  namespace :backfill do
    desc "Backfill all models with SmTask"
    task all: :environment do
      Rake::Task["phase5:backfill:whs_actions"].invoke
      Rake::Task["phase5:backfill:whs_incidents"].invoke
      Rake::Task["phase5:backfill:whs_swms"].invoke
      Rake::Task["phase5:backfill:meetings"].invoke

      puts "\n✅ All backfill tasks complete!"
      Rake::Task["phase5:status"].invoke
    end

    desc "Backfill WHS Action Items with SmTask"
    task whs_actions: :environment do
      puts "\n" + "-" * 40
      puts "Backfilling WHS Action Items..."
      puts "-" * 40

      migrated = 0
      skipped = 0
      failed = 0

      WHSActionItem.where(sm_task_id: nil).find_each do |item|
        # Skip if no job association
        job = Phase5MigrationHelpers.find_job_for_action_item(item)
        unless job
          skipped += 1
          next
        end

        # Skip if no assigned user
        unless item.assigned_to_user.present?
          skipped += 1
          next
        end

        begin
          task = job.sm_tasks.create!(
            name: "WHS: #{item.title}",
            description: item.description,
            trade: "WHS",
            stage: item.source_type,
            status: Phase5MigrationHelpers.action_item_status_to_sm(item.status),
            assigned_user: item.assigned_to_user,
            start_date: item.created_at.to_date,
            end_date: item.due_date || item.created_at.to_date + 7.days,
            duration_days: item.due_date ? [(item.due_date - item.created_at.to_date).to_i, 1].max : 7,
            created_by: item.created_by
          )
          item.update_column(:sm_task_id, task.id)
          migrated += 1
          print "."
        rescue StandardError => e
          failed += 1
          puts "\n  ❌ Failed to migrate action item #{item.id}: #{e.message}"
        end
      end

      puts "\n  Migrated: #{migrated}, Skipped: #{skipped}, Failed: #{failed}"
    end

    desc "Backfill WHS Incidents with SmTask"
    task whs_incidents: :environment do
      puts "\n" + "-" * 40
      puts "Backfilling WHS Incidents..."
      puts "-" * 40

      migrated = 0
      skipped = 0
      failed = 0

      WHSIncident.where(sm_task_id: nil).find_each do |incident|
        # Skip if no job
        unless incident.job.present?
          skipped += 1
          next
        end

        begin
          wphs_appointee = User.where(wphs_appointee: true).first

          task = incident.job.sm_tasks.create!(
            name: "WHS: Investigate Incident #{incident.incident_number}",
            description: "Investigate incident: #{incident.what_happened}",
            trade: "WHS",
            stage: "Incident Investigation",
            status: Phase5MigrationHelpers.incident_status_to_sm(incident.status),
            assigned_user: wphs_appointee,
            start_date: incident.incident_date || incident.created_at.to_date,
            end_date: (incident.incident_date || incident.created_at.to_date) + 3.days,
            duration_days: 3,
            created_by: incident.reported_by_user
          )
          incident.update_column(:sm_task_id, task.id)
          migrated += 1
          print "."
        rescue StandardError => e
          failed += 1
          puts "\n  ❌ Failed to migrate incident #{incident.id}: #{e.message}"
        end
      end

      puts "\n  Migrated: #{migrated}, Skipped: #{skipped}, Failed: #{failed}"
    end

    desc "Backfill WHS SWMS with SmTask"
    task whs_swms: :environment do
      puts "\n" + "-" * 40
      puts "Backfilling WHS SWMS..."
      puts "-" * 40

      migrated = 0
      skipped = 0
      failed = 0

      WHSSWMS.where(sm_task_id: nil).find_each do |swms|
        # Skip if no job (company-wide SWMS)
        unless swms.job.present?
          skipped += 1
          next
        end

        # Skip if created by WPHS Appointee (auto-approved, no task needed)
        if swms.created_by&.wphs_appointee?
          skipped += 1
          next
        end

        begin
          wphs_appointee = User.where(wphs_appointee: true).first

          task = swms.job.sm_tasks.create!(
            name: "WHS: Approve SWMS #{swms.swms_number}",
            description: "Review and approve: #{swms.title}",
            trade: "WHS",
            stage: "SWMS Approval",
            status: Phase5MigrationHelpers.swms_status_to_sm(swms.status),
            assigned_user: wphs_appointee,
            start_date: swms.created_at.to_date,
            end_date: swms.created_at.to_date + 2.days,
            duration_days: 1,
            created_by: swms.created_by
          )
          swms.update_column(:sm_task_id, task.id)
          migrated += 1
          print "."
        rescue StandardError => e
          failed += 1
          puts "\n  ❌ Failed to migrate SWMS #{swms.id}: #{e.message}"
        end
      end

      puts "\n  Migrated: #{migrated}, Skipped: #{skipped}, Failed: #{failed}"
    end

    desc "Backfill Meeting Agenda Items with SmTask"
    task meetings: :environment do
      puts "\n" + "-" * 40
      puts "Backfilling Meeting Agenda Items..."
      puts "-" * 40

      migrated = 0
      skipped = 0
      failed = 0

      # Only migrate items that have a created_task (action items)
      MeetingAgendaItem.where(sm_task_id: nil)
                       .where.not(created_task_id: nil)
                       .includes(meeting: :job)
                       .find_each do |item|
        # Skip if no job
        job = item.meeting&.job
        unless job.present?
          skipped += 1
          next
        end

        begin
          old_task = item.created_task

          task = job.sm_tasks.create!(
            name: "Meeting: #{old_task&.name || item.title}",
            description: "Action item from meeting: #{item.meeting.title}\n\nAgenda item: #{item.title}\n\n#{item.description}",
            trade: "Admin",
            stage: "Meeting Action",
            status: Phase5MigrationHelpers.project_task_status_to_sm(old_task&.status),
            assigned_user: old_task&.assigned_to,
            start_date: item.created_at.to_date,
            end_date: old_task&.planned_end_date || item.created_at.to_date + 7.days,
            duration_days: old_task&.duration_days || 7,
            created_by: item.meeting.organizer&.user
          )
          item.update_column(:sm_task_id, task.id)
          migrated += 1
          print "."
        rescue StandardError => e
          failed += 1
          puts "\n  ❌ Failed to migrate agenda item #{item.id}: #{e.message}"
        end
      end

      puts "\n  Migrated: #{migrated}, Skipped: #{skipped}, Failed: #{failed}"
    end
  end

end

# Helper module for Phase 5 migration
module Phase5MigrationHelpers
  module_function

  def find_job_for_action_item(item)
    case item.actionable_type
    when "WhsInspection"
      item.actionable&.job
    when "WhsIncident"
      item.actionable&.job
    when "WhsSwmsHazard"
      item.actionable&.whs_swms&.job
    else
      nil
    end
  end

  def action_item_status_to_sm(status)
    case status
    when "open" then "not_started"
    when "in_progress" then "started"
    when "completed" then "completed"
    when "cancelled" then "completed"
    else "not_started"
    end
  end

  def incident_status_to_sm(status)
    case status
    when "reported" then "not_started"
    when "under_investigation" then "started"
    when "actions_required" then "started"
    when "closed" then "completed"
    else "not_started"
    end
  end

  def swms_status_to_sm(status)
    case status
    when "draft" then "not_started"
    when "pending_approval" then "started"
    when "approved" then "completed"
    when "rejected" then "completed"
    when "superseded" then "completed"
    else "not_started"
    end
  end

  def project_task_status_to_sm(status)
    case status
    when "not_started" then "not_started"
    when "in_progress" then "started"
    when "completed" then "completed"
    when "cancelled" then "completed"
    else "not_started"
    end
  end
end
