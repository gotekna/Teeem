# frozen_string_literal: true

# SmVoiceNote - Audio recordings attached to tasks
#
# Used for:
# - Quick field updates
# - Detailed task notes
# - Issue descriptions
# - Instructions for other workers
#
class SmVoiceNote < ApplicationRecord
  belongs_to :task, class_name: 'SmTask', foreign_key: 'sm_task_id'
  belongs_to :recorded_by, class_name: 'User', optional: true
  belongs_to :resource, class_name: 'SmResource', optional: true

  validates :audio_url, presence: true
  validates :duration_seconds, numericality: { greater_than: 0 }, allow_nil: true

  # Scopes
  scope :recent, -> { order(recorded_at: :desc) }
  scope :for_date, ->(date) { where(recorded_at: date.beginning_of_day..date.end_of_day) }
  scope :transcribed, -> { where.not(transcription: nil) }
  scope :pending_transcription, -> { where(transcription: nil) }

  # Callbacks
  before_create :set_recorded_at
  after_create :queue_transcription, if: :should_transcribe?

  # Instance methods
  def formatted_duration
    return nil unless duration_seconds

    minutes = duration_seconds / 60
    seconds = duration_seconds % 60
    format('%d:%02d', minutes, seconds)
  end

  def transcribe!
    return if transcription.present?

    # Use OpenAI Whisper or similar service
    result = TranscriptionService.transcribe(audio_url)
    update!(
      transcription: result[:text],
      transcription_confidence: result[:confidence],
      transcribed_at: Time.current
    )
  rescue StandardError => e
    Rails.logger.error("Voice note transcription failed: #{e.message}")
    update!(transcription_error: e.message)
  end

  private

  def set_recorded_at
    self.recorded_at ||= Time.current
  end

  def should_transcribe?
    # Auto-transcribe if enabled in settings
    SmSetting.first&.auto_transcribe_voice_notes
  end

  def queue_transcription
    TranscribeVoiceNoteJob.perform_later(id)
  end
end
