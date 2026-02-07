module Bpmn
  module Tasks
    class CallWebhookTask < BaseTask
      def execute
        url = get_config("url", interpolate_value: true)
        method = (@config["method"] || "POST").upcase
        headers = @config["headers"] || {}

        raise "No URL specified" if url.blank?

        log_info("Calling webhook: #{method} #{url}")

        # Build request body
        body = build_request_body

        # Make HTTP request
        response = make_request(url, method, headers, body)

        # Store response if configured
        if @config["store_response_as"]
          set_variable(@config["store_response_as"], {
            status: response.code.to_i,
            body: parse_response_body(response),
            headers: response.to_hash
          })
        end

        {
          url: url,
          method: method,
          status: response.code.to_i,
          success: response.code.to_i.between?(200, 299),
          called_at: Time.current.iso8601
        }
      end

      private

      def build_request_body
        return nil if @config["body"].blank?

        body_config = @config["body"]

        if body_config.is_a?(Hash)
          # Interpolate all string values
          interpolate_hash(body_config).to_json
        else
          interpolate(body_config.to_s)
        end
      end

      def interpolate_hash(hash)
        hash.transform_values do |value|
          case value
          when String
            interpolate(value)
          when Hash
            interpolate_hash(value)
          when Array
            value.map { |v| v.is_a?(String) ? interpolate(v) : v }
          else
            value
          end
        end
      end

      def make_request(url, method, headers, body)
        uri = URI.parse(url)

        request = case method
        when "GET"
                    Net::HTTP::Get.new(uri.request_uri)
        when "POST"
                    Net::HTTP::Post.new(uri.request_uri)
        when "PUT"
                    Net::HTTP::Put.new(uri.request_uri)
        when "PATCH"
                    Net::HTTP::Patch.new(uri.request_uri)
        when "DELETE"
                    Net::HTTP::Delete.new(uri.request_uri)
        else
                    raise "Unsupported HTTP method: #{method}"
        end

        # Set headers
        request["Content-Type"] = "application/json"
        headers.each { |key, value| request[key] = interpolate(value.to_s) }

        # Set body
        request.body = body if body.present? && %w[POST PUT PATCH].include?(method)

        Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 30, read_timeout: 60) do |http|
          http.request(request)
        end
      end

      def parse_response_body(response)
        JSON.parse(response.body)
      rescue JSON::ParserError
        response.body
      end
    end
  end
end
