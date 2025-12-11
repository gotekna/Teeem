# frozen_string_literal: true

# Tracks kudos points earned from health fixes
# Both system auto-fixes and manual user fixes are recorded
#
# Usage:
#   # System auto-fix (called from SelfHealing concern)
#   HealthKudosEvent.record_system_fix(
#     fix_type: 'name_casing',
#     record: contact,
#     points: 5,
#     details: { original: 'JOHN SMITH', fixed: 'John Smith' }
#   )
#
#   # Manual user fix
#   HealthKudosEvent.record_user_fix(
#     user: current_user,
#     fix_type: 'missing_abn',
#     record: company,
#     points: 10
#   )
#
class HealthKudosEvent < ApplicationRecord
  # Points awarded for different fix types
  POINTS = {
    # Auto-fixes (system earns these)
    name_casing: 5,
    website_prefix: 3,
    phone_format: 2,
    email_lowercase: 1,
    abn_format: 2,
    acn_format: 2,

    # Manual fixes (users earn these)
    missing_abn: 10,
    missing_acn: 10,
    duplicate_merge: 15,
    missing_contact_info: 5,
    invalid_email: 5,
    missing_company_link: 8,
    critical_fix: 25,
    warning_fix: 10,
    info_fix: 5,

    # Prevention bonus (system or user)
    prevention_added: 10
  }.freeze

  belongs_to :user, optional: true

  validates :actor_type, presence: true, inclusion: { in: %w[system user] }
  validates :action, presence: true
  validates :fix_type, presence: true
  validates :points, presence: true, numericality: { greater_than_or_equal_to: 0 }

  scope :by_system, -> { where(actor_type: "system") }
  scope :by_users, -> { where(actor_type: "user") }
  scope :this_week, -> { where("created_at >= ?", Time.current.beginning_of_week) }
  scope :today, -> { where("created_at >= ?", Time.current.beginning_of_day) }
  scope :recent, -> { order(created_at: :desc).limit(100) }

  class << self
    # Record a system auto-fix
    def record_system_fix(fix_type:, record: nil, points: nil, details: {}, description: nil)
      points ||= POINTS[fix_type.to_sym] || 1

      create!(
        actor_type: "system",
        action: "auto_fix",
        fix_type: fix_type.to_s,
        record_type: record&.class&.name,
        record_id: record&.id,
        points: points,
        details: details,
        description: description || "Auto-fixed #{fix_type.to_s.humanize.downcase}"
      )
    end

    # Record a manual user fix
    def record_user_fix(user:, fix_type:, record: nil, records_fixed: 1, points: nil, details: {}, description: nil)
      points ||= POINTS[fix_type.to_sym] || 5

      create!(
        actor_type: "user",
        user: user,
        action: "manual_fix",
        fix_type: fix_type.to_s,
        record_type: record&.class&.name,
        record_id: record&.id,
        records_fixed: records_fixed,
        points: points * records_fixed,
        details: details,
        description: description || "Fixed #{fix_type.to_s.humanize.downcase}"
      )
    end

    # Record a bulk fix (multiple records at once)
    def record_bulk_fix(user: nil, fix_type:, record_type:, record_ids:, points_per_record: nil)
      points_per = points_per_record || POINTS[fix_type.to_sym] || 5
      total_points = points_per * record_ids.length

      create!(
        actor_type: user ? "user" : "system",
        user: user,
        action: user ? "manual_fix" : "auto_fix",
        fix_type: fix_type.to_s,
        record_type: record_type,
        records_fixed: record_ids.length,
        points: total_points,
        details: { record_ids: record_ids, points_per_record: points_per },
        description: "Fixed #{record_ids.length} #{fix_type.to_s.humanize.downcase} issues"
      )
    end

    # Get leaderboard data
    def leaderboard(timeframe: :this_week)
      scope = case timeframe
      when :today then today
      when :this_week then this_week
      else all
      end

      # System total
      system_points = scope.by_system.sum(:points)

      # User totals
      user_totals = scope.by_users
                         .group(:user_id)
                         .sum(:points)
                         .sort_by { |_k, v| -v }

      # Build leaderboard entries
      entries = []

      # Add system as first entry
      entries << {
        id: "system",
        name: "System",
        points: system_points,
        is_system: true,
        trend: calculate_trend("system", timeframe)
      }

      # Add users
      user_totals.each_with_index do |(user_id, points), index|
        user = User.find_by(id: user_id)
        next unless user

        entries << {
          id: "user-#{user_id}",
          name: user.name || user.email&.split("@")&.first || "User #{user_id}",
          points: points,
          is_system: false,
          trend: calculate_trend(user_id, timeframe)
        }
      end

      {
        system_points: system_points,
        humans_points: scope.by_users.sum(:points),
        entries: entries.sort_by { |e| -e[:points] }
      }
    end

    # Get quick wins - fixable issues with their point values
    # Prioritizes auto-fixable issues as they provide easiest points
    def quick_wins_from_health(health_data)
      wins = []

      # First, extract individual checks that are auto-fixable
      health_data[:checks]&.each do |check|
        next unless check[:count].to_i > 0

        # Auto-fixable checks are prioritized as quick wins
        if check[:auto_fixable] && check[:fix_type].present?
          points_per = POINTS[check[:fix_type].to_sym] || 5
          wins << {
            id: "auto-#{check[:check_type]}-#{check[:check_name]}",
            title: "#{check[:count]} #{check[:name].downcase}",
            description: check[:description],
            count: check[:count],
            points: check[:count] * points_per,
            fix_type: check[:fix_type],
            check_type: check[:check_type],
            check_name: check[:check_name],
            auto_fixable: true,
            item_ids: check[:items]&.map { |i| i[:id] }&.compact
          }
        end
      end

      # Then add summary-level quick wins for critical/warning issues
      health_data[:checks]&.group_by { |c| c[:check_type] }&.each do |check_type, checks|
        next if check_type.blank?

        critical_count = checks.select { |c| c[:severity] == "critical" }.sum { |c| c[:count].to_i }
        warning_count = checks.select { |c| c[:severity] == "warning" && !c[:auto_fixable] }.sum { |c| c[:count].to_i }

        if critical_count > 0
          wins << {
            id: "critical-#{check_type}",
            title: "#{critical_count} critical issues in #{check_type.titleize}",
            description: "Fix critical data issues",
            count: critical_count,
            points: critical_count * POINTS[:critical_fix],
            fix_type: "review",
            check_type: check_type,
            auto_fixable: false
          }
        end

        if warning_count > 0
          wins << {
            id: "warning-#{check_type}",
            title: "#{warning_count} warnings in #{check_type.titleize}",
            description: "Review and fix data warnings",
            count: warning_count,
            points: warning_count * POINTS[:warning_fix],
            fix_type: "review",
            check_type: check_type,
            auto_fixable: false
          }
        end
      end

      # Sort: auto-fixable first (easiest wins), then by points
      wins.sort_by { |w| [ w[:auto_fixable] ? 0 : 1, -w[:points] ] }.first(5)
    end

    private

    def calculate_trend(actor_id, timeframe)
      # Compare current period to previous period
      current_scope = case timeframe
      when :today then today
      when :this_week then this_week
      else all
      end

      previous_scope = case timeframe
      when :today
                         where(created_at: 1.day.ago.beginning_of_day..1.day.ago.end_of_day)
      when :this_week
                         where(created_at: 1.week.ago.beginning_of_week..1.week.ago.end_of_week)
      else
                         none
      end

      if actor_id == "system"
        current = current_scope.by_system.sum(:points)
        previous = previous_scope.by_system.sum(:points)
      else
        current = current_scope.where(user_id: actor_id).sum(:points)
        previous = previous_scope.where(user_id: actor_id).sum(:points)
      end

      if current > previous
        "up"
      elsif current < previous
        "down"
      else
        "same"
      end
    end
  end
end
