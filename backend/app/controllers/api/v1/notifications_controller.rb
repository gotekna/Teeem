# frozen_string_literal: true

module Api
  module V1
    class NotificationsController < ApplicationController
      before_action :set_notification, only: [ :mark_read ]

      # GET /api/v1/notifications
      def index
        @notifications = current_user.notifications.recent.includes(:notifiable)

        render json: {
          success: true,
          notifications: @notifications.map { |n| notification_to_json(n) },
          unread_count: current_user.notifications.unread.count
        }
      end

      # GET /api/v1/notifications/unread_count
      def unread_count
        render json: {
          success: true,
          unread_count: current_user.notifications.unread.count
        }
      end

      # PATCH /api/v1/notifications/:id/mark_read
      def mark_read
        @notification.mark_as_read!

        render json: {
          success: true,
          notification: notification_to_json(@notification)
        }
      end

      # POST /api/v1/notifications/mark_all_read
      def mark_all_read
        Notification.mark_all_read_for_user!(current_user)

        render json: {
          success: true,
          message: "All notifications marked as read"
        }
      end

      # DELETE /api/v1/notifications/clear_all
      def clear_all
        count = current_user.notifications.count
        current_user.notifications.destroy_all

        render json: {
          success: true,
          message: "#{count} notifications cleared"
        }
      end

      private

      def set_notification
        @notification = current_user.notifications.find(params[:id])
      end

      def notification_to_json(notification)
        {
          id: notification.id,
          notification_type: notification.notification_type,
          title: notification.title,
          message: notification.message,
          read: notification.read,
          created_at: notification.created_at,
          notifiable_type: notification.notifiable_type,
          notifiable_id: notification.notifiable_id,
          # Add link based on notifiable type
          link: notification_link(notification)
        }
      end

      def notification_link(notification)
        case notification.notifiable_type
        when "SmTask"
          "/tasks" # For now, link to tasks page
        else
          nil
        end
      end
    end
  end
end
