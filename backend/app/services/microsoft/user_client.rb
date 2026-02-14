# frozen_string_literal: true

module Microsoft
  # Client for Microsoft Graph User Management
  # Handles user listing and retrieval
  class UserClient < BaseClient
    # List all users in the tenant
    def list_users(select: nil, filter: nil, top: 100)
      params = { "$top" => top }
      params["$select"] = select if select
      params["$filter"] = filter if filter

      response = get("/users", params)
      response["value"] || []
    end

    # Get a specific user by email or user ID
    def get_user(user_identifier)
      get("/users/#{CGI.escape(user_identifier)}")
    end
  end
end
