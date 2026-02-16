# frozen_string_literal: true

module Microsoft
  # Client for Microsoft Graph Calendar operations
  # Handles calendar event access and management
  class CalendarClient < BaseClient
    # Get calendar events for a user
    def get_user_calendar_events(user_identifier, start_time: nil, end_time: nil, top: 50)
      endpoint = "/users/#{CGI.escape(user_identifier)}/calendar/events"

      params = { "$top" => top, "$orderby" => "start/dateTime" }

      if start_time && end_time
        params["$filter"] = "start/dateTime ge '#{start_time.iso8601}' and end/dateTime le '#{end_time.iso8601}'"
      end

      response = get(endpoint, params)
      response["value"] || []
    end
  end
end
