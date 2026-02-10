# Automatically increment version on Rails startup in development mode
# This ensures the version number displayed in the UI is always current
Rails.application.config.after_initialize do
  if Rails.env.development?
    begin
      # Wait a moment to ensure database is ready
      sleep 0.5

      # Increment version
      new_version = AppVersion.increment!
      Rails.logger.info "Development version incremented to v#{new_version}"
    rescue => e
      Rails.logger.warn "Could not increment development version: #{e.message}"
      # Don't fail startup if version increment fails
    end
  end
end
