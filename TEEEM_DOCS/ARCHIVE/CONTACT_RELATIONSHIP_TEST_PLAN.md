# Contact & Relationship Testing Plan

## Test Date: 2025-11-25
## Status: Ready for Testing

---

## 1. Contact CRUD Operations

### Test 1.1: Create New Contact
- [ ] Navigate to /tables/214/contacts
- [ ] Click "Add Item"
- [ ] Fill in: Full Name, Email, Phone
- [ ] Set entity_type (person/company/trust)
- [ ] Set contact_types (customer/supplier/sales/land_agent)
- [ ] Save and verify it appears in the list

### Test 1.2: Edit Contact
- [ ] Click on a contact to edit
- [ ] Update full name and email
- [ ] Save and verify changes persist

### Test 1.3: Delete Contact
- [ ] Select a test contact
- [ ] Delete it
- [ ] Verify it's removed from the list

---

## 2. Contact Relationships

### Test 2.1: Create Relationship via UI
**Need to check if relationship UI exists in contact detail page**
- [ ] Navigate to /contacts/:id
- [ ] Look for "Relationships" section
- [ ] Try to add a new relationship
- [ ] Select relationship type (e.g., "employee_of")
- [ ] Select related contact
- [ ] Save and verify

### Test 2.2: Bidirectional Sync
**Test via API or Rails console**
```ruby
# Create relationship: Person A is employee of Company B
person = Contact.find_by(entity_type: 'person')
company = Contact.find_by(entity_type: 'company')

rel = ContactRelationship.create!(
  source_contact: person,
  related_contact: company,
  relationship_type: 'employee_of'
)

# Check reverse relationship exists
reverse = ContactRelationship.find_by(
  source_contact: company,
  related_contact: person
)

puts "✅ Bidirectional sync works!" if reverse.present?
```

### Test 2.3: Update Relationship
- [ ] Update an existing relationship (change type or add notes)
- [ ] Verify reverse relationship also updates

### Test 2.4: Delete Relationship
- [ ] Delete a relationship
- [ ] Verify reverse relationship also deleted

---

## 3. Contact Types & Entity Types

### Test 3.1: Multi-type Contact
- [ ] Create contact with multiple types: ['supplier', 'customer']
- [ ] Verify contact appears in both supplier and customer filters
- [ ] Check is_supplier? and is_customer? methods return true

### Test 3.2: Entity Type Filtering
- [ ] Create contacts with different entity types
- [ ] Test filtering by people/companies/trusts
- [ ] Verify scopes work correctly

---

## 4. Company/Employment Relationships

### Test 4.1: Primary Company
- [ ] Create person contact
- [ ] Set primary_company_id to a company contact
- [ ] Verify person.primary_company returns correct company
- [ ] Verify company.employees includes the person

### Test 4.2: Multiple Company Relationships
- [ ] Create person with relationships to multiple companies:
  - director_of Company A
  - shareholder_of Company B
  - employee_of Company C
- [ ] Test person.all_companies returns all 3
- [ ] Test person.directors_of returns Company A
- [ ] Test person.shareholders_of returns Company B
- [ ] Test person.employers returns Company C

### Test 4.3: Ownership Percentages
- [ ] Create shareholder_of relationship with ownership_percentage = 25.5
- [ ] Verify percentage is stored and retrieved correctly
- [ ] Test validation: percentage must be 0-100

---

## 5. Trust Relationships

### Test 5.1: Trust Roles
- [ ] Create trust entity (entity_type = 'trust')
- [ ] Create person as trustee_of the trust
- [ ] Create person as beneficiary_of the trust
- [ ] Verify trust.incoming_relationships shows both trustees and beneficiaries

---

## 6. Contact Detail Page UI

### Test 6.1: Basic Info Display
- [ ] Navigate to /contacts/:id
- [ ] Verify all fields display correctly
- [ ] Check entity type and contact types shown

### Test 6.2: Relationships Tab/Section
**Check if this exists**
- [ ] Look for relationships display
- [ ] Verify outgoing relationships listed
- [ ] Verify incoming relationships listed
- [ ] Check relationship details (type, notes, dates)

### Test 6.3: Jobs/Projects Section
- [ ] Check construction_contacts display
- [ ] Verify primary jobs highlighted
- [ ] Test job roles display

---

## 7. API Endpoints

### Test 7.1: Contacts List API
```bash
curl http://localhost:3000/api/v1/contacts?limit=5
```
- [ ] Returns list of contacts
- [ ] Includes contact_types
- [ ] Includes entity_type
- [ ] Includes display_name

### Test 7.2: Contact Detail API
```bash
curl http://localhost:3000/api/v1/contacts/:id
```
- [ ] Returns full contact details
- [ ] Includes relationships?
- [ ] Includes related contacts?

### Test 7.3: Relationship CRUD API
**Check if these endpoints exist**
```bash
# List relationships for a contact
GET /api/v1/contacts/:id/relationships

# Create relationship
POST /api/v1/contacts/:id/relationships

# Update relationship
PATCH /api/v1/contact_relationships/:id

# Delete relationship
DELETE /api/v1/contact_relationships/:id
```

---

## 8. Edge Cases & Validations

### Test 8.1: Self-Relationship Prevention
- [ ] Try to create relationship where source = related contact
- [ ] Should fail with validation error

### Test 8.2: Duplicate Relationship Prevention
- [ ] Create relationship: Person A → Company B (employee_of)
- [ ] Try to create same relationship again
- [ ] Should fail with validation error

### Test 8.3: Invalid Relationship Type
- [ ] Try to create relationship with invalid type
- [ ] Should fail with validation error

### Test 8.4: Ownership Percentage Validation
- [ ] Try ownership_percentage = -10 (should fail)
- [ ] Try ownership_percentage = 150 (should fail)
- [ ] Try ownership_percentage = 50.5 (should succeed)

---

## 9. Data Integrity

### Test 9.1: Cascade Deletes
- [ ] Create contact with relationships
- [ ] Delete the contact
- [ ] Verify relationships also deleted
- [ ] Verify reverse relationships also deleted

### Test 9.2: Date Ranges
- [ ] Create relationship with start_date = 2020-01-01
- [ ] Set end_date = 2023-12-31
- [ ] Set is_active = false
- [ ] Verify historical relationships work

---

## 10. Frontend UI Tests

### Test 10.1: Contacts Table View
- [ ] Navigate to /tables/214/contacts
- [ ] Verify columns display correctly
- [ ] Test sorting by name, email, contact_type
- [ ] Test filtering by entity_type
- [ ] Test search functionality

### Test 10.2: Contact Detail Page
- [ ] Click on a contact
- [ ] Verify detail page loads
- [ ] Check all tabs/sections work
- [ ] Test editing from detail page

### Test 10.3: Relationship Management UI
**This likely needs to be built**
- [ ] Add "Relationships" tab to contact detail page
- [ ] Display all relationships (outgoing + incoming)
- [ ] Add "Add Relationship" button
- [ ] Add relationship type dropdown
- [ ] Add related contact search/select
- [ ] Add optional fields (notes, dates, ownership %)

---

## Issues Found

### High Priority
- [ ] Issue 1: ...
- [ ] Issue 2: ...

### Medium Priority
- [ ] Issue 3: ...

### Low Priority / Enhancements
- [ ] Enhancement 1: ...

---

## Test Results Summary

- Total Tests: 40+
- Passed: ___
- Failed: ___
- Blocked: ___
- Not Tested: ___

---

## Next Steps

1. Run through all tests systematically
2. Document any bugs found
3. Create issues in Trinity Lexicon for bugs
4. Identify missing UI components
5. Plan implementation for missing features
