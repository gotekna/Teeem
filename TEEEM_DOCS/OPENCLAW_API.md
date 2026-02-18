# OpenClaw API Documentation

**Base URL:** `https://teeem-production-121159e1ff9d.herokuapp.com/api/v1/external/openclaw`

**Version:** 1.0 (February 2026)

---

## Authentication

All requests require an API key passed via the `X-API-Key` header.

```
X-API-Key: oc_your_api_key_here
```

API keys are generated per-user in **Settings > Users > [User] > OpenClaw Integration**. Each key is tied to a specific user and inherits that user's permissions.

> **Security:** Keys are hashed (SHA-256) before storage. The plaintext key is shown once at generation time. If lost, generate a new one.

---

## Response Format

All responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (missing/invalid params) |
| 401 | Unauthorized (missing or invalid API key) |
| 403 | Forbidden (permission not enabled for this user) |
| 404 | Not Found |
| 422 | Unprocessable Entity (validation error) |

---

## Permissions

Each API key has granular permissions controlled by an admin. Use `GET /me` to discover which permissions are enabled for your key.

| Category | Permission | Description |
|----------|-----------|-------------|
| **Communication** | `chat_messages` | Send/receive chat messages |
| | `notes` | Create notes on jobs and contacts |
| | `send_emails` | Send emails on behalf of the user |
| **Jobs** | `jobs_read` | View job details and lists |
| | `jobs_create` | Create new jobs |
| | `jobs_update` | Update job fields |
| | `job_updates` | Receive job update notifications |
| **Contacts** | `contacts_read` | View contact details and lists |
| | `contacts_create` | Create new contacts |
| | `contacts_update` | Update existing contacts |
| **Documents** | `documents_search` | Search across all documents |
| | `documents_read` | View and download documents |
| | `documents_upload` | Upload new documents |
| **Financial** | `estimates_read` | View estimates |
| | `estimates_create` | Create estimates |
| | `purchase_orders_read` | View purchase orders |
| | `purchase_orders_create` | Create purchase orders |
| | `invoices_read` | View invoices |
| **Schedule & Tasks** | `tasks_read` | View tasks |
| | `tasks_create` | Create tasks |
| | `tasks_update` | Update tasks |
| | `schedule_read` | View the schedule |
| **Other** | `pricebook_read` | View pricebook items |
| | `reports_read` | Access reports |
| | `webhooks` | Receive webhook events |

---

## Endpoints

### 1. Get Current User & Permissions

Discover who you're authenticated as and what you can do.

```
GET /me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 42,
    "name": "Jake Smith",
    "email": "jake@tekna.com.au",
    "tenant": "Tekna",
    "permissions": {
      "chat_messages": true,
      "notes": true,
      "send_emails": false,
      "jobs_read": true,
      "jobs_create": false,
      "jobs_update": false,
      "job_updates": true,
      "contacts_read": true,
      "contacts_create": true,
      "contacts_update": true,
      "documents_search": false,
      "documents_read": false,
      "documents_upload": false,
      "estimates_read": false,
      "estimates_create": false,
      "purchase_orders_read": false,
      "purchase_orders_create": false,
      "invoices_read": false,
      "tasks_read": false,
      "tasks_create": false,
      "tasks_update": false,
      "schedule_read": false,
      "pricebook_read": false,
      "reports_read": false,
      "webhooks": false
    }
  }
}
```

---

### 2. Send Chat Message

Send a message to a chat channel or directly to another user.

```
POST /chat
```

**Required permission:** `chat_messages`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The message content |
| `channel` | string | No | Channel name (default: `"general"`) |
| `recipient_user_id` | integer | No | For direct messages, the target user's ID |
| `job_id` | integer | No | Associate message with a specific job |

**Example:**
```bash
curl -X POST https://your-api-url/api/v1/external/openclaw/chat \
  -H "X-API-Key: oc_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Roof inspection complete - all clear",
    "channel": "general",
    "job_id": 123
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5678,
    "content": "Roof inspection complete - all clear",
    "channel": "general",
    "created_at": "2026-02-18T14:30:00.000Z"
  }
}
```

---

### 3. Create Note

Create a note attached to a job, contact, or standalone.

```
POST /notes
```

**Required permission:** `notes`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The note content |
| `job_id` | integer | No | Attach to a specific job |
| `contact_id` | integer | No | Attach to a specific contact |

**Example:**
```bash
curl -X POST https://your-api-url/api/v1/external/openclaw/notes \
  -H "X-API-Key: oc_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Client confirmed colour selection: Surfmist for fascia, Monument for gutters",
    "job_id": 456
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 9012,
    "content": "Client confirmed colour selection: Surfmist for fascia, Monument for gutters",
    "job_id": 456,
    "contact_id": null,
    "created_at": "2026-02-18T14:35:00.000Z"
  }
}
```

---

### 4. Update Job

Update specific fields on an existing job.

```
POST /job_updates
```

**Required permission:** `job_updates`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | integer | Yes | The job to update |
| `updates` | object | Yes | Fields to update |

**Allowed update fields:** `notes`, `status`

**Example:**
```bash
curl -X POST https://your-api-url/api/v1/external/openclaw/job_updates \
  -H "X-API-Key: oc_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": 456,
    "updates": {
      "notes": "Slab poured 18/02/2026. Curing period: 7 days.",
      "status": "in_progress"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "job_code": "J-0456",
    "updated_fields": ["notes", "status"]
  }
}
```

---

### 5. Create or Update Contact

Create a new contact, or update an existing one if the email already exists.

```
POST /contacts
```

**Required permission:** `contacts_create` or `contacts_update`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name (e.g. "John Smith") |
| `email` | string | No | Email address (used for matching existing contacts) |
| `phone` | string | No | Mobile phone number |
| `company` | string | No | Company name to link to (must already exist) |

**Example - Create:**
```bash
curl -X POST https://your-api-url/api/v1/external/openclaw/contacts \
  -H "X-API-Key: oc_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "phone": "0412 345 678",
    "company": "Acme Builders"
  }'
```

**Response (created):**
```json
{
  "success": true,
  "data": {
    "id": 1234,
    "name": "Sarah Johnson",
    "action": "created"
  }
}
```

**Response (updated - email already existed):**
```json
{
  "success": true,
  "data": {
    "id": 567,
    "name": "Sarah Johnson",
    "action": "updated"
  }
}
```

---

### 6. List Jobs

Get a paginated list of jobs with optional search and status filter.

```
GET /jobs
```

**Required permission:** `jobs_read`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `search` | string | No | Search by job name, location, suburb |
| `status` | string | No | Filter by status name (e.g. "In Progress") |
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Results per page (default: 25, max: 100) |

**Example:**
```bash
curl "https://your-api-url/api/v1/external/openclaw/jobs?search=West+Ridge&page=1" \
  -H "X-API-Key: oc_your_key"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": 456,
        "job_code": "J-0456",
        "name": "83 West Ridge Crescent",
        "status": "In Progress",
        "type": "New Build",
        "stage": "Construction",
        "location": "83 West Ridge Crescent, Westlake",
        "suburb": "Westlake",
        "created_at": "2025-06-15T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 25,
      "total": 42,
      "total_pages": 2
    }
  }
}
```

---

### 7. Get Job Details

Get a single job by ID.

```
GET /jobs/:id
```

**Required permission:** `jobs_read`

**Example:**
```bash
curl "https://your-api-url/api/v1/external/openclaw/jobs/456" \
  -H "X-API-Key: oc_your_key"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "job_code": "J-0456",
    "name": "83 West Ridge Crescent",
    "status": "In Progress",
    "type": "New Build",
    "stage": "Construction",
    "location": "83 West Ridge Crescent, Westlake",
    "suburb": "Westlake",
    "created_at": "2025-06-15T09:00:00.000Z"
  }
}
```

---

### 8. List Tasks

Get a paginated list of tasks with optional filters.

```
GET /tasks
```

**Required permission:** `tasks_read`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | integer | No | Filter by job |
| `status` | string | No | Filter by status: `not_started`, `started`, `waiting_for_response`, `waiting_for_info`, `completed` |
| `assigned_user_id` | integer | No | Filter by assigned user |
| `search` | string | No | Full-text search by task name/description |
| `start_date` | string | No | Filter tasks overlapping date range (ISO 8601) |
| `end_date` | string | No | Filter tasks overlapping date range (ISO 8601) |
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Results per page (default: 25, max: 100) |

**Example:**
```bash
curl "https://your-api-url/api/v1/external/openclaw/tasks?job_id=456&status=started" \
  -H "X-API-Key: oc_your_key"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 789,
        "name": "Slab Pour",
        "status": "started",
        "start_date": "2026-02-18",
        "end_date": "2026-02-20",
        "duration_days": 3,
        "job_id": 456,
        "job_code": "J-0456",
        "assigned_user_id": 12,
        "assigned_user_name": "Mike Builder",
        "supplier_name": "Concrete Co",
        "created_at": "2026-01-10T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 25,
      "total": 15,
      "total_pages": 1
    }
  }
}
```

---

### 9. Get Task Details

Get a single task with full details.

```
GET /tasks/:id
```

**Required permission:** `tasks_read`

**Example:**
```bash
curl "https://your-api-url/api/v1/external/openclaw/tasks/789" \
  -H "X-API-Key: oc_your_key"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 789,
    "name": "Slab Pour",
    "status": "started",
    "start_date": "2026-02-18",
    "end_date": "2026-02-20",
    "duration_days": 3,
    "job_id": 456,
    "job_code": "J-0456",
    "assigned_user_id": 12,
    "assigned_user_name": "Mike Builder",
    "supplier_name": "Concrete Co",
    "description": "Pour concrete slab for ground floor",
    "trade": "Concrete",
    "hold": false,
    "confirm": false,
    "progress_percentage": 50,
    "required_by": "2026-02-20",
    "completed_at": null,
    "created_at": "2026-01-10T08:00:00.000Z",
    "updated_at": "2026-02-18T10:00:00.000Z"
  }
}
```

---

### 10. Create Task

Create a new task, optionally linked to a job.

```
POST /tasks
```

**Required permission:** `tasks_create`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Task name |
| `description` | string | No | Task description |
| `status` | string | No | Initial status (default: `"not_started"`) |
| `start_date` | string | No | Start date, ISO 8601 (default: today) |
| `end_date` | string | No | End date, ISO 8601 (auto-calculated from duration if omitted) |
| `duration_days` | integer | No | Duration in working days (default: 1) |
| `job_id` | integer | No | Link to a job |
| `assigned_user_id` | integer | No | Assign to a user |
| `sequence_order` | integer | No | Sort order (default: 0) |

**Example:**
```bash
curl -X POST https://your-api-url/api/v1/external/openclaw/tasks \
  -H "X-API-Key: oc_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Site inspection",
    "description": "Inspect site before frame stage begins",
    "job_id": 456,
    "assigned_user_id": 12,
    "duration_days": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1001,
    "name": "Site inspection",
    "status": "not_started",
    "start_date": "2026-02-18",
    "end_date": "2026-02-18",
    "duration_days": 1,
    "job_id": 456,
    "job_code": "J-0456",
    "assigned_user_id": 12,
    "assigned_user_name": "Mike Builder",
    "supplier_name": null,
    "created_at": "2026-02-18T14:40:00.000Z"
  }
}
```

---

### 11. Update Task

Update fields on an existing task.

```
PATCH /tasks/:id
```

**Required permission:** `tasks_update`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New task name |
| `description` | string | No | New description |
| `status` | string | No | New status |
| `start_date` | string | No | New start date |
| `end_date` | string | No | New end date |
| `duration_days` | integer | No | New duration |
| `assigned_user_id` | integer | No | Reassign to different user |

**Example:**
```bash
curl -X PATCH https://your-api-url/api/v1/external/openclaw/tasks/1001 \
  -H "X-API-Key: oc_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "started",
    "description": "Inspection in progress - checking footings"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1001,
    "name": "Site inspection",
    "status": "started",
    "start_date": "2026-02-18",
    "end_date": "2026-02-18",
    "duration_days": 1,
    "job_id": 456,
    "job_code": "J-0456",
    "assigned_user_id": 12,
    "assigned_user_name": "Mike Builder",
    "supplier_name": null,
    "created_at": "2026-02-18T14:40:00.000Z"
  }
}
```

---

### 12. Search Documents

Search and list documents with optional filters.

```
GET /documents
```

**Required permission:** `documents_search` or `documents_read`

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `search` | string | No | Search by document name or filename |
| `source_type` | string | No | Filter by source: `corporate`, `job`, `email`, `email_attachment`, `task`, `contact`, `warehouse`, etc. |
| `job_id` | integer | No | Filter documents linked to a specific job |
| `contact_id` | integer | No | Filter documents linked to a specific contact |
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Results per page (default: 25, max: 100) |

**Example:**
```bash
curl "https://your-api-url/api/v1/external/openclaw/documents?job_id=456&search=invoice" \
  -H "X-API-Key: oc_your_key"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": 5678,
        "name": "Invoice #1234",
        "original_filename": "INV-1234.pdf",
        "source_type": "job",
        "folder_path": "Jobs/J-0456/Invoices",
        "content_type": "application/pdf",
        "file_size": 245760,
        "linkable_type": "Job",
        "linkable_id": 456,
        "created_at": "2026-02-15T11:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 25,
      "total": 3,
      "total_pages": 1
    }
  }
}
```

---

### 13. Get Document Details & Download

Get full document details including a time-limited download URL.

```
GET /documents/:id
```

**Required permission:** `documents_read`

**Example:**
```bash
curl "https://your-api-url/api/v1/external/openclaw/documents/5678" \
  -H "X-API-Key: oc_your_key"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5678,
    "name": "Invoice #1234",
    "original_filename": "INV-1234.pdf",
    "source_type": "job",
    "folder_path": "Jobs/J-0456/Invoices",
    "content_type": "application/pdf",
    "file_size": 245760,
    "linkable_type": "Job",
    "linkable_id": 456,
    "created_at": "2026-02-15T11:00:00.000Z",
    "download_url": "https://s3.ap-southeast-2.wasabisys.com/bucket/path/to/file?X-Amz-..."
  }
}
```

> **Note:** The `download_url` is a presigned URL that expires after a configured time (typically 1 hour). Fetch the document details again if the URL expires.

---

## Quick Start

### 1. Get your API key

Ask your admin to go to **Settings > Users > [Your Name]** and generate an OpenClaw API key. Copy it immediately - it's only shown once.

### 2. Test your connection

```bash
curl https://your-api-url/api/v1/external/openclaw/me \
  -H "X-API-Key: oc_your_key"
```

### 3. Check your permissions

The `/me` response shows which endpoints you can access. If a permission is `false`, calls to that endpoint will return `403 Forbidden`.

### 4. Start making calls

Use any HTTP client (curl, Postman, Python requests, etc.) to interact with the API.

---

## Python Example

```python
import requests

BASE_URL = "https://your-api-url/api/v1/external/openclaw"
API_KEY = "oc_your_key_here"
HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Check permissions
me = requests.get(f"{BASE_URL}/me", headers=HEADERS)
print(me.json())

# Send a chat message
resp = requests.post(f"{BASE_URL}/chat", headers=HEADERS, json={
    "message": "Site inspection completed successfully",
    "job_id": 123
})
print(resp.json())

# Create a note on a job
resp = requests.post(f"{BASE_URL}/notes", headers=HEADERS, json={
    "content": "Client approved colour selections",
    "job_id": 456
})
print(resp.json())

# Create a contact
resp = requests.post(f"{BASE_URL}/contacts", headers=HEADERS, json={
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "phone": "0412 345 678"
})
print(resp.json())

# List jobs
resp = requests.get(f"{BASE_URL}/jobs", headers=HEADERS, params={
    "search": "West Ridge"
})
print(resp.json())

# List tasks for a job
resp = requests.get(f"{BASE_URL}/tasks", headers=HEADERS, params={
    "job_id": 456,
    "status": "started"
})
print(resp.json())

# Create a task
resp = requests.post(f"{BASE_URL}/tasks", headers=HEADERS, json={
    "name": "Site inspection",
    "job_id": 456,
    "duration_days": 1
})
print(resp.json())

# Update a task status
resp = requests.patch(f"{BASE_URL}/tasks/789", headers=HEADERS, json={
    "status": "completed"
})
print(resp.json())

# Search documents
resp = requests.get(f"{BASE_URL}/documents", headers=HEADERS, params={
    "job_id": 456,
    "search": "invoice"
})
print(resp.json())

# Get document with download URL
resp = requests.get(f"{BASE_URL}/documents/5678", headers=HEADERS)
doc = resp.json()
if doc["success"] and "download_url" in doc["data"]:
    # Download the file
    file_resp = requests.get(doc["data"]["download_url"])
    with open(doc["data"]["original_filename"], "wb") as f:
        f.write(file_resp.content)
```

---

## JavaScript / Node.js Example

```javascript
const BASE_URL = "https://your-api-url/api/v1/external/openclaw";
const API_KEY = "oc_your_key_here";

async function openclawRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  return res.json();
}

// Check permissions
const me = await openclawRequest("/me");
console.log(me);

// Send a chat message
const chat = await openclawRequest("/chat", "POST", {
  message: "Foundation pour complete",
  job_id: 123,
});
console.log(chat);

// Create a contact
const contact = await openclawRequest("/contacts", "POST", {
  name: "Sarah Johnson",
  email: "sarah@example.com",
  phone: "0412 345 678",
});
console.log(contact);

// List jobs
const jobs = await openclawRequest("/jobs?search=West+Ridge");
console.log(jobs);

// List tasks for a job
const tasks = await openclawRequest("/tasks?job_id=456&status=started");
console.log(tasks);

// Create a task
const newTask = await openclawRequest("/tasks", "POST", {
  name: "Site inspection",
  job_id: 456,
  duration_days: 1,
});
console.log(newTask);

// Update a task
const updated = await openclawRequest("/tasks/789", "PATCH", {
  status: "completed",
});
console.log(updated);

// Search documents
const docs = await openclawRequest("/documents?job_id=456&search=invoice");
console.log(docs);

// Get document with download URL
const doc = await openclawRequest("/documents/5678");
if (doc.success && doc.data.download_url) {
  // Download in Node.js or open in browser
  console.log("Download:", doc.data.download_url);
}
```

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Requests per minute | 60 |
| Requests per hour | 1,000 |

Exceeding rate limits returns `429 Too Many Requests`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-18 | Added jobs (list, show), tasks (list, show, create, update), documents (search, show+download) endpoints. |
| 2026-02-18 | Expanded permissions from 4 to 26. Added category-based permission groups. |
| 2026-02-18 | Initial release with chat, notes, job_updates, contacts endpoints. |
