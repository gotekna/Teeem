module Api
  module V1
    class SentryController < ApplicationController
      before_action :require_admin

      SENTRY_API_BASE = "https://sentry.io/api/0".freeze
      CACHE_TTL = 5.minutes

      # GET /api/v1/sentry/issues
      # Proxies Sentry API to return unresolved issues sorted by frequency
      # Queries ALL Sentry projects (frontend + backend) and merges results
      def issues
        force_refresh = params[:refresh] == "true"
        cache_key = "sentry:issues:#{sentry_org}:all_projects"

        unless force_refresh
          cached = Rails.cache.read(cache_key)
          if cached
            return render json: { success: true, data: cached, cached: true }
          end
        end

        response = fetch_all_sentry_issues
        if response[:success]
          Rails.cache.write(cache_key, response[:data], expires_in: CACHE_TTL)
          render json: { success: true, data: response[:data] }
        else
          render json: { success: false, error: response[:error] }, status: response[:status] || :bad_gateway
        end
      end

      # GET /api/v1/sentry/issues/:id/detail
      # Fetches the latest event for an issue including stack trace
      def detail
        issue_id = params[:id]
        response = fetch_issue_detail(issue_id)

        if response[:success]
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
          Rails.cache.delete("sentry:issues:#{sentry_org}:all_projects")
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
        ENV["SENTRY_PROJECT_SLUG"] || "teeem-frontend"
      end

      def sentry_projects
        (ENV["SENTRY_PROJECT_SLUGS"] || "teeem-frontend,teeem-backend").split(",").map(&:strip)
      end

      def sentry_headers
        {
          "Authorization" => "Bearer #{sentry_token}",
          "Content-Type" => "application/json"
        }
      end

      def fetch_all_sentry_issues
        unless sentry_token.present?
          return { success: false, error: "SENTRY_AUTH_TOKEN not configured", status: :service_unavailable }
        end

        all_formatted = []
        errors = []

        sentry_projects.each do |project|
          uri = URI("#{SENTRY_API_BASE}/projects/#{sentry_org}/#{project}/issues/?query=is:unresolved&sort=freq&statsPeriod=14d")

          response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 15) do |http|
            request = Net::HTTP::Get.new(uri)
            sentry_headers.each { |k, v| request[k] = v }
            http.request(request)
          end

          if response.code.to_i == 200
            issues = JSON.parse(response.body)
            all_formatted.concat(issues.map { |issue| format_issue(issue, project) })
          else
            Rails.logger.error "[Sentry] API error for #{project}: #{response.code} - #{response.body}"
            errors << "#{project}: #{response.code}"
          end
        end

        # Sort merged results by count (frequency) descending
        all_formatted.sort_by! { |i| -i[:count] }

        if all_formatted.any? || errors.empty?
          {
            success: true,
            data: {
              issues: all_formatted,
              total_issues: all_formatted.size,
              total_events: all_formatted.sum { |i| i[:count] },
              critical_count: all_formatted.count { |i| i[:level] == "fatal" || i[:level] == "error" }
            }
          }
        else
          { success: false, error: "Sentry API errors: #{errors.join(', ')}", status: :bad_gateway }
        end
      rescue Net::OpenTimeout, Net::ReadTimeout => e
        Rails.logger.error "[Sentry] Timeout: #{e.message}"
        { success: false, error: "Sentry API timeout", status: :gateway_timeout }
      rescue StandardError => e
        Rails.logger.error "[Sentry] Error: #{e.message}"
        { success: false, error: "Failed to contact Sentry API", status: :bad_gateway }
      end

      def fetch_issue_detail(issue_id)
        unless sentry_token.present?
          return { success: false, error: "SENTRY_AUTH_TOKEN not configured", status: :service_unavailable }
        end

        # Fetch the latest event for this issue
        uri = URI("#{SENTRY_API_BASE}/issues/#{issue_id}/events/latest/")

        response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 15) do |http|
          request = Net::HTTP::Get.new(uri)
          sentry_headers.each { |k, v| request[k] = v }
          http.request(request)
        end

        if response.code.to_i == 200
          event = JSON.parse(response.body)
          { success: true, data: format_event_detail(event) }
        else
          Rails.logger.error "[Sentry] Detail error: #{response.code} - #{response.body}"
          { success: false, error: "Sentry API returned #{response.code}", status: :bad_gateway }
        end
      rescue Net::OpenTimeout, Net::ReadTimeout => e
        Rails.logger.error "[Sentry] Timeout: #{e.message}"
        { success: false, error: "Sentry API timeout", status: :gateway_timeout }
      rescue StandardError => e
        Rails.logger.error "[Sentry] Error: #{e.message}"
        { success: false, error: "Failed to contact Sentry API", status: :bad_gateway }
      end

      def format_event_detail(event)
        # Extract stack trace frames
        exception_entry = event.dig("entries")&.find { |e| e["type"] == "exception" }
        frames = exception_entry&.dig("data", "values")&.flat_map { |v|
          (v.dig("stacktrace", "frames") || []).map { |f|
            {
              filename: f["filename"],
              function: f["function"],
              line_no: f["lineNo"],
              col_no: f["colNo"],
              context: f["context"],
              in_app: f["inApp"]
            }
          }
        } || []

        # Extract breadcrumbs (last 10)
        breadcrumb_entry = event.dig("entries")&.find { |e| e["type"] == "breadcrumbs" }
        breadcrumbs = (breadcrumb_entry&.dig("data", "values") || []).last(10).map { |b|
          { category: b["category"], message: b["message"], level: b["level"], timestamp: b["timestamp"] }
        }

        {
          event_id: event["eventID"],
          title: event["title"],
          message: event["message"],
          level: event["context"]&.dig("level") || event["tags"]&.find { |t| t["key"] == "level" }&.dig("value"),
          timestamp: event["dateCreated"],
          url: event["context"]&.dig("url") || event["tags"]&.find { |t| t["key"] == "url" }&.dig("value"),
          browser: event["tags"]&.find { |t| t["key"] == "browser" }&.dig("value"),
          os: event["tags"]&.find { |t| t["key"] == "os" }&.dig("value"),
          exception_type: exception_entry&.dig("data", "values", 0, "type"),
          exception_value: exception_entry&.dig("data", "values", 0, "value"),
          stack_frames: frames.select { |f| f[:in_app] }.reverse,
          all_frames: frames.reverse,
          breadcrumbs: breadcrumbs
        }
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

      def format_issue(issue, project = nil)
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
          project: project,
          metadata: {
            type: issue.dig("metadata", "type"),
            value: issue.dig("metadata", "value")
          }
        }
      end
    end
  end
end
