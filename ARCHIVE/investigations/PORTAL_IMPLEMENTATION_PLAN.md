# Supplier & Customer Portal Implementation Plan

## Overview
Create separate portals for suppliers and customers to access their specific information, with secure authentication and "View As" functionality for internal staff.

## Requirements Summary

### Supplier Portal Features
1. **Gantt Chart** - View timeline of their assigned work
2. **Purchase Orders** - View current and future POs
3. **Payment Structure** - See payment schedules and terms
4. **Payment Linking** - Link their POs to payment requests
5. **Invoice Status** - See when invoices are getting paid
6. **Payment History** - View what has been paid
7. **Maintenance Requests** - View outstanding maintenance issues
8. **TEEEM Rating** - Display their performance rating

### Customer Portal Features
1. **Project Dashboard** - View their construction projects
2. **Project Progress** - Timeline and milestones
3. **Documents** - Access project documents
4. **Financial Summary** - Budget, costs, invoices
5. **Communication** - Messages and updates

### Administrative Features
1. **Portal User Management** - Create/manage portal accounts for contacts
2. **View As** - Impersonate supplier/customer view from Contacts page
3. **Rating System** - Rate suppliers on multiple criteria

---

## Database Schema Changes

### 1. Portal Users Table (New)
```ruby
create_table :portal_users do |t|
  t.references :contact, null: false, foreign_key: true
  t.string :email, null: false
  t.string :password_digest, null: false
  t.string :portal_type, null: false  # 'supplier' or 'customer'
  t.boolean :active, default: true
  t.datetime :last_login_at
  t.string :reset_password_token
  t.datetime :reset_password_sent_at
  t.integer :failed_login_attempts, default: 0
  t.datetime :locked_until
  t.timestamps
end

add_index :portal_users, :email, unique: true
add_index :portal_users, :reset_password_token, unique: true
add_index :portal_users, [:contact_id, :portal_type], unique: true
```

**Purpose**: Separate authentication for external portal users (suppliers/customers)

### 2. Supplier Ratings Table (New)
```ruby
create_table :supplier_ratings do |t|
  t.references :contact, null: false, foreign_key: true  # The supplier being rated
  t.references :rated_by_user, null: false, foreign_key: { to_table: :users }
  t.references :construction, foreign_key: true  # Optional: specific project
  t.references :purchase_order, foreign_key: true  # Optional: specific PO

  # Rating categories (1-5 scale)
  t.integer :quality_rating  # Quality of work/materials
  t.integer :timeliness_rating  # On-time delivery
  t.integer :communication_rating  # Responsiveness
  t.integer :professionalism_rating  # Professional conduct
  t.integer :value_rating  # Value for money

  # Calculated overall
  t.decimal :overall_rating, precision: 3, scale: 2  # Average of above

  # Comments
  t.text :positive_feedback
  t.text :areas_for_improvement
  t.text :internal_notes  # Not visible to supplier

  t.timestamps
end

add_index :supplier_ratings, [:contact_id, :created_at]
```

**Purpose**: Track detailed supplier performance ratings (the "TEEEM Rating")

### 3. Maintenance Requests Table (New)
```ruby
create_table :maintenance_requests do |t|
  t.references :construction, null: false, foreign_key: true
  t.references :supplier_contact, foreign_key: { to_table: :contacts }  # Responsible supplier
  t.references :reported_by_user, foreign_key: { to_table: :users }
  t.references :purchase_order, foreign_key: true  # Related PO if applicable

  t.string :request_number, null: false  # Auto-generated: MR-YYYYMMDD-XXX
  t.string :status, null: false, default: 'open'  # open, in_progress, resolved, closed
  t.string :priority, default: 'medium'  # low, medium, high, urgent
  t.string :category  # plumbing, electrical, structural, etc.

  t.string :title, null: false
  t.text :description
  t.text :resolution_notes

  t.date :reported_date, null: false
  t.date :due_date
  t.date :resolved_date

  t.boolean :warranty_claim, default: false
  t.decimal :estimated_cost, precision: 10, scale: 2
  t.decimal :actual_cost, precision: 10, scale: 2

  t.timestamps
end

add_index :maintenance_requests, :request_number, unique: true
add_index :maintenance_requests, [:supplier_contact_id, :status]
add_index :maintenance_requests, [:construction_id, :status]
```

**Purpose**: Track maintenance issues assigned to suppliers

### 4. Portal Access Logs Table (New)
```ruby
create_table :portal_access_logs do |t|
  t.references :portal_user, null: false, foreign_key: true
  t.string :action  # login, logout, view_po, download_document, etc.
  t.string :ip_address
  t.string :user_agent
  t.jsonb :metadata  # Additional context data
  t.timestamps
end

add_index :portal_access_logs, [:portal_user_id, :created_at]
add_index :portal_access_logs, :action
```

**Purpose**: Audit trail for portal access and activities

### 5. Existing Table Modifications

#### Add to `contacts` table:
```ruby
add_column :contacts, :portal_enabled, :boolean, default: false
add_column :contacts, :portal_welcome_sent_at, :datetime
add_column :contacts, :teeem_rating, :decimal, precision: 3, scale: 2  # Calculated average
add_column :contacts, :total_ratings_count, :integer, default: 0
```

#### Add to `purchase_orders` table:
```ruby
add_column :purchase_orders, :visible_to_supplier, :boolean, default: false
add_column :purchase_orders, :payment_schedule, :jsonb  # Array of payment milestones
```

---

## Implementation Steps

### Phase 1: Database & Models (Priority 1)

#### Step 1.1: Create Migrations
- [ ] `rails g migration CreatePortalUsers`
- [ ] `rails g migration CreateSupplierRatings`
- [ ] `rails g migration CreateMaintenanceRequests`
- [ ] `rails g migration CreatePortalAccessLogs`
- [ ] `rails g migration AddPortalFieldsToContacts`
- [ ] `rails g migration AddPortalFieldsToPurchaseOrders`
- [ ] Run migrations: `bin/rails db:migrate`

#### Step 1.2: Create Models
- [ ] `backend/app/models/portal_user.rb`
  - Validations: email format, password strength
  - Methods: `authenticate`, `generate_reset_token`, `lock_account!`, `unlock_account!`
  - Scopes: `active`, `locked`, `suppliers`, `customers`

- [ ] `backend/app/models/supplier_rating.rb`
  - Validations: ratings between 1-5
  - Callbacks: `calculate_overall_rating` (before_save)
  - Callbacks: Update contact's `teeem_rating` and `total_ratings_count` (after_save)
  - Scopes: `recent`, `by_supplier`, `by_construction`

- [ ] `backend/app/models/maintenance_request.rb`
  - Validations: status, priority
  - Callbacks: `generate_request_number` (before_create)
  - Methods: `mark_in_progress!`, `mark_resolved!`, `mark_closed!`
  - Scopes: `open`, `assigned_to_supplier`, `overdue`, `by_status`

- [ ] `backend/app/models/portal_access_log.rb`
  - Minimal validations
  - Class method: `log_activity(portal_user, action, metadata)`

#### Step 1.3: Update Existing Models
- [ ] Update `Contact` model:
  - Add method: `enable_portal!(portal_type)`
  - Add method: `portal_user`
  - Add method: `average_rating` (calculated from supplier_ratings)
  - Add association: `has_one :portal_user`
  - Add association: `has_many :supplier_ratings`
  - Add association: `has_many :maintenance_requests, foreign_key: :supplier_contact_id`

- [ ] Update `PurchaseOrder` model:
  - Add scope: `visible_to_suppliers`
  - Add method: `make_visible_to_supplier!`
  - Add method: `payment_schedule_summary`

### Phase 2: Authentication & Authorization (Priority 1)

#### Step 2.1: Portal Authentication Controller
- [ ] `backend/app/controllers/api/v1/portal/authentication_controller.rb`
  - POST `/api/v1/portal/login` - Portal user login
  - POST `/api/v1/portal/logout` - Portal user logout
  - GET `/api/v1/portal/me` - Current portal user info
  - POST `/api/v1/portal/forgot_password` - Request password reset
  - POST `/api/v1/portal/reset_password` - Reset password with token

#### Step 2.2: Portal Authorization Concern
- [ ] `backend/app/controllers/concerns/portal_authorization.rb`
  - `authenticate_portal_user!` - Verify JWT token
  - `current_portal_user` - Get current portal user
  - `authorize_supplier!` - Ensure user is supplier type
  - `authorize_customer!` - Ensure user is customer type
  - `log_portal_activity(action, metadata)` - Log access

#### Step 2.3: Impersonation Controller
- [ ] `backend/app/controllers/api/v1/impersonation_controller.rb`
  - POST `/api/v1/contacts/:id/impersonate` - Generate impersonation token
  - Requires admin/manager role
  - Returns portal JWT token for "View As" functionality

### Phase 3: Supplier Portal API (Priority 2)

#### Step 3.1: Supplier Dashboard Controller
- [ ] `backend/app/controllers/api/v1/portal/supplier/dashboard_controller.rb`
  - GET `/api/v1/portal/supplier/dashboard` - Overview stats
  - Returns: active POs count, pending payments, maintenance requests, rating

#### Step 3.2: Supplier Purchase Orders Controller
- [ ] `backend/app/controllers/api/v1/portal/supplier/purchase_orders_controller.rb`
  - GET `/api/v1/portal/supplier/purchase_orders` - List their POs
  - GET `/api/v1/portal/supplier/purchase_orders/:id` - PO details
  - Filters: status, date range
  - Only shows POs where `visible_to_supplier: true`

#### Step 3.3: Supplier Payments Controller
- [ ] `backend/app/controllers/api/v1/portal/supplier/payments_controller.rb`
  - GET `/api/v1/portal/supplier/payments` - Payment history
  - GET `/api/v1/portal/supplier/payments/pending` - Pending payments
  - GET `/api/v1/portal/supplier/payments/:id` - Payment details

#### Step 3.4: Supplier Maintenance Controller
- [ ] `backend/app/controllers/api/v1/portal/supplier/maintenance_requests_controller.rb`
  - GET `/api/v1/portal/supplier/maintenance_requests` - Their maintenance requests
  - GET `/api/v1/portal/supplier/maintenance_requests/:id` - Request details
  - PATCH `/api/v1/portal/supplier/maintenance_requests/:id` - Update status/notes
  - POST `/api/v1/portal/supplier/maintenance_requests/:id/mark_in_progress`
  - POST `/api/v1/portal/supplier/maintenance_requests/:id/mark_resolved`

#### Step 3.5: Supplier Rating Controller
- [ ] `backend/app/controllers/api/v1/portal/supplier/ratings_controller.rb`
  - GET `/api/v1/portal/supplier/ratings` - View their ratings (excluding internal notes)
  - GET `/api/v1/portal/supplier/ratings/summary` - Average ratings by category

#### Step 3.6: Supplier Gantt Data Controller
- [ ] `backend/app/controllers/api/v1/portal/supplier/gantt_controller.rb`
  - GET `/api/v1/portal/supplier/gantt` - Tasks/POs in Gantt format
  - Returns: All their POs with dates formatted for Gantt chart display

### Phase 4: Customer Portal API (Priority 2)

#### Step 4.1: Customer Dashboard Controller
- [ ] `backend/app/controllers/api/v1/portal/customer/dashboard_controller.rb`
  - GET `/api/v1/portal/customer/dashboard` - Overview of their projects

#### Step 4.2: Customer Projects Controller
- [ ] `backend/app/controllers/api/v1/portal/customer/constructions_controller.rb`
  - GET `/api/v1/portal/customer/constructions` - Their projects
  - GET `/api/v1/portal/customer/constructions/:id` - Project details
  - GET `/api/v1/portal/customer/constructions/:id/timeline` - Project timeline

#### Step 4.3: Customer Documents Controller
- [ ] `backend/app/controllers/api/v1/portal/customer/documents_controller.rb`
  - GET `/api/v1/portal/customer/documents` - Access project documents
  - GET `/api/v1/portal/customer/documents/:id/download` - Download document

#### Step 4.4: Customer Financials Controller
- [ ] `backend/app/controllers/api/v1/portal/customer/financials_controller.rb`
  - GET `/api/v1/portal/customer/financials/:construction_id` - Budget, costs, invoices

### Phase 5: Admin Management API (Priority 1)

#### Step 5.1: Portal User Management Controller
- [ ] `backend/app/controllers/api/v1/admin/portal_users_controller.rb`
  - GET `/api/v1/admin/portal_users` - List all portal users
  - POST `/api/v1/admin/portal_users` - Create portal user for contact
  - PATCH `/api/v1/admin/portal_users/:id` - Update portal user
  - DELETE `/api/v1/admin/portal_users/:id` - Deactivate portal user
  - POST `/api/v1/admin/portal_users/:id/send_welcome` - Send welcome email
  - POST `/api/v1/admin/portal_users/:id/reset_password` - Force password reset

#### Step 5.2: Supplier Rating Management Controller
- [ ] `backend/app/controllers/api/v1/admin/supplier_ratings_controller.rb`
  - POST `/api/v1/admin/supplier_ratings` - Create rating
  - GET `/api/v1/admin/supplier_ratings` - List all ratings
  - PATCH `/api/v1/admin/supplier_ratings/:id` - Update rating
  - DELETE `/api/v1/admin/supplier_ratings/:id` - Delete rating

#### Step 5.3: Maintenance Request Management Controller
- [ ] `backend/app/controllers/api/v1/admin/maintenance_requests_controller.rb`
  - POST `/api/v1/admin/maintenance_requests` - Create request
  - GET `/api/v1/admin/maintenance_requests` - List all requests
  - PATCH `/api/v1/admin/maintenance_requests/:id` - Update request
  - DELETE `/api/v1/admin/maintenance_requests/:id` - Delete request

### Phase 6: Frontend - Supplier Portal (Priority 2)

#### Step 6.1: Portal Authentication UI
- [ ] `frontend/src/pages/portal/PortalLogin.jsx` - Portal login page
- [ ] `frontend/src/pages/portal/ForgotPassword.jsx` - Password reset request
- [ ] `frontend/src/pages/portal/ResetPassword.jsx` - Password reset form
- [ ] `frontend/src/contexts/PortalAuthContext.jsx` - Portal auth state management
- [ ] `frontend/src/components/portal/PortalRoute.jsx` - Protected route component

#### Step 6.2: Supplier Portal Layout
- [ ] `frontend/src/components/portal/supplier/SupplierLayout.jsx`
  - Navigation: Dashboard, Purchase Orders, Payments, Maintenance, Profile
  - Show teeem rating in header
  - Logout button

#### Step 6.3: Supplier Dashboard
- [ ] `frontend/src/pages/portal/supplier/SupplierDashboard.jsx`
  - Summary cards: Active POs, Pending Payments, Open Maintenance, Rating
  - Recent activity feed
  - Quick actions

#### Step 6.4: Supplier Purchase Orders
- [ ] `frontend/src/pages/portal/supplier/SupplierPurchaseOrders.jsx`
  - Table with filters (status, date range)
  - Columns: PO#, Project, Date, Amount, Status, Payment Status
  - Click to view details

- [ ] `frontend/src/pages/portal/supplier/SupplierPurchaseOrderDetail.jsx`
  - PO header information
  - Line items table
  - Payment schedule
  - Payment history
  - Related documents

#### Step 6.5: Supplier Gantt View
- [ ] `frontend/src/pages/portal/supplier/SupplierGantt.jsx`
  - Gantt chart showing their POs and tasks over time
  - Filter by project
  - Hover to see PO details

#### Step 6.6: Supplier Payments
- [ ] `frontend/src/pages/portal/supplier/SupplierPayments.jsx`
  - Table: Payment Date, PO#, Amount, Method, Status
  - Filters: date range, status
  - Export to CSV

#### Step 6.7: Supplier Maintenance
- [ ] `frontend/src/pages/portal/supplier/SupplierMaintenanceRequests.jsx`
  - Table: Request#, Project, Priority, Status, Due Date
  - Filters: status, priority
  - Update status button

- [ ] `frontend/src/pages/portal/supplier/SupplierMaintenanceDetail.jsx`
  - Request details
  - Status update form
  - Resolution notes
  - Related documents

#### Step 6.8: Supplier Rating Display
- [ ] `frontend/src/pages/portal/supplier/SupplierRating.jsx`
  - Overall teeem rating (large display)
  - Breakdown by category (Quality, Timeliness, Communication, etc.)
  - Historical rating chart
  - Recent feedback (excluding internal notes)

### Phase 7: Frontend - Customer Portal (Priority 3)

#### Step 7.1: Customer Portal Layout
- [ ] `frontend/src/components/portal/customer/CustomerLayout.jsx`
  - Navigation: Dashboard, Projects, Documents, Financials, Messages

#### Step 7.2: Customer Dashboard
- [ ] `frontend/src/pages/portal/customer/CustomerDashboard.jsx`
  - Active projects
  - Recent updates
  - Upcoming milestones

#### Step 7.3: Customer Projects
- [ ] `frontend/src/pages/portal/customer/CustomerProjects.jsx`
  - Project list with status
- [ ] `frontend/src/pages/portal/customer/CustomerProjectDetail.jsx`
  - Project timeline
  - Progress photos
  - Key milestones

#### Step 7.4: Customer Documents
- [ ] `frontend/src/pages/portal/customer/CustomerDocuments.jsx`
  - Document library
  - Download/view documents

#### Step 7.5: Customer Financials
- [ ] `frontend/src/pages/portal/customer/CustomerFinancials.jsx`
  - Budget vs actual
  - Invoices
  - Payment history

### Phase 8: Frontend - Admin Management (Priority 1)

#### Step 8.1: Portal User Management in Settings
- [ ] `frontend/src/components/settings/PortalUsersTab.jsx`
  - Table: Contact, Email, Portal Type, Status, Last Login
  - Create portal user button
  - Actions: Edit, Deactivate, Reset Password, Send Welcome

- [ ] `frontend/src/components/settings/CreatePortalUserModal.jsx`
  - Select contact
  - Enter email
  - Select portal type (supplier/customer)
  - Generate temporary password
  - Send welcome email option

#### Step 8.2: "View As" from Contacts Page
- [ ] Update `frontend/src/pages/ContactDetailPage.jsx`
  - Add "View Supplier Portal" button (if contact is supplier with portal)
  - Add "View Customer Portal" button (if contact is customer with portal)
  - On click: Get impersonation token, open portal in new tab

- [ ] Update `frontend/src/pages/ContactsPage.jsx`
  - Add "Portal Access" column showing portal status
  - Quick action button to view portal

#### Step 8.3: Supplier Rating Management
- [ ] `frontend/src/components/contacts/RateSupplierModal.jsx`
  - Star ratings for each category (Quality, Timeliness, etc.)
  - Positive feedback textarea
  - Areas for improvement textarea
  - Internal notes textarea (not visible to supplier)
  - Link to construction/PO (optional)

- [ ] Update `frontend/src/pages/ContactDetailPage.jsx`
  - Add "Rate Supplier" button (if contact is supplier)
  - Show average teeem rating
  - Show rating history table

#### Step 8.4: Maintenance Request Management
- [ ] `frontend/src/pages/MaintenanceRequestsPage.jsx`
  - Table with filters
  - Create maintenance request button
  - Status indicators

- [ ] `frontend/src/components/maintenance/CreateMaintenanceRequestModal.jsx`
  - Select project
  - Select responsible supplier
  - Category, priority, title, description
  - Related PO (optional)
  - Due date

- [ ] Update `frontend/src/pages/ContactDetailPage.jsx`
  - Show open maintenance requests for supplier

### Phase 9: Routes Configuration (Priority 1)

#### Backend Routes
```ruby
# config/routes.rb

namespace :api do
  namespace :v1 do
    # Portal Authentication (Public)
    namespace :portal do
      post 'login', to: 'authentication#login'
      post 'logout', to: 'authentication#logout'
      get 'me', to: 'authentication#me'
      post 'forgot_password', to: 'authentication#forgot_password'
      post 'reset_password', to: 'authentication#reset_password'

      # Supplier Portal (Protected)
      namespace :supplier do
        get 'dashboard', to: 'dashboard#index'
        resources :purchase_orders, only: [:index, :show]
        resources :payments, only: [:index, :show] do
          collection do
            get 'pending'
          end
        end
        resources :maintenance_requests, only: [:index, :show, :update] do
          member do
            post 'mark_in_progress'
            post 'mark_resolved'
          end
        end
        resources :ratings, only: [:index] do
          collection do
            get 'summary'
          end
        end
        get 'gantt', to: 'gantt#index'
      end

      # Customer Portal (Protected)
      namespace :customer do
        get 'dashboard', to: 'dashboard#index'
        resources :constructions, only: [:index, :show] do
          member do
            get 'timeline'
          end
        end
        resources :documents, only: [:index] do
          member do
            get 'download'
          end
        end
        get 'financials/:construction_id', to: 'financials#show'
      end
    end

    # Admin Portal Management (Protected - Admin only)
    namespace :admin do
      resources :portal_users do
        member do
          post 'send_welcome'
          post 'reset_password'
        end
      end
      resources :supplier_ratings
      resources :maintenance_requests
    end

    # Impersonation (Protected - Admin/Manager only)
    post 'contacts/:id/impersonate', to: 'impersonation#create'
  end
end
```

#### Frontend Routes
```javascript
// Add to frontend/src/App.jsx

// Portal routes (separate from main app)
<Route path="/portal/login" element={<PortalLogin />} />
<Route path="/portal/forgot-password" element={<ForgotPassword />} />
<Route path="/portal/reset-password" element={<ResetPassword />} />

// Supplier Portal
<Route path="/portal/supplier" element={<PortalRoute type="supplier"><SupplierLayout /></PortalRoute>}>
  <Route index element={<SupplierDashboard />} />
  <Route path="purchase-orders" element={<SupplierPurchaseOrders />} />
  <Route path="purchase-orders/:id" element={<SupplierPurchaseOrderDetail />} />
  <Route path="gantt" element={<SupplierGantt />} />
  <Route path="payments" element={<SupplierPayments />} />
  <Route path="maintenance" element={<SupplierMaintenanceRequests />} />
  <Route path="maintenance/:id" element={<SupplierMaintenanceDetail />} />
  <Route path="ratings" element={<SupplierRating />} />
</Route>

// Customer Portal
<Route path="/portal/customer" element={<PortalRoute type="customer"><CustomerLayout /></PortalRoute>}>
  <Route index element={<CustomerDashboard />} />
  <Route path="projects" element={<CustomerProjects />} />
  <Route path="projects/:id" element={<CustomerProjectDetail />} />
  <Route path="documents" element={<CustomerDocuments />} />
  <Route path="financials" element={<CustomerFinancials />} />
</Route>

// Admin - Maintenance Requests
<Route path="/maintenance-requests" element={<MaintenanceRequestsPage />} />
```

### Phase 10: Email Notifications (Priority 3)

#### Email Templates
- [ ] Welcome email for new portal users (with login instructions)
- [ ] Password reset email
- [ ] New maintenance request notification (to supplier)
- [ ] Maintenance request status change (to construction manager)
- [ ] New PO notification (to supplier)
- [ ] Payment confirmation (to supplier)
- [ ] New rating notification (to supplier - optional)

### Phase 11: Testing & Security (Priority 1)

#### Security Checklist
- [ ] Portal JWT tokens separate from main app tokens
- [ ] Rate limiting on portal login endpoint
- [ ] Account lockout after failed login attempts
- [ ] Strong password requirements enforced
- [ ] Portal users can ONLY see their own data
- [ ] Impersonation requires admin role
- [ ] Audit all portal access
- [ ] HTTPS required for portal
- [ ] Secure password reset flow
- [ ] XSS protection on all portal inputs

#### Testing
- [ ] Model specs for all new models
- [ ] Controller specs for all API endpoints
- [ ] Integration tests for portal authentication
- [ ] Test supplier can only see their POs
- [ ] Test customer can only see their projects
- [ ] Test impersonation authorization
- [ ] Test rating calculations
- [ ] Test maintenance request workflow

---

## Data Flow Examples

### Supplier Viewing Purchase Orders
1. Supplier logs in → `POST /api/v1/portal/login`
2. Receives portal JWT token
3. Navigates to POs → `GET /api/v1/portal/supplier/purchase_orders`
4. Backend filters POs where:
   - `supplier_id = current_portal_user.contact_id`
   - `visible_to_supplier = true`
5. Returns only supplier's POs

### Admin "View As" Supplier
1. Admin clicks "View Supplier Portal" on Contact detail page
2. Frontend → `POST /api/v1/contacts/:id/impersonate`
3. Backend verifies admin role
4. Generates portal JWT token for that contact
5. Opens portal in new tab with impersonation token
6. Portal shows supplier's view with banner: "Viewing as [Supplier Name]"

### Rating a Supplier
1. Admin clicks "Rate Supplier" on Contact detail
2. Opens `RateSupplierModal`
3. Fills ratings (1-5 for each category)
4. Submits → `POST /api/v1/admin/supplier_ratings`
5. Backend calculates `overall_rating` (average)
6. Updates contact's `teeem_rating` and `total_ratings_count`
7. Optional: Sends notification email to supplier

### Creating Maintenance Request
1. Admin creates request → `POST /api/v1/admin/maintenance_requests`
2. Assigns to supplier contact
3. Email sent to supplier portal user
4. Supplier logs in, sees in maintenance tab
5. Supplier updates status → `PATCH /api/v1/portal/supplier/maintenance_requests/:id`
6. Admin sees updated status in main app

---

## UI/UX Considerations

### Supplier Portal Theme
- Professional, clean design
- Primary color: Blue (trustworthy)
- Large, clear typography
- Mobile-responsive (suppliers may use tablets on site)
- Easy navigation with clear sections

### Customer Portal Theme
- Modern, friendly design
- Primary color: Green (positive, progress)
- Photo-heavy (show construction progress)
- Timeline-focused layout
- Mobile-first design

### "View As" Indicator
- Prominent banner at top: "You are viewing as [Name]"
- Orange/yellow color to indicate not normal session
- "Exit Impersonation" button always visible

### Rating Interface
- Star rating inputs (interactive)
- Visual feedback as user selects stars
- Category labels clear and concise
- Optional comments with character count
- Internal notes section clearly marked

---

## Priority Order for Implementation

### Critical (Do First)
1. Database migrations and models
2. Portal authentication system
3. Admin portal user management
4. Supplier rating system
5. "View As" impersonation

### High Priority (Do Second)
1. Supplier portal API (POs, payments)
2. Supplier portal frontend
3. Maintenance request system
4. Rating management UI

### Medium Priority (Do Third)
1. Customer portal API
2. Customer portal frontend
3. Gantt view for suppliers
4. Email notifications

### Low Priority (Nice to Have)
1. Advanced filtering and search
2. Export functionality
3. Mobile app considerations
4. Push notifications

---

## Estimated Timeline

- **Phase 1-2** (Database & Auth): 3-4 days
- **Phase 3** (Supplier API): 3-4 days
- **Phase 4** (Customer API): 2-3 days
- **Phase 5** (Admin API): 2 days
- **Phase 6** (Supplier Frontend): 4-5 days
- **Phase 7** (Customer Frontend): 3-4 days
- **Phase 8** (Admin Frontend): 2-3 days
- **Phase 9** (Routes): 1 day
- **Phase 10** (Emails): 2 days
- **Phase 11** (Testing): 3-4 days

**Total Estimated Time**: 25-35 days

---

## Next Steps

1. Review this plan with stakeholders
2. Prioritize features based on business needs
3. Begin Phase 1: Database schema implementation
4. Set up staging environment for portal testing
5. Design UI mockups for portal pages
6. Prepare email templates
7. Plan user training/documentation

---

## Questions to Resolve

1. Should suppliers be able to submit invoices through the portal?
2. Can suppliers update their own contact information?
3. Should customers be able to message/chat with project manager?
4. What level of financial detail should customers see?
5. Should there be different permission levels within portal users?
6. How should warranty periods be tracked for maintenance requests?
7. Should suppliers be notified when they receive a rating?
8. Can suppliers dispute or respond to ratings?
9. Should there be a supplier onboarding checklist?
10. What documents should be auto-visible to customers vs requiring approval?
