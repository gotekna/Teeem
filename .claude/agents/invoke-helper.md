---
name: Agent Invocation Helper
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Pattern Recognition:     User input mapped         [PASS]║
  ║  Agent Routing:           Correct agent selected    [PASS]║
  ║  Task Invocation:         Proper subagent launch    [PASS]║
  ║  All Agents Command:      Parallel execution        [PASS]║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: Agent invocation routing based on user input     ║
  ║  Usage: Maps natural language to agent definitions       ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~2,000                           ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: gray
type: development
author: Jake
---

# Agent Invocation Helper

This document guides Claude Code on how to invoke agents based on user input.

## Recognition Table

| User Input Pattern | Agent to Invoke | Agent File |
|-------------------|-----------------|------------|
| `deploy`, `run deploy-manager`, `run deploy` | deploy-manager | `.claude/agents/deploy-manager.md` |
| `backend dev`, `run backend-developer`, `backend` | backend-developer | `.claude/agents/backend-developer.md` |
| `frontend dev`, `run frontend-developer`, `frontend` | frontend-developer | `.claude/agents/frontend-developer.md` |
| `production bug hunter`, `run production-bug-hunter`, `bug hunter` | production-bug-hunter | `.claude/agents/production-bug-hunter.md` |
| `plan`, `run planning-collaborator`, `planning` | planning-collaborator | `.claude/agents/planning-collaborator.md` |
| `gantt`, `run gantt-bug-hunter`, `gantt bug hunter` | gantt-bug-hunter | `.claude/agents/gantt-bug-hunter.md` |
| `trinity`, `run trinity-sync-validator`, `trinity sync` | trinity-sync-validator | `.claude/agents/trinity-sync-validator.md` |
| `ui audit`, `run ui-compliance-auditor`, `ui compliance` | ui-compliance-auditor | `.claude/agents/ui-compliance-auditor.md` |
| `run all agents`, `/ag`, `allagent`, `all agents` | ALL | Run all 8 agents in parallel |

## How to Invoke an Agent

When a user request matches one of the patterns above:

1. **Read the agent's markdown file** from `.claude/agents/[agent-name].md`
2. **Parse the agent's instructions** including:
   - Purpose and capabilities
   - When to use
   - Tools available
   - Success criteria
3. **Launch the agent** using the Task tool with `subagent_type: "general-purpose"`
4. **Pass clear instructions** including:
   - What the user wants
   - The agent's specialized role
   - Expected deliverables
5. **Update run history** in database using `AgentDefinition` model:
   - Call `agent.record_success(message, details)` for successful runs
   - Call `agent.record_failure(message, details)` for failed runs
   - Run history is automatically tracked and visible in UI

## Example Invocation

```javascript
// User says: "deploy"
// 1. Read .claude/agents/deploy-manager.md
// 2. Extract instructions and capabilities
// 3. Launch Task with:
{
  subagent_type: "general-purpose",
  description: "Deploy to staging",
  prompt: `You are the Deploy Manager agent. Your role is to handle git operations and staging deployments.

CAPABILITIES:
- Git add, commit, push operations
- Deploy backend to Heroku staging (rob branch)
- Verify deployment success
- Check for migration errors

AUTHORITY:
✅ STAGING: HAS authority to deploy from rob branch to Heroku staging
❌ PRODUCTION: Does NOT have authority to deploy to production from main branch

USER REQUEST: ${user_request}

TASKS:
1. Commit and push changes to rob branch
2. Deploy backend using git subtree to Heroku staging
3. Verify deployment and check for errors
4. Report status to user

Follow the deployment protocol in your agent definition exactly.`
}
// 4. After agent completes, record run in database
```

## Run History Update

After each agent run, record it in the database:

```ruby
# In Rails backend
agent = AgentDefinition.find_by(agent_id: 'deploy-manager')

# For successful run
agent.record_success(
  'Successfully deployed to staging',
  {
    branch: 'rob',
    commit: 'abc123',
    heroku_release: 'v392'
  }
)

# For failed run
agent.record_failure(
  'Deployment failed: migration error',
  {
    error: 'PG::Error',
    details: 'Column does not exist'
  }
)
```

This automatically updates all tracking fields in the `agent_definitions` table and is visible in the UI at: **http://localhost:5173/admin/system?tab=developer-tools**

## Run All Agents

When user requests "run all agents", "/ag", "allagent", or "all agents":

1. Launch all 13 agents **in parallel** using a single message with multiple Task tool calls
2. Give each agent a health check task appropriate to their specialty
3. Wait for all agents to complete
4. Record run results in database for each agent (success/failure)
5. Report aggregated results
