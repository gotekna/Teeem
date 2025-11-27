# frozen_string_literal: true

module Api
  module V1
    class SmCommentsController < ApplicationController
      before_action :set_task, only: [:index, :create]
      before_action :set_comment, only: [:show, :update, :destroy, :replies]

      # GET /api/v1/sm_tasks/:task_id/comments
      def index
        comments = @task.comments
                        .top_level
                        .not_deleted
                        .oldest_first
                        .includes(:author, :replies, :mentions)

        render json: {
          success: true,
          task_id: @task.id,
          comments: comments.map { |c| comment_json(c, include_replies: true) },
          total: comments.count
        }
      end

      # GET /api/v1/sm_comments/:id
      def show
        render json: {
          success: true,
          comment: comment_json(@comment, include_replies: true)
        }
      end

      # POST /api/v1/sm_tasks/:task_id/comments
      def create
        comment = @task.comments.new(comment_params)
        comment.author = current_user

        if comment.save
          render json: {
            success: true,
            comment: comment_json(comment)
          }, status: :created
        else
          render json: {
            success: false,
            errors: comment.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_comments/:id
      def update
        unless can_edit?(@comment)
          return render json: { success: false, error: 'Not authorized' }, status: :forbidden
        end

        if @comment.update(comment_params)
          render json: {
            success: true,
            comment: comment_json(@comment)
          }
        else
          render json: {
            success: false,
            errors: @comment.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_comments/:id
      def destroy
        unless can_delete?(@comment)
          return render json: { success: false, error: 'Not authorized' }, status: :forbidden
        end

        @comment.soft_delete!

        render json: { success: true }
      end

      # GET /api/v1/sm_comments/:id/replies
      def replies
        replies = @comment.replies.not_deleted.oldest_first.includes(:author)

        render json: {
          success: true,
          parent_id: @comment.id,
          replies: replies.map { |r| comment_json(r) }
        }
      end

      # POST /api/v1/sm_comments/:id/reply
      def reply
        parent = SmComment.find(params[:id])
        reply = parent.task.comments.new(comment_params)
        reply.author = current_user
        reply.parent = parent

        if reply.save
          render json: {
            success: true,
            comment: comment_json(reply)
          }, status: :created
        else
          render json: {
            success: false,
            errors: reply.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_comments/mentions
      # Get unread mentions for current user
      def mentions
        mentions = SmCommentMention
                   .for_user(current_user.id)
                   .unread
                   .recent
                   .includes(comment: [:task, :author])
                   .limit(20)

        render json: {
          success: true,
          mentions: mentions.map { |m| mention_json(m) },
          unread_count: mentions.count
        }
      end

      # POST /api/v1/sm_comments/mentions/:id/read
      def mark_mention_read
        mention = SmCommentMention.find(params[:id])

        unless mention.user_id == current_user.id
          return render json: { success: false, error: 'Not authorized' }, status: :forbidden
        end

        mention.mark_read!

        render json: { success: true }
      end

      # POST /api/v1/sm_comments/mentions/read_all
      def mark_all_mentions_read
        SmCommentMention
          .for_user(current_user.id)
          .unread
          .update_all(read_at: Time.current)

        render json: { success: true }
      end

      private

      def set_task
        @task = SmTask.find(params[:task_id])
      end

      def set_comment
        @comment = SmComment.find(params[:id])
      end

      def comment_params
        params.permit(:body, :parent_id, :resource_id)
      end

      def can_edit?(comment)
        comment.author_id == current_user.id || current_user.admin?
      end

      def can_delete?(comment)
        comment.author_id == current_user.id || current_user.admin?
      end

      def comment_json(comment, include_replies: false)
        json = {
          id: comment.id,
          task_id: comment.sm_task_id,
          body: comment.body,
          author: {
            id: comment.author_id,
            name: comment.author&.full_name || comment.author&.email,
            avatar_url: comment.author&.avatar_url
          },
          parent_id: comment.parent_id,
          edited: comment.edited?,
          deleted: comment.deleted?,
          reply_count: comment.reply_count,
          mentions: comment.mentions.map do |m|
            {
              id: m.id,
              user_id: m.user_id,
              resource_id: m.resource_id
            }
          end,
          created_at: comment.created_at,
          updated_at: comment.updated_at
        }

        if include_replies && comment.replies.any?
          json[:replies] = comment.replies.not_deleted.oldest_first.map { |r| comment_json(r) }
        end

        json
      end

      def mention_json(mention)
        {
          id: mention.id,
          comment: {
            id: mention.comment.id,
            body: mention.comment.body.truncate(200),
            author_name: mention.comment.author&.full_name
          },
          task: {
            id: mention.comment.task.id,
            name: mention.comment.task.name
          },
          mentioned_at: mention.mentioned_at,
          read: !mention.unread?
        }
      end
    end
  end
end
