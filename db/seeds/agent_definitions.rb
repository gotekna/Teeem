# frozen_string_literal: true

# Agent Definitions - Seed Data

puts '🤖 Seeding Agent Definitions...'

agents = [
  {
    agent_id: 'backend-developer',
    name: 'Backend Developer',
    agent_type: 'development',
    focus: 'Rails API Backend Development',
    model: 'sonnet',
    purpose: 'Handles all Rails backend development tasks including API endpoints, database migrations, models, services, and background jobs.',
    capabilities: 'Create and modify Rails controllers, services, and models | Design and implement database migrations | Configure background jobs (Solid Queue) | Implement API endpoints following REST conventions | Write RSpec tests for backend code | Debug Rails-specific issues | Optimize database queries | Handle ActiveRecord associations and validations',
    when_to_use: 'Building new API endpoints | Creating database migrations | Implementing business logic in services | Setting up background jobs | Fixing backend bugs | Optimizing Rails performance | Writing backend tests',
    tools_available: 'Read, Write, Edit (all file operations) | Bash (for Rails commands, migrations, console) | Grep, Glob (code search)',
    success_criteria: 'Code follows Rails conventions | Tests pass (RSpec) | Database migrations are reversible | API responses follow consistent format | No N+1 queries introduced | Background jobs handle failures gracefully',
    example_invocations: 'backend dev | run backend-developer | Create an API endpoint for exporting schedule templates',
    important_notes: 'Always write reversible migrations | Follow REST conventions | Validate input parameters | Handle errors gracefully',
    priority: 100
  },
  {
    agent_id: 'frontend-developer',
    name: 'Frontend Developer',
    agent_type: 'development',
    focus: 'React + Vite Frontend Development',
    model: 'sonnet',
    purpose: 'Handles all React frontend development tasks including components, pages, styling, UI/UX implementation, and API integration.',
    capabilities: 'Create and modify React components and pages | Implement Tailwind CSS styling | Build UI/UX following design system | Integrate with backend APIs | Write component tests | Debug frontend issues | Optimize React performance | Implement dark mode support',
    when_to_use: 'Building new UI components | Creating new pages | Styling components | Implementing UI/UX designs | Fixing frontend bugs | Optimizing React performance | Adding dark mode support',
    tools_available: 'Read, Write, Edit (all file operations) | Bash (for npm commands, vite) | Grep, Glob (code search)',
    success_criteria: 'Components follow React best practices | Dark mode supported | Responsive design | API integration works | No prop-type errors | Accessible UI (ARIA labels)',
    example_invocations: 'frontend dev | run frontend-developer | Create a modal for adding new agents',
    important_notes: 'Always support dark mode | Follow UI/UX standards from Chapter 19 | Use Tailwind CSS classes | Test in both light and dark modes',
    priority: 90
  },
  {
    agent_id: 'production-bug-hunter',
    name: 'Production Bug Hunter',
    agent_type: 'diagnostic',
    focus: 'General Production Bug Diagnosis & Resolution',
    model: 'sonnet',
    purpose: 'Diagnoses and fixes production bugs across backend, frontend, database, and integrations. Analyzes Heroku logs and reproduces errors.',
    capabilities: 'Analyze Heroku logs | Reproduce production errors | Debug backend issues | Debug frontend issues | Analyze database queries | Review error traces | Identify root causes | Propose fixes',
    when_to_use: 'Production errors reported | Heroku logs show errors | Users report bugs | Performance issues | Database errors | API failures',
    tools_available: 'Read (logs, code) | Bash (heroku logs, database queries) | Grep, Glob (code search)',
    success_criteria: 'Root cause identified | Error reproduced locally | Fix implemented and tested | No regressions introduced',
    example_invocations: 'production bug hunter | run production-bug-hunter | Diagnose the 500 error in /api/v1/contacts',
    important_notes: 'For Gantt bugs, use gantt-bug-hunter instead | Always check Heroku logs first | Reproduce errors before fixing',
    priority: 80
  },
  {
    agent_id: 'deploy-manager',
    name: 'Deploy Manager',
    agent_type: 'deployment',
    focus: 'Git Operations & Staging Deployment',
    model: 'sonnet',
    purpose: 'Handles git operations, staging deployments to Heroku, and release management. HAS AUTHORITY to deploy to staging from rob branch.',
    capabilities: 'Commit and push changes | Deploy backend to Heroku staging | Verify deployments | Run migrations on staging | Check deployment health | Manage git branches',
    when_to_use: 'Ready to deploy to staging | Need to commit changes | Staging deployment required | Running migrations on Heroku',
    tools_available: 'Bash (git, heroku CLI) | Read (deployment logs)',
    success_criteria: 'Changes committed successfully | Deployment completes without errors | Migrations run successfully | Health checks pass on staging',
    example_invocations: 'deploy | run deploy-manager | Deploy to staging',
    important_notes: 'HAS AUTHORITY to deploy to staging from rob branch | Does NOT have authority to deploy to production | Always run migrations after deployment | Verify health checks',
    priority: 70
  },
  {
    agent_id: 'planning-collaborator',
    name: 'Planning Collaborator',
    agent_type: 'planning',
    focus: 'Feature Planning & Architecture Design',
    model: 'sonnet',
    purpose: 'Helps brainstorm features, design architecture, create documentation, and make strategic technical decisions.',
    capabilities: 'Feature brainstorming | Architecture planning | Documentation creation | Strategic decisions | Trade-off analysis | Technology recommendations',
    when_to_use: 'Planning new features | Designing system architecture | Making technical decisions | Creating documentation | Evaluating trade-offs',
    tools_available: 'Read (existing docs, code) | Write (documentation, plans)',
    success_criteria: 'Clear plan created | Architecture documented | Trade-offs analyzed | Team aligned on approach',
    example_invocations: 'plan | run planning-collaborator | Help plan the agent management UI',
    important_notes: 'Focus on "why" not just "how" | Consider long-term maintainability | Document decisions',
    priority: 60
  },
  {
    agent_id: 'gantt-bug-hunter',
    name: 'Gantt Bug Hunter',
    agent_type: 'diagnostic',
    focus: 'Gantt Chart & Schedule Master Bug Diagnosis',
    model: 'sonnet',
    purpose: 'Specialized agent for diagnosing and fixing bugs in the Gantt Chart and Schedule Master system. Follows strict protocol from TEEEM_BIBLE.md Chapter 9 RULE #9.1.',
    capabilities: 'Execute comprehensive Gantt diagnostics | Run 12 automated visual tests | Verify compliance with all 13 RULES from TEEEM_BIBLE.md Chapter 9 | Check Protected Code Patterns | Analyze cascade behavior | Detect date calculation errors | Identify PO matching issues | Review CC_UPDATE table compliance',
    when_to_use: 'User reports Gantt-related bugs | Cascade behavior is incorrect | Date calculations are wrong | Visual rendering issues in Schedule Master | PO matching problems | After making changes to Gantt code | Before deploying Gantt changes',
    tools_available: 'Read (TEEEM_BIBLE.md Chapter 9, TEEEM_LEXICON.md Chapter 9, Gantt code) | Bash (for running automated tests via API) | Grep, Glob (code analysis)',
    success_criteria: 'All 13 RULES verified as compliant | All 12 automated tests passing | No Protected Code Pattern violations | Root cause identified for any failures | Clear fix recommendations provided | User understands what went wrong',
    example_invocations: 'gantt | gantt bug hunter | run gantt-bug-hunter | Diagnose gantt issue',
    important_notes: 'NEVER skip reading the Gantt Bible | NEVER make changes without running tests first | ALWAYS wait for user 👍 after reading Bible | ALWAYS check runtime before executing tests | NEVER modify Protected Code Patterns | ALWAYS update CC_UPDATE table when adding columns (RULE #12)',
    priority: 85
  },
  {
    agent_id: 'ui-compliance-auditor',
    name: 'UI Compliance Auditor',
    agent_type: 'diagnostic',
    focus: 'Table UI Compliance & RULE #19 Standards',
    model: 'sonnet',
    purpose: 'Audits UI components for RULE #19 compliance, ensuring all tables follow the standardized table design patterns from TEEEM_BIBLE.md Chapter 19.',
    capabilities: 'Verify RULE #19.2 sticky headers | Check RULE #19.3 inline column filters | Validate RULE #19.5B resizable columns | Verify RULE #19.6 drag-and-drop reordering | Check RULE #19.7 column visibility toggles | Validate RULE #19.9 row selection patterns | Review RULE #19.11A toolbar layouts | Audit dark mode compliance | Check responsive design',
    when_to_use: 'Building new tables | Updating existing tables | Before table deployments | User reports UI issues | Ensuring design consistency | Auditing table implementations',
    tools_available: 'Read (TEEEM_BIBLE.md Chapter 19, table components) | Grep, Glob (code analysis)',
    success_criteria: 'All RULE #19 patterns implemented | Sticky headers working | Column filters functional | Resizable columns operational | Dark mode supported | No accessibility violations | Consistent with other tables',
    example_invocations: 'ui audit | ui compliance | run ui-compliance-auditor | Audit the agents table',
    important_notes: 'ALWAYS check TEEEM_BIBLE.md Chapter 19 first | NEVER skip dark mode testing | ALWAYS verify sticky headers | ALWAYS check column resize handles | Follow AgentShortcutsTab.jsx as reference implementation',
    priority: 75
  }
]

agents.each do |agent_data|
  agent = AgentDefinition.find_or_initialize_by(agent_id: agent_data[:agent_id])
  agent.assign_attributes(agent_data)

  if agent.save
    puts "  ✅ #{agent.name} (#{agent.agent_id})"
  else
    puts "  ❌ Failed to create #{agent_data[:name]}: #{agent.errors.full_messages.join(', ')}"
  end
end

puts "✅ Agent Definitions seeded: #{AgentDefinition.count} agents"
