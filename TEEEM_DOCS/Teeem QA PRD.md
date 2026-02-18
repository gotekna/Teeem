# PRD: TEEEM QA Automation Agent (Ralph Loop)

## Introduction

TEEEM (the Tekna construction management app) requires significant manual QA effort before each release. Every fix or feature triggers a full regression check that frequently times out at Claude's 20-minute limit, leaving testing incomplete and bugs reaching end users. This PRD defines a five-agent QA system orchestrated by the Ralph Wiggum Loop that comprehensively validates TEEEM is ship-ready — eliminating manual QA entirely.

## Goals

- Eliminate 100% of manual QA time before shipping
- Build a complete inventory of every UI element in TEEEM before testing begins
- Deploy five specialist agents that each deeply examine their domain
- Ensure thoroughness over speed — hours of testing is acceptable, shallow coverage is not
- Persist state across Ralph loop iterations so timeouts never lose progress
- Produce a clear pass/fail ship-ready verdict with a detailed report of all findings

## User Stories

### US-001: Element Inventory Build

**Description:** As Jake, I want the system to catalogue every UI element in TEEEM so that no element gets skipped during testing.

**Acceptance Criteria:**

- [ ] Every page, tab, and sub-tab is discovered and logged
- [ ] Every button, modal, dropdown, tooltip, badge, form, table, toggle, date picker, link, toast, and alert is catalogued
- [ ] Elements behind modals, inside nested tabs, and within dynamically loaded content are included
- [ ] Each element records: type, page location, parent container, access path (e.g. "click Projects -> click row -> Edit button -> modal"), and unique ID
- [ ] Inventory stored in Supabase as the master checklist for all agents
- [ ] Inventory count matches a manual spot-check of at least 3 pages

### US-002: QA Agent — Functional Testing

**Description:** As Jake, I want every interactive element verified as functional so that end users never encounter broken features.

**Acceptance Criteria:**

- [ ] Every page loads to the correct destination
- [ ] Every button responds to click
- [ ] Every modal opens and closes correctly
- [ ] Every dropdown populates and selects correctly
- [ ] Every form submits with valid data and shows correct success state
- [ ] Every form triggers correct validation errors for invalid input
- [ ] Every table supports create, edit, and delete of a test record (prefixed qa-test-)
- [ ] No orphaned data remains after test record deletion
- [ ] Every navigation path works with no dead links
- [ ] Elements behind modals and nested tabs are tested, not just top-level elements

### US-003: UX Agent — User Experience Validation

**Description:** As Jake, I want the user experience reviewed so that technically functional but confusing or awkward UI is caught before shipping.

**Acceptance Criteria:**

- [ ] Layout hierarchy is logical on every page — related elements grouped, clear information flow
- [ ] Spacing and alignment is consistent — no awkward whitespace or cramped sections
- [ ] Multi-step workflows flow naturally with clear next-step indicators
- [ ] Error states are helpful and descriptive, not generic
- [ ] Labels and placeholder text are descriptive enough for a first-time user
- [ ] Truncated values have tooltips or expansion
- [ ] Modals are appropriately sized with scrollable content when needed
- [ ] Confirmation dialogs are appropriate and not excessive
- [ ] Each finding includes a specific description and the page/element it relates to

### US-004: Design System Agent — Brand Compliance

**Description:** As Jake, I want every component checked against the brand guidelines so that the app has complete visual uniformity.

**Acceptance Criteria:**

- [ ] Brand guidelines loaded from /settings/developer/brand-guidelines as single source of truth
- [ ] Every select/combobox uses the canonical component
- [ ] Every date picker uses the canonical component
- [ ] Every button follows the defined style variants
- [ ] Every modal uses the defined pattern
- [ ] Every table uses the defined structure
- [ ] Colours, typography, icons, and spacing match the brand guidelines
- [ ] Each inconsistency logged with: element, current component, expected component per guidelines
- [ ] If guidelines don't cover a specific case, flagged as "needs-guideline-decision" rather than guessed

### US-005: Performance Agent — Load Times & Responsiveness

**Description:** As Jake, I want actual performance benchmarks for every page and interaction so that slow areas are identified before users hit them.

**Acceptance Criteria:**

- [ ] Every page measured: time to first paint, time to interactive, total load time
- [ ] Any page exceeding 3 seconds flagged
- [ ] Every button click, form submission, modal open, and table load measured for response time
- [ ] Any interaction exceeding 1 second flagged
- [ ] Scroll performance measured on data-heavy pages — frame rate jank flagged
- [ ] Lazy-loaded content measured for load delay
- [ ] Measurements taken with realistic data, not empty states
- [ ] Results stored with page reference and actual timing values

### US-006: Data Integrity Agent — Records & Calculations

**Description:** As Jake, I want every calculated value and data relationship verified so that users never see incorrect numbers.

**Acceptance Criteria:**

- [ ] Every calculated field verified as dynamically computed, not hardcoded
- [ ] Input values altered and outputs confirmed to update accordingly
- [ ] All totals, subtotals, percentages, and derived values validated
- [ ] Related records reference each other correctly
- [ ] Deleting a parent record handles child records appropriately
- [ ] Filters produce correct results
- [ ] Sorting works correctly on all table columns
- [ ] Search returns accurate matches
- [ ] Empty states display correctly
- [ ] Zero values display correctly (not blank or null)
- [ ] Maximum length inputs handled without breaking display
- [ ] Special characters in data don't break display

### US-007: State Persistence & Resume

**Description:** As Jake, I want the Ralph loop to persist state so that timeouts never lose progress and the system picks up where it left off.

**Acceptance Criteria:**

- [ ] State stored in Supabase: run ID, timestamp, current agent, element inventory, per-agent progress, per-agent findings, ship-ready status
- [ ] Each iteration reads state on startup and writes updated state on completion
- [ ] After a timeout, the next invocation resumes from exactly where it stopped
- [ ] No duplicate testing of already-checked elements after resume
- [ ] Final state includes complete report of all findings across all agents

## Functional Requirements

- **FR-1:** The system must build a complete element inventory before any testing begins (Phase 0)
- **FR-2:** The system must run five specialist agents sequentially: QA, UX, Design System, Performance, Data Integrity
- **FR-3:** Each agent must work through its full checklist from the element inventory — no elements skipped
- **FR-4:** Each agent must log every finding to Supabase with: issue ID, severity, agent, page, element, description
- **FR-5:** The Ralph loop must persist state to Supabase after every iteration
- **FR-6:** The system must resume from the last checkpoint after any timeout
- **FR-7:** Each iteration must be scoped to complete within 15 minutes to stay under the 20-minute timeout
- **FR-8:** Thoroughness over speed — fewer elements checked properly is better than many checked superficially
- **FR-9:** All test records created during QA must be prefixed with qa-test- for safe cleanup
- **FR-10:** Every element must be accessed the way a real user would — clicking through navigation, opening modals, expanding tabs
- **FR-11:** The system must produce a ship-ready boolean verdict when all agents complete
- **FR-12:** The Design System Agent must reference /settings/developer/brand-guidelines as the single source of truth

## Non-Goals

- Performance load testing (concurrent users)
- Mobile/native app testing
- Third-party integrations beyond TEEEM's own UI
- Accessibility (WCAG) compliance — separate PRD
- Fixing any issues found — handled by the separate Auto-Fix Agent PRD
- Auto-deploying or pushing code

## Technical Considerations

- Ralph Wiggum Loop with 30 max iterations (https://awesomeclaude.ai/ralph-wiggum)
- Supabase for state persistence — use existing TEEEM project backend
- Claude computer use for UI interaction
- Brand guidelines at /settings/developer/brand-guidelines within TEEEM app
- TEEEM GitHub: https://github.com/goTekna/TEEEM

## Success Metrics

- 100% of UI elements in TEEEM catalogued in element inventory
- All 5 agents complete their full checklist with zero pending items
- Zero manual QA time required before shipping
- Ship-ready verdict produced automatically at end of run

## Open Questions

- Should the element inventory be rebuilt every run, or cached and only refreshed when pages change?
- What severity levels should findings use (e.g. critical/major/minor)?
- Should the system notify Jake (e.g. via Pepper/WhatsApp) when the run completes?

## Reference

- Auto-Fix Agent PRD: (see linked PRD)
- Ralph Wiggum Loop: https://awesomeclaude.ai/ralph-wiggum
- TEEEM GitHub: https://github.com/goTekna/TEEEM
- Brand Guidelines: /settings/developer/brand-guidelines (within TEEEM app)
