# Claude Code Agents

This directory contains specialized agent definitions for the Trapid project.

## Agent Attribution

Agent definitions support an `author` field in YAML frontmatter to track who created each agent:

```yaml
---
name: My Agent
description: What it does
model: sonnet
author: Jake  # Matches user by name or email
---
```

The sync task uses this priority for attribution:
1. Explicit `author:` field in frontmatter (recommended)
2. Git history (first commit author)
3. Fallback to current user

## Available Agents

### 1. backend-developer
**Focus:** Rails API Backend Development | **Created by:** Robert
- API endpoints, controllers, services
- Database migrations and models
- Background jobs (Solid Queue)
- Rails-specific features

### 2. frontend-developer
**Focus:** React + Vite Frontend Development | **Created by:** Robert
- React components and pages
- Tailwind CSS styling
- UI/UX implementation
- API integration on frontend

### 3. production-bug-hunter
**Focus:** General Production Bug Diagnosis & Resolution | **Created by:** Robert
- Production bug diagnosis (backend, frontend, database, etc.)
- Heroku log analysis
- Error reproduction and fixing
- Works with other agents for fixes
- **Note:** For Gantt bugs, use **"Gantt Bug Hunter"** workflow (separate from this agent)

### 4. deploy-manager
**Focus:** Git Operations & Staging Deployment | **Created by:** Robert
- Commit and push changes to appropriate branch
- **HAS AUTHORITY** to deploy to staging from `rob` branch
- Does NOT have authority to deploy to production from `main` branch
- Deploys backend to Heroku staging using git subtree
- Frontend deploys automatically via Vercel

### 5. planning-collaborator
**Focus:** Feature Planning & Architecture Design | **Created by:** Robert
- Feature brainstorming
- Architecture planning
- Documentation creation
- Strategic decisions

### 6. gantt-bug-hunter
**Focus:** Gantt Chart & Schedule Master Bug Diagnosis | **Created by:** Robert
- Gantt/Schedule Master bug diagnosis
- Run 12 automated visual tests
- Verify all 13 RULES from Trinity Chapter 9
- Check Protected Code Patterns
- Analyze cascade behavior

### 7. trinity-sync-validator
**Focus:** Trinity Database & Markdown Sync Validation | **Created by:** Robert
- Validates Trinity database integrity
- Ensures markdown exports are up-to-date backups
- Prevents stale markdown files
- Ensures documentation integrity
- Trinity database is source of truth

### 8. ui-compliance-auditor
**Focus:** UI/UX Standards Compliance (Chapter 19 & 20) | **Created by:** Jake
- Audits all frontend code against Chapter 19 UI/UX standards
- Focuses on forms, modals, navigation, buttons, layouts
- Checks for incorrect icon usage
- Verifies dark mode support across all components
- Generates detailed compliance reports
- **Note:** For table-specific audits, use ui-table-auditor

### 9. ui-table-auditor
**Focus:** Table Component Compliance (Chapter 19 - Tables) | **Created by:** Jake
- Specialized audits for ALL table components
- Trinity tables, DataTable, custom table implementations
- Validates table structure, inline editing, column formatting
- Checks sorting, filtering, row actions
- Verifies empty/loading states, mobile responsiveness
- Dark mode compliance for tables

### 10. trapid-table-architect
**Focus:** TrapidTableView Component Specialist | **Created by:** Jake
- Creates new table implementations using TrapidTableView
- Reviews existing tables for standards compliance
- Migrates legacy tables to TrapidTableView
- Optimizes table performance (N+1 queries, pagination)
- Ensures accessibility and mobile responsiveness
- Enforces the "One Table Standard"

### 11. architecture-guardian
**Focus:** Clean Architecture & Code Quality | **Created by:** Jake
- Reviews code for architectural consistency
- Ensures SOLID principles and clean architecture
- Validates component reusability
- Checks backward compatibility
- Identifies unnecessary fallbacks
- Maintains codebase scalability

### 12. code-guardian
**Focus:** Automated Pattern Violation Detection | **Created by:** Jake
- Scans code for known bug patterns
- Prevents repeat bugs before they reach production
- Posts PR review comments with fixes
- References Pattern Library and Detection Rules
- Tracks violation metrics
- Consolidates backend + frontend code review

### 13. invoke-helper
**Focus:** Agent Invocation Guide | **Created by:** Jake
- Helper agent for invoking other agents
- Provides agent shortcuts and invocation patterns
- Manages run history tracking

### 14. ssot-agent
**Focus:** Single Source of Truth Validation | **Created by:** Jake
- Validates Dense Index ↔ CLAUDE.md consistency
- Scans all .md files for conflicts with Trinity
- Suggests archivable documentation (superseded by Trinity)
- Audits backend code for SSoT compliance
- Audits frontend code for SSoT compliance
- Stops on conflicts and asks user to resolve
- Updates Trinity with archive records

### 15. gold-standard-sst
**Focus:** Column Types SSoT Validation | **Created by:** Robert
- Validates Trinity T19.xxx entries match Gold Standard columns
- Checks SQL type sync across all sources
- Audits for hardcoded column type duplicates
- Verifies validation rules are defined
- Enforces Bible Rule #19.37

### 16. product-owner-analyst
**Focus:** Product Decisions & Feature Planning | **Created by:** Jake
- Classifies features as PUBLIC-READY, INTERNAL-ONLY, or TECHNICAL-DEBT
- Reviews code for public product readiness
- Identifies Tekna-specific logic that needs isolation
- Provides product strategy guidance
- Guards against internal tools shipping to external users

### 17. agent-creator
**Focus:** Automated Agent Creation Workflow | **Created by:** Robert
- Guides through 7 multiple-choice questions
- Generates box-format output mockup
- Creates agent file with proper YAML frontmatter
- Syncs to database automatically
- Updates README with new agent listing

### 18. gold-std-table-integration
**Focus:** Sync Table Settings to Gold Standard | **Created by:** Robert
- Detects current table from UI context
- Fetches Gold Standard template configuration
- Compares column types, validation rules, display settings
- Compares filter screen, button layout, color scheme
- Compares edit functions (inline/bulk edit modes)
- Shows preview of all changes before applying
- Applies updates only after user confirmation

## How to Use

### Quick Commands

```bash
# Run single agent
"run backend-developer"
"run frontend-developer"
"run production-bug-hunter"
"run deploy-manager"
"run planning-collaborator"
"run gantt-bug-hunter"
"run trinity-sync-validator"
"run ui-compliance-auditor"
"run ui-table-auditor"

# Shorter versions
"backend dev"
"frontend dev"
"production bug hunter"
"deploy"
"plan"
"gantt"
"trinity"
"ui audit"
"audit tables"
```

### Run All Agents

```bash
"run all agents"
"/ag"
"allagent"
```

This will run all 13 agents in parallel with health check tasks.

## Database Integration

All agent definitions are automatically synced to the `agent_definitions` database table.

### Viewing Agents in UI

Navigate to: **http://localhost:5173/admin/system?tab=developer-tools** → "Agent Status" sub-tab

The UI displays:
- Agent name and icon
- Description and focus area
- Last run timestamp
- Total runs and success rate
- Current status (success/failure)
- Run button to execute agent

### Auto-Sync Mechanisms

Agents are automatically synced to the database in two ways:

**1. Git Post-Commit Hook (Automatic)**
- Whenever you commit changes to `.claude/agents/*.md` files
- The hook detects changed agent files
- Automatically runs `bin/rails trapid:agents:sync`
- Agents appear in UI immediately after commit

**2. Manual Sync Command**
```bash
# From project root
npm run sync-agents

# Or directly
cd backend && bin/rails trapid:agents:sync
```

## Run History

Agent run history is tracked in the **database** (`agent_definitions` table):

- `total_runs` - Total number of times agent was executed
- `successful_runs` - Number of successful executions
- `failed_runs` - Number of failed executions
- `last_run_at` - Timestamp of last execution
- `last_status` - Last run status (success/failure)
- `last_message` - Last run message/summary
- `last_run_details` - JSON details of last run

View run history in the UI at: **http://localhost:5173/admin/system?tab=developer-tools** → "Agent Status"

## Agent Definitions

Each agent has a Markdown file defining:
- Purpose and capabilities
- When to use
- Tools available
- Success criteria
- Example invocations

## Updating Agents

To modify an agent:
1. Edit the corresponding `.md` file
2. Agent changes take effect immediately
3. No restart required

## Adding New Agents

### Step 1: Define the Deliverable FIRST (Before Writing Any Code)

**Critical:** Agree on what the agent will OUTPUT before creating the file. This prevents scope creep and ensures clear success criteria.

Answer these questions:

| Question | Your Answer |
|----------|-------------|
| **What is the agent's job?** | One sentence description |
| **What does it check/do?** | List of specific checks or actions |
| **What does it output?** | Exact format (see example below) |
| **What triggers it?** | Manual, proactive, on PR, scheduled? |
| **What tools does it need?** | Read, Grep, Glob, API calls, Edit, Write? |
| **What's the token budget?** | Estimated tokens per run |
| **Pass/Fail criteria?** | What makes each check pass or fail? |

### Step 2: Design the Output Format

Create a mockup of EXACTLY what the agent should produce. This becomes the contract.

**Example: Gold STD Table - SSoT Agent Output**

```
╔═══════════════════════════════════════════════════════════╗
║  Trinity Entries:       21 types documented       [PASS]  ║
║  Gold Standard Cols:    21 column types           [PASS]  ║
║  Type Comparison:       21/21 matched             [PASS]  ║
║  SQL Type Sync:         22/22 defined             [PASS]  ║
║    (+1 action_buttons system-only)                        ║
║  Column Validation:     21/21 have rules          [PASS]  ║
║  Code Audit:            No unauthorized dupes     [PASS]  ║
╠═══════════════════════════════════════════════════════════╣
║  System Columns:        id, created_at, updated_at        ║
║  Single Source of Truth: Trinity T19.xxx                  ║
║  Bible Rule: #19.37                                       ║
╠═══════════════════════════════════════════════════════════╣
║  Est. Tokens:           ~5,600                            ║
╚═══════════════════════════════════════════════════════════╝
```

**Why this matters:**
- Clear visual confirmation of pass/fail status
- User knows exactly what to expect
- Agent has clear success criteria to implement
- Token budget is transparent

### Step 3: Create the Agent File

Create `.claude/agents/your-agent-name.md` with this structure:

**IMPORTANT:** The description MUST use the standard box format shown below. This displays in the Agent Status UI popup.

```markdown
---
name: Your Agent Name
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Check 1:               Expected result            [PASS] ║
  ║  Check 2:               Expected result            [PASS] ║
  ║  Check 3:               Expected result            [PASS] ║
  ║  Check 4:               Expected result            [PASS] ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: One line description of agent purpose            ║
  ║  Bible Rule: #X.XX (if applicable)                       ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~X,XXX                           ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet  # or opus, haiku
color: blue    # optional: blue, green, red, yellow, orange, cyan, gray
type: diagnostic  # or development, deployment, planning
author: Jake  # Your name - matches database user by name or email
---

Brief one-line mission statement.

## The Problem This Agent Solves

Explain why this agent exists and what pain point it addresses.

## Your Diagnostic Protocol (or Workflow)

### Step 1: First Check
- What to fetch/read
- What to look for
- Pass/fail criteria

### Step 2: Second Check
...

## What to Report

### Green (All Good)
- List conditions for all-pass status

### Yellow (Warning)
- List conditions for warning status

### Red (Critical)
- List conditions for failure status

## Fix Guidance

### If [problem 1]:
1. Step to fix
2. Step to fix

## Final Summary Output (REQUIRED)

You MUST output a summary box at the end (see gold-standard-sst.md for full example)
```

### Step 4: Sync to Database

```bash
npm run sync-agents
```

### Step 5: Verify in UI

- Navigate to http://localhost:5173/admin/system?tab=developer-tools
- Check "Agent Status" tab
- Your new agent should appear in the list

### Step 6: Update this README

Add the agent to the "Available Agents" list above.

### Agent Creation Checklist

- [ ] Defined deliverable/output format FIRST
- [ ] Created mockup of expected output
- [ ] Answered all planning questions
- [ ] Created `.claude/agents/your-agent-name.md`
- [ ] **Used standard box format in description** (see Step 3 template)
- [ ] Included YAML frontmatter (name, description, model, type, author)
- [ ] Added `author: YourName` field for attribution
- [ ] Listed all checks with `[PASS]` placeholder in description box
- [ ] Included Focus line and Bible Rule reference (if applicable)
- [ ] Added Est. Tokens estimate in description box
- [ ] Wrote clear diagnostic protocol/workflow
- [ ] Defined pass/fail/warning criteria
- [ ] Included fix guidance section
- [ ] Specified required final summary output format
- [ ] Ran `npm run sync-agents`
- [ ] Verified agent appears in UI with box format displaying correctly
- [ ] Updated this README with agent listing and "Created by" info

**Important:**
- The description box format is REQUIRED - it displays in the Agent Status UI popup
- Keep the box width consistent (59 characters inside the border)
- Use Unicode box-drawing characters: ╔ ╗ ╚ ╝ ║ ═ ╠ ╣

## Notes

- Agents are stateless (each run is independent)
- Run history is stored in the database and persists across sessions
- Agent definitions (markdown files) are version-controlled
- Agent run statistics are tracked automatically in the database
- Agents should fetch from Trinity API (`/api/v1/trinity`), never read markdown files
- Trinity database is the source of truth for all documentation

## Recording Agent Runs

When an agent completes, record the run via API. Pass your git user name to track who ran it:

**Via curl (from CLI/hooks):**
```bash
# Get git user name
GIT_NAME=$(git config user.name)

# Record success
curl -X POST http://localhost:3000/api/v1/agent_definitions/your-agent-name/record_run \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"success\", \"message\": \"Task completed\", \"user_name\": \"$GIT_NAME\"}"

# Record failure
curl -X POST http://localhost:3000/api/v1/agent_definitions/your-agent-name/record_run \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"failure\", \"message\": \"Error occurred\", \"user_name\": \"$GIT_NAME\"}"
```

**Via Rails console:**
```ruby
# Success with user name
agent = AgentDefinition.find_by(agent_id: 'your-agent-name')
agent.record_success('Task completed', { details: 'metadata' }, user_name: 'RobertJHarder')

# Failure
agent.record_failure('Error message', { error: 'details' }, user_name: 'RobertJHarder')
```

This updates:
- `total_runs` (incremented)
- `successful_runs` or `failed_runs` (incremented)
- `last_run_at` (current timestamp)
- `last_status` ('success' or 'failure')
- `last_message` (your message)
- `last_run_details` (optional metadata)
- `last_run_by_name` (git user name)
