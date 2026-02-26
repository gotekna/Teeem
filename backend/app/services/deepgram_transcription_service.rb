# frozen_string_literal: true

# DeepgramTranscriptionService - Voice note transcription (Phase 2)
#
# Transcribes audio files (WhatsApp voice notes, Signal voice messages)
# using Deepgram Nova-3 API. Cost: ~$0.004/minute.
#
# Usage:
#   # From URL (WhatsApp/Twilio media)
#   text = DeepgramTranscriptionService.transcribe_url(url: media_url, content_type: "audio/ogg")
#
#   # From file content (Signal voice messages)
#   text = DeepgramTranscriptionService.transcribe(content: audio_bytes, content_type: "audio/mp4")
#
class DeepgramTranscriptionService
  DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"

  # Default options optimized for voice notes
  DEFAULT_OPTIONS = {
    model: "nova-3",
    language: "en-AU",
    punctuate: true,
    smart_format: true,
    diarize: false,       # Single speaker in voice notes
    utterances: false
  }.freeze

  class << self
    # Transcribe audio from a URL (e.g., Twilio media URL)
    #
    # @param url [String] URL of the audio file
    # @param content_type [String] MIME type of the audio
    # @param options [Hash] Additional Deepgram options
    # @return [String, nil] Transcribed text or nil on failure
    def transcribe_url(url:, content_type: "audio/ogg", **options)
      api_key = resolve_api_key
      unless api_key.present?
        Rails.logger.warn "[Deepgram] DEEPGRAM_API_KEY not configured (checked TenantSetting + ENV)"
        return nil
      end

      query_params = build_query_params(options)
      endpoint = "#{DEEPGRAM_API_URL}?#{query_params}"

      response = HTTParty.post(
        endpoint,
        headers: {
          "Authorization" => "Token #{api_key}",
          "Content-Type" => "application/json"
        },
        body: { url: url }.to_json,
        timeout: 30
      )

      parse_response(response)
    rescue StandardError => e
      Rails.logger.error "[Deepgram] Transcription from URL failed: #{e.message}"
      nil
    end

    # Transcribe raw audio content
    #
    # @param content [String] Raw audio bytes
    # @param content_type [String] MIME type (audio/ogg, audio/mp4, audio/wav, etc.)
    # @param options [Hash] Additional Deepgram options
    # @return [String, nil] Transcribed text or nil on failure
    def transcribe(content:, content_type: "audio/ogg", **options)
      api_key = resolve_api_key
      unless api_key.present?
        Rails.logger.warn "[Deepgram] DEEPGRAM_API_KEY not configured (checked TenantSetting + ENV)"
        return nil
      end

      query_params = build_query_params(options)
      endpoint = "#{DEEPGRAM_API_URL}?#{query_params}"

      response = HTTParty.post(
        endpoint,
        headers: {
          "Authorization" => "Token #{api_key}",
          "Content-Type" => content_type
        },
        body: content,
        timeout: 30
      )

      parse_response(response)
    rescue StandardError => e
      Rails.logger.error "[Deepgram] Transcription failed: #{e.message}"
      nil
    end

    # Check if the Deepgram API is configured and reachable
    def configured?
      resolve_api_key.present?
    end

    private

    # Resolve API key: TenantSetting (per-tenant) → ENV (platform-level)
    def resolve_api_key
      tenant_key = begin
        TenantSetting.instance&.deepgram_api_key
      rescue StandardError
        nil
      end
      tenant_key.presence || ENV["DEEPGRAM_API_KEY"]
    end

    def build_query_params(options)
      merged = DEFAULT_OPTIONS.merge(options)
      merged.map { |k, v| "#{k}=#{v}" }.join("&")
    end

    def parse_response(response)
      unless response.success?
        Rails.logger.error "[Deepgram] API error #{response.code}: #{response.body&.truncate(500)}"
        return nil
      end

      data = JSON.parse(response.body)
      transcript = data.dig("results", "channels", 0, "alternatives", 0, "transcript")

      if transcript.blank?
        Rails.logger.warn "[Deepgram] Empty transcript returned"
        return nil
      end

      Rails.logger.info "[Deepgram] Transcribed: #{transcript.truncate(100)}"
      transcript
    rescue JSON::ParserError => e
      Rails.logger.error "[Deepgram] JSON parse error: #{e.message}"
      nil
    end
  end
end
