# Subcontractor Portal - Test Plan

## Prerequisites

1. **Database Migrations:**
   ```bash
   cd backend
   bin/rails db:migrate
   ```

2. **Create Test Data:**
   ```bash
   bin/rails runner "
   # Create a test supplier contact
   contact = Contact.create!(
     first_name: 'Test',
     last_name: 'Subcontractor',
     company_name: 'Test Plumbing Co',
     email: 'test.subbie@example.com',
     phone: '0400123456',
     contact_type: 'supplier'
   )

   # Activate portal access
   result = SubcontractorActivationService.activate(
     contact,
     invited_by: User.first&.contact,
     send_welcome: false
   )

   if result[:success]
     puts \"Portal user created!\"
     puts \"Email: test.subbie@example.com\"
     puts \"Temporary Password: #{result[:temporary_password]}\"

     # Update password to something easy for testing
     result[:portal_user].update(password: 'Password123!@#')
     puts \"Password changed to: Password123!@#\"
   else
     puts \"Error: #{result[:error]}\"
   end
   "
   ```

3. **Start Backend:**
   ```bash
   cd backend
   bin/rails server
   ```

4. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

## Test Scenarios

### 1. Portal Login ✅

**Endpoint:** `POST /api/v1/portal/auth/login`

**Test with cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/portal/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.subbie@example.com",
    "password": "Password123!@#"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "email": "test.subbie@example.com",
    "contact_name": "Test Subcontractor",
    "company_name": "Test Plumbing Co",
    "portal_type": "supplier",
    "kudos_score": 0.0,
    "account_tier": "free"
  }
}
```

**Frontend Test:**
1. Navigate to `http://localhost:5173/portal/login`
2. Enter credentials:
   - Email: `test.subbie@example.com`
   - Password: `Password123!@#`
3. Click "Sign in"
4. Should redirect to `/portal/dashboard`

---

### 2. Dashboard Data ✅

**Endpoint:** `GET /api/v1/portal/jobs`

**Test with cURL:**
```bash
TOKEN="your_token_from_login"

curl -X GET http://localhost:3000/api/v1/portal/jobs \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "upcoming": [],
    "in_progress": [],
    "completed": [],
    "all_jobs": []
  }
}
```

---

### 3. Create Test Quote Request (Builder Side)

**Run in Rails console:**
```bash
bin/rails runner "
construction = Construction.first || Construction.create!(
  job_name: 'Test House Build',
  street_address: '123 Test St',
  city: 'Melbourne',
  state: 'VIC',
  postcode: '3000',
  business_name: 'Test Builders Pty Ltd'
)

quote_request = QuoteRequest.create!(
  construction: construction,
  created_by: User.first,
  title: 'Plumbing Rough-In',
  description: 'Need plumbing rough-in for new house build',
  trade_category: 'Plumbing',
  requested_date: 2.weeks.from_now,
  budget_min: 5000,
  budget_max: 8000,
  status: 'pending_response'
)

# Send to test subcontractor
contact = Contact.find_by(email: 'test.subbie@example.com')
quote_request.send_to_suppliers!([contact.id])

puts \"Quote request created: ID #{quote_request.id}\"
puts \"Sent to: #{contact.display_name}\"
"
```

---

### 4. View Quote Requests ✅

**Endpoint:** `GET /api/v1/portal/quote_requests`

**Test with cURL:**
```bash
curl -X GET http://localhost:3000/api/v1/portal/quote_requests \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "pending": [
      {
        "quote_request": {
          "id": 1,
          "title": "Plumbing Rough-In",
          "description": "Need plumbing rough-in...",
          "trade_category": "Plumbing",
          "budget_min": 5000,
          "budget_max": 8000,
          "construction": {
            "name": "Test House Build",
            "address": "123 Test St"
          }
        },
        "my_response": null,
        "days_waiting": 0
      }
    ],
    "submitted": [],
    "accepted": [],
    "rejected": []
  }
}
```

**Frontend Test:**
1. Go to `/portal/quotes`
2. Should see "Pending" tab with 1 quote
3. Click on the quote to view details

---

### 5. Submit Quote Response ✅

**Endpoint:** `POST /api/v1/portal/quote_responses`

**Test with cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/portal/quote_responses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_request_id": 1,
    "quote_response": {
      "price": 6500,
      "timeframe": "2 weeks",
      "notes": "Can start immediately. Includes all rough-in plumbing for 3 bathrooms and kitchen."
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Quote submitted successfully",
  "data": {
    "id": 1,
    "price": 6500,
    "timeframe": "2 weeks",
    "notes": "Can start immediately...",
    "status": "submitted",
    "response_time_hours": 0.5
  }
}
```

---

### 6. Accept Quote & Create PO (Builder Side)

**Run in Rails console:**
```bash
bin/rails runner "
quote_request = QuoteRequest.first
quote_response = quote_request.quote_responses.first

# Accept the quote
quote_request.accept_quote!(quote_response)

# Convert to Purchase Order
po = PurchaseOrder.create!(
  construction: quote_request.construction,
  contact: quote_response.contact,
  po_number: 'PO-1001',
  total: quote_response.price,
  notes: 'Created from quote request',
  status: 'approved',
  quote_response: quote_response
)

puts \"PO created: #{po.po_number}\"
puts \"Amount: $#{po.total}\"
"
```

---

### 7. View Jobs ✅

**Endpoint:** `GET /api/v1/portal/jobs`

**Frontend Test:**
1. Go to `/portal/jobs`
2. Should see job in "Upcoming" tab
3. Click job to view details

---

### 8. Mark Job Arrival ✅

**Endpoint:** `POST /api/v1/portal/jobs/:id/mark_arrival`

**Test with cURL:**
```bash
JOB_ID=1

curl -X POST http://localhost:3000/api/v1/portal/jobs/$JOB_ID/mark_arrival \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Arrival recorded successfully",
  "kudos_awarded": 100
}
```

---

### 9. Mark Job Complete ✅

**Endpoint:** `POST /api/v1/portal/jobs/:id/mark_complete`

**Test with cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/portal/jobs/$JOB_ID/mark_complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

### 10. Create Invoice ✅

**Endpoint:** `POST /api/v1/portal/invoices`

**Test with cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/portal/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "purchase_order_id": 1,
    "amount": 6500
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "id": 1,
    "amount": 6500,
    "status": "pending"
  }
}
```

**Frontend Test:**
1. Go to `/portal/invoices`
2. Click "Create Invoice"
3. Select completed job
4. Enter amount
5. Submit

---

### 11. View Kudos Score ✅

**Endpoint:** `GET /api/v1/portal/kudos`

**Test with cURL:**
```bash
curl -X GET http://localhost:3000/api/v1/portal/kudos \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "kudos_score": 200.0,
    "tier": "silver",
    "tier_progress": 50.0,
    "breakdown": {
      "quote_response": {
        "total_events": 1,
        "weighted_points": 100.0
      },
      "arrival": {
        "total_events": 1,
        "weighted_points": 100.0
      }
    }
  }
}
```

**Frontend Test:**
1. Go to `/portal/kudos`
2. Should see score of ~200
3. Tier badge should show "Silver"
4. Progress bar showing progress to Gold

---

## Quick Test Script

**Run all API tests:**
```bash
# Save this as test_portal.sh
#!/bin/bash

# Login
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/portal/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test.subbie@example.com","password":"Password123!@#"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# Get jobs
echo -e "\n2. Getting jobs..."
curl -s -X GET http://localhost:3000/api/v1/portal/jobs \
  -H "Authorization: Bearer $TOKEN" | jq

# Get quotes
echo -e "\n3. Getting quote requests..."
curl -s -X GET http://localhost:3000/api/v1/portal/quote_requests \
  -H "Authorization: Bearer $TOKEN" | jq

# Get kudos
echo -e "\n4. Getting kudos score..."
curl -s -X GET http://localhost:3000/api/v1/portal/kudos \
  -H "Authorization: Bearer $TOKEN" | jq

echo -e "\n✅ All tests complete!"
```

---

## Expected Flow

1. ✅ Builder creates quote request
2. ✅ Subcontractor receives notification (email/SMS)
3. ✅ Subcontractor logs into portal
4. ✅ Views quote in dashboard
5. ✅ Submits quote with price/timeframe
6. ✅ Builder reviews and accepts quote
7. ✅ Builder creates PO from accepted quote
8. ✅ Subcontractor sees job in "Upcoming"
9. ✅ Marks arrival on site
10. ✅ Marks job complete
11. ✅ Creates invoice
12. ✅ Invoice syncs to accounting (if connected)
13. ✅ Kudos score updates based on performance

---

## Troubleshooting

### Can't login?
```bash
# Check if portal user exists
bin/rails runner "puts PortalUser.find_by(email: 'test.subbie@example.com').inspect"

# Reset password
bin/rails runner "
user = PortalUser.find_by(email: 'test.subbie@example.com')
user.update(password: 'Password123!@#')
puts 'Password reset to: Password123!@#'
"
```

### No jobs showing?
```bash
# Check purchase orders
bin/rails runner "
contact = Contact.find_by(email: 'test.subbie@example.com')
puts \"POs for #{contact.display_name}:\"
puts contact.purchase_orders.pluck(:id, :po_number, :status)
"
```

### Kudos score not updating?
```bash
# Manually recalculate
bin/rails runner "
contact = Contact.find_by(email: 'test.subbie@example.com')
account = contact.portal_user.subcontractor_account
account.recalculate_kudos_score!
puts \"New score: #{account.kudos_score}\"
"
```

---

## Success Criteria ✅

- [ ] Can login with test credentials
- [ ] Dashboard shows stats and recent activity
- [ ] Can view and respond to quote requests
- [ ] Can see jobs in different statuses
- [ ] Can mark arrival and completion
- [ ] Can create invoices
- [ ] Kudos score updates after events
- [ ] Can view kudos breakdown
- [ ] Settings page loads accounting options

---

## Next Steps

Once testing is complete:
1. Add frontend routes to App.jsx
2. Deploy to staging
3. Invite real subcontractors
4. Gather feedback
5. Iterate on UI/UX
