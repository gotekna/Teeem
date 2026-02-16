module Api
  module V1
    class SentryController < ApplicationController
      before_action :require_admin

      SENTRY_API_BASE = "https://sentry.io/api/0".freeze
      CACHE_TTL = 5.minutes

      # GET /api/v1/sentry/issues
      # Proxies Sentry API to return unresolved issues sorted by frequency
      def issues
        force_refresh = params[:refresh] == "true"
        cache_key = "sentry:issues:#{sentry_org}:#{sentry_project}"

        unless force_refresh
          cached = Rails.cache.read(cache_key)
          if cached
            return render json: { success: true, data: cached, cached: true }
          end
        end

        response = fetch_sentry_issues
        if response[:success]
          Rails.cache.write(cache_key, response[:data], expires_in: CACHE_TTL)
          render json: { success: true, data: response[:data] }
        else
          render json: { success: false, error: response[:error] }, status: response[:status] || :bad_gateway
        end
      end

      # POST /api/v1/sentry/issues/:id/resolve
      # Marks an issue as resolved in Sentry
      def resolve
        issue_id = params[:id]
        response = update_sentry_issue(issue_id, status: "resolved")

        if response[:success]
          # Invalidate cache so next fetch shows updated status
          Rails.cache.delete("sentry:issues:#{sentry_org}:#{sentry_project}")
          render json: { success: true, data: response[:data] }
        else
          render json: { success: false, error: response[:error] }, status: response[:status] || :bad_gateway
        end
      end

      private

      def sentry_token
        ENV["SENTRY_AUTH_TOKEN"]
      end

      def sentry_org
        ENV["SENTRY_ORG_SLUG"] || "teeem-pty-ltd"
      end

      def sentry_project
        ENV["SENTRY_PROJECT_SLUG"] || "javascript-nextjs"
      end

      def sentry_headers
        {
          "Authorization" => "Bearer #{sentry_token}",
          "Content-Type" => "application/json"
        }
      end

      def fetch_sentry_issues
        unless sentry_token.present?
          return { success: false, error: "SENTRY_AUTH_TOKEN not configured", status: :service_unavailable }
        end

        uri = URI("#{SENTRY_API_BASE}/projects/#{sentry_org}/#{sentry_project}/issues/?query=is:unresolved&sort=freq&statsPeriod=14d")

        response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 15) do |http|
          request = Net::HTTP::Get.new(uri)
          sentry_headers.each { |k, v| request[k] = v }
          http.request(request)
        end

        if response.code.to_i == 200
          issues = JSON.parse(response.body)
          formatted = issues.map { |issue| format_issue(issue) }
          {
            success: true,
            data: {
              issues: formatted,
              total_issues: formatted.size,
              total_events: formatted.sum { |i| i[:count] },
              critical_count: formatted.count { |i| i[:level] == "fatal" || i[:level] == "error" }
            }
          }
        else
          Rails.logger.error "[Sentry] API error: #{response.code} - #{response.body}"
          { success: false, error: "Sentry API returned #{response.code}", status: :bad_gateway }
        end
      rescue Net::OpenTimeout, Net::ReadTimeout => e
        Rails.logger.error "[Sentry] Timeout: #{e.message}"
        { success: false, error: "Sentry API timeout", status: :gateway_timeout }
      rescue StandardError => e
        Rails.logger.error "[Sentry] Error: #{e.message}"
        { success: false, error: "Failed to contact Sentry API", status: :bad_gateway }
      end

      def update_sentry_issue(issue_id, updates)
        unless sentry_token.present?
          return { success: false, error: "SENTRY_AUTH_TOKEN not configured", status: :service_unavailable }
        end

        uri = URI("#{SENTRY_API_BASE}/issues/#{issue_id}/")

        response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 15) do |http|
          request = Net::HTTP::Put.new(uri)
          sentry_headers.each { |k, v| request[k] = v }
          request.body = updates.to_json
          http.request(request)
        end

        if response.code.to_i == 200
          { success: true, data: JSON.parse(response.body) }
        else
          Rails.logger.error "[Sentry] Update error: #{response.code} - #{response.body}"
          { success: false, error: "Sentry API returned #{response.code}", status: :bad_gateway }
        end
      rescue Net::OpenTimeout, Net::ReadTimeout => e
        Rails.logger.error "[Sentry] Timeout: #{e.message}"
        { success: false, error: "Sentry API timeout", status: :gateway_timeout }
      rescue StandardError => e
        Rails.logger.error "[Sentry] Error: #{e.message}"
        { success: false, error: "Failed to contact Sentry API", status: :bad_gateway }
      end

      def format_issue(issue)
        {
          id: issue["id"],
          title: issue["title"],
          culprit: issue["culprit"],
          count: issue["count"]&.to_i || 0,
          user_count: issue["userCount"]&.to_i || 0,
          level: issue["level"],
          status: issue["status"],
          first_seen: issue["firstSeen"],
          last_seen: issue["lastSeen"],
          permalink: issue["permalink"],
          short_id: issue["shortId"],
          metadata: {
            type: issue.dig("metadata", "type"),
            value: issue.dig("metadata", "value")
          }
        }
      end
    end
  end
end
