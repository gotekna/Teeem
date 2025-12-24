# frozen_string_literal: true

# Performance Observatory - Web Vitals
# Captures Core Web Vitals from frontend browsers
class PerformanceVital < ApplicationRecord
  belongs_to :user, optional: true

  # Core Web Vitals metric names
  METRIC_NAMES = %w[LCP FID CLS INP TTFB FCP].freeze

  # Thresholds per Google's Core Web Vitals guidelines
  # Values are: [good, needs_improvement] - anything above is poor
  THRESHOLDS = {
    "LCP" => [2500, 4000],      # Largest Contentful Paint (ms)
    "FID" => [100, 300],        # First Input Delay (ms)
    "CLS" => [0.1, 0.25],       # Cumulative Layout Shift (score)
    "INP" => [200, 500],        # Interaction to Next Paint (ms)
    "TTFB" => [800, 1800],      # Time to First Byte (ms)
    "FCP" => [1800, 3000]       # First Contentful Paint (ms)
  }.freeze

  validates :metric_name, presence: true, inclusion: { in: METRIC_NAMES }
  validates :value, presence: true, numericality: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :since, ->(time) { where("created_at > ?", time) }
  scope :for_metric, ->(name) { where(metric_name: name) }
  scope :for_page, ->(path) { where(page_path: path) }
  scope :for_user, ->(user) { where(user: user) }
  scope :good, -> { where(rating: "good") }
  scope :needs_improvement, -> { where(rating: "needs-improvement") }
  scope :poor, -> { where(rating: "poor") }

  # Calculate rating based on metric thresholds
  before_validation :calculate_rating, on: :create

  def calculate_rating
    thresholds = THRESHOLDS[metric_name]
    return unless thresholds

    self.rating = if value <= thresholds[0]
                    "good"
                  elsif value <= thresholds[1]
                    "needs-improvement"
                  else
                    "poor"
                  end
  end

  # Get P75 for a metric (Google's recommended percentile for Core Web Vitals)
  def self.p75(metric_name, since: 24.hours.ago)
    values = for_metric(metric_name).since(since).pluck(:value).compact.sort
    return nil if values.empty?

    values[(0.75 * (values.length - 1)).round]
  end

  # Core Web Vitals summary for dashboard
  def self.vitals_summary(since: 24.hours.ago)
    METRIC_NAMES.each_with_object({}) do |metric, summary|
      values = for_metric(metric).since(since).pluck(:value).compact.sort
      next if values.empty?

      p75 = values[(0.75 * (values.length - 1)).round]
      thresholds = THRESHOLDS[metric]

      rating = if p75 <= thresholds[0]
                 "good"
               elsif p75 <= thresholds[1]
                 "needs-improvement"
               else
                 "poor"
               end

      summary[metric] = {
        p75: p75.round(2),
        rating: rating,
        count: values.length,
        good_pct: (for_metric(metric).since(since).good.count.to_f / values.length * 100).round(1),
        unit: metric == "CLS" ? "score" : "ms"
      }
    end
  end

  # Stats by page for dashboard
  def self.page_stats(since: 24.hours.ago)
    since(since)
      .group(:page_path, :metric_name)
      .select(
        "page_path",
        "metric_name",
        "COUNT(*) as sample_count",
        "PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75"
      )
      .order("page_path, metric_name")
  end

  # Get trend data for a metric over time
  def self.trend(metric_name, days: 7, bucket: :hour)
    bucket_sql = case bucket
                 when :hour then "date_trunc('hour', created_at)"
                 when :day then "date_trunc('day', created_at)"
                 else "date_trunc('hour', created_at)"
                 end

    for_metric(metric_name)
      .since(days.days.ago)
      .group(Arel.sql(bucket_sql))
      .select(
        "#{bucket_sql} as bucket",
        "PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75",
        "COUNT(*) as sample_count"
      )
      .order(Arel.sql(bucket_sql))
  end

  # Retention: Delete old records
  def self.cleanup_old_records!(days: 90)
    deleted = where("created_at < ?", days.days.ago).delete_all
    Rails.logger.info "[PerformanceVital] Cleaned up #{deleted} records older than #{days} days"
    deleted
  end
end
