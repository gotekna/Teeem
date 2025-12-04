# Plan: Company Groups & Corporate Structure

## Overview
Build a comprehensive corporate structure system to track ownership hierarchies, shareholdings, and entity relationships within company groups (e.g., Tekna Group, Team Harder Group).

## Current State
- `CompanyGroup` model exists (Tekna, Team Harder, Promise, etc.)
- `CompanyShareholding` model exists with polymorphic shareholders (Company or Contact)
- `Company` model has `company_group_id` but NO parent/child relationship
- Only 3 shareholdings currently in database
- `entity_type` column exists on Company but not fully utilized

## Requirements
1. **Entity Types**: Companies, Trusts, Individuals, SMSFs
2. **Ownership**: Track 100% ownership of subsidiaries with full shareholding details
3. **Relationships**: Trustees of trusts, Directors of companies
4. **UI**: Multiple views (tree, org chart, list)

---

## Phase 1: Database Schema Updates

### 1.1 Add Parent Company Relationship
```ruby
# Migration: add_parent_company_to_companies
add_reference :companies, :parent_company, foreign_key: { to_table: :companies }, null: true
add_column :companies, :ownership_percentage, :decimal, precision: 5, scale: 2, default: 100.0
add_column :companies, :hierarchy_level, :integer, default: 0
```

### 1.2 Enhance Entity Types
Update `entity_type` enum values:
- `company` - Pty Ltd company
- `trust` - Family/Unit/Discretionary Trust
- `individual` - Person (for director/shareholder tracking)
- `smsf` - Self-Managed Super Fund
- `partnership` - Partnership entity

### 1.3 Add Trustee Relationship
```ruby
# Migration: create_trustee_relationships
create_table :trustee_relationships do |t|
  t.references :trust, foreign_key: { to_table: :companies }
  t.references :trustee, polymorphic: true  # Can be Company or Contact
  t.date :appointed_date
  t.date :ceased_date
  t.boolean :active, default: true
  t.timestamps
end
```

### 1.4 Enhance Company Shareholdings
Already has:
- `shareholder_type` (polymorphic - Company/Contact)
- `shareholder_id`
- `share_class`
- `number_of_shares`
- `beneficially_held`

Add:
- `acquisition_date`
- `disposal_date`
- `certificate_number`
- `consideration_paid`

---

## Phase 2: Model Updates

### 2.1 Company Model
```ruby
class Company < ApplicationRecord
  # Hierarchy
  belongs_to :parent_company, class_name: 'Company', optional: true
  has_many :subsidiaries, class_name: 'Company', foreign_key: 'parent_company_id'

  # Shareholdings (as the company being owned)
  has_many :shareholdings, class_name: 'CompanyShareholding', dependent: :destroy

  # Shareholdings (as the shareholder/owner)
  has_many :investments, class_name: 'CompanyShareholding',
           as: :shareholder, dependent: :destroy

  # Trust relationships
  has_many :trustee_relationships, foreign_key: :trust_id
  has_many :trustees_of, class_name: 'TrusteeRelationship', as: :trustee

  # Scopes
  scope :top_level, -> { where(parent_company_id: nil) }
  scope :subsidiaries_of, ->(parent_id) { where(parent_company_id: parent_id) }

  # Entity type enum
  enum :entity_type, {
    company: 'company',
    trust: 'trust',
    individual: 'individual',
    smsf: 'smsf',
    partnership: 'partnership'
  }

  def ancestors
    result = []
    current = parent_company
    while current
      result << current
      current = current.parent_company
    end
    result
  end

  def descendants
    subsidiaries.flat_map { |s| [s] + s.descendants }
  end

  def full_hierarchy
    {
      company: self,
      children: subsidiaries.map(&:full_hierarchy)
    }
  end
end
```

### 2.2 TrusteeRelationship Model (New)
```ruby
class TrusteeRelationship < ApplicationRecord
  belongs_to :trust, class_name: 'Company'
  belongs_to :trustee, polymorphic: true

  validates :trust, presence: true
  validates :trustee, presence: true
  validates :trust_id, uniqueness: { scope: [:trustee_type, :trustee_id] }

  scope :active, -> { where(active: true) }
end
```

---

## Phase 3: API Endpoints

### 3.1 Company Group Structure
```
GET /api/v1/company_groups/:id/structure
```
Returns full hierarchy tree for a group.

### 3.2 Company Hierarchy
```
GET /api/v1/companies/:id/hierarchy
GET /api/v1/companies/:id/subsidiaries
GET /api/v1/companies/:id/parent_chain
```

### 3.3 Shareholdings
```
GET /api/v1/companies/:id/shareholdings
POST /api/v1/companies/:id/shareholdings
PUT /api/v1/company_shareholdings/:id
DELETE /api/v1/company_shareholdings/:id
```

### 3.4 Trustee Relationships
```
GET /api/v1/companies/:id/trustees  (for trusts)
POST /api/v1/trustee_relationships
DELETE /api/v1/trustee_relationships/:id
```

---

## Phase 4: Frontend UI

### 4.1 Company Group Page (New)
- Show all groups with company counts
- Click to expand and see hierarchy

### 4.2 Structure Views
1. **Tree View**: Expandable tree with +/- toggles
2. **Org Chart**: Visual boxes with connecting lines
3. **Table View**: Flat list with parent column and indentation

### 4.3 Company Detail - Structure Tab
- Show parent company
- List subsidiaries
- Show shareholdings (who owns this company)
- Show investments (what this company owns)
- Show trustee relationships (if trust)

---

## Phase 5: Data Migration

### 5.1 Set Up Tekna Group Hierarchy
```ruby
# Example structure:
# Tekna Pty Ltd (parent)
#   ├── Tekna Drafting Pty Ltd (100%)
#   ├── Tekna Admin Pty Ltd (100%)
#   ├── Tekna Homes Pty Ltd (100%)
#   ├── Co Invest Capital Pty Ltd (100%)
#   └── Co Invest Homes Pty Ltd (100%)
```

### 5.2 Set Up Team Harder Group
```ruby
# Team Harder Pty Ltd (parent)
#   ├── Gen2612 Pty Ltd
#   ├── Prov1322 Global Pty Ltd
#   ├── W2G Assets Pty Ltd
#   └── Team Harder Super Investments Pty Ltd (trustee of SMSF)
#       └── Team Harder Super Fund (SMSF)
```

---

## Phase 6: SharePoint Integration

Once groups are set up:
1. Map SharePoint "Corporate File" folders to Company Groups
2. Auto-detect company folders within group folders
3. Sync documents to correct companies with proper naming

---

## Implementation Order

1. **Database migrations** (parent_company, entity_type enum, trustee_relationships)
2. **Model updates** (Company, TrusteeRelationship, CompanyShareholding)
3. **API endpoints** (structure, hierarchy, shareholdings)
4. **Seed data** (set up Tekna & Team Harder hierarchies)
5. **Frontend - Structure views** (tree, org chart, table)
6. **SharePoint sync** (map folders to groups)

---

## Estimated Scope
- Backend: 4-6 migrations, 2 new models, 4 controller updates
- Frontend: 1 new page, 3 view components, company detail tab
- Data: Seed scripts for group hierarchies
