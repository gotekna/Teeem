# frozen_string_literal: true

module Microsoft
  # Client for Microsoft Graph Email operations
  # Handles email access, sending, searching, and management
  class EmailClient < BaseClient
    # List emails for a specific user
    # user_identifier: email address or user ID
    def get_user_emails(user_identifier, folder: "inbox", top: 50, filter: nil, search: nil, since: nil, skip: nil)
      endpoint = "/users/#{CGI.escape(user_identifier)}/mailFolders/#{folder}/messages"

      params = {
        "$top" => top,
        "$orderby" => "receivedDateTime DESC",
        "$select" => "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,createdDateTime,lastModifiedDateTime,hasAttachments,bodyPreview,body,internetMessageId,conversationId,isRead,importance,isDraft"
      }

      params["$skip"] = skip if skip
      params["$filter"] = filter if filter
      params["$search"] = "\"#{search}\"" if search

      if since
        since_filter = "receivedDateTime ge #{since.iso8601}"
        params["$filter"] = params["$filter"] ? "(#{params['$filter']}) and #{since_filter}" : since_filter
      end

      response = get(endpoint, params)
      response["value"] || []
    end

    # Get a specific email for a user
    def get_user_email(user_identifier, message_id, include_body: true)
      select = "id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,body,internetMessageId,conversationId,isRead"
      select = select.gsub(",body", "") unless include_body

      get("/users/#{CGI.escape(user_identifier)}/messages/#{message_id}", { "$select" => select })
    end

    # Mark a message as read or unread in Office 365
    # @param user_identifier [String] User email or ID
    # @param message_id [String] The MS Graph message ID
    # @param is_read [Boolean] true to mark as read, false to mark as unread
    # @return [Hash] The updated message data
    def mark_message_read(user_identifier, message_id, is_read: true)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}"
      patch(endpoint, { isRead: is_read })
    end

    # Get email attachments (full content - expensive, ~300KB+ per email)
    # Prefer list_email_attachments + download_email_attachment for selective fetching.
    def get_email_attachments(user_identifier, message_id)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments"
      Rails.logger.info "[Microsoft::EmailClient] get_email_attachments - endpoint: #{endpoint}"
      Rails.logger.info "[Microsoft::EmailClient] get_email_attachments - credential tenant: #{@credential.tenant_id}"
      response = get(endpoint)
      response["value"] || []
    end

    # List email attachment metadata only (no contentBytes - fast, ~1KB response)
    # Returns array of { id, name, contentType, size, isInline, @odata.type }
    # Use this to check if an email has real attachments before downloading them.
    # Note: contentId is only on fileAttachment subtype, not base attachment type,
    # so we can't include it in $select (causes 400 error). Get it on individual download.
    def list_email_attachments(user_identifier, message_id)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments" \
                 "?$select=id,name,contentType,size,isInline"
      response = get(endpoint)
      response["value"] || []
    end

    # Download a specific email attachment
    # Returns { content:, filename:, content_type: } or nil on failure
    # Handles both fileAttachment (regular files) and itemAttachment (nested emails)
    def download_email_attachment(user_identifier, message_id, attachment_id)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments/#{attachment_id}"
      attachment = get(endpoint)

      return nil unless attachment

      # Handle file attachments (contentBytes contains base64-encoded content)
      if attachment["@odata.type"] == "#microsoft.graph.fileAttachment" && attachment["contentBytes"]
        {
          content: Base64.decode64(attachment["contentBytes"]),
          filename: attachment["name"] || "attachment",
          content_type: attachment["contentType"] || "application/octet-stream",
          content_id: attachment["contentId"]
        }
      elsif attachment["@odata.type"] == "#microsoft.graph.itemAttachment"
        # Item attachments are nested messages (emails attached to emails)
        # Fetch MIME content via /$value endpoint to get downloadable .eml
        download_item_attachment_mime(user_identifier, message_id, attachment_id, attachment)
      else
        Rails.logger.warn "[Microsoft::EmailClient] Unsupported attachment type: #{attachment['@odata.type']}"
        nil
      end
    rescue StandardError => e
      Rails.logger.error "[Microsoft::EmailClient] Failed to download attachment #{attachment_id}: #{e.message}"
      nil
    end

    # Get email in MIME format (.eml)
    # Returns the raw MIME content of the email message
    # Uses with_retry for proper 429 throttling handling
    def get_email_mime_content(user_identifier, message_id)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/$value"

      with_retry(max_retries: 5) do
        # This endpoint returns raw MIME content, not JSON
        response = HTTP.auth("Bearer #{access_token}")
                       .get("#{GRAPH_API_BASE}#{endpoint}")

        unless response.status.success?
          raise ApiError, "Failed to get email MIME content: #{response.code} - #{response.body}"
        end

        response.body.to_s
      end
    end

    # List mail folders for a user (including nested subfolders)
    def get_user_mail_folders(user_identifier, max_depth: 3)
      folders = []
      fetch_folders_recursive(user_identifier, nil, nil, folders, 0, max_depth)
      folders
    end

    # Send email as a specific user
    # Uses POST /users/{user-id}/sendMail to send email from any user's mailbox
    # Options:
    #   from: sender email address (the mailbox to send from)
    #   to: recipient email(s) (string or array)
    #   cc: CC recipient email(s) (optional)
    #   bcc: BCC recipient email(s) (optional)
    #   subject: email subject
    #   body: email body (HTML supported)
    #   attachments: array of { name:, content: (base64), content_type: } (optional)
    #   reply_to_message_id: internetMessageId of original email (for threading replies)
    def send_email(from:, to:, subject:, body:, cc: [], bcc: [], attachments: [], reply_to_message_id: nil)
      # Build recipients arrays
      to_recipients = Array(to).map { |email| { emailAddress: { address: email } } }
      cc_recipients = Array(cc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }
      bcc_recipients = Array(bcc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }

      # Build message content
      message_content = {
        subject: subject,
        body: {
          contentType: "HTML",
          content: body
        },
        toRecipients: to_recipients
      }

      # Add CC if present
      message_content[:ccRecipients] = cc_recipients if cc_recipients.any?

      # Add BCC if present
      message_content[:bccRecipients] = bcc_recipients if bcc_recipients.any?

      # Add threading headers for replies
      # This ensures the reply appears in the same email thread/conversation
      if reply_to_message_id.present?
        message_content[:internetMessageHeaders] = [
          { name: "In-Reply-To", value: reply_to_message_id },
          { name: "References", value: reply_to_message_id }
        ]
      end

      # Add attachments if present
      if attachments.any?
        message_content[:attachments] = attachments.map do |att|
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: att[:name] || att[:filename],
            contentBytes: att[:content],
            contentType: att[:content_type] || "application/octet-stream"
          }
        end
      end

      # Build request body
      request_body = {
        message: message_content,
        saveToSentItems: true
      }

      # Send using the user's mailbox
      endpoint = "/users/#{CGI.escape(from)}/sendMail"

      url = "#{GRAPH_API_BASE}#{endpoint}"

      with_retry do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers("Content-Type" => "application/json")
                       .post(url, json: request_body)

        # Microsoft Graph returns 202 (Accepted) for successful sendMail
        if response.status.success? || response.status.code == 202
          Rails.logger.info "[Microsoft::EmailClient] Email sent successfully from #{from} to #{to}"
          { success: true, message_id: SecureRandom.uuid }
        else
          error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
          error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
          Rails.logger.error "[Microsoft::EmailClient] Failed to send email: #{response.status.code} - #{error_msg}"
          raise ApiError, "#{response.status.code} - #{error_msg}"
        end
      end
    end

    # Create a draft email in user's mailbox (saves to Drafts folder, does NOT send)
    # Returns the created message hash with id, subject, etc.
    def create_draft(from:, to: [], subject: "", body: "", cc: [], bcc: [], attachments: [], reply_to_message_id: nil)
      message_content = build_message_content(
        to: to, subject: subject, body: body, cc: cc, bcc: bcc,
        attachments: attachments, reply_to_message_id: reply_to_message_id
      )

      endpoint = "/users/#{CGI.escape(from)}/messages"
      post(endpoint, message_content)
    end

    # Update an existing draft in user's mailbox
    # Returns the updated message hash
    def update_draft(from:, draft_id:, to: [], subject: "", body: "", cc: [], bcc: [], attachments: [])
      message_content = build_message_content(
        to: to, subject: subject, body: body, cc: cc, bcc: bcc,
        attachments: attachments
      )

      endpoint = "/users/#{CGI.escape(from)}/messages/#{draft_id}"
      patch(endpoint, message_content)
    end

    # Send an existing draft (moves from Drafts to Sent Items)
    # Returns true on success (Graph returns 202 with no body)
    def send_draft(from:, draft_id:)
      endpoint = "/users/#{CGI.escape(from)}/messages/#{draft_id}/send"
      url = "#{GRAPH_API_BASE}#{endpoint}"

      with_retry do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers("Content-Type" => "application/json")
                       .post(url)

        if response.status.success? || response.status.code == 202
          Rails.logger.info "[Microsoft::EmailClient] Draft #{draft_id} sent successfully from #{from}"
          true
        else
          error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
          error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
          raise ApiError, "#{response.status.code} - #{error_msg}"
        end
      end
    end

    # Delete a draft from user's mailbox
    # Reuses delete_user_email! pattern (treats 404 as success)
    def delete_draft(from:, draft_id:)
      delete_user_email!(from, draft_id)
    end

    # Search emails across a user's mailbox
    def search_user_emails(user_identifier, query, top: 50)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages"

      params = {
        "$top" => top,
        "$search" => "\"#{query}\"",
        "$select" => "id,subject,from,toRecipients,receivedDateTime,hasAttachments,bodyPreview,parentFolderId"
      }

      response = get(endpoint, params)
      response["value"] || []
    end

    # Move an email to a different folder
    # Returns the moved message with its new ID
    def move_user_email(user_identifier, message_id, destination_folder_id)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/move"

      response = post(endpoint, { destinationId: destination_folder_id })
      {
        id: response["id"],
        new_folder_id: response["parentFolderId"],
        subject: response["subject"]
      }
    end

    # Delete an email from a user's mailbox
    # Microsoft Graph DELETE moves to Deleted Items (soft delete)
    # Returns true on success, false on failure (swallows errors - use delete_user_email! for error details)
    def delete_user_email(user_identifier, message_id)
      delete_user_email!(user_identifier, message_id)
      true
    rescue StandardError => e
      Rails.logger.error "[Microsoft::EmailClient] Failed to delete email #{message_id}: #{e.message}"
      false
    end

    # Delete an email - raises on failure (use in controllers where you want error details)
    # Treats 404 as success (email already deleted = goal achieved)
    def delete_user_email!(user_identifier, message_id)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}"
      delete(endpoint)
    rescue ApiError => e
      # 404 = email already deleted from Outlook = goal achieved
      if e.message.include?("404")
        Rails.logger.info "[Microsoft::EmailClient] Email #{message_id} already deleted from Outlook (404)"
        return true
      end
      raise
    end

    # Get emails modified since a delta token (for incremental sync)
    def get_user_emails_delta(user_identifier, delta_link: nil, folder: "inbox")
      if delta_link
        # Use the delta link directly
        response = get_url(delta_link)
      else
        # Initial delta request
        endpoint = "/users/#{CGI.escape(user_identifier)}/mailFolders/#{folder}/messages/delta"
        params = {
          "$select" => "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,bodyPreview,body,internetMessageId,conversationId,isRead,importance"
        }
        response = get(endpoint, params)
      end

      {
        emails: response["value"] || [],
        next_link: response["@odata.nextLink"],
        delta_link: response["@odata.deltaLink"]
      }
    end

    # Batch fetch MIME content for multiple emails (up to 20 per batch)
    # Returns hash of { "user_email:message_id" => mime_content_or_nil }
    # FRC (Jan 2026): Reduces HTTP calls by ~95% (250 emails = 13 batch calls instead of 250)
    def batch_get_email_mime_content(email_requests)
      return {} if email_requests.empty?

      # Microsoft Graph batch limit is 20 requests
      results = {}

      email_requests.each_slice(20) do |batch|
        batch_results = execute_mime_batch(batch)
        results.merge!(batch_results)
      end

      results
    end

    # Batch sync emails for multiple users (more efficient)
    def batch_get_emails(user_emails, folder: "inbox", top: 20)
      requests = user_emails.map.with_index do |email, idx|
        {
          id: idx.to_s,
          method: "GET",
          url: "/users/#{CGI.escape(email)}/mailFolders/#{folder}/messages?$top=#{top}&$orderby=receivedDateTime DESC"
        }
      end

      response = post("/$batch", { requests: requests })

      results = {}
      (response["responses"] || []).each do |resp|
        idx = resp["id"].to_i
        user_email = user_emails[idx]
        if resp["status"] == 200
          results[user_email] = resp["body"]["value"] || []
        else
          Rails.logger.warn "[Microsoft::EmailClient] Failed to get emails for #{user_email}: #{resp['status']}"
          results[user_email] = []
        end
      end
      results
    end

    private

    # Download item attachment (nested email) as MIME content (.eml)
    # Microsoft Graph /$value endpoint returns raw MIME for item attachments
    def download_item_attachment_mime(user_identifier, message_id, attachment_id, attachment_metadata)
      endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments/#{attachment_id}/$value"

      mime_content = with_retry(max_retries: 3) do
        response = HTTP.auth("Bearer #{access_token}")
                       .get("#{GRAPH_API_BASE}#{endpoint}")

        unless response.status.success?
          Rails.logger.warn "[Microsoft::EmailClient] Failed to get item attachment MIME: #{response.code}"
          raise ApiError, "Item attachment MIME fetch failed: #{response.code}"
        end

        response.body.to_s
      end

      return nil unless mime_content.present?

      filename = attachment_metadata["name"] || "attached_message"
      filename = "#{filename}.eml" unless filename.downcase.end_with?(".eml")

      {
        content: mime_content,
        filename: filename,
        content_type: "message/rfc822"
      }
    rescue StandardError => e
      Rails.logger.error "[Microsoft::EmailClient] Failed to download item attachment MIME #{attachment_id}: #{e.message}"
      nil
    end

    # Build Graph API message content hash (reused by send_email, create_draft, update_draft)
    def build_message_content(to: [], subject: "", body: "", cc: [], bcc: [], attachments: [], reply_to_message_id: nil)
      to_recipients = Array(to).reject(&:blank?).map { |email| { emailAddress: { address: email } } }
      cc_recipients = Array(cc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }
      bcc_recipients = Array(bcc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }

      content = {
        subject: subject,
        body: {
          contentType: "HTML",
          content: body
        },
        toRecipients: to_recipients
      }

      content[:ccRecipients] = cc_recipients if cc_recipients.any?
      content[:bccRecipients] = bcc_recipients if bcc_recipients.any?

      if reply_to_message_id.present?
        content[:internetMessageHeaders] = [
          { name: "In-Reply-To", value: reply_to_message_id },
          { name: "References", value: reply_to_message_id }
        ]
      end

      if attachments.any?
        content[:attachments] = attachments.map do |att|
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: att[:name] || att[:filename],
            contentBytes: att[:content],
            contentType: att[:content_type] || "application/octet-stream"
          }
        end
      end

      content
    end

    def fetch_folders_recursive(user_identifier, parent_folder_id, parent_path, folders, depth, max_depth)
      return if depth > max_depth

      # Build endpoint - top level or child folders
      endpoint = if parent_folder_id
        "/users/#{CGI.escape(user_identifier)}/mailFolders/#{parent_folder_id}/childFolders"
      else
        "/users/#{CGI.escape(user_identifier)}/mailFolders"
      end

      response = get(endpoint, { "$top" => 100 })
      (response["value"] || []).each do |folder|
        display_name = folder["displayName"]
        # Build full path for subfolders (e.g., "Inbox/Investments")
        full_path = parent_path ? "#{parent_path}/#{display_name}" : display_name

        folders << {
          id: folder["id"],
          name: full_path,  # Store full path for warehouse filtering
          display_name: display_name,  # Keep original for UI
          total_items: folder["totalItemCount"],
          unread_count: folder["unreadItemCount"],
          depth: depth,
          parent_id: parent_folder_id,
          child_folder_count: folder["childFolderCount"] || 0
        }

        # Recursively fetch child folders if they exist
        if (folder["childFolderCount"] || 0) > 0
          fetch_folders_recursive(user_identifier, folder["id"], full_path, folders, depth + 1, max_depth)
        end
      end
    rescue => e
      Rails.logger.warn "[Microsoft::EmailClient] Failed to fetch folders at depth #{depth}: #{e.message}"
    end

    # Execute a single batch request for MIME content (max 20)
    def execute_mime_batch(batch)
      requests = batch.map.with_index do |req, idx|
        {
          id: idx.to_s,
          method: "GET",
          url: "/users/#{CGI.escape(req[:user_email])}/messages/#{req[:message_id]}/$value",
          headers: { "Accept" => "message/rfc822" }
        }
      end

      results = {}

      with_retry(max_retries: 5) do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers("Content-Type" => "application/json")
                       .post("#{GRAPH_API_BASE}/$batch", json: { requests: requests })

        unless response.status.success?
          raise ApiError, "Batch request failed: #{response.status.code}"
        end

        batch_response = JSON.parse(response.body.to_s)

        (batch_response["responses"] || []).each do |resp|
          idx = resp["id"].to_i
          req = batch[idx]
          key = "#{req[:user_email]}:#{req[:message_id]}"

          if resp["status"] == 200
            # MIME content is in the body
            results[key] = resp["body"]
          else
            error_msg = resp.dig("body", "error", "message") || "HTTP #{resp['status']}"
            Rails.logger.warn "[Microsoft::EmailClient] Batch MIME failed for #{key}: #{error_msg}"
            results[key] = { error: error_msg, status: resp["status"] }
          end
        end
      end

      results
    end
  end
end
