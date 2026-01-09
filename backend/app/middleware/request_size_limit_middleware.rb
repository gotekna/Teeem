# frozen_string_literal: true

# Middleware to limit request body size (security: prevents DoS via large uploads)
# Rejects requests with Content-Length exceeding the configured limit before
# the body is read into memory.
#
# Usage:
#   config.middleware.use RequestSizeLimitMiddleware, max_bytes: 100.megabytes
#
class RequestSizeLimitMiddleware
  def initialize(app, max_bytes: 100.megabytes)
    @app = app
    @max_bytes = max_bytes
  end

  def call(env)
    content_length = env["CONTENT_LENGTH"].to_i

    # Only check requests with a body (POST, PUT, PATCH)
    if content_length > 0 && content_length > @max_bytes
      return [
        413,
        {
          "Content-Type" => "application/json",
          "X-Request-Size-Limit" => @max_bytes.to_s
        },
        [{ success: false, error: "Request body too large. Maximum size is #{@max_bytes / 1.megabyte}MB." }.to_json]
      ]
    end

    @app.call(env)
  end
end
