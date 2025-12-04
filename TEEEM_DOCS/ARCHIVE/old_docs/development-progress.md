# TEEEM Development Progress

## Session Date: October 29, 2025

---

## What We Built Today

### 1. Context-Aware Navigation System

**Feature**: Dynamic top navigation menu that changes based on the current section (Explorer, Workflow, or Designer)

**Files Modified**:
- [frontend/src/components/layout/AppLayout.jsx](frontend/src/components/layout/AppLayout.jsx)

**Implementation**:
- Created three separate navigation arrays for different sections
- Added URL-based section detection logic
- Menu automatically switches when navigating between sections

**Designer Navigation Menu Items**:
- Tables - Manage table schemas and structure
- Features - (Placeholder for future functionality)
- Menus - Control which tables are visible to users
- Pages - (Placeholder for future functionality)
- Experiences - (Placeholder for future functionality)
- Maintenance - (Placeholder for future functionality)

### 2. Menus Management Page

**Feature**: Control which tables appear as live menus in the Explorer view

**Files Created**:
- [frontend/src/pages/designer/Menus.jsx](frontend/src/pages/designer/Menus.jsx)

**Files Modified**:
- [backend/db/migrate/20251029035059_add_is_live_to_tables.rb](backend/db/migrate/20251029035059_add_is_live_to_tables.rb) - Added `is_live` boolean field
- [backend/app/controllers/api/v1/tables_controller.rb](backend/app/controllers/api/v1/tables_controller.rb) - Added `is_live` to permitted params
- [frontend/src/api.js](frontend/src/api.js) - Added PATCH method support

**Functionality**:
- Lists all tables with toggle switches
- Live/Hidden status persists to database
- Optimistic UI updates for instant feedback
- Only "live" tables appear in Explorer Dashboard

### 3. Delete Table Modal

**Feature**: Proper confirmation dialog for table deletion with improved error handling

**Files Created**:
- [frontend/src/components/designer/DeleteTableModal.jsx](frontend/src/components/designer/DeleteTableModal.jsx)

**Files Modified**:
- [backend/app/services/table_builder.rb](backend/app/services/table_builder.rb) - Added `if_exists: true` and better error handling

**Functionality**:
- Uses Headless UI Dialog component
- Shows warning icon and confirmation message
- Gracefully handles missing tables
- Provides loading state during deletion

### 4. Live Tables Filter

**Feature**: Dashboard only displays tables marked as "live"

**Files Modified**:
- [frontend/src/pages/Dashboard.jsx](frontend/src/pages/Dashboard.jsx)

**Functionality**:
- Filters tables where `is_live === true`
- Hides administrative/draft tables from end users

### 5. Authentication Removal (Temporary)

**Feature**: Simplified authentication for faster development iteration

**Files Modified**:
- [frontend/src/App.jsx](frontend/src/App.jsx) - Removed AuthProvider and guards
- [backend/app/controllers/application_controller.rb](backend/app/controllers/application_controller.rb) - Auto-creates default user

**Note**: This is temporary and will be re-implemented later with proper user management

### 6. Production Deployment Configuration

**Issues Resolved**:
- **Vercel 404 Error**: Disabled Deployment Protection
- **CORS Blocking**: Updated [backend/config/initializers/cors.rb](backend/config/initializers/cors.rb) to allow Vercel domains
- **Environment Variable**: Added `VITE_API_URL` to Vercel pointing to Heroku backend
- **Column Type Validation**: Added `phone` and `url` to [backend/app/models/column.rb](backend/app/models/column.rb)

### 7. Dynamic Model Reloading Fix

**Problem**: Add record button failed with "unknown attribute" errors after adding new columns

**Root Cause**: ActiveRecord was caching old table schemas

**Files Modified**:
- [backend/app/controllers/api/v1/columns_controller.rb](backend/app/controllers/api/v1/columns_controller.rb)

**Solution**:
- Call `reload_dynamic_model` after column creation/update
- Clear ActiveRecord schema cache with `clear_data_source_cache!`
- Required Heroku dyno restart to clear existing cached models

### 8. CSV Import Production Fix (Major)

**Problem**: CSV import failing on Heroku with "Failed to import data" error

**Root Cause**: Heroku's ephemeral filesystem doesn't persist temp files between HTTP requests

**Files Modified**:
- [backend/app/controllers/api/v1/imports_controller.rb](backend/app/controllers/api/v1/imports_controller.rb)
- [frontend/src/components/imports/ImportPreview.jsx](frontend/src/components/imports/ImportPreview.jsx)

**Solution Implemented**:
- Upload endpoint now encodes file content as base64 and returns it to frontend
- Execute endpoint accepts `file_content` instead of `temp_file_path`
- Uses Ruby `Tempfile` for processing within single request lifecycle
- File content stays in memory, no persistent storage required
- Automatically cleans up temp files with `ensure` block

**How It Works Now**:
1. User uploads CSV → Backend reads file, parses for preview, returns base64-encoded content
2. Frontend stores file content in state
3. User configures import → Frontend sends file content back with execute request
4. Backend decodes content, creates temp file, imports data, deletes temp file
5. All processing happens within a single request - no cross-request file persistence needed

---

## Current Architecture

### Backend (Rails 8.0.4 + PostgreSQL)
- **Hosting**: Heroku
- **URL**: https://teeem-backend-447058022b51.herokuapp.com
- **Key Features**:
  - Dynamic table/column generation
  - CSV/Excel import with type detection
  - RESTful API endpoints
  - CORS configured for Vercel domains

### Frontend (React + Vite + Tailwind CSS)
- **Hosting**: Vercel
- **URL**: https://frontend-k99yijvug-jakes-projects-b6cf0fcb.vercel.app
- **Key Libraries**:
  - React Router for navigation
  - Headless UI for accessible components
  - Heroicons for icons
  - Tailwind CSS for styling

### Database Schema
- **Tables** - User-defined table metadata
  - Fields: name, singular_name, plural_name, icon, title_column, description, `is_live`
- **Columns** - Column definitions for tables
  - Supports 15+ column types (text, email, phone, url, number, date, boolean, etc.)
- **Dynamic Tables** - Created at runtime based on user schema definitions
- **Users** - Basic user authentication (currently simplified)

---

## Product Vision & Roadmap

### Core Concept
TEEEM is a no-code/low-code platform that allows users to:
1. Define custom data tables with flexible schemas
2. Import data from spreadsheets (CSV/Excel)
3. Create custom interfaces to interact with their data
4. Build workflows and automation
5. Design user experiences without writing code

### Development Phases

#### Phase 1: Foundation (Current - Mostly Complete)
- ✅ Backend API with dynamic table generation
- ✅ Frontend with basic table management
- ✅ CSV/Excel import functionality
- ✅ Column type detection and validation
- ✅ Production deployment (Heroku + Vercel)
- ✅ Context-aware navigation system
- ✅ Live/hidden table management
- ⏳ Authentication system (temporarily disabled)

#### Phase 2: Explorer Enhancement (In Progress)
- ✅ Dashboard with live tables only
- ✅ Table view with record display
- 🔲 Advanced filtering and search
- 🔲 Sorting capabilities
- 🔲 Pagination for large datasets
- 🔲 Bulk operations (delete, edit multiple records)
- 🔲 Export data (CSV, Excel, JSON)

#### Phase 3: Designer Tools (Partially Complete)
**Tables** (Current):
- ✅ Create/edit/delete tables
- ✅ Add/modify columns
- ✅ Set title columns and searchable fields
- 🔲 Relationships between tables (foreign keys)
- 🔲 Computed columns with formulas
- 🔲 Validation rules

**Features** (Planned):
- 🔲 Custom actions on records
- 🔲 Triggers and webhooks
- 🔲 Email notifications
- 🔲 API integrations

**Menus** (Current):
- ✅ Toggle table visibility
- 🔲 Custom menu ordering
- 🔲 Menu grouping/categories
- 🔲 Icons and descriptions

**Pages** (Planned):
- 🔲 Custom page builder
- 🔲 Drag-and-drop interface
- 🔲 Widgets and components
- 🔲 Embedded tables and charts

**Experiences** (Planned):
- 🔲 Multi-step forms
- 🔲 User onboarding flows
- 🔲 Custom dashboards
- 🔲 Mobile-responsive layouts

**Maintenance** (Planned):
- 🔲 Database backup/restore
- 🔲 Schema migrations
- 🔲 Data cleanup tools
- 🔲 Performance monitoring

#### Phase 4: Workflow Builder (Not Started)
- 🔲 Visual workflow designer
- 🔲 Trigger definitions (on create, update, delete, schedule)
- 🔲 Action steps (send email, update record, call API)
- 🔲 Conditional logic and branching
- 🔲 Workflow templates

#### Phase 5: User Management & Permissions (Not Started)
- 🔲 Re-implement authentication system
- 🔲 User roles and permissions
- 🔲 Row-level security
- 🔲 Audit logs
- 🔲 Team collaboration features

#### Phase 6: AI Automation & Integrations (Future)

**AI Quote Collection Agent** (Planned with Lindy.ai):
- 🔲 Automatic supplier outreach when new jobs start
- 🔲 Connect Pricebook, Contacts, and Estimating tables
- 🔲 Email integration for supplier communication
- 🔲 Parse supplier responses and update pricebook automatically
- 🔲 Track quote status and follow-up reminders
- 🔲 Multi-supplier comparison and selection

**Workflow**:
1. New job created → Trigger AI agent
2. Agent analyzes job requirements and cross-references pricebook
3. Identifies required purchases and relevant suppliers from contacts
4. Drafts and sends personalized quote requests via email
5. Monitors inbox for supplier responses
6. Parses email responses (pricing, lead times, availability)
7. Updates pricebook with current quotes
8. Notifies team when quotes are complete
9. Optional: Suggest best suppliers based on pricing/history

**Technical Approach**:
- Integration with Lindy.ai for AI orchestration
- Email API integration (SendGrid, Mailgun, or Gmail API)
- Webhook endpoints in TEEEM to receive updates
- Natural language processing for email parsing
- Automated data entry into pricebook table

**Benefits**:
- Saves hours of manual quote collection
- Ensures pricebook stays current
- Reduces human error in data entry
- Faster turnaround on estimates
- Better supplier relationship management

#### Phase 7: Advanced Features (Future)
- 🔲 Real-time collaboration
- 🔲 Version history and rollback
- 🔲 API key management for external access
- 🔲 Custom domain support
- 🔲 White-label options
- 🔲 Mobile apps (iOS/Android)

---

## Technical Debt & Known Issues

### High Priority
1. **Authentication**: Currently disabled - needs proper implementation with JWT tokens, secure sessions, and password management
2. **Error Handling**: Need consistent error messages across frontend and backend
3. **Loading States**: Some components lack proper loading indicators
4. **Input Validation**: Need more comprehensive validation on forms

### Medium Priority
1. **Ruby Version**: Heroku warns about unspecified Ruby version in Gemfile
2. **Schema Cache**: May need periodic cache clearing strategy for dynamic models
3. **File Size Limits**: No size validation on CSV uploads
4. **Rate Limiting**: No API rate limiting implemented

### Low Priority
1. **Code Comments**: Could use more documentation in complex areas
2. **Test Coverage**: No automated tests yet
3. **Performance**: No query optimization or caching strategy
4. **Accessibility**: Could improve keyboard navigation and screen reader support

---

## Key Design Decisions

### 1. Dynamic Model Generation
**Decision**: Generate ActiveRecord models at runtime based on user-defined schemas

**Rationale**:
- Allows unlimited flexibility for user-defined tables
- No migrations needed for user data structures
- Leverages Rails' ActiveRecord for all CRUD operations

**Trade-offs**:
- Schema cache management complexity
- Potential performance implications
- Requires careful memory management

### 2. Separate Backend/Frontend
**Decision**: Rails API backend + React SPA frontend

**Rationale**:
- Clear separation of concerns
- Allows independent scaling
- Modern development workflow
- Can add mobile apps later without rewriting business logic

**Trade-offs**:
- CORS configuration required
- More complex deployment
- Need to manage two codebases

### 3. Heroku + Vercel Hosting
**Decision**: Split hosting between Heroku (backend) and Vercel (frontend)

**Rationale**:
- Heroku excellent for Rails + PostgreSQL
- Vercel optimized for React deployments
- Both have good free/hobby tiers
- Easy deployment pipelines

**Trade-offs**:
- Ephemeral filesystem on Heroku (solved with in-memory file processing)
- Need to coordinate deployments
- Two separate billing systems

### 4. Optimistic UI Updates
**Decision**: Update UI immediately, then sync with backend

**Rationale**:
- Feels faster to users
- Better perceived performance
- Reduces waiting time

**Trade-offs**:
- Need rollback logic on errors
- Complexity in state management

---

## Getting Started for New Developers

### Prerequisites
- Ruby 3.2+
- Node.js 18+
- PostgreSQL 14+
- Heroku CLI (for deployment)
- Vercel CLI (for deployment)

### Local Development Setup

**Backend**:
```bash
cd backend
bundle install
rails db:create db:migrate
rails server -p 3000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

**Access**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Deployment

**Backend to Heroku**:
```bash
git subtree push --prefix backend heroku main
```

**Frontend to Vercel**:
```bash
cd frontend
vercel --prod
```

### Environment Variables

**Frontend (.env)**:
```
VITE_API_URL=http://localhost:3000  # Local
VITE_API_URL=https://teeem-backend-447058022b51.herokuapp.com  # Production
```

**Backend (.env)**:
```
DATABASE_URL=postgresql://...
RAILS_MASTER_KEY=...
```

---

## Next Immediate Steps

### Short Term (Next Session)
1. **Re-enable Authentication**: Implement proper login/signup with secure sessions
2. **Table Relationships**: Add support for foreign keys and lookup columns
3. **Advanced Filtering**: Build filtering UI for table views
4. **Error Messages**: Standardize error handling and user feedback

### Medium Term (Next Week)
1. **Workflow Builder**: Start basic workflow functionality
2. **Custom Pages**: Begin page builder with drag-and-drop
3. **User Permissions**: Implement role-based access control
4. **Performance**: Add caching and query optimization

### Long Term (Next Month)
1. **Mobile Responsive**: Ensure all views work on mobile
2. **API Documentation**: Generate API docs for external integrations
3. **Testing**: Add automated test suite
4. **Analytics**: Track usage patterns and performance metrics

---

## Resources & Documentation

### External Documentation
- [Rails 8 Guides](https://guides.rubyonrails.org/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Headless UI](https://headlessui.dev/)
- [Heroku Rails Guide](https://devcenter.heroku.com/articles/getting-started-with-rails8)
- [Vercel Deployment](https://vercel.com/docs)

### Internal Documentation
- [Rapid Rebuild Plan](rapid-rebuild-plan.md) - Original project planning document
- API endpoints documented in respective controllers
- Component documentation in JSDoc comments (to be added)

---

## Contributing Guidelines (Future)

When this project opens to contributors:

1. **Code Style**: Follow existing patterns
2. **Commits**: Use descriptive commit messages
3. **Pull Requests**: Include description of changes and why
4. **Testing**: Add tests for new features
5. **Documentation**: Update relevant docs

---

## Contact & Support

**Project Owner**: Jake Baird
**Current Status**: Active Development
**Last Updated**: October 29, 2025

---

## Changelog

### October 29, 2025
- Added context-aware navigation system
- Implemented menus management page with live/hidden toggle
- Created delete table modal with confirmation
- Fixed CSV import for production (base64 encoding solution)
- Fixed dynamic model reloading issues
- Deployed backend to Heroku (v20)
- Deployed frontend to Vercel
- Resolved CORS and environment variable issues
- Added phone and url column types
- Temporarily disabled authentication for faster development

### Earlier Commits
- Initial Rails + React setup
- Database schema design
- CSV/Excel import functionality
- Dynamic table generation
- Basic CRUD operations
- Tailwind CSS integration
- Heroku + Vercel deployment setup

---

*This document will be updated regularly as development progresses.*
