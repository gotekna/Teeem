# MicrosoftAppGraphClient - Facade for Microsoft Graph API clients
# This is a thin wrapper that delegates to focused clients for backward compatibility
#
# SSoT Usage (preferred - org-scoped):
#   client = MicrosoftAppGraphClient.for_org(organization)
#   client = MicrosoftAppGraphClient.for_org('Tekna')
#
# Legacy Usage (deprecated - logs warning):
#   client = MicrosoftAppGraphClient.new
#   client.list_users
#   client.get_user_emails('user@tekna.com.au')
#   client.get_user_email('user@tekna.com.au', 'message_id')
#
# Architecture (Feb 2026 refactor):
#   MicrosoftAppGraphClient (facade) delegates to:
#   - Microsoft::EmailClient - Email operations
#   - Microsoft::UserClient - User management
#   - Microsoft::DriveClient - SharePoint/OneDrive/file operations
#   - Microsoft::CalendarClient - Calendar operations
#   All inherit from Microsoft::BaseClient (auth, HTTP, error handling)

class MicrosoftAppGraphClient
  GRAPH_API_BASE = MicrosoftGraphBase::GRAPH_API_BASE

  attr_reader :credential, :email, :user, :drive, :calendar

  # Re-export exceptions from BaseClient for backward compatibility
  class NotConnectedError < Microsoft::BaseClient::NotConnectedError; end
  class ApiError < Microsoft::BaseClient::ApiError; end
  class DeadTokenError < Microsoft::BaseClient::DeadTokenError; end

  # SSoT: Reference MicrosoftTokenManager for dead token error codes
  def self.dead_token_error?(error_message)
    Microsoft::BaseClient.dead_token_error?(error_message)
  end

  # SSoT: Create client with org-scoped credential lookup (preferred)
  # @param organization [Organization, String] Organization object or name/slug
  # @return [MicrosoftAppGraphClient] Client scoped to the organization
  def self.for_org(organization)
    org = case organization
          when Organization
            organization
          when String
            Organization.find_by_name_or_slug(organization)
          when Integer
            Organization.find_by(id: organization)
          else
            raise ArgumentError, "organization must be an Organization, String, or Integer"
          end

    raise Microsoft::BaseClient::NotConnectedError, "Organization not found: #{organization}" unless org

    # SSoT: Use MicrosoftCredential only
    credential = MicrosoftCredential.active_for_org(org)

    raise Microsoft::BaseClient::NotConnectedError, "No SharePoint credential configured for #{org.name}. Configure in Admin > System > Connections." unless credential

    new(credential)
  end

  def initialize(credential = nil)
    @credential = credential || find_active_credential
    raise Microsoft::BaseClient::NotConnectedError, "SharePoint not configured. Please configure in Admin > System > Connections." unless @credential

    # Initialize focused clients
    @email = Microsoft::EmailClient.new(@credential)
    @user = Microsoft::UserClient.new(@credential)
    @drive = Microsoft::DriveClient.new(@credential)
    @calendar = Microsoft::CalendarClient.new(@credential)
  end

  # Ensure we have a valid token, refreshing if needed
  # Delegates to the email client (all clients share same credential)
  def ensure_valid_token!
    @email.ensure_valid_token!
  end

  private

  # Find active credential - SSoT: MicrosoftCredential only
  # DEPRECATED: Use MicrosoftAppGraphClient.for_org(organization) instead
  def find_active_credential
    # Log deprecation warning - this should not be called in new code
    Rails.logger.warn "[MicrosoftAppGraphClient] DEPRECATED: find_active_credential called without org context. " \
                      "Use MicrosoftAppGraphClient.for_org(organization) instead. " \
                      "Caller: #{caller(1, 3).join(' <- ')}"

    # SSoT: Use MicrosoftCredential only
    MicrosoftCredential.active_credential
  end

  public

  # ==========================================
  # User Management (delegates to Microsoft::UserClient)
  # ==========================================

  def list_users(select: nil, filter: nil, top: 100)
    @user.list_users(select: select, filter: filter, top: top)
  end

  def get_user(user_identifier)
    @user.get_user(user_identifier)
  end

  # ==========================================
  # Email Access (delegates to Microsoft::EmailClient)
  # ==========================================

  def get_user_emails(user_identifier, folder: "inbox", top: 50, filter: nil, search: nil, since: nil, skip: nil)
    @email.get_user_emails(user_identifier, folder: folder, top: top, filter: filter, search: search, since: since, skip: skip)
  end

  def get_user_email(user_identifier, message_id, include_body: true)
    @email.get_user_email(user_identifier, message_id, include_body: include_body)
  end

  def mark_message_read(user_identifier, message_id, is_read: true)
    @email.mark_message_read(user_identifier, message_id, is_read: is_read)
  end

  def get_email_attachments(user_identifier, message_id)
    @email.get_email_attachments(user_identifier, message_id)
  end

  def download_email_attachment(user_identifier, message_id, attachment_id)
    @email.download_email_attachment(user_identifier, message_id, attachment_id)
  end

  def get_email_mime_content(user_identifier, message_id)
    @email.get_email_mime_content(user_identifier, message_id)
  end

  def get_user_mail_folders(user_identifier, max_depth: 3)
    @email.get_user_mail_folders(user_identifier, max_depth: max_depth)
  end

  def send_email(from:, to:, subject:, body:, cc: [], bcc: [], attachments: [], reply_to_message_id: nil)
    @email.send_email(from: from, to: to, subject: subject, body: body, cc: cc, bcc: bcc, attachments: attachments, reply_to_message_id: reply_to_message_id)
  end

  def search_user_emails(user_identifier, query, top: 50)
    @email.search_user_emails(user_identifier, query, top: top)
  end

  def move_user_email(user_identifier, message_id, destination_folder_id)
    @email.move_user_email(user_identifier, message_id, destination_folder_id)
  end

  def delete_user_email(user_identifier, message_id)
    @email.delete_user_email(user_identifier, message_id)
  end

  def delete_user_email!(user_identifier, message_id)
    @email.delete_user_email!(user_identifier, message_id)
  end

  def get_user_emails_delta(user_identifier, delta_link: nil, folder: "inbox")
    @email.get_user_emails_delta(user_identifier, delta_link: delta_link, folder: folder)
  end

  def batch_get_email_mime_content(email_requests)
    @email.batch_get_email_mime_content(email_requests)
  end

  def batch_get_emails(user_emails, folder: "inbox", top: 20)
    @email.batch_get_emails(user_emails, folder: folder, top: top)
  end

  # ==========================================
  # SharePoint Site Access (delegates to Microsoft::DriveClient)
  # ==========================================

  def list_sharepoint_sites(search: nil, top: 100)
    @drive.list_sharepoint_sites(search: search, top: top)
  end

  def get_all_sites(top: 200)
    @drive.get_all_sites(top: top)
  end

  def get_site(site_id)
    @drive.get_site(site_id)
  end

  def get_site_drives(site_id)
    @drive.get_site_drives(site_id)
  end

  # ==========================================
  # OneDrive Access (delegates to Microsoft::DriveClient)
  # ==========================================

  def get_user_drive(user_identifier)
    @drive.get_user_drive(user_identifier)
  end

  def list_user_drive_items(user_identifier, folder_path: nil, top: 100)
    @drive.list_user_drive_items(user_identifier, folder_path: folder_path, top: top)
  end

  # ==========================================
  # Drive Item Operations (delegates to Microsoft::DriveClient)
  # ==========================================

  def list_drive_items(drive_id, folder_path: nil, folder_id: nil, top: 100)
    @drive.list_drive_items(drive_id, folder_path: folder_path, folder_id: folder_id, top: top)
  end

  def get_drive_item(drive_id, item_id)
    @drive.get_drive_item(drive_id, item_id)
  end

  def get_item_by_path(drive_id, path)
    @drive.get_item_by_path(drive_id, path)
  end

  def search_drive(drive_id, query, top: 50)
    @drive.search_drive(drive_id, query, top: top)
  end

  def get_drive_item_content(site_id: nil, drive_id:, item_id:)
    @drive.get_drive_item_content(site_id: site_id, drive_id: drive_id, item_id: item_id)
  end

  def delete_drive_item(site_id: nil, drive_id:, item_id:)
    @drive.delete_drive_item(site_id: site_id, drive_id: drive_id, item_id: item_id)
  end

  def convert_to_pdf(site_id: nil, drive_id:, item_id:)
    @drive.convert_to_pdf(site_id: site_id, drive_id: drive_id, item_id: item_id)
  end

  def search_all_files(query, top: 50)
    @drive.search_all_files(query, top: top)
  end

  # ==========================================
  # Calendar Access (delegates to Microsoft::CalendarClient)
  # ==========================================

  def get_user_calendar_events(user_identifier, start_time: nil, end_time: nil, top: 50)
    @calendar.get_user_calendar_events(user_identifier, start_time: start_time, end_time: end_time, top: top)
  end

  # ==========================================
  # SharePoint Upload Methods (delegates to Microsoft::DriveClient)
  # ==========================================

  def large_file?(size)
    @drive.large_file?(size)
  end

  def upload_file_content(site_id, drive_id, parent_folder_path, filename, content)
    @drive.upload_file_content(site_id, drive_id, parent_folder_path, filename, content)
  end

  def upload_to_folder(drive_id:, parent_folder_id:, filename:, content:)
    @drive.upload_to_folder(drive_id: drive_id, parent_folder_id: parent_folder_id, filename: filename, content: content)
  end

  def create_upload_session(site_id, drive_id, parent_folder_path, filename)
    @drive.create_upload_session(site_id, drive_id, parent_folder_path, filename)
  end

  def upload_large_file(upload_url, content, chunk_size = 320 * 1024)
    @drive.upload_large_file(upload_url, content, chunk_size)
  end

  def ensure_folder_exists(site_id, drive_id, folder_path)
    @drive.ensure_folder_exists(site_id, drive_id, folder_path)
  end

  def create_folder(site_id, drive_id, parent_folder_id, folder_name)
    @drive.create_folder(site_id, drive_id, parent_folder_id, folder_name)
  end

  def copy_file(drive_id:, item_id:, destination_folder_path:, new_name: nil)
    @drive.copy_file(drive_id: drive_id, item_id: item_id, destination_folder_path: destination_folder_path, new_name: new_name)
  end

  def move_file(drive_id:, item_id:, destination_folder_path:, new_name: nil)
    @drive.move_file(drive_id: drive_id, item_id: item_id, destination_folder_path: destination_folder_path, new_name: new_name)
  end

  def create_share_link(drive_id:, item_id:, type: "view", scope: "anonymous")
    @drive.create_share_link(drive_id: drive_id, item_id: item_id, type: type, scope: scope)
  end
end
