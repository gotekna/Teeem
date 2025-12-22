# frozen_string_literal: true

# Phase 5a: Add sm_task_id to WHS and Meeting models for migration from ProjectTask
#
# This is part of the SSoT consolidation from ProjectTask → SmTask
# We use dual-write during migration: both project_task_id and sm_task_id
# will be populated until migration is complete.
#
class AddSmTaskToSafetyModels < ActiveRecord::Migration[8.0]
  def change
    # WHS Action Items - creates tasks for corrective actions
    add_reference :whs_action_items, :sm_task, null: true, foreign_key: { to_table: :tasks }

    # WHS Incidents - creates tasks for incident follow-up
    add_reference :whs_incidents, :sm_task, null: true, foreign_key: { to_table: :tasks }

    # WHS SWMS - creates tasks for SWMS reviews
    add_reference :whs_swms, :sm_task, null: true, foreign_key: { to_table: :tasks }

    # Meeting Agenda Items - creates tasks from meeting actions
    add_reference :meeting_agenda_items, :sm_task, null: true, foreign_key: { to_table: :tasks }
  end
end
