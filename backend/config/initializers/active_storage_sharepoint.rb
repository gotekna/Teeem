# frozen_string_literal: true

# Register the SharePoint service with ActiveStorage
# This allows using `service: SharePoint` in config/storage.yml

require "active_storage/service"

Rails.application.config.to_prepare do
  require_relative "../../app/services/active_storage/service/share_point_service"
  ActiveStorage::Service.services[:share_point] = ActiveStorage::Service::SharePointService
end
