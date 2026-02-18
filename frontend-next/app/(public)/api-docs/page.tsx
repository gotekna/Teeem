import { CopyButton } from "./CopyButton";

const BASE_URL =
  "https://teeem-production-121159e1ff9d.herokuapp.com/api/v1/external/openclaw";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  params?: Param[];
  curlExample: string;
  pythonExample: string;
  jsExample: string;
  responseExample: string;
}

// ---------------------------------------------------------------------------
// Endpoint data
// ---------------------------------------------------------------------------

const endpoints: Endpoint[] = [
  {
    id: "me",
    method: "GET",
    path: "/me",
    title: "Get Current User",
    description:
      "Returns the authenticated user's profile and their full set of OpenClaw permissions. Use this endpoint to verify connectivity and inspect what your API key is authorised to do.",
    curlExample: `curl -X GET "${BASE_URL}/me" \\
  -H "X-API-Key: oc_your_api_key_here"`,
    pythonExample: `import requests

response = requests.get(
    "${BASE_URL}/me",
    headers={"X-API-Key": "oc_your_api_key_here"}
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/me", {
  headers: { "X-API-Key": "oc_your_api_key_here" }
});
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": {
    "user": {
      "id": 42,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "admin"
    },
    "permissions": [
      "jobs_read",
      "tasks_read",
      "tasks_create",
      "documents_search"
    ]
  }
}`,
  },
  {
    id: "chat",
    method: "POST",
    path: "/chat",
    title: "Send Chat Message",
    description:
      "Sends a chat message into TEEEM. Messages appear in the appropriate channel in real time. You can target a specific channel, send a direct message to a user, or attach the message to a job.",
    params: [
      {
        name: "message",
        type: "string",
        required: true,
        description: "The message content to send.",
      },
      {
        name: "channel",
        type: "string",
        required: false,
        description: 'Target channel name (e.g. "general", "site-updates").',
      },
      {
        name: "recipient_user_id",
        type: "integer",
        required: false,
        description: "Send a direct message to a specific user by ID.",
      },
      {
        name: "job_id",
        type: "integer",
        required: false,
        description: "Associate this message with a job.",
      },
    ],
    curlExample: `curl -X POST "${BASE_URL}/chat" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Concrete pour scheduled for 7am tomorrow.",
    "job_id": 101,
    "channel": "site-updates"
  }'`,
    pythonExample: `import requests

response = requests.post(
    "${BASE_URL}/chat",
    headers={"X-API-Key": "oc_your_api_key_here"},
    json={
        "message": "Concrete pour scheduled for 7am tomorrow.",
        "job_id": 101,
        "channel": "site-updates"
    }
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/chat", {
  method: "POST",
  headers: {
    "X-API-Key": "oc_your_api_key_here",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    message: "Concrete pour scheduled for 7am tomorrow.",
    job_id: 101,
    channel: "site-updates"
  })
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "message_id": 8841,
    "created_at": "2026-02-18T07:00:00Z"
  }
}`,
  },
  {
    id: "notes",
    method: "POST",
    path: "/notes",
    title: "Create Note",
    description:
      "Attaches a note to a job or contact. Notes are visible inside TEEEM and become part of the record's history.",
    params: [
      {
        name: "content",
        type: "string",
        required: true,
        description: "Note body text.",
      },
      {
        name: "job_id",
        type: "integer",
        required: false,
        description: "Attach the note to this job.",
      },
      {
        name: "contact_id",
        type: "integer",
        required: false,
        description: "Attach the note to this contact.",
      },
    ],
    curlExample: `curl -X POST "${BASE_URL}/notes" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Client confirmed tile selection.",
    "job_id": 101
  }'`,
    pythonExample: `import requests

response = requests.post(
    "${BASE_URL}/notes",
    headers={"X-API-Key": "oc_your_api_key_here"},
    json={"content": "Client confirmed tile selection.", "job_id": 101}
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/notes", {
  method: "POST",
  headers: {
    "X-API-Key": "oc_your_api_key_here",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ content: "Client confirmed tile selection.", job_id: 101 })
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "note_id": 2204,
    "content": "Client confirmed tile selection.",
    "job_id": 101,
    "created_at": "2026-02-18T09:15:00Z"
  }
}`,
  },
  {
    id: "job_updates",
    method: "POST",
    path: "/job_updates",
    title: "Update Job Fields",
    description:
      "Applies field-level updates to an existing job. Only the fields supplied in the updates object are changed; all other fields remain untouched.",
    params: [
      {
        name: "job_id",
        type: "integer",
        required: true,
        description: "ID of the job to update.",
      },
      {
        name: "updates",
        type: "object",
        required: true,
        description:
          "Key-value map of fields to update. Supported keys: notes, status.",
      },
      {
        name: "updates.notes",
        type: "string",
        required: false,
        description: "New notes text for the job.",
      },
      {
        name: "updates.status",
        type: "string",
        required: false,
        description: "New status value for the job.",
      },
    ],
    curlExample: `curl -X POST "${BASE_URL}/job_updates" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": 101,
    "updates": {
      "status": "In Progress",
      "notes": "Frame inspection passed."
    }
  }'`,
    pythonExample: `import requests

response = requests.post(
    "${BASE_URL}/job_updates",
    headers={"X-API-Key": "oc_your_api_key_here"},
    json={
        "job_id": 101,
        "updates": {"status": "In Progress", "notes": "Frame inspection passed."}
    }
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/job_updates", {
  method: "POST",
  headers: {
    "X-API-Key": "oc_your_api_key_here",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    job_id: 101,
    updates: { status: "In Progress", notes: "Frame inspection passed." }
  })
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "job_id": 101,
    "updated_fields": ["status", "notes"]
  }
}`,
  },
  {
    id: "contacts_create",
    method: "POST",
    path: "/contacts",
    title: "Create / Update Contact",
    description:
      "Creates a new contact or updates an existing one if a matching email is found. Returns the full contact record.",
    params: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Full name of the contact.",
      },
      {
        name: "email",
        type: "string",
        required: false,
        description: "Email address. Used for deduplication.",
      },
      {
        name: "phone",
        type: "string",
        required: false,
        description: "Phone number.",
      },
      {
        name: "company",
        type: "string",
        required: false,
        description: "Company or organisation name.",
      },
    ],
    curlExample: `curl -X POST "${BASE_URL}/contacts" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Alex Johnson",
    "email": "alex@buildco.com.au",
    "phone": "0412 345 678",
    "company": "BuildCo Pty Ltd"
  }'`,
    pythonExample: `import requests

response = requests.post(
    "${BASE_URL}/contacts",
    headers={"X-API-Key": "oc_your_api_key_here"},
    json={
        "name": "Alex Johnson",
        "email": "alex@buildco.com.au",
        "phone": "0412 345 678",
        "company": "BuildCo Pty Ltd"
    }
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/contacts", {
  method: "POST",
  headers: {
    "X-API-Key": "oc_your_api_key_here",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: "Alex Johnson",
    email: "alex@buildco.com.au",
    phone: "0412 345 678",
    company: "BuildCo Pty Ltd"
  })
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "contact": {
      "id": 553,
      "name": "Alex Johnson",
      "email": "alex@buildco.com.au",
      "phone": "0412 345 678",
      "company": "BuildCo Pty Ltd",
      "created_at": "2026-02-18T10:00:00Z"
    }
  }
}`,
  },
  {
    id: "jobs_list",
    method: "GET",
    path: "/jobs",
    title: "List Jobs",
    description:
      "Returns a paginated list of jobs. Supports full-text search and status filtering.",
    params: [
      {
        name: "search",
        type: "string",
        required: false,
        description: "Full-text search across job name, code, and notes.",
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: 'Filter by job status (e.g. "Active", "Completed").',
      },
      {
        name: "page",
        type: "integer",
        required: false,
        description: "Page number. Defaults to 1.",
      },
      {
        name: "per_page",
        type: "integer",
        required: false,
        description: "Results per page. Defaults to 25, max 100.",
      },
    ],
    curlExample: `curl -G "${BASE_URL}/jobs" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  --data-urlencode "search=riverside" \\
  --data-urlencode "status=Active" \\
  --data-urlencode "page=1" \\
  --data-urlencode "per_page=25"`,
    pythonExample: `import requests

response = requests.get(
    "${BASE_URL}/jobs",
    headers={"X-API-Key": "oc_your_api_key_here"},
    params={"search": "riverside", "status": "Active", "page": 1, "per_page": 25}
)
print(response.json())`,
    jsExample: `const params = new URLSearchParams({
  search: "riverside",
  status: "Active",
  page: "1",
  per_page: "25"
});
const response = await fetch(\`${BASE_URL}/jobs?\${params}\`, {
  headers: { "X-API-Key": "oc_your_api_key_here" }
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": 101,
        "code": "J-2026-101",
        "name": "Riverside Development Stage 2",
        "status": "Active",
        "client": "Riverside Holdings",
        "start_date": "2026-01-15",
        "end_date": "2026-08-30"
      }
    ],
    "pagination": {
      "total": 84,
      "page": 1,
      "per_page": 25,
      "pages": 4
    }
  }
}`,
  },
  {
    id: "jobs_show",
    method: "GET",
    path: "/jobs/:id",
    title: "Get Job Details",
    description:
      "Returns the full detail record for a single job including contacts, documents, and current status.",
    curlExample: `curl -X GET "${BASE_URL}/jobs/101" \\
  -H "X-API-Key: oc_your_api_key_here"`,
    pythonExample: `import requests

response = requests.get(
    "${BASE_URL}/jobs/101",
    headers={"X-API-Key": "oc_your_api_key_here"}
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/jobs/101", {
  headers: { "X-API-Key": "oc_your_api_key_here" }
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "job": {
      "id": 101,
      "code": "J-2026-101",
      "name": "Riverside Development Stage 2",
      "status": "Active",
      "notes": "Frame inspection passed.",
      "client": "Riverside Holdings",
      "start_date": "2026-01-15",
      "end_date": "2026-08-30",
      "contacts": [],
      "document_count": 14
    }
  }
}`,
  },
  {
    id: "tasks_list",
    method: "GET",
    path: "/tasks",
    title: "List Tasks",
    description:
      "Returns tasks with rich filtering options. Filter by job, status, assigned user, date range, or full-text search.",
    params: [
      {
        name: "job_id",
        type: "integer",
        required: false,
        description: "Filter tasks belonging to this job.",
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: 'Task status filter (e.g. "pending", "in_progress", "complete").',
      },
      {
        name: "assigned_user_id",
        type: "integer",
        required: false,
        description: "Filter by the assigned user's ID.",
      },
      {
        name: "search",
        type: "string",
        required: false,
        description: "Full-text search across task name and description.",
      },
      {
        name: "start_date",
        type: "date",
        required: false,
        description: "Return tasks starting on or after this date (YYYY-MM-DD).",
      },
      {
        name: "end_date",
        type: "date",
        required: false,
        description: "Return tasks ending on or before this date (YYYY-MM-DD).",
      },
      {
        name: "page",
        type: "integer",
        required: false,
        description: "Page number. Defaults to 1.",
      },
      {
        name: "per_page",
        type: "integer",
        required: false,
        description: "Results per page. Defaults to 25, max 100.",
      },
    ],
    curlExample: `curl -G "${BASE_URL}/tasks" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  --data-urlencode "job_id=101" \\
  --data-urlencode "status=pending"`,
    pythonExample: `import requests

response = requests.get(
    "${BASE_URL}/tasks",
    headers={"X-API-Key": "oc_your_api_key_here"},
    params={"job_id": 101, "status": "pending"}
)
print(response.json())`,
    jsExample: `const params = new URLSearchParams({ job_id: "101", status: "pending" });
const response = await fetch(\`${BASE_URL}/tasks?\${params}\`, {
  headers: { "X-API-Key": "oc_your_api_key_here" }
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 301,
        "name": "Pour Slab - Zone A",
        "status": "pending",
        "start_date": "2026-02-20",
        "end_date": "2026-02-20",
        "duration_days": 1,
        "job_id": 101,
        "assigned_user_id": 42
      }
    ],
    "pagination": { "total": 18, "page": 1, "per_page": 25, "pages": 1 }
  }
}`,
  },
  {
    id: "tasks_show",
    method: "GET",
    path: "/tasks/:id",
    title: "Get Task Details",
    description: "Returns the full detail record for a single task.",
    curlExample: `curl -X GET "${BASE_URL}/tasks/301" \\
  -H "X-API-Key: oc_your_api_key_here"`,
    pythonExample: `import requests

response = requests.get(
    "${BASE_URL}/tasks/301",
    headers={"X-API-Key": "oc_your_api_key_here"}
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/tasks/301", {
  headers: { "X-API-Key": "oc_your_api_key_here" }
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "task": {
      "id": 301,
      "name": "Pour Slab - Zone A",
      "description": "Concrete supplier confirmed 7am delivery.",
      "status": "pending",
      "start_date": "2026-02-20",
      "end_date": "2026-02-20",
      "duration_days": 1,
      "job_id": 101,
      "assigned_user_id": 42,
      "created_at": "2026-02-15T14:00:00Z"
    }
  }
}`,
  },
  {
    id: "tasks_create",
    method: "POST",
    path: "/tasks",
    title: "Create Task",
    description:
      "Creates a new task and optionally assigns it to a user and links it to a job.",
    params: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Task name.",
      },
      {
        name: "description",
        type: "string",
        required: false,
        description: "Detailed description.",
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: 'Initial status. Defaults to "pending".',
      },
      {
        name: "start_date",
        type: "date",
        required: false,
        description: "Start date (YYYY-MM-DD).",
      },
      {
        name: "end_date",
        type: "date",
        required: false,
        description: "End date (YYYY-MM-DD).",
      },
      {
        name: "duration_days",
        type: "integer",
        required: false,
        description: "Duration in days.",
      },
      {
        name: "job_id",
        type: "integer",
        required: false,
        description: "Link this task to a job.",
      },
      {
        name: "assigned_user_id",
        type: "integer",
        required: false,
        description: "Assign to a user by ID.",
      },
    ],
    curlExample: `curl -X POST "${BASE_URL}/tasks" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Install Roof Battens",
    "status": "pending",
    "start_date": "2026-03-01",
    "end_date": "2026-03-03",
    "duration_days": 3,
    "job_id": 101,
    "assigned_user_id": 42
  }'`,
    pythonExample: `import requests

response = requests.post(
    "${BASE_URL}/tasks",
    headers={"X-API-Key": "oc_your_api_key_here"},
    json={
        "name": "Install Roof Battens",
        "status": "pending",
        "start_date": "2026-03-01",
        "end_date": "2026-03-03",
        "duration_days": 3,
        "job_id": 101,
        "assigned_user_id": 42
    }
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/tasks", {
  method: "POST",
  headers: {
    "X-API-Key": "oc_your_api_key_here",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: "Install Roof Battens",
    status: "pending",
    start_date: "2026-03-01",
    end_date: "2026-03-03",
    duration_days: 3,
    job_id: 101,
    assigned_user_id: 42
  })
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "task": {
      "id": 302,
      "name": "Install Roof Battens",
      "status": "pending",
      "start_date": "2026-03-01",
      "end_date": "2026-03-03",
      "duration_days": 3,
      "job_id": 101,
      "assigned_user_id": 42,
      "created_at": "2026-02-18T11:00:00Z"
    }
  }
}`,
  },
  {
    id: "tasks_update",
    method: "PATCH",
    path: "/tasks/:id",
    title: "Update Task",
    description:
      "Applies partial updates to an existing task. Only supplied fields are modified.",
    params: [
      {
        name: "name",
        type: "string",
        required: false,
        description: "Updated task name.",
      },
      {
        name: "description",
        type: "string",
        required: false,
        description: "Updated description.",
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: "Updated status.",
      },
      {
        name: "start_date",
        type: "date",
        required: false,
        description: "Updated start date (YYYY-MM-DD).",
      },
      {
        name: "end_date",
        type: "date",
        required: false,
        description: "Updated end date (YYYY-MM-DD).",
      },
      {
        name: "duration_days",
        type: "integer",
        required: false,
        description: "Updated duration in days.",
      },
      {
        name: "assigned_user_id",
        type: "integer",
        required: false,
        description: "Reassign to a different user.",
      },
    ],
    curlExample: `curl -X PATCH "${BASE_URL}/tasks/302" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "in_progress",
    "assigned_user_id": 55
  }'`,
    pythonExample: `import requests

response = requests.patch(
    "${BASE_URL}/tasks/302",
    headers={"X-API-Key": "oc_your_api_key_here"},
    json={"status": "in_progress", "assigned_user_id": 55}
)
print(response.json())`,
    jsExample: `const response = await fetch("${BASE_URL}/tasks/302", {
  method: "PATCH",
  headers: {
    "X-API-Key": "oc_your_api_key_here",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ status: "in_progress", assigned_user_id: 55 })
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "task": {
      "id": 302,
      "name": "Install Roof Battens",
      "status": "in_progress",
      "assigned_user_id": 55,
      "updated_at": "2026-02-18T12:30:00Z"
    }
  }
}`,
  },
  {
    id: "documents_list",
    method: "GET",
    path: "/documents",
    title: "Search Documents",
    description:
      "Searches the document warehouse. Supports full-text search and filtering by source type, job, or contact.",
    params: [
      {
        name: "search",
        type: "string",
        required: false,
        description: "Full-text search across filename and metadata.",
      },
      {
        name: "source_type",
        type: "string",
        required: false,
        description: 'Filter by source (e.g. "job", "email", "corporate").',
      },
      {
        name: "job_id",
        type: "integer",
        required: false,
        description: "Filter documents linked to this job.",
      },
      {
        name: "contact_id",
        type: "integer",
        required: false,
        description: "Filter documents linked to this contact.",
      },
      {
        name: "page",
        type: "integer",
        required: false,
        description: "Page number. Defaults to 1.",
      },
      {
        name: "per_page",
        type: "integer",
        required: false,
        description: "Results per page. Defaults to 25, max 100.",
      },
    ],
    curlExample: `curl -G "${BASE_URL}/documents" \\
  -H "X-API-Key: oc_your_api_key_here" \\
  --data-urlencode "job_id=101" \\
  --data-urlencode "search=invoice"`,
    pythonExample: `import requests

response = requests.get(
    "${BASE_URL}/documents",
    headers={"X-API-Key": "oc_your_api_key_here"},
    params={"job_id": 101, "search": "invoice"}
)
print(response.json())`,
    jsExample: `const params = new URLSearchParams({ job_id: "101", search: "invoice" });
const response = await fetch(\`${BASE_URL}/documents?\${params}\`, {
  headers: { "X-API-Key": "oc_your_api_key_here" }
});
const data = await response.json();`,
    responseExample: `{
  "success": true,
  "data": {
    "documents": [
      {
        "id": 7701,
        "display_name": "Invoice #1042 - Riverside Stage 2",
        "source_type": "job",
        "job_id": 101,
        "created_at": "2026-02-10T08:00:00Z"
      }
    ],
    "pagination": { "total": 3, "page": 1, "per_page": 25, "pages": 1 }
  }
}`,
  },
  {
    id: "documents_show",
    method: "GET",
    path: "/documents/:id",
    title: "Get Document",
    description:
      "Returns full metadata for a single document including a time-limited presigned download URL.",
    curlExample: `curl -X GET "${BASE_URL}/documents/7701" \\
  -H "X-API-Key: oc_your_api_key_here"`,
    pythonExample: `import requests

response = requests.get(
    "${BASE_URL}/documents/7701",
    headers={"X-API-Key": "oc_your_api_key_here"}
)
data = response.json()
download_url = data["data"]["document"]["download_url"]`,
    jsExample: `const response = await fetch("${BASE_URL}/documents/7701", {
  headers: { "X-API-Key": "oc_your_api_key_here" }
});
const data = await response.json();
const { download_url } = data.data.document;`,
    responseExample: `{
  "success": true,
  "data": {
    "document": {
      "id": 7701,
      "display_name": "Invoice #1042 - Riverside Stage 2",
      "source_type": "job",
      "job_id": 101,
      "content_type": "application/pdf",
      "file_size_bytes": 204800,
      "created_at": "2026-02-10T08:00:00Z",
      "download_url": "https://storage.example.com/presigned?token=abc123&expires=3600"
    }
  }
}`,
  },
];

// ---------------------------------------------------------------------------
// Permission data
// ---------------------------------------------------------------------------

const permissionGroups = [
  {
    category: "Communication",
    perms: ["chat_messages", "notes", "send_emails"],
  },
  {
    category: "Jobs",
    perms: ["jobs_read", "jobs_create", "jobs_update", "job_updates"],
  },
  {
    category: "Contacts",
    perms: ["contacts_read", "contacts_create", "contacts_update"],
  },
  {
    category: "Documents",
    perms: ["documents_search", "documents_read", "documents_upload"],
  },
  {
    category: "Financial",
    perms: [
      "estimates_read",
      "estimates_create",
      "purchase_orders_read",
      "purchase_orders_create",
      "invoices_read",
    ],
  },
  {
    category: "Schedule & Tasks",
    perms: ["tasks_read", "tasks_create", "tasks_update", "schedule_read"],
  },
  {
    category: "Other",
    perms: ["pricebook_read", "reports_read", "webhooks"],
  },
];

// ---------------------------------------------------------------------------
// Status code data
// ---------------------------------------------------------------------------

const statusCodes = [
  { code: "200", label: "OK", desc: "Request succeeded." },
  { code: "201", label: "Created", desc: "Resource was created successfully." },
  {
    code: "400",
    label: "Bad Request",
    desc: "Missing or invalid parameters.",
  },
  {
    code: "401",
    label: "Unauthorized",
    desc: "Missing or invalid API key.",
  },
  {
    code: "403",
    label: "Forbidden",
    desc: "API key lacks the required permission.",
  },
  { code: "404", label: "Not Found", desc: "Requested resource not found." },
  {
    code: "422",
    label: "Unprocessable Entity",
    desc: "Validation failed. Check the error message.",
  },
  {
    code: "429",
    label: "Too Many Requests",
    desc: "Rate limit exceeded. Slow down and retry.",
  },
];

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function MethodBadge({ method }: { method: Endpoint["method"] }) {
  const colors: Record<Endpoint["method"], string> = {
    GET: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    POST: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    PATCH: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    DELETE: "bg-red-500/20 text-red-300 border border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold tracking-wide ${colors[method]}`}
    >
      {method}
    </span>
  );
}

function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  return (
    <div className="relative rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/60 border-b border-zinc-700/50">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {language}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-zinc-200 font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ParamsTable({ params }: { params: Param[] }) {
  return (
    <div className="rounded-lg overflow-hidden border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-800/50 border-b border-zinc-700/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-40">
              Parameter
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-24">
              Type
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-24">
              Required
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr
              key={p.name}
              className={`border-b border-zinc-800/60 ${
                i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/30"
              }`}
            >
              <td className="px-4 py-3 font-mono text-indigo-300 text-xs">
                {p.name}
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{p.type}</td>
              <td className="px-4 py-3">
                {p.required ? (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    required
                  </span>
                ) : (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-zinc-700/50 text-zinc-400">
                    optional
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-300 text-xs leading-relaxed">
                {p.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: individual endpoint
// ---------------------------------------------------------------------------

function EndpointSection({ ep }: { ep: Endpoint }) {
  return (
    <section id={ep.id} className="mb-16 scroll-mt-20">
      {/* Endpoint header */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <MethodBadge method={ep.method} />
        <code className="text-zinc-100 font-mono text-sm bg-zinc-800/60 px-3 py-1 rounded-md border border-zinc-700/50">
          {ep.path}
        </code>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{ep.title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed mb-6">
        {ep.description}
      </p>

      {/* Parameters */}
      {ep.params && ep.params.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Parameters
          </h4>
          <ParamsTable params={ep.params} />
        </div>
      )}

      {/* Code examples */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Code Examples
        </h4>
        <div className="space-y-3">
          <CodeBlock code={ep.curlExample} language="curl" />
          <CodeBlock code={ep.pythonExample} language="python" />
          <CodeBlock code={ep.jsExample} language="javascript" />
        </div>
      </div>

      {/* Response */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Example Response
        </h4>
        <CodeBlock code={ep.responseExample} language="json" />
      </div>

      <div className="mt-10 border-b border-zinc-800/60" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sidebar nav
// ---------------------------------------------------------------------------

const navSections = [
  {
    label: "Getting Started",
    items: [
      { href: "#overview", label: "Overview" },
      { href: "#authentication", label: "Authentication" },
      { href: "#rate-limits", label: "Rate Limits" },
      { href: "#errors", label: "Errors & Status Codes" },
      { href: "#permissions", label: "Permissions" },
    ],
  },
  {
    label: "Endpoints",
    items: endpoints.map((ep) => ({
      href: `#${ep.id}`,
      label: ep.title,
      method: ep.method,
    })),
  },
];

function Sidebar() {
  return (
    <nav
      aria-label="API documentation navigation"
      className="sticky top-0 h-screen overflow-y-auto w-64 shrink-0 hidden lg:block py-8 pr-6 border-r border-zinc-800"
    >
      {/* Brand */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">T</span>
          </div>
          <span className="text-white font-semibold text-sm">TEEEM</span>
        </div>
        <p className="text-zinc-500 text-xs pl-8">OpenClaw API v1</p>
      </div>

      {navSections.map((section) => (
        <div key={section.label} className="mb-6">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors group"
                >
                  {"method" in item && item.method && (
                    <span
                      className={`text-xs font-mono font-bold w-10 shrink-0 ${
                        item.method === "GET"
                          ? "text-emerald-400"
                          : item.method === "POST"
                          ? "text-blue-400"
                          : item.method === "PATCH"
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {item.method}
                    </span>
                  )}
                  <span className="truncate group-hover:text-white">
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Footer link */}
      <div className="mt-8 pt-6 border-t border-zinc-800">
        <a
          href="https://teeem.com.au"
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          teeem.com.au
        </a>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiDocsPage() {
  const authExample = `curl -X GET "${BASE_URL}/me" \\
  -H "X-API-Key: oc_your_api_key_here"`;

  const errorExample = `// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Detailed error message here"
}`;

  const rateLimitExample = `HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708250400

{
  "success": false,
  "error": "Rate limit exceeded. Please wait before retrying."
}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center gap-3 px-4 py-4 border-b border-zinc-800 sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm">
        <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">T</span>
        </div>
        <span className="text-white font-semibold text-sm">
          OpenClaw API Docs
        </span>
      </div>

      <div className="max-w-screen-xl mx-auto flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-8 lg:py-12 max-w-3xl">
          {/* Page header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-300 text-xs font-medium">
                API v1 - Stable
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
              OpenClaw API
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl">
              Integrate your tools with TEEEM&apos;s construction management
              platform. Automate job updates, sync tasks, manage documents, and
              build AI-powered workflows on top of your live project data.
            </p>
          </div>

          {/* Base URL callout */}
          <div className="mb-12 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Base URL
            </p>
            <div className="flex items-center gap-3">
              <code className="text-indigo-300 font-mono text-sm break-all">
                {BASE_URL}
              </code>
              <CopyButton text={BASE_URL} />
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Overview */}
          {/* ---------------------------------------------------------------- */}
          <section id="overview" className="mb-14 scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              The OpenClaw API is a REST API that gives external tools
              authenticated access to TEEEM project data. All requests and
              responses use JSON. HTTPS is required on all calls.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {[
                {
                  label: "Protocol",
                  value: "HTTPS only",
                  icon: "🔒",
                },
                {
                  label: "Format",
                  value: "JSON",
                  icon: "{ }",
                },
                {
                  label: "Auth",
                  value: "X-API-Key header",
                  icon: "🔑",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <p className="text-lg mb-1">{item.icon}</p>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm text-zinc-200 font-medium">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 border-b border-zinc-800/60" />
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Authentication */}
          {/* ---------------------------------------------------------------- */}
          <section id="authentication" className="mb-14 scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">
              Authentication
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              All API requests must include your API key in the{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                X-API-Key
              </code>{" "}
              header. OpenClaw API keys are prefixed with{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                oc_
              </code>
              . You can generate and manage API keys from the TEEEM settings
              panel under{" "}
              <strong className="text-zinc-200">
                Settings &rarr; Developer &rarr; OpenClaw API Keys
              </strong>
              .
            </p>
            <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 mb-6">
              <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
                Keep your key secret
              </p>
              <p className="text-amber-200/70 text-sm">
                Treat your API key like a password. Never expose it in
                client-side code or public repositories. If a key is
                compromised, revoke it immediately from the TEEEM settings
                panel.
              </p>
            </div>
            <CodeBlock code={authExample} language="curl" />
            <div className="mt-10 border-b border-zinc-800/60" />
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Rate Limits */}
          {/* ---------------------------------------------------------------- */}
          <section id="rate-limits" className="mb-14 scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Rate Limits</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Requests are rate-limited per API key. Exceeding either limit
              returns a{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                429 Too Many Requests
              </code>{" "}
              response. Implement exponential back-off when retrying.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { label: "Per minute", value: "60 requests" },
                { label: "Per hour", value: "1,000 requests" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-center"
                >
                  <p className="text-2xl font-bold text-white mb-1">
                    {item.value}
                  </p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
            <CodeBlock code={rateLimitExample} language="http" />
            <div className="mt-10 border-b border-zinc-800/60" />
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Errors */}
          {/* ---------------------------------------------------------------- */}
          <section id="errors" className="mb-14 scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">
              Errors &amp; Status Codes
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              All responses follow a consistent envelope format. On success,{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                success
              </code>{" "}
              is{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                true
              </code>{" "}
              and payload lives in{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                data
              </code>
              . On error,{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                success
              </code>{" "}
              is{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                false
              </code>{" "}
              and a human-readable message is in{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                error
              </code>
              .
            </p>
            <CodeBlock code={errorExample} language="json" />

            <div className="mt-6 rounded-lg overflow-hidden border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-zinc-700/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-20">
                      Code
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-48">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Meaning
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statusCodes.map((s, i) => (
                    <tr
                      key={s.code}
                      className={`border-b border-zinc-800/60 ${
                        i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/30"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-indigo-300 text-xs">
                        {s.code}
                      </td>
                      <td className="px-4 py-3 text-zinc-200 text-xs font-medium">
                        {s.label}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {s.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-10 border-b border-zinc-800/60" />
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Permissions */}
          {/* ---------------------------------------------------------------- */}
          <section id="permissions" className="mb-14 scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Permissions</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Each API key is granted a subset of 26 permissions across 7
              categories. Use the{" "}
              <a
                href="#me"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                /me endpoint
              </a>{" "}
              to inspect which permissions your key holds. Calling an endpoint
              without the required permission returns a{" "}
              <code className="text-indigo-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                403 Forbidden
              </code>
              .
            </p>
            <div className="space-y-4">
              {permissionGroups.map((group) => (
                <div
                  key={group.category}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    {group.category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.perms.map((perm) => (
                      <span
                        key={perm}
                        className="inline-block px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/50"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 border-b border-zinc-800/60" />
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Endpoint sections */}
          {/* ---------------------------------------------------------------- */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Endpoints</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              All 13 endpoints are documented below with parameters, code
              examples in three languages, and example responses.
            </p>
          </div>

          {endpoints.map((ep) => (
            <EndpointSection key={ep.id} ep={ep} />
          ))}

          {/* Footer */}
          <footer className="pt-8 pb-16 border-t border-zinc-800 text-center">
            <p className="text-zinc-600 text-sm">
              Built by{" "}
              <a
                href="https://teeem.com.au"
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                TEEEM
              </a>{" "}
              &mdash; Construction Management Platform
            </p>
            <p className="text-zinc-700 text-xs mt-2">
              OpenClaw API v1 &bull; Last updated February 2026
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
