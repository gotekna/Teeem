# NewJobModal Enhancement Specification

## Overview
Enhance the NewJobModal with additional fields for comprehensive job setup while maintaining the existing swipe animations, gradient header, progress bar, and dark mode support.

## Current File
`/Users/jakebaird/teeem/frontend/src/components/jobs/NewJobModal.jsx`

## New Step Structure (3 steps total)

### Step 1: Basic Info
**Fields:**
1. **Job Title** (required) - Already exists
2. **Address/Location** (required) - Make the existing `location` field required
3. **Client** (required) - Replace simple text input with searchable dropdown
   - Searchable dropdown connecting to `/api/v1/contacts?search={query}`
   - Show contact's `full_name` in dropdown
   - When selected, store `client_id` and prepopulate:
     - `client_name` (from `full_name`)
     - `client_email` (from `email`)
     - `client_phone` (from `mobile_phone` or `office_phone`)
   - Include "Create new client" option that opens inline mini-form or note to create later
4. **Lead Source** - New dropdown field with options:
   - Referral
   - Website
   - Social Media
   - Email Campaign
   - Walk-in
   - Past Client
   - Other

**Design Notes:**
- Maintain icon-badge styling for each field
- Use Headless UI Combobox for the searchable client dropdown
- Show client's email/phone below the selected client (if available)

### Step 2: Project Details
**Fields:**
1. **Contract Value** - Already exists
2. **Start Date** - Already exists
3. **End Date** - Already exists
4. **Site Supervisor** - Move from Step 3 to here, keep required

**Design Notes:**
- Keep existing layout with date range in 2-column grid
- Maintain current styling

### Step 3: Documentation & Status
**Section 1: Documents Available (Checkboxes)**
```jsx
- [ ] Plans/Drawings
- [ ] Engineering
- [ ] Soil Report
- [ ] Energy Report
```

**Section 2: Land Status (Radio buttons - single select)**
```jsx
○ Registered
○ Not Yet Registered
○ Unconditional
○ Settled
○ Under Contract
```

**Section 3: Project Classification**
- **Project Stage** - Already exists (dropdown)
- **Project Status** (required) - Already exists (dropdown)

**Section 4: Summary Card**
- Already exists, update to include new fields

**Design Notes:**
- Group checkboxes in a clean grid (2 columns on desktop, 1 on mobile)
- Use Headless UI RadioGroup for land status
- Add section headers for visual organization
- Keep the gradient summary card

## API Integration

### Contacts Endpoint
- **Endpoint:** `GET /api/v1/contacts?search={query}`
- **Response:**
  ```json
  {
    "success": true,
    "contacts": [
      {
        "id": 123,
        "full_name": "John Smith",
        "first_name": "John",
        "last_name": "Smith",
        "email": "john@example.com",
        "mobile_phone": "0412345678",
        "office_phone": "0298765432"
      }
    ]
  }
  ```

### Form Data Structure
```javascript
const [formData, setFormData] = useState({
  // Existing
  title: '',
  location: '',
  contract_value: '',
  start_date: '',
  end_date: '',
  site_supervisor_name: 'Andrew Clement',
  stage: 'Planning',
  status: 'Active',

  // New fields
  client_id: null,           // Store contact ID
  client_name: '',
  client_email: '',
  client_phone: '',
  lead_source: '',

  // Documents (store as JSON or separate fields)
  has_plans: false,
  has_engineering: false,
  has_soil_report: false,
  has_energy_report: false,

  // Land status (single value)
  land_status: '',
})
```

## Backend Note
**IMPORTANT:** Some fields don't exist in the `constructions` table yet:
- `client_id` (should be INTEGER foreign key to contacts)
- `client_name` (STRING)
- `client_email` (STRING)
- `client_phone` (STRING)
- `lead_source` (STRING)
- `has_plans`, `has_engineering`, `has_soil_report`, `has_energy_report` (BOOLEAN or JSONB)
- `land_status` (STRING)

**Options:**
1. Add migration to add these columns to `constructions`
2. Use existing `constructions` columns if they map to these fields
3. Store as JSON in a metadata column (if one exists)

For now, the frontend will collect this data. Backend developer should create migration to add missing columns.

## Validation Rules

### Step 1 (canProceed):
```javascript
formData.title.trim() !== '' &&
formData.location.trim() !== '' &&
formData.client_id !== null
```

### Step 2 (canProceed):
```javascript
true // All optional
```

### Step 3 (canSubmit):
```javascript
formData.title.trim() !== '' &&
formData.location.trim() !== '' &&
formData.client_id !== null &&
formData.site_supervisor_name.trim() !== '' &&
formData.status.trim() !== ''
```

## Component Dependencies to Add

### New imports needed:
```javascript
import { Combobox, RadioGroup } from '@headlessui/react'
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  MapIcon,
  UserGroupIcon,
  CheckIcon,
  ChevronUpDownIcon
} from '@heroicons/react/24/outline'
```

## Client Lookup Component Example

```jsx
const [clients, setClients] = useState([])
const [clientQuery, setClientQuery] = useState('')
const [loadingClients, setLoadingClients] = useState(false)

// Debounced search
useEffect(() => {
  if (clientQuery.length < 2) return

  const timer = setTimeout(async () => {
    setLoadingClients(true)
    try {
      const response = await api.get(`/api/v1/contacts?search=${clientQuery}`)
      setClients(response.data.contacts || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoadingClients(false)
    }
  }, 300)

  return () => clearTimeout(timer)
}, [clientQuery])

<Combobox value={selectedClient} onChange={handleClientSelect}>
  <Combobox.Input
    onChange={(e) => setClientQuery(e.target.value)}
    displayValue={(client) => client?.full_name || ''}
    placeholder="Search for a client..."
  />
  <Combobox.Options>
    {clients.map((client) => (
      <Combobox.Option key={client.id} value={client}>
        {client.full_name}
        {client.email && <span className="text-sm text-gray-500">{client.email}</span>}
      </Combobox.Option>
    ))}
  </Combobox.Options>
</Combobox>
```

## Design Consistency Requirements
- Maintain gradient header (indigo-500 to purple-600)
- Keep swipe animations between steps
- Use icon-badge pattern for field labels
- Support dark mode on all new components
- Mobile-responsive (checkboxes stack on mobile)
- Smooth transitions (400ms cubic-bezier)
- Keep the progress bar at top
- Summary card gradient (indigo-50 to purple-50)

## Testing Checklist
- [ ] Client search works with debouncing
- [ ] Selected client prepopulates name, email, phone
- [ ] Address is required and blocks Step 1 → Step 2
- [ ] Checkboxes toggle correctly
- [ ] Radio buttons are mutually exclusive
- [ ] Summary card shows all new fields
- [ ] Form submits with all new data
- [ ] Dark mode works on all new components
- [ ] Mobile responsive (320px - 1440px)
- [ ] Validation prevents submission with missing required fields
