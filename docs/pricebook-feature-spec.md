# Feature Specification: Price Book Management System
## TEEEM - Tekna Homes Migration

**Feature Owner:** Jake Baird (Tekna Homes)  
**Dev Lead:** [TBD]  
**Priority:** P0 (Critical for migration)  
**Target Release:** Phase 2 Enhancement  
**Estimated Effort:** 3-5 dev days

---

## 🎯 Problem Statement

Tekna Homes needs to migrate their 5,000+ item price book from the deprecated Rapid Platform to TEEEM. The current data requires significant cleanup and the new system needs to support construction-specific workflows including supplier management, quote collection, and price tracking.

**Business Impact:**
- **Risk:** $500K+ project estimates depend on accurate pricing data
- **Urgency:** Rapid Platform shutting down - no access to source code
- **Opportunity:** Foundation for automated quote collection system (Phase 6)

---

## 📋 User Stories

### Epic: Price Book Migration
**As a** construction estimator  
**I want to** access our complete price book in TEEEM  
**So that** I can continue creating accurate project estimates without disruption

#### Story 1: Bulk Price Book Import
**As an** admin  
**I want to** import our entire price book from CSV  
**So that** all historical pricing data is preserved

**Acceptance Criteria:**
- ✅ Can upload CSV files up to 50MB
- ✅ System detects and validates column types automatically  
- ✅ Imports 5,000+ items in under 5 minutes
- ✅ Shows preview before final import
- ✅ Handles missing prices gracefully (flags for review)
- ✅ Creates categories and suppliers automatically
- ✅ Provides detailed import summary with stats

#### Story 2: Price Book Search & Filter
**As an** estimator  
**I want to** quickly find specific items in the price book  
**So that** I can add them to project estimates efficiently

**Acceptance Criteria:**
- 🔲 Can search by item code, name, or description
- 🔲 Can filter by category, supplier, or price range
- 🔲 Search results appear in under 200ms
- 🔲 Highlights search terms in results
- 🔲 Shows item details including price, supplier, last updated
- 🔲 Can sort by price, name, category, or last updated

#### Story 3: Price History Tracking
**As a** project manager  
**I want to** see price changes over time  
**So that** I can understand cost trends and validate estimates

**Acceptance Criteria:**
- 🔲 Records price change history with dates
- 🔲 Shows percentage change from previous price
- 🔲 Flags significant price increases (>20%)
- 🔲 Links price changes to supplier quotes
- 🔲 Displays price trends in simple chart

#### Story 4: Supplier Management Integration
**As an** admin  
**I want to** manage supplier information linked to price book items  
**So that** I can track supplier performance and contact details

**Acceptance Criteria:**
- 🔲 Creates supplier records from price book import
- 🔲 Links items to supplier contacts
- 🔲 Shows supplier performance metrics (response time, accuracy)
- 🔲 Allows bulk supplier updates
- 🔲 Manages supplier contact information

---

## 🎨 User Experience Design

### Price Book Dashboard
```
┌─────────────────────────────────────────────────┐
│ 📚 Price Book (5,287 items)          [+ Import] │
├─────────────────────────────────────────────────┤
│ 🔍 [Search items...]     [Category ▼] [Sort ▼] │
├─────────────────────────────────────────────────┤
│ CODE    │ ITEM NAME               │ PRICE │ SUPP │
├─────────────────────────────────────────────────┤
│ DPP     │ Wiring Double Power Pt  │ $51   │ TL   │
│ SPP     │ Wiring Single Power Pt  │ $50   │ TL   │  
│ ODPP    │ Waterproof Double PP    │ $69   │ TL   │
│ ⚠️ WEF   │ Wiring Exhaust Fan     │ -     │ -    │
│ ⚠️ WLP   │ Wiring Light Point     │ -     │ -    │
└─────────────────────────────────────────────────┘
```

### Import Flow
```
Step 1: Upload File
┌─────────────────────────────────────┐
│ 📁 Drop CSV file here or click      │
│                                     │
│ ✅ tekna_pricebook_cleaned.csv      │
│    5,287 rows • 830KB • Valid      │
└─────────────────────────────────────┘

Step 2: Preview & Configure  
┌─────────────────────────────────────┐
│ 📊 Import Preview                   │
│ • 5,287 items to import             │
│ • 227 items missing prices          │
│ • 121 suppliers identified          │
│ • 216 categories created            │
│                                     │
│ [Import All] [Review Missing Prices]│
└─────────────────────────────────────┘

Step 3: Import Progress
┌─────────────────────────────────────┐
│ ⏳ Importing... 3,421 / 5,287      │
│ ████████████░░░░  65%               │
│                                     │
│ Creating suppliers... ✅            │
│ Creating categories... ✅           │  
│ Importing items... ⏳              │
└─────────────────────────────────────┘
```

---

## 🔧 Technical Specifications

### Database Schema

#### Enhanced `pricebook` Table
```sql
CREATE TABLE pricebook (
  id BIGSERIAL PRIMARY KEY,
  item_code VARCHAR(50) UNIQUE NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit_of_measure VARCHAR(50) DEFAULT 'Each',
  current_price DECIMAL(10,2),
  supplier_id BIGINT REFERENCES suppliers(id),
  brand VARCHAR(100),
  notes TEXT,
  searchable_text TSVECTOR, -- PostgreSQL full-text search
  is_active BOOLEAN DEFAULT true,
  needs_pricing_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pricebook_code ON pricebook(item_code);
CREATE INDEX idx_pricebook_search ON pricebook USING GIN(searchable_text);
CREATE INDEX idx_pricebook_category ON pricebook(category);
CREATE INDEX idx_pricebook_supplier ON pricebook(supplier_id);
```

#### `suppliers` Table Enhancement
```sql
CREATE TABLE suppliers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  rating INTEGER DEFAULT 0, -- 1-5 star rating
  response_rate DECIMAL(3,2) DEFAULT 0, -- Quote response rate %
  avg_response_time INTEGER, -- Hours
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `price_history` Table  
```sql
CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  pricebook_item_id BIGINT REFERENCES pricebook(id),
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  change_reason VARCHAR(100), -- 'quote_update', 'manual_edit', 'import'
  changed_by_user_id BIGINT REFERENCES users(id),
  supplier_id BIGINT REFERENCES suppliers(id),
  quote_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

#### Core Price Book API
```typescript
// Get price book with filtering/search
GET /api/v1/pricebook
  ?search=string
  &category=string
  &supplier_id=number
  &min_price=number
  &max_price=number
  &needs_pricing=boolean
  &page=number
  &limit=number

// Bulk import from CSV
POST /api/v1/pricebook/import
  Content-Type: multipart/form-data
  Body: { file: CSV, options: ImportOptions }

// Update single item
PATCH /api/v1/pricebook/:id
  Body: { current_price, supplier_id, notes }

// Get price history
GET /api/v1/pricebook/:id/history

// Bulk price updates
PATCH /api/v1/pricebook/bulk
  Body: { updates: Array<{id, current_price, supplier_id}> }
```

#### Import Processing
```typescript
interface ImportOptions {
  skip_missing_prices: boolean;
  create_suppliers: boolean;
  create_categories: boolean;
  update_existing: boolean;
}

interface ImportResult {
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  suppliers_created: number;
  categories_created: number;
  errors: Array<ImportError>;
  warnings: Array<string>;
}
```

### Performance Requirements

**Search Performance:**
- Full-text search results in <200ms for 10K+ items
- Filter operations in <100ms
- Pagination support for large result sets

**Import Performance:**  
- 5,000 items imported in <5 minutes
- Real-time progress updates during import
- Memory-efficient processing for large files

**Scalability:**
- Support up to 50,000 price book items
- Handle 100 concurrent users searching
- Database query optimization with proper indexing

---

## 🧪 Testing Strategy

### Unit Tests
- CSV parsing and validation logic
- Price calculation and formatting
- Search query building
- Data transformation functions

### Integration Tests  
- End-to-end import flow
- API endpoint functionality
- Database operations and constraints
- File upload handling

### Performance Tests
- Large file import (50MB CSV)
- Concurrent search operations
- Database query performance
- Memory usage during import

### User Acceptance Tests
```gherkin
Feature: Price Book Import
  Scenario: Successfully import cleaned price book
    Given I have a cleaned CSV file with 5,000+ items
    When I upload the file through the import wizard
    Then all items are imported successfully
    And suppliers are created automatically
    And categories are assigned correctly
    And missing prices are flagged for review

  Scenario: Search for specific items
    Given the price book contains imported items
    When I search for "wiring double power"
    Then I see relevant electrical items
    And the search is highlighted in results
    And I can filter by Electrical category
```

---

## 🚦 Risk Assessment

### High Priority Risks

**Data Quality Issues**
- **Risk:** Imported data contains errors or inconsistencies
- **Impact:** Incorrect estimates, supplier confusion
- **Mitigation:** Comprehensive validation, manual review queue, rollback capability

**Performance Issues**
- **Risk:** Search/import too slow for large datasets
- **Impact:** Poor user experience, system timeouts  
- **Mitigation:** Database optimization, indexing strategy, progress indicators

**Import Failures**
- **Risk:** Large import operations fail midway
- **Impact:** Partial data, system inconsistency
- **Mitigation:** Transaction handling, batch processing, error recovery

### Medium Priority Risks

**Supplier Duplication**
- **Risk:** Multiple supplier records for same company
- **Impact:** Data fragmentation, reporting issues
- **Mitigation:** Supplier matching algorithm, merge functionality

**Category Inconsistency**  
- **Risk:** Items miscategorized during import
- **Impact:** Poor findability, incorrect grouping
- **Mitigation:** Category validation rules, post-import review

---

## 📦 Deliverables

### Phase 1: Core Import (Dev Days 1-2)
- ✅ CSV cleanup script (completed)
- 🔲 Enhanced database schema
- 🔲 Basic import API endpoint
- 🔲 Import progress tracking
- 🔲 Supplier auto-creation

### Phase 2: Search & Management (Dev Days 3-4)
- 🔲 Full-text search implementation
- 🔲 Filtering and sorting
- 🔲 Price book dashboard UI
- 🔲 Item detail views
- 🔲 Basic edit functionality

### Phase 3: Advanced Features (Dev Day 5)
- 🔲 Price history tracking
- 🔲 Bulk operations
- 🔲 Export functionality
- 🔲 Performance optimization
- 🔲 Error handling improvements

---

## 🎯 Success Metrics

### Functional Metrics
- **Import Success Rate:** 99%+ of items imported correctly
- **Search Speed:** <200ms average response time
- **Data Completeness:** 95%+ items have all required fields
- **User Adoption:** 100% estimators using new system within 1 week

### Business Metrics  
- **Estimate Speed:** 25% faster estimate creation
- **Data Accuracy:** 90% reduction in pricing errors
- **Supplier Efficiency:** Foundation for quote automation
- **System Reliability:** 99.5% uptime during business hours

---

## 📞 Stakeholder Sign-off

**Business Requirements Approved By:**
- [ ] Jake Baird (Tekna Homes) - Business Owner
- [ ] [Estimators Team] - End Users  
- [ ] [Finance Team] - Price Accuracy

**Technical Requirements Approved By:**  
- [ ] [Dev Lead] - Technical Implementation
- [ ] [DevOps] - Infrastructure & Performance
- [ ] [QA Lead] - Testing Strategy

---

## 📚 Appendix

### A. Sample Data Files
- [View Strategy Document](computer:///mnt/user-data/outputs/pricebook-cleanup-strategy.md)
- [View Cleaned Sample Data](computer:///mnt/user-data/outputs/pricebook-sample-cleaned.csv)
- [View Cleanup Script](computer:///mnt/user-data/outputs/cleanup_pricebook.py)
- [View Full Cleaned Dataset](computer:///mnt/user-data/outputs/tekna_pricebook_cleaned.csv)

### B. Integration Points
- **Quote Collection System:** Price updates from supplier responses
- **Project Estimation:** Item selection and pricing for estimates  
- **Supplier Management:** Contact details and performance tracking
- **Reporting:** Cost analysis and price trend reporting

### C. Future Enhancements (Phase 6+)
- **AI Quote Collection:** Automated supplier quote requests
- **Price Monitoring:** Market price comparison and alerts
- **Predictive Pricing:** ML-based price forecasting
- **Mobile Access:** Field access for on-site estimates

---

*This feature specification provides the complete technical and business requirements for implementing the Price Book Management System in TEEEM, supporting Tekna Homes' critical migration from Rapid Platform.*
