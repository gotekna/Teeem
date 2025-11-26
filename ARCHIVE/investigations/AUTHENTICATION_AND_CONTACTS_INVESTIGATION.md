# TEEEM CODEBASE INVESTIGATION REPORT
## Authentication System, Contacts Management, and Business Logic

**Investigation Date:** November 14, 2025
**Scope:** Very Thorough
**Project Structure:** Rails 8 + React + PostgreSQL monorepo

---

## TABLE OF CONTENTS
1. [Authentication System](#authentication-system)
2. [User Model & Roles](#user-model--roles)
3. [Contact & Supplier System](#contact--supplier-system)
4. [Purchase Order Models](#purchase-order-models)
5. [Payment Tracking](#payment-tracking)
6. [Rating & Review Systems](#rating--review-systems)
7. [Related Models & Relationships](#related-models--relationships)
8. [Frontend Components](#frontend-components)
9. [Database Schema Summary](#database-schema-summary)
10. [Key File Locations](#key-file-locations)

---

## AUTHENTICATION SYSTEM

### Current Setup

**Authentication Method:** JWT Token-based (BCrypt + JWT)

**Gems/Libraries Used:**
- `bcrypt (~> 3.1.7)` - Password hashing and secure password storage
- `jwt (~> 2.7)` - JWT token generation and validation
- `omniauth (~> 2.1)` - OAuth framework
- `omniauth-microsoft-office365 (~> 0.0.8)` - Office 365 OAuth provider
- `omniauth-rails_csrf_protection (~> 1.0)` - CSRF protection for OmniAuth

**Authentication Flow:**

1. **JWT Service:** `JsonWebToken` class encodes/decodes tokens
   - Location: `/Users/rob/Projects/teeem/backend/app/services/json_web_token.rb`
   - Uses Rails credentials (`SECRET_KEY_BASE`) for token signing
   - Tokens expire in 24 hours by default
   - Handles `JWT::DecodeError` and `JWT::ExpiredSignature` exceptions

2. **Login Methods:**
   - Email/Password (traditional)
   - Microsoft Office 365 OAuth
   - (Password reset token support with reset_password_token & reset_password_sent_at fields)

3. **Controllers:**
   - `AuthenticationController` - Handles signup/login
     - POST `/api/v1/auth/signup` - Creates new user
     - POST `/api/v1/auth/login` - Authenticates with email/password
     - GET `/api/v1/auth/me` - Returns current user info
   - `OmniauthCallbacksController` - Handles OAuth callbacks
     - GET `/omniauth/callback/microsoft_office365` - OAuth callback

**Authorization:**
- Location: `ApplicationController#authorize_request` (middleware pattern)
- Current Implementation: **PLACEHOLDER** - Returns default user
  - Status: NOT PRODUCTION READY
  - Always returns first user or creates default test user
  - Need to implement actual JWT token validation from request headers

---

## USER MODEL & ROLES

### User Model Schema

**Location:** `/Users/rob/Projects/teeem/backend/app/models/user.rb`

**Database Fields:**
```ruby
create_table :users do |t|
  t.string :email                    # Unique, required
  t.string :password_digest          # BCrypt hash
  t.string :name                     # Required
  t.string :role                     # Enum: user, admin, product_owner, estimator, supervisor, builder
  t.datetime :last_chat_read_at      # Last time user read chat
  t.string :reset_password_token     # For password reset flow
  t.datetime :reset_password_sent_at # When reset token was sent
  t.string :assigned_role            # Team assignment role
  t.datetime :last_login_at          # Login timestamp
  t.string :mobile_phone             # User's phone
  
  # OAuth fields
  t.string :provider                 # OAuth provider (e.g., 'microsoft_office365')
  t.string :uid                      # OAuth user ID
  t.text :oauth_token                # OAuth access token
  t.datetime :oauth_expires_at       # When OAuth token expires
  
  t.timestamps
end
```

**Associations:**
- `has_many :grok_plans, dependent: :destroy` - AI planning features
- `has_many :chat_messages, dependent: :destroy` - Chat history
- `has_many :schedule_template_row_audits, dependent: :nullify` - Audit trail

### Role System

**Available Roles (6 total):**

```ruby
ROLES = %w[user admin product_owner estimator supervisor builder].freeze
```

**Assignable Roles (for team assignment in schedule templates):**
```ruby
ASSIGNABLE_ROLES = %w[admin sales site supervisor builder estimator].freeze
```

**Permission Methods:**

| Method | Roles | Purpose |
|--------|-------|---------|
| `admin?` | admin | Full system access |
| `user?` | user | Basic user permissions |
| `product_owner?` | product_owner | Product management |
| `estimator?` | estimator | Estimation features |
| `supervisor?` | supervisor | Supervision/site tasks |
| `builder?` | builder | Builder/field tasks |
| `can_create_templates?` | admin, product_owner | Create schedule templates |
| `can_edit_schedule?` | admin, product_owner, estimator | Edit schedules |
| `can_view_supervisor_tasks?` | admin, supervisor | View supervisor tasks |
| `can_view_builder_tasks?` | admin, builder | View builder tasks |

### Password Requirements

**Validation Rules:**
- Minimum 12 characters length
- Must contain at least one uppercase letter (A-Z)
- Must contain at least one lowercase letter (a-z)
- Must contain at least one digit (0-9)
- Must contain at least one special character (!@#$%^&*()_+-=[]{}...etc)

**OAuth Users:**
- Password is optional for OAuth-authenticated users
- Random 64-character hex password generated automatically
- Custom validation: `password_required?` method checks if OAuth

---

## CONTACT & SUPPLIER SYSTEM

### Contact Model

**Location:** `/Users/rob/Projects/teeem/backend/app/models/contact.rb`

**Database Schema:**
```ruby
create_table :contacts do |t|
  # Basic Info
  t.string :first_name
  t.string :last_name
  t.string :full_name
  
  # Contact Types (Array - can be multiple)
  t.string :contact_types,          default: [], array: true  # customer, supplier, sales, land_agent
  t.string :primary_contact_type    # Primary type (auto-set from first in contact_types)
  
  # Contact Information
  t.string :email                   # Unique format validation
  t.string :mobile_phone
  t.string :office_phone
  t.string :fax_phone
  t.string :website
  
  # Address & Location
  t.text :address
  t.text :lgas,                     default: [], array: true  # Local Government Areas
  t.integer :contact_region_id
  t.string :contact_region
  
  # Tax & Company Info
  t.string :tax_number              # ABN/ACN
  t.string :company_number
  
  # Banking Info (for suppliers)
  t.string :bank_bsb
  t.string :bank_account_number
  t.string :bank_account_name
  
  # Xero Integration
  t.string :xero_id                 # Xero contact ID
  t.string :xero_contact_number
  t.string :xero_contact_status
  t.string :xero_account_number
  t.string :default_purchase_account
  t.string :default_sales_account
  t.boolean :sync_with_xero
  t.datetime :last_synced_at
  t.text :xero_sync_error
  
  # Supplier Metrics (when contact_types includes 'supplier')
  t.integer :rating,                default: 0              # 0-5 stars
  t.decimal :response_rate,                                 # 0-100%
  t.integer :avg_response_time                              # Hours
  t.string :supplier_code                                   # Unique supplier code
  t.text :notes
  
  # Account Terms
  t.integer :bill_due_day           # Day of month for bills
  t.string :bill_due_type           # e.g., 'NET30'
  t.integer :sales_due_day
  t.string :sales_due_type
  t.decimal :default_discount       # Decimal 0-100
  
  # A/R Tracking
  t.decimal :accounts_receivable_outstanding
  t.decimal :accounts_receivable_overdue
  
  # Activity & Status
  t.boolean :is_active,             default: true
  t.boolean :deleted
  t.boolean :branch                 # Branch office?
  
  # Legacy/System Fields
  t.integer :sys_type_id
  t.integer :parent_id
  t.string :parent
  t.string :drive_id
  t.string :folder_id
  
  t.timestamps
end
```

**Contact Types (Enum):**
```ruby
CONTACT_TYPES = %w[customer supplier sales land_agent].freeze
```

**Key Methods:**
- `display_name` - Full name or first+last or email or "Contact #ID"
- `primary_phone` - Returns mobile_phone or office_phone
- `has_contact_info?` - True if has email, mobile, or office phone
- `is_customer?`, `is_supplier?`, `is_sales?`, `is_land_agent?` - Type checkers
- `supplier_name` - Returns full_name for suppliers
- `total_purchase_orders_count` - Count of POs
- `total_purchase_orders_value` - Sum of PO totals

**Scopes:**
- `with_email` - Only contacts with email
- `with_phone` - Only contacts with phone
- `with_type(type)` - Contacts of specific type
- `customers`, `suppliers`, `sales`, `land_agents` - Type-specific scopes

**Associations:**

```ruby
# Contact Relationships
has_many :supplier_contacts, dependent: :destroy
has_many :linked_suppliers, through: :supplier_contacts, source: :supplier
has_many :contact_activities, dependent: :destroy

# Related Contacts (bidirectional)
has_many :outgoing_relationships, class_name: 'ContactRelationship',
         foreign_key: :source_contact_id, dependent: :destroy
has_many :incoming_relationships, class_name: 'ContactRelationship',
         foreign_key: :related_contact_id, dependent: :destroy
has_many :related_contacts, through: :outgoing_relationships, source: :related_contact

# Xero Associations
has_many :contact_persons, dependent: :destroy
has_many :contact_addresses, dependent: :destroy
has_many :contact_group_memberships, dependent: :destroy
has_many :contact_groups, through: :contact_group_memberships

# Supplier-specific (using foreign_key :supplier_id pointing to contact)
has_many :pricebook_items, foreign_key: :supplier_id, dependent: :destroy
has_many :purchase_orders, foreign_key: :supplier_id, dependent: :restrict_with_error
has_many :price_histories, foreign_key: :supplier_id, dependent: :destroy
```

### Contact Persons (Contacts Table Detail)

**Location:** `/Users/rob/Projects/teeem/backend/app/models/contact_person.rb`

**Purpose:** Individual contact people within a Contact organization

**Fields:**
```ruby
create_table :contact_persons do |t|
  t.bigint :contact_id,    null: false  # Parent contact
  t.string :first_name
  t.string :last_name
  t.string :email
  t.string :mobile_phone
  t.string :role
  t.boolean :is_primary,   default: false
  t.timestamps
end
```

**Key Feature:** Enforces single primary contact person per contact via `ensure_single_primary_per_contact` callback

### Contact Relationships (Network)

**Location:** `/Users/rob/Projects/teeem/backend/app/models/contact_relationship.rb`

**Purpose:** Track relationships between contacts (customers, suppliers, related projects, family, etc.)

**Relationship Types:**
```ruby
RELATIONSHIP_TYPES = [
  'previous_client',
  'parent_company',
  'subsidiary',
  'partner',
  'referral',
  'supplier_alternate',
  'related_project',
  'family_member',
  'other'
].freeze
```

**Schema:**
```ruby
create_table :contact_relationships do |t|
  t.references :source_contact,   null: false, foreign_key: { to_table: :contacts }
  t.references :related_contact,  null: false, foreign_key: { to_table: :contacts }
  t.string :relationship_type,    null: false
  t.text :notes
  t.timestamps
end
```

**Key Feature:** Bidirectional auto-sync - Creating a relationship automatically creates the reverse relationship with same type and notes

### Contact Roles

**Location:** `/Users/rob/Projects/teeem/backend/app/models/contact_role.rb`

**Purpose:** Define custom roles for contacts within constructions (independent of user roles)

**Schema:**
```ruby
create_table :contact_roles do |t|
  t.string :name,      null: false, unique: true
  t.boolean :active,   default: true
  t.timestamps
end
```

### Construction Contacts (Junction Table)

**Location:** Schema migration: `20251112203249_create_construction_contacts.rb`

**Purpose:** Link contacts to specific construction jobs with roles

**Schema:**
```ruby
create_table :construction_contacts do |t|
  t.references :construction, null: false, foreign_key: true
  t.references :contact,      null: false, foreign_key: true
  t.boolean :primary,         default: false
  t.string :role              # e.g., "Site Manager", "Architect", etc.
  t.timestamps
end
```

### Supplier Model

**Location:** `/Users/rob/Projects/teeem/backend/app/models/supplier.rb`

**Database Schema:**
```ruby
create_table :suppliers do |t|
  t.string :name,                       null: false, unique: true
  t.integer :contact_id                 # Legacy - points to Contact
  t.string :supplier_code,              unique: true
  
  # Contact Info
  t.string :contact_person
  t.string :email
  t.string :phone
  t.string :contact_number
  t.text :address
  
  # Performance Metrics
  t.integer :rating,                    default: 0           # 0-5
  t.decimal :response_rate,                                  # 0-100%
  t.integer :avg_response_time                               # Hours
  
  # Matching & Verification
  t.decimal :confidence_score,          precision: 5, scale: 4  # Match confidence 0-1
  t.string :match_type                  # How supplier was matched
  t.boolean :is_verified,               default: false       # Manually verified
  t.string :original_name               # Before normalization
  
  # Pricing
  t.decimal :markup_percentage,         default: 0           # 0-100%
  
  # Trade Categories
  t.text :trade_categories              # JSON array of categories
  t.text :is_default_for_trades         # JSON array of default trade types
  
  # Status & Count
  t.boolean :is_active,                 default: true
  t.integer :purchase_orders_count,     default: 0
  t.text :notes
  
  t.timestamps
end
```

**Supplier-Contact Relationship:**
- Model transitioning from separate Supplier to Contact-based system
- Uses `supplier_id` foreign key pointing to `contact_id` in related tables
- `has_many :supplier_contacts` - Multiple contacts linked to supplier

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `primary_contact` | Get main contact person |
| `contact_emails` | All email addresses |
| `contact_phones` | All phone numbers |
| `display_name` | Supplier display name |
| `rating_stars` | Formatted star rating (★★★☆☆) |
| `response_rate_percentage` | Formatted percentage |
| `avg_response_time_formatted` | Human-readable time (24h or 3.5d) |
| `matched?` | Has contact_id assigned |
| `match_confidence_label` | "Exact", "High", "Fuzzy", "Manual", "Low" |
| `match_status` | :unmatched, :verified, :needs_review |

**Scopes:**
- `active` - Only active suppliers
- `by_rating` - Order by rating DESC
- `by_response_rate` - Order by response_rate DESC
- `matched` - Has contact_id
- `unmatched` - No contact_id
- `verified` - Marked as verified
- `needs_review` - Matched but not verified
- `for_trade(category)` - By trade category

---

## PURCHASE ORDER MODELS

### Purchase Order

**Location:** `/Users/rob/Projects/teeem/backend/app/models/purchase_order.rb`

**Database Schema:**
```ruby
create_table :purchase_orders do |t|
  t.string :purchase_order_number,      null: false, unique: true  # PO-000001
  t.bigint :construction_id,            null: false                 # Which job
  t.bigint :supplier_id                                             # Which supplier
  t.bigint :estimate_id                                             # From which estimate
  
  # Status Tracking
  t.string :status,                     default: 'draft'  # Enum
  t.string :payment_status,             default: 'pending' # Enum
  
  # Financial
  t.decimal :sub_total,                 precision: 15, scale: 2
  t.decimal :tax,                       precision: 15, scale: 2
  t.decimal :total,                     precision: 15, scale: 2
  t.decimal :budget
  
  # Invoice/Payment Tracking
  t.decimal :invoiced_amount,           default: 0
  t.decimal :amount_paid,               default: 0
  t.decimal :amount_invoiced,           default: 0
  t.decimal :amount_still_to_be_invoiced
  
  # Xero Integration
  t.string :xero_invoice_id
  t.decimal :xero_amount_paid
  t.boolean :xero_complete,             default: false
  t.decimal :xero_still_to_be_paid
  t.decimal :xero_budget_diff
  
  # Dates
  t.date :required_date                 # When needed
  t.date :ordered_date                  # When ordered
  t.date :expected_delivery_date        # Expected arrival
  t.date :received_date                 # When received
  t.date :required_on_site_date         # On-site requirement
  t.date :invoice_date
  
  # Approval & Tracking
  t.integer :created_by_id
  t.integer :approved_by_id
  t.datetime :approved_at
  
  # Schedule Integration
  t.boolean :creates_schedule_tasks,    default: true
  t.string :task_category
  
  # Xero Reconciliation
  t.decimal :total_with_allowance
  t.decimal :diff_po_with_allowance_versus_budget
  t.decimal :diff_xero_and_total_but_not_complete
  
  # Content
  t.text :description
  t.text :delivery_address
  t.text :special_instructions
  t.string :invoice_reference
  
  t.timestamps
end
```

**Status Enum (8 states):**
```ruby
enum :status, {
  draft: 'draft',               # Can edit
  pending: 'pending',           # Awaiting approval
  approved: 'approved',         # Manager approved
  sent: 'sent',                 # Sent to supplier
  received: 'received',         # Goods received
  invoiced: 'invoiced',         # Invoice received
  paid: 'paid',                 # Fully paid
  cancelled: 'cancelled'        # Cancelled
}
```

**Payment Status Enum (4 states):**
```ruby
enum :payment_status, {
  pending: 'pending',           # No invoice yet
  part_payment: 'part_payment', # Partially invoiced/paid
  complete: 'complete',         # Fully invoiced/paid (within 5%)
  manual_review: 'manual_review' # Discrepancy detected
}, prefix: :payment
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `approve!(user_id)` | Move from pending→approved |
| `send_to_supplier!` | Move to sent, set ordered_date |
| `mark_received!` | Move to received, set received_date |
| `can_edit?` | True if draft or pending |
| `can_approve?` | True if pending |
| `can_cancel?` | True unless paid or cancelled |
| `payment_percentage` | (invoiced_amount / total * 100) |
| `delivery_aligned_with_tasks?` | Required date before task starts |
| `timing_warnings` | Array of delivery timing issues |
| `active_workflow` | Get current workflow instance |
| `determine_payment_status(amount)` | Calculate status from invoice amount |
| `apply_invoice!` | Update from invoice data |

**Automatic Calculations (callbacks):**
- `calculate_totals` - Sum line items for sub_total, tax, total
- `calculate_variances` - Budget vs. PO, Xero amount differences
- `update_construction_profit` - Update parent construction profit

**Line Items Association:**
```ruby
has_many :line_items,           class_name: 'PurchaseOrderLineItem', dependent: :destroy
accepts_nested_attributes_for :line_items, allow_destroy: true
```

### Purchase Order Line Items

**Location:** `/Users/rob/Projects/teeem/backend/app/models/purchase_order_line_item.rb`

**Schema:**
```ruby
create_table :purchase_order_line_items do |t|
  t.bigint :purchase_order_id,       null: false
  t.bigint :pricebook_item_id                           # Link to pricebook for pricing
  
  t.string :description,             null: false       # What's being ordered
  t.integer :line_number,            null: false       # Order in PO
  
  t.integer :quantity,               null: false       # How many
  t.decimal :unit_price,             null: false       # Price per unit
  t.decimal :tax_amount
  t.decimal :total_amount
  
  t.timestamps
end
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `calculate_totals` | Set tax_amount (10% GST default) and total_amount |
| `price_drift` | % difference from pricebook current price |
| `price_outdated?` | Drift > 10% threshold |
| `price_status` | Status: no_pricebook_item, no_current_price, in_sync, minor_drift, major_drift |

---

## PAYMENT TRACKING

### Payment Model

**Location:** `/Users/rob/Projects/teeem/backend/app/models/payment.rb`

**Database Schema:**
```ruby
create_table :payments do |t|
  t.bigint :purchase_order_id,   null: false
  t.decimal :amount,             null: false
  t.date :payment_date,          null: false
  
  t.string :payment_method       # bank_transfer, check, credit_card, cash, eft, other
  t.string :reference_number     # Check number, transaction ref, etc.
  t.text :notes                  # Payment notes
  
  # Xero Sync Fields
  t.string :xero_payment_id
  t.datetime :xero_synced_at
  t.text :xero_sync_error
  
  # Who created it
  t.bigint :created_by_id        # Reference to User
  
  t.timestamps
end
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `synced_to_xero?` | Has xero_payment_id and xero_synced_at |
| `sync_error?` | Has xero_sync_error |
| `mark_synced!(xero_id)` | Mark as synced to Xero |
| `mark_sync_failed!(error)` | Log sync error |

**Callbacks:**
- `after_save` & `after_destroy` - Trigger `update_purchase_order_payment_status`
- Recalculates PO payment_status based on total payments vs PO total

**Scopes:**
- `recent` - Order by payment_date DESC
- `by_purchase_order(po_id)` - For specific PO
- `synced_to_xero` - Has xero_payment_id
- `not_synced_to_xero` - Missing xero_payment_id
- `with_sync_errors` - Has xero_sync_error

---

## RATING & REVIEW SYSTEMS

### Supplier Ratings (Built into Contact/Supplier)

**Fields in Contact/Supplier:**
- `rating: integer` (0-5 stars) - Validation: 0-5
- `response_rate: decimal` (0-100%) - Validation: 0-100
- `avg_response_time: integer` (hours) - Response time metric

**Methods:**
- `rating_stars` - Returns "★★★☆☆" format
- `response_rate_percentage` - Returns "85.5%" format
- `avg_response_time_formatted` - Returns "24h" or "3.5d" format
- `supplier_reliability_score` - Composite score (0-100)

**Composite Reliability Scoring (PricebookItem):**

```ruby
def supplier_reliability_score
  score = 0
  score += (supplier.rating || 0) * 8                    # 40 points
  score += (supplier.response_rate || 0) * 0.3           # 30 points
  if supplier.avg_response_time
    time_score = [30 - (supplier.avg_response_time / 2.0), 0].max  # 30 points
    score += time_score
  end
  score.round
end
```

### Price Item Risk Scoring (Pricebook Items)

**Location:** `/Users/rob/Projects/teeem/backend/app/models/pricebook_item.rb`

**Risk Level Calculation:**

| Component | Weight | Scoring |
|-----------|--------|---------|
| Price Freshness | 40 points | Fresh=0, Needs Confirmation=20, Outdated=40 |
| Supplier Reliability | 20 points | Inverse of reliability_score |
| Price Volatility | 20 points | Stable=0, Moderate=25%, Volatile=50% |
| Missing Info | 20 points | No supplier=30, no brand=20, no category=10 |

**Risk Levels:**
- `low` - Score < 25
- `medium` - Score 25-50
- `high` - Score 50-75
- `critical` - Score > 75

**Methods:**
- `risk_score` - Raw 0-100 score
- `risk_level` - Low/Medium/High/Critical
- `risk_level_label` - Display string
- `risk_level_color` - green/yellow/orange/red

### Estimate Reviews (AI Plan Analysis)

**Location:** `/Users/rob/Projects/teeem/backend/app/models/estimate_review.rb`

**Purpose:** AI-powered plan review comparing to estimates

**Schema:**
```ruby
create_table :estimate_reviews do |t|
  t.bigint :estimate_id,              null: false
  t.string :status,                   default: 'pending'  # pending, processing, completed, failed
  
  t.text :ai_findings                 # JSON findings
  t.text :discrepancies               # JSON discrepancies
  
  t.decimal :confidence_score         # 0-100
  t.integer :items_mismatched         # Count
  t.integer :items_missing            # Count
  t.integer :items_extra              # Count
  
  t.timestamps
end
```

**Status Enum:**
```ruby
enum :status, {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed'
}, prefix: true, default: :pending
```

**Key Methods:**
- `completed?`, `processing?`, `failed?` - Status checks
- `total_discrepancies` - items_mismatched + items_missing + items_extra
- `has_discrepancies?` - Boolean true if total_discrepancies > 0

### Contact Activity Log

**Location:** `/Users/rob/Projects/teeem/backend/app/models/contact_activity.rb`

**Purpose:** Audit trail for contact changes and syncs

**Activity Types:**
```ruby
ACTIVITY_TYPES = %w[
  created
  updated
  synced_from_xero
  synced_to_xero
  purchase_order_created
  supplier_linked
  contact_merged
].freeze
```

**Schema:**
```ruby
create_table :contact_activities do |t|
  t.bigint :contact_id,         null: false
  t.string :activity_type,      null: false
  t.text :description
  t.jsonb :metadata             # Flexible data storage
  t.references :performed_by, polymorphic: true, optional: true  # Can be User, System, etc.
  t.datetime :occurred_at,      null: false
  t.timestamps
end
```

---

## RELATED MODELS & RELATIONSHIPS

### Price History & Tracking

**Location:** `/Users/rob/Projects/teeem/backend/app/models/price_history.rb`

**Purpose:** Track all price changes for audit trail and trend analysis

**Schema:**
```ruby
create_table :price_histories do |t|
  t.bigint :pricebook_item_id,  null: false
  t.bigint :supplier_id                        # Which supplier this price from
  
  t.decimal :old_price                         # Previous price
  t.decimal :new_price                         # New price
  
  t.string :change_reason                      # manual_edit, quote_import, etc.
  t.bigint :changed_by_user_id                 # Who changed it
  t.string :quote_reference                    # Quote/invoice reference
  t.string :lga                                # Location specific pricing
  
  t.timestamps
end
```

**Pricebook Item Methods:**
- `latest_price_change` - Most recent price history record
- `price_trend(days)` - % change over period
- `price_volatility` - stable/moderate/volatile
- `price_freshness_status` - missing/unknown/fresh/needs_confirmation/outdated

### Supplier Contacts (Junction)

**Location:** `/Users/rob/Projects/teeem/backend/app/models/supplier_contact.rb`

**Purpose:** Link multiple Contact persons to a Supplier

**Schema:**
```ruby
create_table :supplier_contacts do |t|
  t.bigint :supplier_id,   null: false
  t.bigint :contact_id,    null: false
  t.boolean :is_primary,   default: false
  t.timestamps
end
```

**Constraint:** Unique pair (supplier_id, contact_id)

---

## FRONTEND COMPONENTS

### Authentication Components

**Location:** `/Users/rob/Projects/teeem/frontend/src`

| Component | File | Purpose |
|-----------|------|---------|
| Auth Context | `contexts/AuthContext.jsx` | Global auth state management |
| Login Page | `pages/Login.jsx` | Email/password login |
| Signup | `pages/Signup.jsx` | New user registration |
| Auth Callback | `pages/AuthCallback.jsx` | OAuth callback handler |
| Logout | `pages/Logout.jsx` | Logout handler |
| Profile | `pages/Profile.jsx` | User profile management |

### Contact Management

| Component | File | Purpose |
|-----------|------|---------|
| Contacts Page | `pages/ContactsPage.jsx` | List all contacts |
| Contact Detail | `pages/ContactDetailPage.jsx` | Full contact information |
| Contact Persons Section | `components/contacts/ContactPersonsSection.jsx` | Manage contact people |
| Contact Addresses | `components/contacts/ContactAddressesSection.jsx` | Multiple addresses |
| Contact Groups | `components/contacts/ContactGroupsSection.jsx` | Group membership |
| Contact Relationships | `components/contacts/ContactRelationshipsSection.jsx` | Related contacts |
| Merge Contacts Modal | `components/contacts/MergeContactsModal.jsx` | Merge duplicate contacts |
| Link Xero Contact | `components/contacts/LinkXeroContactModal.jsx` | Link to Xero |
| Type Badge | `components/contacts/ContactTypeBadge.jsx` | Display contact type |
| Contact Map | `components/contacts/ContactMapCard.jsx` | Map view |

### Supplier Components

| Component | File | Purpose |
|-----------|------|---------|
| Suppliers Page | `pages/SuppliersPage.jsx` | List suppliers with filtering |
| Supplier Detail | `pages/SupplierDetailPage.jsx` | Full supplier info + pricebook |
| Supplier Edit | `pages/SupplierEditPage.jsx` | Edit supplier details |
| Supplier New | `pages/SupplierNewPage.jsx` | Create new supplier |

### Purchase Order Components

| Component | File | Purpose |
|-----------|------|---------|
| POs Page | `pages/PurchaseOrdersPage.jsx` | List and manage POs |
| PO Detail | `pages/PurchaseOrderDetailPage.jsx` | Full PO information |
| PO Edit | `pages/PurchaseOrderEditPage.jsx` | Edit PO and line items |

### Price Book Components

| Component | File | Purpose |
|-----------|------|---------|
| Price Books | `pages/PriceBooksPage.jsx` | Manage pricebook items |
| Item Detail | `pages/PriceBookItemDetailPage.jsx` | Individual item with history |

---

## DATABASE SCHEMA SUMMARY

### Core User Tables

```
users
├─ email (unique)
├─ password_digest
├─ name
├─ role (enum: user, admin, product_owner, estimator, supervisor, builder)
├─ oauth fields (provider, uid, token, expires_at)
├─ reset_password_token
├─ last_login_at
├─ mobile_phone
└─ assigned_role
```

### Contact System Tables

```
contacts (central contact repository)
├─ contact_types (array: customer, supplier, sales, land_agent)
├─ primary_contact_type
├─ personal info (name, email, phones)
├─ address & location
├─ tax & company numbers
├─ banking details
├─ supplier metrics (rating, response_rate, avg_response_time)
├─ xero integration fields
└─ status & activity

contact_persons (individual people)
├─ contact_id (FK)
├─ first_name, last_name, email, mobile_phone
├─ role
└─ is_primary

contact_addresses (multiple addresses)
├─ contact_id (FK)
├─ address fields

contact_groups (Xero groups)
├─ xero_contact_group_id
├─ name, status
└─ contact_group_memberships (junction)

contact_relationships (network)
├─ source_contact_id
├─ related_contact_id
├─ relationship_type
└─ notes (bidirectional)

contact_activities (audit log)
├─ contact_id
├─ activity_type
├─ description
├─ metadata (JSON)
├─ performed_by (polymorphic)
└─ occurred_at

contact_roles (for constructions)
├─ name (unique)
└─ active
```

### Supplier Tables

```
suppliers (legacy, transitioning to contacts)
├─ name (unique)
├─ supplier_code (unique)
├─ contact_id (FK to contacts)
├─ metrics (rating, response_rate, avg_response_time)
├─ matching fields (confidence_score, match_type, is_verified)
├─ trade categories & defaults
└─ purchase_orders_count

supplier_contacts (junction, many-to-many)
├─ supplier_id
├─ contact_id
└─ is_primary
```

### Purchase Order Tables

```
purchase_orders (header)
├─ purchase_order_number (unique)
├─ construction_id (FK)
├─ supplier_id (FK)
├─ estimate_id (FK)
├─ status (enum: draft, pending, approved, sent, received, invoiced, paid, cancelled)
├─ payment_status (enum: pending, part_payment, complete, manual_review)
├─ financial (sub_total, tax, total, budget)
├─ invoiced_amount, amount_paid, amount_invoiced
├─ xero integration fields
├─ date tracking (required, ordered, expected_delivery, received, on_site)
├─ approval tracking (created_by, approved_by, approved_at)
└─ schedule integration (creates_schedule_tasks, task_category)

purchase_order_line_items (details)
├─ purchase_order_id (FK)
├─ pricebook_item_id (FK, optional)
├─ description
├─ line_number
├─ quantity, unit_price, tax_amount, total_amount
```

### Pricing Tables

```
pricebook_items (inventory)
├─ item_code (unique)
├─ item_name
├─ category
├─ unit_of_measure
├─ current_price
├─ supplier_id (FK to contacts)
├─ default_supplier_id (FK to contacts)
├─ image fields & QR code
├─ photo_attached, spec_url
├─ needs_pricing_review
├─ price_last_updated_at
└─ searchable_text (tsvector for full-text search)

price_histories (audit trail)
├─ pricebook_item_id (FK)
├─ supplier_id (FK to contacts)
├─ old_price, new_price
├─ change_reason
├─ changed_by_user_id
├─ quote_reference
├─ lga (location-specific)
```

### Construction Contacts Junction

```
construction_contacts
├─ construction_id (FK)
├─ contact_id (FK)
├─ primary (boolean)
├─ role (e.g., "Site Manager")
└─ unique(construction_id, contact_id)
```

### Payment Tracking

```
payments
├─ purchase_order_id (FK)
├─ amount (decimal)
├─ payment_date
├─ payment_method (bank_transfer, check, credit_card, cash, eft, other)
├─ reference_number
├─ notes
├─ xero sync fields (xero_payment_id, xero_synced_at, xero_sync_error)
├─ created_by_id (FK to users)
```

### Review & Analysis

```
estimate_reviews
├─ estimate_id (FK)
├─ status (pending, processing, completed, failed)
├─ ai_findings (JSON)
├─ discrepancies (JSON)
├─ confidence_score (0-100)
├─ items_mismatched, items_missing, items_extra
```

---

## KEY FILE LOCATIONS

### Backend - Models
```
/Users/rob/Projects/teeem/backend/app/models/
├─ user.rb                          # User model with roles
├─ contact.rb                        # Main contact model
├─ contact_person.rb                # Individual contact people
├─ contact_relationship.rb           # Contact network relationships
├─ contact_activity.rb              # Activity audit log
├─ contact_group.rb                 # Xero contact groups
├─ contact_role.rb                  # Roles for contacts
├─ supplier.rb                       # Supplier model (legacy)
├─ supplier_contact.rb              # Supplier-contact junction
├─ purchase_order.rb                # Purchase order header
├─ purchase_order_line_item.rb      # PO line items
├─ payment.rb                        # Payment records
├─ pricebook_item.rb                # Price book items with risk scoring
├─ price_history.rb                 # Price change audit trail
├─ estimate_review.rb               # AI plan review
```

### Backend - Controllers (API v1)
```
/Users/rob/Projects/teeem/backend/app/controllers/api/v1/
├─ authentication_controller.rb      # Login/signup
├─ omniauth_callbacks_controller.rb  # OAuth callback
├─ contacts_controller.rb            # Contact CRUD
├─ suppliers_controller.rb           # Supplier CRUD
├─ purchase_orders_controller.rb     # PO management
├─ payments_controller.rb            # Payment tracking
├─ pricebook_items_controller.rb     # Pricebook management
├─ contact_relationships_controller.rb # Relationship management
├─ contact_roles_controller.rb       # Role management
```

### Backend - Services
```
/Users/rob/Projects/teeem/backend/app/services/
├─ json_web_token.rb                # JWT encode/decode
├─ invoice_matching_service.rb      # PO-Invoice matching
```

### Backend - Database
```
/Users/rob/Projects/teeem/backend/db/
├─ schema.rb                         # Current schema (auto-generated)
├─ migrate/
│  ├─ 20251029024027_create_users.rb
│  ├─ 20251103082219_create_contacts.rb
│  ├─ 20251103074835_create_price_book_system.rb
│  ├─ 20251104030009_create_purchase_orders.rb
│  ├─ 20251104032250_create_supplier_contacts.rb
│  ├─ 20251110042814_add_role_to_users.rb
│  ├─ 20251112203249_create_construction_contacts.rb
│  ├─ 20251112205154_create_contact_relationships.rb
│  ├─ 20251112213631_create_payments.rb
```

### Backend - Routes
```
/Users/rob/Projects/teeem/backend/config/routes.rb
Authentication:
  POST /api/v1/auth/signup
  POST /api/v1/auth/login
  GET  /api/v1/auth/me

Contacts:
  GET    /api/v1/contacts
  POST   /api/v1/contacts
  GET    /api/v1/contacts/:id
  PATCH  /api/v1/contacts/:id
  DELETE /api/v1/contacts/:id
  PATCH  /api/v1/contacts/bulk_update
  POST   /api/v1/contacts/merge
  
Contact Relationships:
  GET    /api/v1/contacts/:id/relationships
  POST   /api/v1/contacts/:id/relationships
  PATCH  /api/v1/contacts/:id/relationships/:id
  DELETE /api/v1/contacts/:id/relationships/:id

Suppliers:
  GET    /api/v1/suppliers
  POST   /api/v1/suppliers
  GET    /api/v1/suppliers/:id
  PATCH  /api/v1/suppliers/:id
  DELETE /api/v1/suppliers/:id
  GET    /api/v1/suppliers/unmatched
  GET    /api/v1/suppliers/needs_review
  POST   /api/v1/suppliers/:id/link_contact
  POST   /api/v1/suppliers/:id/verify_match

Purchase Orders:
  GET    /api/v1/purchase_orders
  POST   /api/v1/purchase_orders
  GET    /api/v1/purchase_orders/:id
  PATCH  /api/v1/purchase_orders/:id
  DELETE /api/v1/purchase_orders/:id
  POST   /api/v1/purchase_orders/:id/approve
  POST   /api/v1/purchase_orders/:id/send_to_supplier
  POST   /api/v1/purchase_orders/:id/mark_received

Payments:
  GET    /api/v1/purchase_orders/:po_id/payments
  POST   /api/v1/purchase_orders/:po_id/payments
  PATCH  /api/v1/payments/:id
  DELETE /api/v1/payments/:id
  POST   /api/v1/payments/:id/sync_to_xero
```

### Frontend - Components
```
/Users/rob/Projects/teeem/frontend/src/
├─ pages/
│  ├─ Login.jsx
│  ├─ Signup.jsx
│  ├─ AuthCallback.jsx
│  ├─ ContactsPage.jsx
│  ├─ ContactDetailPage.jsx
│  ├─ SuppliersPage.jsx
│  ├─ SupplierDetailPage.jsx
│  ├─ SupplierEditPage.jsx
│  ├─ SupplierNewPage.jsx
│  ├─ PurchaseOrdersPage.jsx
│  ├─ PurchaseOrderDetailPage.jsx
│  ├─ PurchaseOrderEditPage.jsx
│  ├─ PriceBooksPage.jsx
│  ├─ PriceBookItemDetailPage.jsx
│  ├─ Profile.jsx

├─ components/
│  ├─ contacts/
│  │  ├─ ContactPersonsSection.jsx
│  │  ├─ ContactAddressesSection.jsx
│  │  ├─ ContactGroupsSection.jsx
│  │  ├─ ContactRelationshipsSection.jsx
│  │  ├─ ContactTypeBadge.jsx
│  │  ├─ MergeContactsModal.jsx
│  │  ├─ LinkXeroContactModal.jsx
│  │  └─ ContactMapCard.jsx
│  ├─ settings/
│  │  └─ ContactRolesManagement.jsx

├─ contexts/
│  └─ AuthContext.jsx
```

---

## KEY OBSERVATIONS & NOTES

### Authentication Status
⚠️ **IMPORTANT:** Current `authorize_request` in ApplicationController is a PLACEHOLDER
- Creates default test user on every request
- Does NOT validate JWT tokens from request headers
- **Not suitable for production**
- Need to implement actual JWT validation middleware

### Supplier-Contact Transition
- System is actively transitioning from separate Supplier model to Contact-based model
- Many tables still have `supplier_id` foreign keys pointing to `contact_id`
- SupplierContact junction model bridges the gap during migration
- New development uses Contact model with contact_types=['supplier']

### Rating System
- Supplier ratings are direct fields in both Supplier and Contact models
- PricebookItem includes sophisticated risk scoring combining:
  - Price freshness (40%)
  - Supplier reliability (20%)
  - Price volatility (20%)
  - Missing information (20%)

### Invoice Matching
- PurchaseOrder has sophisticated payment status tracking
- Payment status determined by comparing invoice_amount to PO total
- Tolerance: 95-105% considered "complete"
- Payment model tracks all payment transactions and Xero sync status

### Authorization
- Role-based permissions model in place
- 6 primary roles: user, admin, product_owner, estimator, supervisor, builder
- 6 assignable roles for team scheduling
- Methods for permission checks: admin?, can_create_templates?, etc.

---

## SUMMARY TABLE

| Aspect | Status | Details |
|--------|--------|---------|
| **Authentication** | Partial | JWT setup complete, middleware placeholder |
| **Users & Roles** | Complete | 6 roles with permission methods |
| **Contacts** | Complete | Multi-type system with relationships |
| **Suppliers** | In Transition | Legacy model→Contact model |
| **PurchaseOrders** | Complete | Full lifecycle with Xero integration |
| **Payments** | Complete | Tracking with Xero sync |
| **Ratings** | Complete | Supplier metrics + risk scoring |
| **Reviews** | Complete | Estimate AI review framework |
| **Frontend** | Mostly Done | Auth, contact, supplier, PO components ready |

