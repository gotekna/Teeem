# frozen_string_literal: true

# Register the SharePoint service with ActiveStorage
# This allows using `service: SharePoint` in config/storage.yml
#
# In Rails 8, custom services are auto-discovered by convention.
# The service class at app/services/active_storage/service/share_point_service.rb
# will be loaded automatically when referenced in storage.yml

Rails.application.config.to_prepare do
  require_relative "../../app/services/active_storage/service/share_point_service"
end
