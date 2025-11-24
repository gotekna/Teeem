# frozen_string_literal: true

module Api
  module V1
    class SmActivitiesController < ApplicationController
      before_action :set_construction, only: [:index, :feed]

      # GET /api/v1/constructions/:construction_id/activities
      # GET /api/v1/sm_activities
      def index
        activities = SmActivityService.feed(
          construction_id: @construction&.id || params[:construction_id],
          filters: activity_filters
        )

        render json: {
          success: true,
          activities: activities.map { |a| activity_json(a) },
          filters: activity_filters,
          total: activities.count
        }
      end

      # GET /api/v1/sm_activities/feed
      # Real-time feed with polling support
      def feed
        since = params[:since] ? Time.parse(params[:since]) : 1.hour.ago

        activities = SmActivity
                     .for_construction(@construction.id)
                     .where('created_at > ?', since)
                     .recent
                     .limit(50)

        render json: {
          success: true,
          activities: activities.map { |a| activity_json(a) },
          since: since,
          latest: activities.first&.created_at,
          count: activities.count
        }
      end

      # GET /api/v1/sm_tasks/:task_id/activities
      def task_activities
        task = SmTask.find(params[:task_id])
        activities = SmActivity.for_task(task.id).recent.limit(params[:limit] || 50)

        render json: {
          success: true,
          task_id: task.id,
          activities: activities.map { |a| activity_json(a) }
        }
      end

      # GET /api/v1/sm_activities/my_activity
      def my_activity
        activities = SmActivity
                     .for_user(current_user.id)
                     .recent
                     .limit(params[:limit] || 50)

        render json: {
          success: true,
          activities: activities.map { |a| activity_json(a) }
        }
      end

      # GET /api/v1/sm_activities/summary
      def summary
        construction_id = params[:construction_id]

        today_count = SmActivity.for_construction(construction_id).today.count
        week_count = SmActivity.for_construction(construction_id).this_week.count

        # Activity breakdown by type
        type_breakdown = SmActivity
                         .for_construction(construction_id)
                         .this_week
                         .group(:activity_type)
                         .count

        # Most active users this week
        active_users = SmActivity
                       .for_construction(construction_id)
                       .this_week
                       .where.not(user_id: nil)
                       .group(:user_id)
                       .count
                       .sort_by { |_k, v| -v }
                       .first(5)
                       .map do |user_id, count|
                         user = User.find_by(id: user_id)
                         { user_id: user_id, name: user&.full_name, count: count }
                       end

        render json: {
          success: true,
          construction_id: construction_id,
          today: today_count,
          this_week: week_count,
          by_type: type_breakdown,
          active_users: active_users
        }
      end

      private

      def set_construction
        @construction = Construction.find(params[:construction_id]) if params[:construction_id]
      end

      def activity_filters
        {
          task_id: params[:task_id],
          user_id: params[:user_id],
          resource_id: params[:resource_id],
          type: params[:type],
          since: params[:since],
          today: params[:today] == 'true',
          this_week: params[:this_week] == 'true',
          limit: params[:limit]&.to_i || 50
        }.compact
      end

      def activity_json(activity)
        metadata = begin
          JSON.parse(activity.metadata || '{}')
        rescue StandardError
          {}
        end

        {
          id: activity.id,
          type: activity.activity_type,
          icon: activity.icon,
          color: activity.color,
          message: activity.formatted_message,
          actor: {
            id: activity.user_id || activity.resource_id,
            name: activity.actor_name,
            type: activity.user_id ? 'user' : 'resource'
          },
          task: activity.task ? {
            id: activity.task.id,
            name: activity.task.name
          } : nil,
          construction_id: activity.construction_id,
          metadata: metadata,
          created_at: activity.created_at,
          time_ago: time_ago_in_words(activity.created_at)
        }
      end

      def time_ago_in_words(time)
        seconds = (Time.current - time).to_i

        case seconds
        when 0..59 then 'just now'
        when 60..3599 then "#{seconds / 60}m ago"
        when 3600..86_399 then "#{seconds / 3600}h ago"
        when 86_400..604_799 then "#{seconds / 86_400}d ago"
        else time.strftime('%b %d')
        end
      end
    end
  end
end
