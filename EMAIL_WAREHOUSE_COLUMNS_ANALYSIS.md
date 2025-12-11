# Email Warehouse Column Analysis

## Currently Populated (✓)
| Column | Status | Keep? | Notes |
|--------|--------|-------|-------|
| `id` | ✓ HAS DATA | ✅ KEEP | Primary key |
| `internet_message_id` | ✓ HAS DATA | ✅ KEEP | Unique email identifier (SSoT) |
| `outlook_id` | ✓ HAS DATA | ✅ KEEP | Microsoft Graph API ID |
| `conversation_id` | ✓ HAS DATA | ✅ KEEP | Email threading |
| `subject` | ✓ HAS DATA | ✅ KEEP | Email subject |
| `body_preview` | ✓ HAS DATA | ✅ KEEP | 500-char preview (lightweight) |
| `from_email` | ✓ HAS DATA | ✅ KEEP | Sender email |
| `from_name` | ✓ HAS DATA | ✅ KEEP | Sender display name |
| `to_emails` | ✓ HAS DATA | ✅ KEEP | Array of recipients |
| `cc_emails` | ✓ HAS DATA | ✅ KEEP | Array of CC'd emails |
| `received_at` | ✓ HAS DATA | ✅ KEEP | When email was received |
| `has_attachments` | ✓ HAS DATA | ✅ KEEP | Boolean flag |
| `attachment_count` | ✓ HAS DATA | ✅ KEEP | Auto-populated after attachment sync |
| `folder_name` | ✓ HAS DATA | ✅ KEEP | Inbox/Sent/etc |
| `is_read` | ✓ HAS DATA | ✅ KEEP | Read status |
| `mailbox_owner_email` | ✓ HAS DATA | ✅ KEEP | Which mailbox this came from |
| `microsoft_credential_id` | ✓ HAS DATA | ✅ KEEP | Which org this belongs to |
| `first_synced_at` | ✓ HAS DATA | ✅ KEEP | Initial sync timestamp |
| `last_synced_at` | ✓ HAS DATA | ✅ KEEP | Last sync timestamp |
| `created_at` | ✓ HAS DATA | ✅ KEEP | Rails timestamp |
| `updated_at` | ✓ HAS DATA | ✅ KEEP | Rails timestamp |
| `sharepoint_email_file_id` | ✓ HAS DATA | ✅ KEEP | .eml file in SharePoint |
| `sharepoint_email_path` | ✓ HAS DATA | ✅ KEEP | Path to .eml in SharePoint |

## Currently Empty (✗) - Need to Fill
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `body_text` | ✗ EMPTY | 🔧 **ADD TO SYNC** | Plain text body - needed for search/AI |
| `body_html` | ✗ EMPTY | 🔧 **ADD TO SYNC** | HTML body - needed for display |
| `bcc_emails` | ✗ EMPTY | ✅ KEEP AS-IS | Rarely available from API |

## Currently Empty - AI/Processing Columns (Fill Later)
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `ai_summary` | ✗ EMPTY | ⏰ LATER | AI-generated summary (~200 chars) |
| `email_classification` | ✗ EMPTY | ⏰ LATER | spam/marketing/business JSON |
| `action_items` | ✗ EMPTY | ⏰ LATER | AI-extracted TODOs |
| `extracted_contacts` | ✗ EMPTY | ⏰ LATER | Contacts from signature |
| `extracted_entities` | ✗ EMPTY | ⏰ LATER | Jobs/cases extracted |

## Currently Empty - Contact Matching (NEW!)
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `contact_ids` | ✗ EMPTY | ⏰ AFTER SYNC | Array of matched contact IDs |
| `primary_contact_id` | ✗ EMPTY | ⏰ AFTER SYNC | Main contact (sender or recipient) |
| `contacts_matched_at` | ✗ EMPTY | ⏰ AFTER SYNC | When contacts were matched |

## Currently Empty - Job Matching
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `job_id` | ✗ EMPTY | ⏰ LATER | Matched job |
| `match_type` | ✗ EMPTY | ⏰ LATER | auto/manual |
| `match_confidence` | ✗ EMPTY | ⏰ LATER | 0.0-1.0 |
| `matched_at` | ✗ EMPTY | ⏰ LATER | When matched |

## Currently Empty - User Classification
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `user_classification` | ✗ EMPTY | ⏰ LATER | User override |
| `user_classification_at` | ✗ EMPTY | ⏰ LATER | When classified |
| `user_classification_by_id` | ✗ EMPTY | ⏰ LATER | Which user |

## Currently Empty - SSoT Fields
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `ssot_owner_id` | ✗ EMPTY | ❓ MAYBE REMOVE | Unclear usage |
| `synced_by_user_id` | ✗ EMPTY | ❓ MAYBE KEEP | Tracks who initiated sync |

## Currently Empty - Email Headers
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `sent_at` | ✗ EMPTY | ✅ AVAILABLE | Sent timestamp (different from received) |
| `in_reply_to` | ✗ EMPTY | ✅ AVAILABLE | For threading |
| `references` | ✗ EMPTY | ✅ AVAILABLE | Email thread references |
| `internet_headers` | ✗ EMPTY | ❓ SKIP | SPF/DKIM headers - rarely needed |
| `importance` | ✗ EMPTY | ✅ AVAILABLE | High/Low priority |

## Full-text Search
| Column | Status | Action | Notes |
|--------|--------|--------|-------|
| `searchable` | ✓ AUTO | ✅ KEEP | PostgreSQL tsvector (auto-generated) |
| `is_latest_in_thread` | ✓ AUTO | ✅ KEEP | For threading (auto-calculated) |

---

## Recommendations

### 🔧 IMMEDIATE: Update OrgEmailSyncJob
Add to sync (already returned by Microsoft Graph API):
- `body_text` - Extract from `body.content` when `body.contentType = "text"`
- `body_html` - Extract from `body.content` when `body.contentType = "html"`
- `sent_at` - From `sentDateTime`
- `in_reply_to` - From `inReplyTo`
- `references` - From `references`
- `importance` - From `importance`

### ⏰ LATER: Background Processing Jobs
1. **ContactEmailMatchJob** - Match emails to contacts (already created!)
2. **EmailAISummaryJob** - Generate AI summaries for all emails
3. **EmailClassificationJob** - Classify as spam/marketing/business
4. **JobMatchJob** - Auto-match emails to jobs

### ❌ CONSIDER REMOVING
- `ssot_owner_id` - Unclear purpose, seems redundant with `mailbox_owner_email`
- `internet_headers` - Rarely needed, can fetch on-demand if required

### ✅ KEEP EMPTY (Populated on-demand or by users)
- `bcc_emails` - Not available in most API responses
- `user_classification*` - Only populated when user overrides AI
- `job_id`, `match_*` - Populated by job matching logic