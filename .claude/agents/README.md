# Claude Code Agents

This directory contains 18 specialized agent definitions for the TEEEM project.

**Last Updated:** 2025-12-31

## Quick Reference

| Agent | Focus | Command |
|-------|-------|---------|
| backend-developer | Rails API development | `/backend` |
| frontend-developer | React/Next.js development | `/frontend` |
| planning-collaborator | Feature planning | `/plan` |
| deploy-manager | Git & deployment | `/deploy` |
| production-bug-hunter | Production debugging | `/bug-hunter` |
| gantt-bug-hunter | Gantt/Schedule Master bugs | `/gantt` |
| code-guardian | Code quality (SSoT, components) | - |
| frontend-auditor | UI/UX compliance | - |
| table-guardian | TeeemTableView compliance | - |
| column-type-validator | Column type SSoT validation | - |
| table-settings-sync | Sync table settings to Gold Standard | - |
| method-auditor | NoMethodError prevention | - |
| foundation-sync | DB schema ↔ Foundation sync | - |
| data-warehouse-health | Data integrity checks | - |
| performance-auditor | Frontend performance | - |
| product-planner | Product strategy | - |
| agent-creator | Create new agents | - |
| ttv-refactor | TeeemTableView refactoring | - |

## Agent Categories

### Development Agents
- **backend-developer** - Rails API, models, migrations, jobs
- **frontend-developer** - React components, Tailwind, dark mode

### Planning Agents
- **planning-collaborator** - Feature planning, architecture design
- **product-planner** - Product strategy, SaaS readiness

### Deployment Agents
- **deploy-manager** - Git operations, staging deployment

### Diagnostic Agents
- **production-bug-hunter** - General production bugs
- **gantt-bug-hunter** - Gantt/Schedule Master specific
- **code-guardian** - Code quality, SSoT violations
- **frontend-auditor** - UI/UX standards compliance
- **table-guardian** - TeeemTableView compliance
- **performance-auditor** - Frontend performance anti-patterns
- **data-warehouse-health** - Data integrity across all tables

### Validation Agents
- **column-type-validator** - Column type definitions sync
- **table-settings-sync** - Table settings to Gold Standard
- **method-auditor** - Rails method call validation (NoMethodError)
- **foundation-sync** - DB schema ↔ Foundation metadata

### Utility Agents
- **agent-creator** - Interactive agent creation workflow
- **ttv-refactor** - TeeemTableView refactoring specialist

## Agent File Format

```yaml
---
name: Agent Name
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Check 1:               Result                      [PASS]║
  ║  Check 2:               Result                      [PASS]║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: One line description                              ║
  ║  SSoT: Source reference                                   ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~X,XXX                            ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: blue
type: diagnostic
category: validation
author: Robert
---

# Agent Name

Content...
```

## Syncing Agents

Agents are synced to the database for tracking:

```bash
# Sync all agents
cd backend && bin/rails agents:sync_from_files

# View in admin UI
# Navigate to /admin/agents
```

## Recording Runs

```bash
# Record success
curl -X POST http://localhost:3001/api/v1/agent_definitions/agent-name/record_run \
  -H "Content-Type: application/json" \
  -d '{"status": "success", "message": "Completed"}'
```

## Skills (1 active)

Skills are lightweight pre-flight checkers in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| duplicate-detector | Detects code duplicates and SSoT violations |

## Notes

- Agents fetch rules from Trinity API, not markdown files
- All agents should output a summary box at completion
- Use standard box-drawing characters: ╔ ╗ ╚ ╝ ║ ═ ╠ ╣
