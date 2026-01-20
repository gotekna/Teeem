# frozen_string_literal: true

class Api::V1::EmailSnoozesController < ApplicationController
  before_action :set_snooze, only: [:show, :cancel, :extend]

  # GET /api/v1/email_snoozes
  # List all active snoozed emails for current user
  def index
    snoozes = current_user.email_snoozes.active.upcoming

    # Include email details
    snoozes = snoozes.includes(:synced_email)

    render json: {
      success: true,
      data: {
        snoozes: snoozes.map { |s| snooze_json(s, include_email: true) },
        count: snoozes.count
      }
    }
  end

  # GET /api/v1/email_snoozes/:id
  def show
    render json: {
      success: true,
      data: snooze_json(@snooze, include_email: true)
    }
  end

  # POST /api/v1/email_snoozes
  # Snooze an email
  def create
    email = SyncedEmail.find(params[:email_id])

    # Determine snooze time
    if params[:preset].present?
      snooze = EmailSnooze.snooze_with_preset!(
        email,
        user: current_user,
        preset: params[:preset],
        reason: params[:reason]
      )
    elsif params[:snooze_until].present?
      snooze = EmailSnooze.snooze!(
        email,
        user: current_user,
        until_time: Time.parse(params[:snooze_until]),
        reason: params[:reason]
      )
    else
      return render json: {
        success: false,
        error: "Either preset or snooze_until is required"
      }, status: :unprocessable_entity
    end

    render json: {
      success: true,
      data: snooze_json(snooze, include_email: true),
      message: "Email snoozed until #{snooze.snooze_until.strftime('%b %d at %I:%M %p')}"
    }, status: :created
  rescue ArgumentError => e
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
  rescue ActiveRecord::RecordInvalid => e
    render json: {
      success: false,
      error: e.record.errors.full_messages.join(", ")
    }, status: :unprocessable_entity
  end

  # DELETE /api/v1/email_snoozes/:id
  # Cancel a snooze (unsnooze)
  def cancel
    @snooze.cancel!

    render json: {
      success: true,
      message: "Snooze cancelled"
    }
  end

  # PATCH /api/v1/email_snoozes/:id/extend
  # Extend snooze time
  def extend
    if params[:preset].present?
      preset_config = EmailSnooze::PRESETS[params[:preset].to_sym]
      return render json: { success: false, error: "Unknown preset" }, status: :unprocessable_entity unless preset_config

      new_time = preset_config[:calculate].call
    elsif params[:snooze_until].present?
      new_time = Time.parse(params[:snooze_until])
    else
      return render json: {
        success: false,
        error: "Either preset or snooze_until is required"
      }, status: :unprocessable_entity
    end

    @snooze.extend!(new_time)

    render json: {
      success: true,
      data: snooze_json(@snooze),
      message: "Snooze extended until #{new_time.strftime('%b %d at %I:%M %p')}"
    }
  end

  # GET /api/v1/email_snoozes/presets
  # Get available preset options with calculated times
  def presets
    render json: {
      success: true,
      data: {
        presets: EmailSnooze.preset_options
      }
    }
  end

  # GET /api/v1/email_snoozes/for_email/:email_id
  # Check if an email is snoozed for current user
  def for_email
    email = SyncedEmail.find(params[:email_id])
    snooze = EmailSnooze.active_snooze_for(email, current_user)

    render json: {
      success: true,
      data: {
        is_snoozed: snooze.present?,
        snooze: snooze ? snooze_json(snooze) : nil
      }
    }
  end

  # POST /api/v1/email_snoozes/bulk_snooze
  # Snooze multiple emails at once
  def bulk_snooze
    email_ids = params[:email_ids] || []

    return render json: { success: false, error: "No emails provided" }, status: :bad_request if email_ids.empty?

    # Determine snooze time
    if params[:preset].present?
      preset_config = EmailSnooze::PRESETS[params[:preset].to_sym]
      return render json: { success: false, error: "Unknown preset" }, status: :unprocessable_entity unless preset_config

      until_time = preset_config[:calculate].call
    elsif params[:snooze_until].present?
      until_time = Time.parse(params[:snooze_until])
    else
      return render json: { success: false, error: "Either preset or snooze_until is required" }, status: :unprocessable_entity
    end

    snoozed = []
    errors = []

    email_ids.each do |email_id|
      email = SyncedEmail.find_by(id: email_id)
      next unless email

      begin
        snooze = EmailSnooze.snooze!(email, user: current_user, until_time: until_time, reason: params[:reason])
        snoozed << snooze.id
      rescue StandardError => e
        errors << { email_id: email_id, error: e.message }
      end
    end

    render json: {
      success: errors.empty?,
      data: {
        snoozed_count: snoozed.count,
        snooze_until: until_time,
        errors: errors
      },
      message: "Snoozed #{snoozed.count} emails until #{until_time.strftime('%b %d at %I:%M %p')}"
    }
  end

  # DELETE /api/v1/email_snoozes/bulk_cancel
  # Cancel multiple snoozes at once
  def bulk_cancel
    snooze_ids = params[:snooze_ids] || []
    email_ids = params[:email_ids] || []

    cancelled = 0

    if snooze_ids.any?
      current_user.email_snoozes.active.where(id: snooze_ids).find_each do |snooze|
        snooze.cancel!
        cancelled += 1
      end
    end

    if email_ids.any?
      current_user.email_snoozes.active.where(synced_email_id: email_ids).find_each do |snooze|
        snooze.cancel!
        cancelled += 1
      end
    end

    render json: {
      success: true,
      data: { cancelled_count: cancelled },
      message: "Cancelled #{cancelled} snoozes"
    }
  end

  private

  def set_snooze
    @snooze = current_user.email_snoozes.find(params[:id])
  end

  def snooze_json(snooze, include_email: false)
    json = snooze.as_json

    if include_email && snooze.email_warehouse
      json[:email] = {
        id: snooze.synced_email.id,
        subject: snooze.synced_email.subject,
        from_email: snooze.synced_email.from_email,
        from_name: snooze.synced_email.from_name,
        received_at: snooze.synced_email.received_at,
        has_attachments: snooze.synced_email.has_attachments,
        snippet: snooze.synced_email.preview_body(length: 150)
      }
    end

    json
  end
end
