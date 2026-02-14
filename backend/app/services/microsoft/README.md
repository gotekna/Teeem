# Microsoft Graph API Clients

Refactored Feb 2026 from a 1,228-line god service into focused, single-responsibility clients.

## Architecture

```
MicrosoftAppGraphClient (facade - 290 lines)
├── Microsoft::EmailClient (388 lines)
├── Microsoft::UserClient (22 lines)
├── Microsoft::DriveClient (503 lines)
├── Microsoft::CalendarClient (21 lines)
└── Microsoft::BaseClient (257 lines - shared HTTP, auth, retry logic)
```

## Usage

### Backward Compatible (Facade)
All existing code continues to work through the facade:

```ruby
# Still works - delegates to focused clients internally
client = MicrosoftAppGraphClient.for_org(organization)
client.list_users                   # → @user.list_users
client.send_email(...)              # → @email.send_email
client.upload_file_content(...)     # → @drive.upload_file_content
```

### Direct Client Usage (Recommended for New Code)
For new code, use focused clients directly:

```ruby
# Email operations only
credential = MicrosoftCredential.active_for_org(org)
email_client = Microsoft::EmailClient.new(credential)
email_client.send_email(from: "...", to: "...", subject: "...", body: "...")
email_client.get_user_emails("user@example.com")

# Drive operations only
drive_client = Microsoft::DriveClient.new(credential)
drive_client.upload_file_content(site_id, drive_id, path, filename, content)
drive_client.list_sharepoint_sites

# User management only
user_client = Microsoft::UserClient.new(credential)
user_client.list_users
user_client.get_user("user@example.com")

# Calendar operations only
calendar_client = Microsoft::CalendarClient.new(credential)
calendar_client.get_user_calendar_events("user@example.com")
```

## Client Responsibilities

### BaseClient (Shared)
- Authentication & token management
- HTTP request helpers (get, post, patch, put, delete)
- Retry logic (401 token refresh, 429 rate limiting, 503 service unavailable)
- Dead token detection
- Error handling

### EmailClient
- List/get/search emails
- Send email (with attachments, threading)
- Mark read/unread
- Download attachments & MIME content
- List mail folders
- Move/delete emails
- Delta sync
- Batch operations (MIME, multi-user sync)

### UserClient
- List users in tenant
- Get user by email or ID

### DriveClient
- SharePoint sites (list, get, drives)
- OneDrive access
- File operations (list, get, search, download, delete)
- Upload (small files, large files with chunking)
- Folder management (create, ensure exists)
- File operations (copy, move, convert to PDF)
- Share links
- Tenant-wide search

### CalendarClient
- Get calendar events for user

## Migration Notes

- **NO breaking changes** - All existing callers work unchanged through the facade
- Facade delegates method calls to appropriate focused clients
- Exceptions re-exported from BaseClient for backward compatibility
- Each focused client is under 510 lines (most under 400)
- BaseClient extracted ~850 lines of shared HTTP/auth/retry logic (was duplicated in original god service methods)

## File Locations

```
backend/app/services/
├── microsoft/
│   ├── base_client.rb          # Shared auth, HTTP, retry logic
│   ├── email_client.rb         # Email operations
│   ├── user_client.rb          # User management
│   ├── drive_client.rb         # SharePoint/OneDrive/file operations
│   ├── calendar_client.rb      # Calendar operations
│   └── README.md               # This file
└── microsoft_app_graph_client.rb   # Facade (backward compatibility)
```

## Benefits

1. **Single Responsibility** - Each client does ONE thing
2. **Testability** - Easier to test focused clients in isolation
3. **Maintainability** - Changes to email logic don't risk breaking drive operations
4. **Discoverability** - Clear which client handles what functionality
5. **Reusability** - Can instantiate only the client you need
6. **No Breaking Changes** - Facade preserves all existing behavior
