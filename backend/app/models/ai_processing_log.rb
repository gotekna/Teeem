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
end
