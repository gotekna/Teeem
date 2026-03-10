# frozen_string_literal: true

module Api
  module V1
    module Sda
      class NotificationsController < ApplicationController
        before_action :set_notification, only: [:show, :update, :acknowledge, :retry_send]

        # GET /api/v1/sda/notifications
        def index
          notifications = SdaNotification
            .includes(:property, :recipient_user, :recipient_contact)
            .order(created_at: :desc)

          notifications = apply_filters(notifications)

          render_success(notifications.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            recipient_user: { only: [:id, :name, :email] },
            recipient_contact: { only: [:id, :display_name] }
          }))
        end

        # GET /api/v1/sda/notifications/:id
        def show
          render_success(@notification.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            recipient_user: { only: [:id, :name, :email] },
            recipient_contact: { only: [:id, :display_name] }
          }))
        end

        # POST /api/v1/sda/notifications
        def create
          notification = SdaNotification.new(notification_params)

          if notification.save
            render_success(notification, status: :created)
          else
            render_validation_errors(notification)
          end
        end

        # PATCH /api/v1/sda/notifications/:id
        def update
          if @notification.update(notification_params)
            render_success(@notification)
          else
            render_validation_errors(@notification)
          end
        end

        # POST /api/v1/sda/notifications/:id/acknowledge
        def acknowledge
          @notification.update!(
            status: "acknowledged",
            acknowledged_at: Time.current
          )
          render_success(@notification)
        end

        # POST /api/v1/sda/notifications/:id/retry_send
        def retry_send
          unless @notification.status == "failed"
            return render_error("Only failed notifications can be retried", status: :unprocessable_entity)
          end

          @notification.update!(status: "pending")
          render_success(@notification)
        end

        # GET /api/v1/sda/notifications/overdue
        def overdue
          SdaNotification.pending.find_each(&:check_overdue!)

          notifications = SdaNotification
            .includes(:property, :recipient_user)
            .overdue
            .order(due_at: :asc)

          render_success(notifications.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            recipient_user: { only: [:id, :name, :email] }
          }))
        end

        # GET /api/v1/sda/notifications/dashboard
        def dashboard
          pending = SdaNotification.pending.count
          failed = SdaNotification.failed.count
          overdue_count = SdaNotification.overdue.count
          sent_today = SdaNotification.where("sent_at >= ?", Date.current.beginning_of_day).count

          by_type = SdaNotification::NOTIFICATION_TYPES.index_with do |type|
            SdaNotification.where(notification_type: type).count
          end.reject { |_, v| v.zero? }

          by_channel = SdaNotification::CHANNELS.index_with do |ch|
            SdaNotification.where(channel: ch).count
          end.reject { |_, v| v.zero? }

          render_success({
            pending: pending,
            failed: failed,
            overdue: overdue_count,
            sentToday: sent_today,
            byType: by_type,
            byChannel: by_channel
          })
        end

        private

        def set_notification
          @notification = SdaNotification.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Notification not found", status: :not_found)
        end

        def notification_params
          params.require(:sda_notification).permit(
            :property_id, :notification_type, :channel,
            :status, :priority, :notifiable_type, :notifiable_id,
            :recipient_user_id, :recipient_contact_id,
            :recipient_email, :recipient_phone,
            :subject, :body, :due_at
          )
        end

        def apply_filters(scope)
          scope = scope.where(notification_type: params[:notification_type]) if params[:notification_type].present?
          scope = scope.where(channel: params[:channel]) if params[:channel].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(priority: params[:priority]) if params[:priority].present?
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope
        end
      end
    end
  end
end
