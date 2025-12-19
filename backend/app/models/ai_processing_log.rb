# frozen_string_literal: true

# Audit trail for AI processing decisions
# Tracks OCR, pattern matching, AI validation results and user corrections
class AiProcessingLog < ApplicationRecord
  belongs_to :processable, polymorphic: true, optional: true
  belongs_to :corrected_by, class_name: "User", optional: true

  DECISION_METHODS = %w[ocr_only ocr_plus_ai ai_only ai_validated manual failed].freeze

  validates :service_type, presence: true
  validates :decision_method, inclusion: { in: DECISION_METHODS }, allow_nil: true

  scope :for_service, ->(type) { where(service_type: type) }
  scope :corrected, -> { where(user_corrected: true) }
  scope :not_corrected, -> { where(user_corrected: false) }
  scope :recent, -> { order(created_at: :desc) }
  scope :since, ->(time) { where("created_at > ?", time) }

  # Calculate accuracy for a service over a time period
  def self.accuracy_for(service_type, days: 30)
    logs = for_service(service_type).since(days.days.ago)
    total = logs.count
    return { accuracy: nil, total: 0, correct: 0 } if total.zero?

    correct = logs.not_corrected.count
    {
      accuracy: (correct.to_f / total * 100).round(1),
      total: total,
      correct: correct,
      corrected: total - correct
    }
  end

  # Accuracy stats for all services
  def self.accuracy_stats(days: 30)
    AiServiceConfig::SERVICE_TYPES.keys.each_with_object({}) do |service_type, stats|
      stats[service_type] = accuracy_for(service_type, days: days)
    end
  end

  # Record a user correction
  def record_correction!(new_value, user:)
    update!(
      user_corrected: true,
      corrected_to: new_value,
      corrected_by: user,
      corrected_at: Time.current
    )
  end

  # Was this processed with OCR?
  def used_ocr?
    ocr_result.present? && ocr_result["success"]
  end

  # Was this processed with AI?
  def used_ai?
    ai_result.present?
  end

  # Processing method summary
  def processing_summary
    parts = []
    parts << "OCR: #{ocr_duration_ms}ms" if ocr_duration_ms
    parts << "AI: #{ai_duration_ms}ms" if ai_duration_ms
    parts << "Total: #{total_duration_ms}ms" if total_duration_ms
    parts.join(", ")
  end

  # Get the original AI/OCR result before correction
  def original_result
    final_type
  end

  # Human-readable status
  def status_label
    if user_corrected?
      "Corrected"
    elsif final_confidence.to_i >= 80
      "High Confidence"
    elsif final_confidence.to_i >= 60
      "Medium Confidence"
    else
      "Low Confidence"
    end
  end

  # ============================================================================
  # LEARNING INSIGHTS - Analyze correction patterns to improve accuracy
  # ============================================================================

  # Analyze correction patterns for a service
  # Returns insights about where corrections happen most
  def self.correction_patterns(service_type, days: 30)
    logs = for_service(service_type).corrected.since(days.days.ago)

    # Group by decision method
    by_method = logs.group(:decision_method).count

    # Group by confidence range
    by_confidence = {
      "0-59" => logs.where("final_confidence < 60").count,
      "60-79" => logs.where("final_confidence >= 60 AND final_confidence < 80").count,
      "80-89" => logs.where("final_confidence >= 80 AND final_confidence < 90").count,
      "90-100" => logs.where("final_confidence >= 90").count
    }

    # Most common corrections (what was changed to what)
    common_corrections = logs
      .where.not(corrected_to: nil)
      .group(:final_type, :corrected_to)
      .count
      .sort_by { |_, count| -count }
      .first(10)
      .map { |(from, to), count| { from: from || "none", to: to, count: count } }

    {
      total_corrections: logs.count,
      by_method: by_method,
      by_confidence: by_confidence,
      common_corrections: common_corrections
    }
  end

  # Calculate optimal threshold based on correction data
  # Returns recommended AI threshold to minimize corrections
  def self.suggest_threshold(service_type, days: 30)
    logs = for_service(service_type).since(days.days.ago)
    total = logs.count
    return nil if total < 20 # Need enough data

    # Calculate correction rate at different confidence levels
    thresholds = [50, 60, 70, 80, 90]
    analysis = thresholds.map do |threshold|
      # Items below threshold that would trigger AI
      below = logs.where("final_confidence < ?", threshold)
      below_total = below.count
      below_corrected = below.corrected.count

      # Items at or above threshold (would NOT trigger AI)
      above = logs.where("final_confidence >= ?", threshold)
      above_total = above.count
      above_corrected = above.corrected.count

      # Calculate rates
      below_correction_rate = below_total > 0 ? (below_corrected.to_f / below_total * 100).round(1) : 0
      above_correction_rate = above_total > 0 ? (above_corrected.to_f / above_total * 100).round(1) : 0

      {
        threshold: threshold,
        below_total: below_total,
        below_corrected: below_corrected,
        below_correction_rate: below_correction_rate,
        above_total: above_total,
        above_corrected: above_corrected,
        above_correction_rate: above_correction_rate,
        would_trigger_ai_pct: (below_total.to_f / total * 100).round(1)
      }
    end

    # Find optimal threshold - minimize corrections above threshold
    # while keeping AI usage reasonable (< 50% of items)
    optimal = analysis.select { |a| a[:would_trigger_ai_pct] < 50 }
                      .min_by { |a| a[:above_correction_rate] }

    current_config = AiServiceConfig.find_by(service_type: service_type)
    current_threshold = current_config&.ai_threshold || 80

    {
      current_threshold: current_threshold,
      suggested_threshold: optimal&.dig(:threshold) || current_threshold,
      analysis: analysis,
      recommendation: build_recommendation(current_threshold, optimal, analysis),
      sample_size: total
    }
  end

  # Build human-readable recommendation
  def self.build_recommendation(current, optimal, analysis)
    return "Not enough data for recommendation" if optimal.nil?

    suggested = optimal[:threshold]
    if suggested == current
      "Current threshold of #{current}% is optimal. " \
      "#{optimal[:above_correction_rate]}% correction rate for items above threshold."
    elsif suggested > current
      "Consider raising threshold from #{current}% to #{suggested}%. " \
      "This would reduce AI usage by #{(analysis.find { |a| a[:threshold] == current }&.dig(:would_trigger_ai_pct) || 0) - optimal[:would_trigger_ai_pct]}% " \
      "while maintaining #{100 - optimal[:above_correction_rate]}% accuracy."
    else
      "Consider lowering threshold from #{current}% to #{suggested}%. " \
      "This would improve accuracy by triggering AI for #{optimal[:would_trigger_ai_pct] - (analysis.find { |a| a[:threshold] == current }&.dig(:would_trigger_ai_pct) || 0)}% more items."
    end
  end

  # Get learning context for AI prompts (what patterns we've learned)
  def self.learning_context(service_type, limit: 10)
    corrections = for_service(service_type)
      .corrected
      .where.not(corrected_to: nil)
      .recent
      .limit(limit)

    return "" if corrections.empty?

    examples = corrections.map do |log|
      "- \"#{log.input_identifier || 'unknown'}\" was identified as \"#{log.final_type || 'none'}\" " \
      "(#{log.final_confidence}% confidence) but corrected to \"#{log.corrected_to}\""
    end

    "Recent corrections for learning:\n#{examples.join("\n")}"
  end

  # Analyze OCR vs AI effectiveness
  def self.method_effectiveness(service_type, days: 30)
    logs = for_service(service_type).since(days.days.ago)

    methods = %w[ocr_only ocr_plus_ai ai_only ai_validated]
    methods.each_with_object({}) do |method, result|
      method_logs = logs.where(decision_method: method)
      total = method_logs.count
      next if total.zero?

      corrected = method_logs.corrected.count
      avg_confidence = method_logs.average(:final_confidence)&.round(1)
      avg_duration = method_logs.average(:total_duration_ms)&.round(0)

      result[method] = {
        total: total,
        corrected: corrected,
        accuracy: ((total - corrected).to_f / total * 100).round(1),
        avg_confidence: avg_confidence,
        avg_duration_ms: avg_duration
      }
    end
  end
end
