# Corporate Entity Management - API Reference

Quick reference for all corporate management API endpoints.

**Base URL:** `/api/v1`

---

## Companies

### List Companies
```http
GET /companies
```

**Query Parameters:**
- `group` - Filter by company group (tekna, team_harder, promise, charity, other)
- `status` - Filter by status (active, struck_off, in_liquidation, dormant)
- `search` - Search by name, ACN, or ABN

**Response:**
```json
{
  "companies": [
    {
      "id": 1,
      "name": "Tekna Pty Ltd",
      "company_group": "tekna",
      "acn": "123456789",
      "formatted_acn": "123 456 789",
      "abn": "12345678901",
      "formatted_abn": "12 345 678 901",
      "status": "active",
      "current_directors": [...],
      "has_xero_connection": true
    }
  ]
}
```

### Create Company
```http
POST /companies
```

**Request Body:**
```json
{
  "company": {
    "name": "Test Company Pty Ltd",
    "company_group": "tekna",
    "acn": "123456789",
    "abn": "12345678901",
    "tfn": "123456789",
    "status": "active",
    "date_incorporated": "2020-01-01",
    "registered_office_address": "123 Test St",
    "is_trustee": false,
    "gst_registration_status": "registered"
  }
}
```

### Get Company
```http
GET /companies/:id
```

### Update Company
```http
PUT /companies/:id
```

### Delete Company
```http
DELETE /companies/:id
```

### Company Directors
```http
GET /companies/:id/directors
POST /companies/:id/add_director
DELETE /companies/:id/directors/:director_id
```

**Add Director Request:**
```json
{
  "contact_id": 123,
  "position": "Director",
  "appointment_date": "2020-01-01"
}
```

### Company Bank Accounts
```http
GET /companies/:id/bank_accounts
```

### Company Compliance Items
```http
GET /companies/:id/compliance_items
```

**Query Parameters:**
- `due_soon` - Filter items due soon (true/false)
- `days` - Days threshold (default: 30)

### Company Documents
```http
GET /companies/:id/documents
```

### Company Activities
```http
GET /companies/:id/activities
```

---

## Assets

### List Assets
```http
GET /assets
```

**Query Parameters:**
- `company_id` - Filter by company
- `asset_type` - Filter by type (vehicle, equipment, property, other)
- `status` - Filter by status (active, disposed, sold, written_off)
- `needs_attention` - Filter assets needing attention (true/false)

**Response:**
```json
{
  "assets": [
    {
      "id": 1,
      "company_id": 1,
      "description": "Toyota Hilux",
      "asset_type": "vehicle",
      "make": "Toyota",
      "model": "Hilux",
      "year": 2020,
      "registration": "ABC123",
      "purchase_price": 50000,
      "status": "active",
      "needs_attention": false
    }
  ]
}
```

### Create Asset
```http
POST /assets
```

**Request Body:**
```json
{
  "asset": {
    "company_id": 1,
    "description": "Toyota Hilux",
    "asset_type": "vehicle",
    "make": "Toyota",
    "model": "Hilux",
    "year": 2020,
    "vin": "1234567890ABCDEFG",
    "registration": "ABC123",
    "purchase_date": "2020-01-01",
    "purchase_price": 50000,
    "current_value": 45000,
    "depreciation_rate": 15.0,
    "status": "active"
  }
}
```

### Get Asset
```http
GET /assets/:id
```

### Update Asset
```http
PUT /assets/:id
```

### Delete Asset
```http
DELETE /assets/:id
```

### Asset Insurance
```http
GET /assets/:id/insurance
POST /assets/:id/add_insurance
```

**Add Insurance Request:**
```json
{
  "insurance": {
    "insurance_company": "NRMA",
    "policy_number": "POL123456",
    "insurance_type": "Comprehensive",
    "start_date": "2024-01-01",
    "expiry_date": "2025-01-01",
    "premium_amount": 1200,
    "premium_frequency": "annual",
    "coverage_amount": 50000
  }
}
```

### Asset Service History
```http
GET /assets/:id/service_history
POST /assets/:id/add_service
```

**Add Service Request:**
```json
{
  "service_record": {
    "service_type": "Regular Service",
    "service_date": "2024-11-01",
    "service_provider": "Toyota Service",
    "cost": 350,
    "odometer_reading": 50000,
    "next_service_date": "2025-05-01",
    "next_service_odometer": 60000,
    "description": "10,000km service"
  }
}
```

---

## Bank Accounts

### List All Bank Accounts
```http
GET /bank_accounts
```

### Create Bank Account
```http
POST /bank_accounts
```

**Request Body:**
```json
{
  "bank_account": {
    "company_id": 1,
    "account_name": "Business Account",
    "bank_name": "ANZ",
    "bsb": "012-345",
    "account_number": "123456789",
    "account_type": "Business",
    "is_primary": true
  }
}
```

### Get Bank Account
```http
GET /bank_accounts/:id
```

### Update Bank Account
```http
PUT /bank_accounts/:id
```

### Delete Bank Account
```http
DELETE /bank_accounts/:id
```

---

## Compliance Items

### List Compliance Items
```http
GET /company_compliance_items
```

**Query Parameters:**
- `company_id` - Filter by company
- `completed` - Filter by completion status (true/false)
- `overdue` - Filter overdue items (true/false)

**Response:**
```json
{
  "compliance_items": [
    {
      "id": 1,
      "company_id": 1,
      "title": "Annual ASIC Review",
      "description": "Review and update company details",
      "item_type": "asic_review",
      "due_date": "2024-12-31",
      "completed": false,
      "is_overdue": false,
      "days_until_due": 42
    }
  ]
}
```

### Create Compliance Item
```http
POST /company_compliance_items
```

**Request Body:**
```json
{
  "compliance_item": {
    "company_id": 1,
    "title": "Annual ASIC Review",
    "description": "Review and update company details with ASIC",
    "item_type": "asic_review",
    "due_date": "2024-12-31",
    "reminder_days": "7,30,60,90"
  }
}
```

### Update Compliance Item
```http
PUT /company_compliance_items/:id
```

### Delete Compliance Item
```http
DELETE /company_compliance_items/:id
```

### Mark Compliance Item Complete
```http
POST /company_compliance_items/:id/mark_complete
```

**Response:**
```json
{
  "message": "Compliance item marked as complete",
  "compliance_item": {
    "id": 1,
    "completed": true,
    "completed_at": "2024-11-19T10:30:00Z"
  }
}
```

---

## Documents

### List Documents
```http
GET /company_documents
```

**Query Parameters:**
- `company_id` - Filter by company

### Upload Document
```http
POST /company_documents
Content-Type: multipart/form-data
```

**Form Data:**
```
company_document[company_id]: 1
company_document[title]: Constitution
company_document[document_type]: constitution
company_document[document_date]: 2020-01-01
company_document[description]: Company constitution
company_document[file]: [binary file data]
```

### Delete Document
```http
DELETE /company_documents/:id
```

---

## Asset Insurance

### List Insurance Policies
```http
GET /asset_insurance
```

**Query Parameters:**
- `asset_id` - Filter by asset

### Create Insurance Policy
```http
POST /asset_insurance
```

### Update Insurance Policy
```http
PUT /asset_insurance/:id
```

### Delete Insurance Policy
```http
DELETE /asset_insurance/:id
```

---

## Asset Service History

### List Service Records
```http
GET /asset_service_history
```

**Query Parameters:**
- `asset_id` - Filter by asset

### Create Service Record
```http
POST /asset_service_history
```

### Update Service Record
```http
PUT /asset_service_history/:id
```

### Delete Service Record
```http
DELETE /asset_service_history/:id
```

---

## Xero Integration

### List Xero Connections
```http
GET /company_xero_connections
```

**Response:**
```json
{
  "connections": [
    {
      "id": 1,
      "company_id": 1,
      "tenant_id": "xero-tenant-id",
      "tenant_name": "Test Company",
      "access_token": "[encrypted]",
      "token_expires_at": "2024-11-20T10:00:00Z",
      "last_sync_at": "2024-11-19T09:00:00Z",
      "connected": true
    }
  ]
}
```

### Get OAuth URL
```http
GET /xero/auth_url?company_id=1
```

**Response:**
```json
{
  "auth_url": "https://login.xero.com/identity/connect/authorize?..."
}
```

### OAuth Callback
```http
POST /xero/callback
```

**Request Body:**
```json
{
  "code": "oauth-code-from-xero",
  "company_id": 1
}
```

### Manual Sync
```http
POST /company_xero_connections/:id/sync
```

**Response:**
```json
{
  "message": "Sync completed successfully",
  "accounts_synced": 150
}
```

### Disconnect
```http
DELETE /company_xero_connections/:id
```

---

## Error Responses

All endpoints return standard error responses:

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": {
    "acn": ["must be 9 digits"],
    "name": ["can't be blank"]
  }
}
```

### 404 Not Found
```json
{
  "error": "Company not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "An unexpected error occurred"
}
```

---

## Data Models

### Company
```typescript
interface Company {
  id: number
  name: string
  company_group: 'tekna' | 'team_harder' | 'promise' | 'charity' | 'other'
  acn: string
  formatted_acn: string
  abn: string
  formatted_abn: string
  tfn: string // encrypted
  status: 'active' | 'struck_off' | 'in_liquidation' | 'dormant'
  date_incorporated: string
  registered_office_address: string
  principal_place_of_business: string
  is_trustee: boolean
  trust_name: string | null
  gst_registration_status: 'registered' | 'not_registered' | 'pending'
  asic_username: string
  asic_password: string // encrypted
  asic_last_review_date: string
  asic_next_review_date: string
  created_at: string
  updated_at: string
}
```

### Asset
```typescript
interface Asset {
  id: number
  company_id: number
  description: string
  asset_type: 'vehicle' | 'equipment' | 'property' | 'other'
  make: string
  model: string
  year: number
  vin: string
  registration: string
  purchase_date: string
  purchase_price: number
  current_value: number
  depreciation_rate: number
  status: 'active' | 'disposed' | 'sold' | 'written_off'
  disposal_date: string | null
  disposal_value: number | null
  needs_attention: boolean
  created_at: string
  updated_at: string
}
```

### BankAccount
```typescript
interface BankAccount {
  id: number
  company_id: number
  account_name: string
  bank_name: string
  bsb: string
  account_number: string
  account_type: string
  is_primary: boolean
  notes: string
  created_at: string
  updated_at: string
}
```

### ComplianceItem
```typescript
interface ComplianceItem {
  id: number
  company_id: number
  title: string
  description: string
  item_type: 'asic_review' | 'tax_return' | 'financial_statements' | 'agm' | 'other'
  due_date: string
  completed: boolean
  completed_at: string | null
  reminder_days: string
  is_overdue: boolean
  days_until_due: number | null
  created_at: string
  updated_at: string
}
```

---

## Authentication

All API requests require authentication via JWT token:

```http
Authorization: Bearer <jwt-token>
```

Obtain token from login endpoint:
```http
POST /auth/login
```

---

## Rate Limiting

No rate limiting currently implemented. For production deployment, consider implementing rate limiting for:
- API endpoints: 100 requests/minute
- Xero sync: 10 requests/minute
- File uploads: 10 requests/minute

---

## Pagination

Not currently implemented. All list endpoints return full results.

For future implementation:
```http
GET /companies?page=1&per_page=20
```

Response would include:
```json
{
  "companies": [...],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_count": 100,
    "per_page": 20
  }
}
```
