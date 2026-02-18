## Introduction
TEEEM (the Tekna construction management app) currently requires significant manual QA effort before each release. Every fix or feature addition requires a full regression check — checking every page, tab, sub-tab, form, button, and table — which frequently times out at the 20-minute Claude limit, leaving testing incomplete and bugs slipping through to end users.
This PRD defines an automated QA agent system powered by the Ralph loop that comprehensively validates TEEEM is ship-ready before it goes live with end users.
## Goals
Eliminate manual QA time by automating full regression testing across every part of TEEEM. Ensure every page loads correctly and within acceptable time. Validate all interactive elements (buttons, forms, dropdowns, selects) work as expected. Confirm data integrity by creating and deleting test records in every table. Enforce design system consistency so the same component types are used uniformly across the entire app. Handle long-running test sessions gracefully via the Ralph loop so timeouts never kill a full test run.
## Problem Statement
The core pain points are: manual QA is time-consuming and error-prone; Claude's 20-minute context window kills long test runs mid-way; memory fills up and the agent powers through pages without actually validating them; scrolling and rendering bugs cause buttons and elements to be partially hidden or obscured; and inconsistent component usage (e.g. different select/combobox components on different pages) creates a poor end-user experience.
## Solution Overview
A multi-agent QA system orchestrated by the Ralph loop. The loop breaks the full test suite into discrete, memory-efficient chunks — each chunk covering a specific domain of the app. State is persisted between runs so if a session times out, the next run picks up exactly where it left off. The loop continues cycling until all chunks have passed, at which point TEEEM is declared ship-ready.
## Ralph Loop Architecture
The Ralph loop runs with a maximum of 30 iterations. Each iteration executes one focused test domain, logs results, updates state, and passes control back to the loop. The loop tracks which domains have passed and which have failed or are pending, and continues until all domains return a passing status.
State is stored externally (Supabase) so it persists across context windows and timeouts. Each run reads current state on startup and writes updated state on completion.
## Test Domains
Domain 1 — Structural Navigation. Crawl every page, tab, and sub-tab in the app. Verify each one opens to the correct destination. Record load time for every page. Flag any pages that exceed acceptable load thresholds or fail to open.
Domain 2 — Interactive Elements. For every button, link, and actionable element on every page: verify it is fully visible and not obscured by overlapping elements or hidden below the fold. Verify it responds to click/tap. Verify scroll position does not cause elements to become inaccessible or partially hidden. Flag any elements with z-index, overflow, or positioning issues.
Domain 3 — Form & Data Entry. For every form in the app: complete all required fields with valid test data. Submit the form. Verify submission succeeds and the correct success state is shown. Verify validation errors are triggered correctly for invalid inputs.
Domain 4 — CRUD Operations. For every table in the app: create a new test record. Verify the record saves correctly and appears in the table. Edit the record and verify changes persist. Delete the record and verify it is removed. Confirm no orphaned data remains after deletion.
Domain 5 — Calculation Validation. For every field or display that shows a calculated value: verify the value is computed dynamically from underlying data, not hardcoded. Alter input values and confirm outputs update accordingly. Flag any static values that should be dynamic.
Domain 6 — Design System Consistency. Audit every page for component uniformity. Identify the canonical component for each UI pattern (e.g. select/combobox, date picker, modal, button style). Flag any page using a non-standard component variant. Generate a report of all inconsistencies for remediation.
Domain 7 — Scroll & Viewport Stability. On every scrollable page or panel: scroll to the bottom and back to the top. Verify no layout jitter, element jumping, or position shifts occur during scroll. Verify sticky elements (headers, footers, toolbars) remain correctly positioned throughout.
## State Management
Test state is stored in Supabase with the following structure: run ID, timestamp, current domain, list of completed domains with pass/fail status, list of failed items with page reference and description, and overall ship-ready status (boolean).
On each Ralph loop iteration: read current state → execute the next pending domain → write results back to Supabase → return to loop. If the session times out, the next invocation reads state and continues from the next pending domain.
## Success Criteria
All 7 domains return a passing status. Every page loads within 3 seconds. Zero buttons or interactive elements are obscured or non-functional. All CRUD operations succeed without errors. All calculations are confirmed as dynamic. Zero design system inconsistencies remain. Zero manual QA time required before shipping.
## Out of Scope
Performance load testing (concurrent users). Mobile/native app testing. Third-party integrations beyond TEEM's own UI. Accessibility (WCAG) compliance — to be addressed in a separate PRD.
## Implementation Notes
Use the Ralph loop skill from awesomeclaude.ai with 30 max iterations. Each domain should be scoped to complete within 15 minutes to stay safely under the 20-minute timeout. Use Claude's computer use capability for UI interaction. Supabase is the state store — use the existing project backend. All test records created during QA must be clearly tagged (e.g. qa-test- prefix) for safe cleanup.
## Reference
Ralph Wiggum Loop documentation: https://awesomeclaude.ai/ralph-wiggum
TEEM GitHub: https://github.com/goTekna/TEEEM
