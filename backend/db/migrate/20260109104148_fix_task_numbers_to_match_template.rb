# frozen_string_literal: true

# Migration to fix task_number values in sm_tasks to match sm_schedule_masters
#
# Problem: sm_task.task_number was assigned sequentially per-job (1, 2, 3...)
# instead of using sm_schedule_master.task_number (which equals sm_schedule_master.id)
#
# Solution:
# 1. Fix sm_schedule_masters: ensure task_number = id for all rows
# 2. For each job, remap predecessor_ids and header_gantt to new task_numbers
# 3. Update sm_task.task_number to match sm_schedule_master.task_number
# 4. Manual tasks (no template) get task_number = 0
#
class FixTaskNumbersToMatchTemplate < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def up
    say_with_time "Fixing task_numbers to match template..." do
      # Phase 1: Fix sm_schedule_masters where task_number != id
      mismatched_count = execute(<<~SQL).cmd_tuples
        UPDATE sm_schedule_masters
        SET task_number = id
        WHERE id != task_number
      SQL
      say "Fixed #{mismatched_count} mismatched sm_schedule_masters", true

      # Phase 2: Fix sm_tasks for each job
      total_tasks_fixed = 0
      total_preds_fixed = 0
      total_headers_fixed = 0

      Job.find_each do |job|
        tasks = job.sm_tasks.where.not(sm_schedule_master_id: nil).includes(:sm_schedule_master)
        next if tasks.empty?

        # Build mapping: old task_number -> new task_number (= sm_schedule_master.task_number)
        mapping = {}
        tasks.each do |t|
          next unless t.sm_schedule_master
          mapping[t.task_number] = t.sm_schedule_master.task_number
        end

        # Skip if all task_numbers already match (nothing to remap)
        next if mapping.all? { |old_tn, new_tn| old_tn == new_tn }

        # Remap predecessor_ids
        job.sm_tasks.where.not(predecessor_ids: nil).find_each do |task|
          next if task.predecessor_ids.blank?

          new_preds = task.predecessor_ids.map do |pred|
            old_id = (pred["id"] || pred[:id]).to_i
            new_id = mapping[old_id]
            next nil unless new_id
            { "id" => new_id, "type" => pred["type"] || "FS", "lag" => (pred["lag"] || 0).to_i }
          end.compact

          if new_preds != task.predecessor_ids
            task.update_column(:predecessor_ids, new_preds)
            total_preds_fixed += 1
          end
        end

        # Remap header_gantt (integer references to parent task_number)
        job.sm_tasks.where.not(header_gantt: nil).find_each do |task|
          header = task.header_gantt
          next unless header.is_a?(Integer) || (header.is_a?(String) && header.match?(/^\d+$/))

          old_parent = header.to_i
          new_parent = mapping[old_parent]
          if new_parent && new_parent != old_parent
            task.update_column(:header_gantt, new_parent)
            total_headers_fixed += 1
          end
        end

        # Update task_numbers to match template
        tasks.find_each do |task|
          next unless task.sm_schedule_master
          new_tn = task.sm_schedule_master.task_number
          if task.task_number != new_tn
            task.update_column(:task_number, new_tn)
            total_tasks_fixed += 1
          end
        end
      end

      say "Fixed #{total_tasks_fixed} task_numbers", true
      say "Remapped #{total_preds_fixed} predecessor_ids", true
      say "Remapped #{total_headers_fixed} header_gantt references", true

      # Phase 3: Set manual tasks (no template) to task_number = 0
      manual_count = SmTask.where(sm_schedule_master_id: nil).where.not(task_number: 0).update_all(task_number: 0)
      say "Set #{manual_count} manual tasks to task_number = 0", true
    end
  end

  def down
    say "This migration cannot be fully reversed - task_numbers have been changed"
    say "Manual intervention required if you need to revert"
  end
end
