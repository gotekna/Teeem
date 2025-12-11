# frozen_string_literal: true

# Configure Anthropic client globally
# This ensures the API key is always available and validates it at boot time
#
Anthropic.configure do |config|
  config.access_token = ENV.fetch("ANTHROPIC_API_KEY", nil)
end
