# frozen_string_literal: true

class SmNotificationMailer < ApplicationMailer
  default from: 'notifications@trapid.com.au'

  def task_reminder(to:, task:)
    @task = task
    @construction = task.construction

    mail(
      to: to,
      subject: "Reminder: #{task.name} starts #{task.start_date&.strftime('%b %d')}"
    )
  end

  def schedule_update(to:, task:)
    @task = task
    @construction = task.construction

    mail(
      to: to,
      subject: "Schedule Update: #{task.name}"
    )
  end

  def delay_alert(to:, task:)
    @task = task
    @construction = task.construction

    mail(
      to: to,
      subject: "Delay Alert: #{task.name} - Action Required"
    )
  end

  def completion_notice(to:, task:)
    @task = task
    @construction = task.construction

    mail(
      to: to,
      subject: "Task Completed: #{task.name}"
    )
  end

  def daily_digest(to:, user:, constructions:)
    @user = user
    @constructions = constructions
    @tasks_due_today = SmTask.where(construction_id: constructions.pluck(:id))
                             .where(start_date: Date.current)
                             .where.not(status: 'completed')

    mail(
      to: to,
      subject: "Daily Schedule Digest - #{Date.current.strftime('%b %d, %Y')}"
    )
  end
end
