# frozen_string_literal: true

# AiTimesheetGeneratorService - ML-powered timesheet suggestion engine
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Aggregates evidence from multiple sources to suggest time entries:
# - Site presence photos (check-in/checkout)
# - GPS check-ins (SmSiteCheckin)
# - Calendar events
# - Historical patterns
#
# Generates AiTimesheetSuggestion records for worker review
#
class AiTimesheetGeneratorService
  include AnthropicClient

  attr_reader :errors, :suggestions_created

  # Minimum confidence threshold to create a suggestion
  CONFIDENCE_THRESHOLD = 60

  # Maximum hours in a single suggestion (anomaly threshold)
  MAX_HOURS_THRESHOLD = 14

  def initialize
    @errors = []
    @suggestions_created = 0
  end

  # Generate suggestions for a specific worker and date
  def generate_for_worker(worker_profile:, date:)
    @errors = []

    evidence = gather_evidence(worker_profile, date)

    if evidence[:sessions].empty? && evidence[:checkins].empty? && evidence[:photos].empty?
      return { success: true, message: "No evidence found for #{date}", suggestions: [] }
    end

    suggestions = build_suggestions(worker_profile, date, evidence)

    created = save_suggestions(suggestions)

    {
      success: true,
      date: date,
      worker_id: worker_profile.id,
      worker_name: worker_profile.display_name,
      evidence_summary: {
        sessions: evidence[:sessions].count,
        checkins: evidence[:checkins].count,
        photos: evidence[:photos].count
      },
      suggestions_created: created.count,
      suggestions: created.map { |s| suggestion_to_json(s) }
    }
  end

  # Generate suggestions for all active workers for a given date
  def generate_for_date(date:)
    @errors = []
    results = []

    WorkerProfile.active.find_each do |worker|
      result = generate_for_worker(worker_profile: worker, date: date)
      results << result
    rescue StandardError => e
      @errors << "Worker #{worker.id}: #{e.message}"
      Rails.logger.error "[AiTimesheetGenerator] Worker #{worker.id} error: #{e.message}"
    end

    total_suggestions = results.sum { |r| r[:suggestions_created] || 0 }

    {
      success: @errors.empty?,
      date: date,
      workers_processed: results.count,
      total_suggestions: total_suggestions,
      errors: @errors,
      results: results
    }
  end

  # Generate suggestions for yesterday (typical daily job usage)
  def generate_for_yesterday
    generate_for_date(date: Date.yesterday)
  end

  # Regenerate suggestions for a worker/date (replaces pending ones)
  def regenerate(worker_profile:, date:)
    # Remove existing pending suggestions
    AiTimesheetSuggestion.where(
      worker_profile: worker_profile,
      suggestion_date: date,
      status: "pending"
    ).destroy_all

    generate_for_worker(worker_profile: worker_profile, date: date)
  end

  private

  def gather_evidence(worker_profile, date)
    # Get site presence sessions for the date
    sessions = SitePresenceSession.where(worker_profile: worker_profile)
                                  .where("DATE(checkin_at) = ?", date)
                                  .includes(:checkin_photo, :checkout_photo, :job)

    # Get GPS check-ins (legacy SmSiteCheckin if exists)
    checkins = if defined?(SmSiteCheckin)
      SmSiteCheckin.where(resource_id: worker_profile.user_id)
                   .where("DATE(checked_in_at) = ?", date)
                   .order(:checked_in_at)
    else
      []
    end

    # Get photos taken that day
    photos = SmTaskPhoto.where(uploaded_by_id: worker_profile.user_id)
                        .for_date(date)
                        .includes(:job, :task)

    # Get any existing time entries (to avoid duplicates)
    existing_entries = LabourCostEntry.where(worker_profile: worker_profile)
                                      .for_date(date)

    {
      sessions: sessions.to_a,
      checkins: checkins.to_a,
      photos: photos.to_a,
      existing_entries: existing_entries.to_a
    }
  end

  def build_suggestions(worker_profile, date, evidence)
    suggestions = []

    # Priority 1: Build from completed site presence sessions (highest confidence)
    evidence[:sessions].each do |session|
      next unless session.completed?
      next if session_already_has_entry?(session, evidence[:existing_entries])

      suggestion = build_from_session(worker_profile, date, session, evidence)
      suggestions << suggestion if suggestion
    end

    # Priority 2: Build from GPS checkins without matching sessions
    unmatched_checkins = find_unmatched_checkins(evidence[:checkins], evidence[:sessions])
    if unmatched_checkins.any?
      checkin_suggestion = build_from_checkins(worker_profile, date, unmatched_checkins, evidence)
      suggestions << checkin_suggestion if checkin_suggestion
    end

    # Priority 3: Build from photos without matching sessions/checkins
    unmatched_photos = find_unmatched_photos(evidence[:photos], evidence[:sessions])
    if unmatched_photos.any?
      photo_suggestion = build_from_photos(worker_profile, date, unmatched_photos, evidence)
      suggestions << photo_suggestion if photo_suggestion
    end

    suggestions
  end

  def build_from_session(worker_profile, date, session, evidence)
    return nil unless session.total_hours.present? && session.total_hours.positive?

    # High confidence for completed sessions with both photos
    confidence = calculate_session_confidence(session)

    return nil if confidence < CONFIDENCE_THRESHOLD

    photo_evidence = []
    photo_evidence << { photo_id: session.checkin_photo_id, type: "checkin" } if session.checkin_photo_id
    photo_evidence << { photo_id: session.checkout_photo_id, type: "checkout" } if session.checkout_photo_id

    {
      worker_profile: worker_profile,
      job: session.job,
      suggestion_date: date,
      suggested_start_time: session.checkin_at,
      suggested_end_time: session.checkout_at,
      suggested_hours: session.total_hours,
      confidence_score: confidence,
      evidence_source: "site_presence_session",
      photo_evidence: photo_evidence,
      gps_evidence: [
        { type: "checkin", lat: session.latitude_checkin, lng: session.longitude_checkin },
        { type: "checkout", lat: session.latitude_checkout, lng: session.longitude_checkout }
      ].compact,
      reasoning: generate_reasoning(session, confidence)
    }
  end

  def build_from_checkins(worker_profile, date, checkins, evidence)
    return nil if checkins.empty?

    first_checkin = checkins.first
    last_checkin = checkins.last

    # Lower confidence for checkins without photos
    confidence = 50

    # Boost confidence if we have multiple checkins
    confidence += [checkins.length * 5, 20].min

    # Estimate hours from first to last checkin
    if first_checkin.respond_to?(:checked_in_at) && last_checkin.respond_to?(:checked_in_at)
      start_time = first_checkin.checked_in_at
      end_time = last_checkin.checked_in_at
      hours = ((end_time - start_time) / 1.hour).round(2)

      # Sanity check
      return nil if hours <= 0 || hours > MAX_HOURS_THRESHOLD
    else
      return nil
    end

    # Try to determine job from checkin location
    job = determine_job_from_checkins(checkins)
    return nil unless job

    {
      worker_profile: worker_profile,
      job: job,
      suggestion_date: date,
      suggested_start_time: start_time,
      suggested_end_time: end_time,
      suggested_hours: hours,
      confidence_score: confidence,
      evidence_source: "gps_checkins",
      photo_evidence: [],
      gps_evidence: checkins.map do |c|
        { checkin_id: c.id, time: c.checked_in_at, lat: c.latitude, lng: c.longitude }
      end,
      reasoning: "Based on #{checkins.length} GPS check-ins between #{start_time.strftime('%H:%M')} and #{end_time.strftime('%H:%M')}"
    }
  end

  def build_from_photos(worker_profile, date, photos, evidence)
    return nil if photos.empty?

    # Lowest confidence for photo-only evidence
    confidence = 40
    confidence += [photos.length * 3, 15].min

    # Determine time range from photo timestamps
    sorted_photos = photos.sort_by(&:taken_at)
    start_time = sorted_photos.first.taken_at
    end_time = sorted_photos.last.taken_at

    # Estimate minimum hours (assume at least work around photos)
    hours = [(end_time - start_time) / 1.hour, 1.0].max.round(2)

    return nil if hours > MAX_HOURS_THRESHOLD

    # Try to determine job from photos
    job = photos.map(&:job).compact.first
    return nil unless job

    {
      worker_profile: worker_profile,
      job: job,
      suggestion_date: date,
      suggested_start_time: start_time,
      suggested_end_time: end_time,
      suggested_hours: hours,
      confidence_score: confidence,
      evidence_source: "photos",
      photo_evidence: photos.map { |p| { photo_id: p.id, type: p.photo_type, time: p.taken_at } },
      gps_evidence: photos.select(&:has_gps?).map do |p|
        { photo_id: p.id, lat: p.effective_latitude, lng: p.effective_longitude }
      end,
      reasoning: "Based on #{photos.length} photos taken between #{start_time.strftime('%H:%M')} and #{end_time.strftime('%H:%M')}"
    }
  end

  def calculate_session_confidence(session)
    confidence = 70 # Base confidence for a completed session

    # Boost for photo verification
    confidence += 10 if session.checkin_photo_id.present?
    confidence += 10 if session.checkout_photo_id.present?

    # Boost for face verification
    confidence += 5 if session.face_verified_checkin
    confidence += 5 if session.face_verified_checkout

    # Boost for GPS verification
    confidence += 3 if session.gps_verified_checkin
    confidence += 3 if session.gps_verified_checkout

    # Penalty for anomalies
    confidence -= 20 if session.has_anomalies

    # Cap at 100
    [confidence, 100].min
  end

  def generate_reasoning(session, confidence)
    parts = []
    parts << "Completed site presence session with #{session.total_hours.round(2)} hours"
    parts << "check-in photo verified" if session.checkin_photo_id.present?
    parts << "checkout photo verified" if session.checkout_photo_id.present?
    parts << "face matched" if session.face_verified_checkin || session.face_verified_checkout
    parts << "GPS confirmed" if session.gps_verified_checkin || session.gps_verified_checkout
    parts << "ANOMALY DETECTED" if session.has_anomalies

    parts.join(". ") + ". Confidence: #{confidence}%."
  end

  def session_already_has_entry?(session, existing_entries)
    existing_entries.any? { |e| e.site_presence_session_id == session.id }
  end

  def find_unmatched_checkins(checkins, sessions)
    return [] if checkins.empty?

    # Filter out checkins that fall within session time ranges
    checkins.reject do |checkin|
      time = checkin.checked_in_at
      sessions.any? do |s|
        s.checkin_at && s.checkout_at &&
          time >= s.checkin_at && time <= s.checkout_at
      end
    end
  end

  def find_unmatched_photos(photos, sessions)
    return [] if photos.empty?

    photos.reject do |photo|
      time = photo.taken_at
      sessions.any? do |s|
        s.checkin_at && s.checkout_at &&
          time >= s.checkin_at && time <= s.checkout_at
      end
    end
  end

  def determine_job_from_checkins(checkins)
    # Try to find job from checkin data
    checkins.each do |checkin|
      return checkin.job if checkin.respond_to?(:job) && checkin.job.present?
    end
    nil
  end

  def save_suggestions(suggestions)
    created = []

    suggestions.each do |suggestion_data|
      next if suggestion_data[:confidence_score] < CONFIDENCE_THRESHOLD

      suggestion = AiTimesheetSuggestion.new(
        worker_profile: suggestion_data[:worker_profile],
        job: suggestion_data[:job],
        suggestion_date: suggestion_data[:suggestion_date],
        suggested_start_time: suggestion_data[:suggested_start_time],
        suggested_end_time: suggestion_data[:suggested_end_time],
        suggested_hours: suggestion_data[:suggested_hours],
        confidence_score: suggestion_data[:confidence_score],
        evidence_source: suggestion_data[:evidence_source],
        photo_evidence: suggestion_data[:photo_evidence],
        gps_evidence: suggestion_data[:gps_evidence],
        reasoning: suggestion_data[:reasoning],
        status: "pending"
      )

      if suggestion.save
        created << suggestion
        @suggestions_created += 1
      else
        @errors << "Failed to save suggestion: #{suggestion.errors.full_messages.join(', ')}"
      end
    end

    created
  end

  def suggestion_to_json(suggestion)
    {
      id: suggestion.id,
      job_id: suggestion.job_id,
      job_name: suggestion.job&.name,
      date: suggestion.suggestion_date,
      start_time: suggestion.suggested_start_time,
      end_time: suggestion.suggested_end_time,
      hours: suggestion.suggested_hours,
      confidence: suggestion.confidence_score,
      evidence_source: suggestion.evidence_source,
      reasoning: suggestion.reasoning,
      status: suggestion.status
    }
  end
end
