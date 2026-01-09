# frozen_string_literal: true

# FaceVerificationJob - Async face verification using AWS Rekognition
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Verifies check-in/checkout photos against worker's stored face photo
# to prevent buddy punching and time fraud.
#
class FaceVerificationJob < ApplicationJob
  queue_as :default

  # Minimum similarity threshold for face match (90%)
  SIMILARITY_THRESHOLD = 90.0

  # Retry on AWS transient errors (only if AWS SDK is loaded)
  if defined?(Aws::Rekognition)
    retry_on Aws::Rekognition::Errors::ThrottlingException, wait: :exponentially_longer, attempts: 5
    retry_on Aws::Rekognition::Errors::ProvisionedThroughputExceededException, wait: 30.seconds, attempts: 3
  end

  def perform(session_id, photo_type)
    session = SitePresenceSession.find_by(id: session_id)
    return unless session

    worker = session.worker_profile
    return unless worker&.face_encoding.present? || worker&.profile_photo_url.present?

    photo = photo_type == "checkin" ? session.checkin_photo : session.checkout_photo
    return unless photo&.photo_url.present?

    result = verify_face(worker, photo)

    update_session(session, photo_type, result)
    detect_anomaly_if_failed(session, photo_type, result)
  end

  private

  def verify_face(worker, photo)
    # If AWS Rekognition is not configured, skip verification
    unless aws_configured?
      Rails.logger.info("FaceVerificationJob: AWS Rekognition not configured, skipping verification")
      return { verified: true, confidence: 100.0, skipped: true, reason: "aws_not_configured" }
    end

    # Compare faces using AWS Rekognition
    begin
      response = rekognition_client.compare_faces(
        source_image: image_params(worker.profile_photo_url),
        target_image: image_params(photo.photo_url),
        similarity_threshold: SIMILARITY_THRESHOLD
      )

      if response.face_matches.any?
        match = response.face_matches.first
        {
          verified: true,
          confidence: match.similarity,
          face_details: {
            bounding_box: match.face.bounding_box.to_h,
            quality: match.face.quality&.to_h
          }
        }
      else
        {
          verified: false,
          confidence: 0.0,
          reason: "no_face_match",
          unmatched_faces: response.unmatched_faces.count
        }
      end
    rescue Aws::Rekognition::Errors::InvalidParameterException => e
      Rails.logger.warn("FaceVerificationJob: Invalid image - #{e.message}")
      { verified: false, confidence: 0.0, reason: "invalid_image", error: e.message }
    rescue Aws::Rekognition::Errors::InvalidImageFormatException => e
      Rails.logger.warn("FaceVerificationJob: Invalid image format - #{e.message}")
      { verified: false, confidence: 0.0, reason: "invalid_format", error: e.message }
    rescue StandardError => e
      Rails.logger.error("FaceVerificationJob: Unexpected error - #{e.class}: #{e.message}")
      { verified: false, confidence: 0.0, reason: "error", error: e.message }
    end
  end

  def update_session(session, photo_type, result)
    if photo_type == "checkin"
      session.update!(
        face_verified_checkin: result[:verified],
        face_confidence_checkin: result[:confidence]
      )
    else
      session.update!(
        face_verified_checkout: result[:verified],
        face_confidence_checkout: result[:confidence]
      )
    end
  end

  def detect_anomaly_if_failed(session, photo_type, result)
    return if result[:verified] || result[:skipped]

    # Face verification failed - create anomaly record
    session.update!(
      has_anomalies: true,
      anomaly_details: (session.anomaly_details || {}).merge(
        "face_verification_#{photo_type}" => {
          detected_at: Time.current.iso8601,
          confidence: result[:confidence],
          reason: result[:reason],
          severity: "critical"
        }
      )
    )

    # Notify admin of potential buddy punching
    notify_admin_of_face_mismatch(session, photo_type, result)
  end

  def notify_admin_of_face_mismatch(session, photo_type, result)
    # TODO: Implement notification (email/Slack/push)
    Rails.logger.warn(
      "FACE VERIFICATION FAILED: Session ##{session.id}, " \
      "Worker: #{session.worker_profile.display_name}, " \
      "Type: #{photo_type}, " \
      "Confidence: #{result[:confidence]}%"
    )
  end

  def image_params(url)
    if url.start_with?("s3://")
      # Direct S3 reference
      bucket, key = url.gsub("s3://", "").split("/", 2)
      { s3_object: { bucket: bucket, name: key } }
    elsif url.include?("amazonaws.com")
      # Parse S3 URL
      uri = URI.parse(url)
      bucket = uri.host.split(".").first
      key = uri.path[1..]
      { s3_object: { bucket: bucket, name: key } }
    else
      # Download from URL and pass as bytes
      { bytes: download_image(url) }
    end
  end

  def download_image(url)
    require "open-uri"
    URI.open(url, read_timeout: 10) { |f| f.read }
  rescue StandardError => e
    Rails.logger.error("FaceVerificationJob: Failed to download image from #{url}: #{e.message}")
    raise
  end

  def aws_configured?
    ENV["AWS_ACCESS_KEY_ID"].present? &&
      ENV["AWS_SECRET_ACCESS_KEY"].present? &&
      ENV["AWS_REGION"].present?
  end

  def rekognition_client
    @rekognition_client ||= Aws::Rekognition::Client.new(
      region: ENV.fetch("AWS_REGION", "ap-southeast-2"),
      credentials: Aws::Credentials.new(
        ENV["AWS_ACCESS_KEY_ID"],
        ENV["AWS_SECRET_ACCESS_KEY"]
      )
    )
  end
end
