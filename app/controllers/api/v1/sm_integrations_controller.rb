# frozen_string_literal: true

module Api
  module V1
    class SmIntegrationsController < ApplicationController
      before_action :set_construction, only: [:export_ms_project, :sync_calendar, :calendar_events]

      # ==========================================
      # MS PROJECT INTEGRATION
      # ==========================================

      # POST /api/v1/sm_integrations/import_ms_project
      def import_ms_project
        construction = Construction.find(params[:construction_id])

        unless params[:file].present?
          return render json: { success: false, error: 'No file provided' }, status: :bad_request
        end

        xml_content = params[:file].read
        result = SmMsProjectService.import(construction, xml_content)

        if result[:success]
          render json: {
            success: true,
            message: "Imported #{result[:tasks_imported]} tasks",
            tasks: result[:tasks]
          }, status: :created
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_integrations/export_ms_project
      def export_ms_project
        xml_content = SmMsProjectService.export(@construction)

        send_data xml_content,
                  filename: "#{@construction.name.parameterize}-schedule.xml",
                  type: 'application/xml',
                  disposition: 'attachment'
      end

      # ==========================================
      # CALENDAR SYNC
      # ==========================================

      # POST /api/v1/sm_integrations/sync_calendar
      def sync_calendar
        provider = params[:provider] # 'google' or 'outlook'
        tasks = @construction.sm_tasks.where.not(status: 'completed')

        events_synced = 0

        tasks.each do |task|
          event_data = {
            title: task.name,
            description: "#{task.trade} - #{@construction.name}",
            start_time: task.start_date&.beginning_of_day,
            end_time: task.end_date&.end_of_day,
            location: @construction.address
          }

          case provider
          when 'google'
            sync_to_google_calendar(event_data, task)
          when 'outlook'
            sync_to_outlook_calendar(event_data, task)
          end

          events_synced += 1
        end

        render json: {
          success: true,
          provider: provider,
          events_synced: events_synced
        }
      end

      # GET /api/v1/sm_integrations/calendar_events
      def calendar_events
        tasks = @construction.sm_tasks.includes(:supplier)

        events = tasks.map do |task|
          {
            id: task.id,
            title: task.name,
            start: task.start_date,
            end: task.end_date,
            color: status_color(task.status),
            extendedProps: {
              trade: task.trade,
              status: task.status,
              supplier: task.supplier&.name
            }
          }
        end

        render json: {
          success: true,
          events: events
        }
      end

      # ==========================================
      # NOTIFICATIONS
      # ==========================================

      # POST /api/v1/sm_integrations/send_notification
      def send_notification
        notification_type = params[:type]
        recipients = params[:recipients] || []
        task_id = params[:task_id]

        task = SmTask.find_by(id: task_id)

        case notification_type
        when 'task_reminder'
          send_task_reminder(task, recipients)
        when 'schedule_update'
          send_schedule_update(task, recipients)
        when 'delay_alert'
          send_delay_alert(task, recipients)
        when 'completion_notice'
          send_completion_notice(task, recipients)
        else
          return render json: { success: false, error: 'Invalid notification type' }, status: :bad_request
        end

        render json: {
          success: true,
          notification_type: notification_type,
          recipients_count: recipients.size
        }
      end

      # GET /api/v1/sm_integrations/notification_settings
      def notification_settings
        settings = SmNotificationSetting.find_or_create_by(user: current_user)

        render json: {
          success: true,
          settings: {
            email_task_reminders: settings.email_task_reminders,
            email_schedule_updates: settings.email_schedule_updates,
            email_delay_alerts: settings.email_delay_alerts,
            push_enabled: settings.push_enabled,
            push_token: settings.push_token.present?,
            reminder_days_before: settings.reminder_days_before
          }
        }
      end

      # PATCH /api/v1/sm_integrations/notification_settings
      def update_notification_settings
        settings = SmNotificationSetting.find_or_create_by(user: current_user)

        if settings.update(notification_settings_params)
          render json: { success: true }
        else
          render json: { success: false, errors: settings.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def set_construction
        @construction = Construction.find(params[:construction_id])
      end

      def notification_settings_params
        params.permit(
          :email_task_reminders,
          :email_schedule_updates,
          :email_delay_alerts,
          :push_enabled,
          :push_token,
          :reminder_days_before
        )
      end

      def status_color(status)
        case status
        when 'completed' then '#10b981' # green
        when 'started' then '#3b82f6'   # blue
        else '#9ca3af' # gray
        end
      end

      # Calendar sync helpers
      def sync_to_google_calendar(event_data, task)
        # Placeholder - would use Google Calendar API
        # Requires OAuth token from user
        Rails.logger.info("Would sync to Google Calendar: #{event_data[:title]}")
      end

      def sync_to_outlook_calendar(event_data, task)
        # Placeholder - would use Microsoft Graph API
        # Requires OAuth token from user
        Rails.logger.info("Would sync to Outlook: #{event_data[:title]}")
      end

      # Notification helpers
      def send_task_reminder(task, recipients)
        return unless task

        recipients.each do |recipient|
          # Email notification
          SmNotificationMailer.task_reminder(
            to: recipient,
            task: task
          ).deliver_later

          # Push notification if enabled
          send_push_notification(
            recipient,
            title: 'Task Reminder',
            body: "#{task.name} starts on #{task.start_date&.strftime('%b %d')}"
          )
        end
      end

      def send_schedule_update(task, recipients)
        return unless task

        recipients.each do |recipient|
          SmNotificationMailer.schedule_update(
            to: recipient,
            task: task
          ).deliver_later
        end
      end

      def send_delay_alert(task, recipients)
        return unless task

        recipients.each do |recipient|
          SmNotificationMailer.delay_alert(
            to: recipient,
            task: task
          ).deliver_later

          send_push_notification(
            recipient,
            title: 'Delay Alert',
            body: "#{task.name} may be delayed",
            priority: 'high'
          )
        end
      end

      def send_completion_notice(task, recipients)
        return unless task

        recipients.each do |recipient|
          SmNotificationMailer.completion_notice(
            to: recipient,
            task: task
          ).deliver_later
        end
      end

      def send_push_notification(recipient, title:, body:, priority: 'normal')
        settings = SmNotificationSetting.find_by(user_id: recipient)
        return unless settings&.push_enabled && settings&.push_token.present?

        # Placeholder for FCM/APNs integration
        Rails.logger.info("Would send push: #{title} - #{body} to #{settings.push_token}")
      end
    end
  end
end
