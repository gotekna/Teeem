# frozen_string_literal: true

# SmTaskStartService - Handles task start and workflow triggering
#
# When a task is started, this service:
# 1. Fires the linked start workflow if configured
# 2. Marks the workflow as fired to prevent duplicates
#
class SmTaskStartService
  attr_reader :task, :user, :errors

  def initialize(task, user: nil)
    @task = task
    @user = user
    @errors = []
  end

  # Start a task and fire configured workflows
  # Returns { success: bool, task: SmTask, workflow_started: bool, errors: [] }
  def start!
    return already_started_result if task.start_workflow_fired?
    return workflow_disabled_result unless should_fire_workflow?

    ActiveRecord::Base.transaction do
      fire_start_workflow
      mark_workflow_fired
      success_result
    end
  rescue StandardError => e
    @errors << "Start workflow failed: #{e.message}"
    Rails.logger.error("SmTaskStartService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    failure_result
  end

  private

  def should_fire_workflow?
    task.start_workflow_enabled? && task.start_workflow_id.present?
  end

  def fire_start_workflow
    workflow = task.start_workflow
    return unless workflow

    # Fire the BPMN workflow with task context
    Bpmn::EngineService.start_process(
      process_id: workflow.id,
      subject: task.job,
      variables: workflow_variables,
      triggered_by: "task_start"
    )

    Rails.logger.info("[SmTaskStartService] Fired workflow '#{workflow.name}' for task #{task.id} (#{task.name})")
  end

  def workflow_variables
    {
      task_id: task.id,
      task_name: task.name,
      task_number: task.task_number,
      job_id: task.job_id,
      job_code: task.job&.job_code,
      started_by_user_id: user&.id,
      started_at: Time.current.iso8601
    }
  end

  def mark_workflow_fired
    task.update_column(:start_workflow_fired, true)
  end

  def success_result
    {
      success: true,
      task: task,
      workflow_started: true,
      errors: []
    }
  end

  def failure_result
    {
      success: false,
      task: task,
      workflow_started: false,
      errors: @errors
    }
  end

  def already_started_result
    {
      success: true,
      task: task,
      workflow_started: false,
      errors: ["Start workflow already fired for this task"]
    }
  end

  def workflow_disabled_result
    {
      success: true,
      task: task,
      workflow_started: false,
      errors: []
    }
  end
end
