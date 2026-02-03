# Claude Code Slash Commands - Quick Reference

This directory contains slash commands that you can use in Claude Code to trigger common workflows.

## How to Use

Type `/` followed by the command name in Claude Code. For example:
- `/deploy` - Deploy to staging
- `/gantt` - Run Gantt bug hunter
- `/all-agents` - Run all agents in parallel

## Available Commands

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `/deploy` | Deploy current branch to staging (Heroku + Vercel) | Ready to deploy your changes to staging |
| `/all-agents` | Run all 6 agents in parallel for health checks | Want comprehensive status of entire project |
| `/backend` | Launch backend-developer agent | Working on Rails API, models, or services |
| `/frontend` | Launch frontend-developer agent | Working on React UI, styling, or components |
| `/gantt` | Launch gantt-bug-hunter agent | Debugging Gantt/Schedule Master issues |
| `/bug-hunter` | Launch production-bug-hunter agent | Investigating production errors |
| `/plan` | Launch planning-collaborator agent | Brainstorming features or architecture |
| `/bible` | Read a chapter from TEEEM_BIBLE.md | Need to check rules before working on feature |
| `/lexicon` | Search Lexicon database | Looking for bug history or architecture decisions |
| `/chapter` | Work on feature by chapter number | Starting work on specific feature (reads Bible + Lexicon first) |
| `/fix-bug` | Fix bug with proper Lexicon documentation | Found a bug and want to fix it properly |
| `/test` | Run tests with auto-debug on failures | Running any tests (backend, frontend, E2E, Bug Hunter) |
| `/commit` | Create git commit with conventional format | Ready to commit your changes |
| `/status` | Get comprehensive project status report | Want overview of git, servers, deployments |
| `/export-lexicon` | Export Lexicon database to markdown | Updated Lexicon entries and want to export to file |
| `/pr` | Test EVERY page in the app using Chrome DevTools | Comprehensive UI testing before deployment |

## Agent Shortcuts

These commands map to the 6 specialized agents. **Each shortcut automatically saves execution history to the Lexicon** so Claude learns your usage patterns.

| Shortcut | Agent | Focus Area | Auto-Saves to Lexicon |
|----------|-------|-----------|----------------------|
| `/backend` | backend-developer | Rails API, database, background jobs | ✅ Chapter 20 |
| `/frontend` | frontend-developer | React, Tailwind, UI/UX | ✅ Chapter 20 |
| `/bug-hunter` | production-bug-hunter | Heroku logs, error diagnosis | ✅ Chapter 20 |
| `/deploy` | deploy-manager | Staging deployment, git subtree | ✅ Chapter 20 |
| `/plan` | planning-collaborator | Features, architecture, docs | ✅ Chapter 20 |
| `/gantt` | gantt-bug-hunter | Gantt Bible compliance, visual tests | ✅ Chapter 20 |

### How Shortcuts Work

1. **Type shortcut** (e.g., `/gantt` or just `gantt`)
2. **Agent executes** its specialized tasks
3. **Auto-saves to Lexicon** - Creates entry in `documentation_entries` table (Chapter 20)
4. **Exports to markdown** - Updates `/TEEEM_DOCS/TEEEM_LEXICON.md`
5. **Claude learns** - Future sessions can reference this execution history

## Deployment Commands

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `/s` | Commit THIS chat + deploy to Staging | Quick staging deploy of current work |
| `/sa` | Commit ALL changes + deploy to Staging | Deploy all uncommitted work to staging |
| `/b` | Commit THIS chat + deploy to Beta | Push current work to beta |
| `/ba` | Commit ALL changes + deploy to Beta | Deploy all uncommitted work to beta |
| `/p` | Commit THIS chat + full pipeline to Production | Push current work all the way to production |
| `/pa` | Commit ALL changes + full pipeline to Production | Deploy everything to production |
| `/live` | **True sync** - merge ALL branches together | Branches diverged, make all identical |
| `/sd` | Merge Sam-Dev → Staging | Merge Sam's development branch into staging |
| `/ss` | Merge SamTestMerge → Staging | Merge Sam's test branch into staging |
| `/ma` | Back-merge Live → Beta → Staging | After hotfixes, sync changes back |
| `/mp` | Deploy Staging backend to Beta + Production | Backend-only deployment |

### Branch Pipeline
```
Staging ──► Beta ──► Live (Production)
   │          │          │
   └──────────┴──────────┘
```

## Common Workflows

### Deploy to Staging
```
/deploy
```

### Fix a Bug (Proper Workflow)
```
/fix-bug
```
Then describe the bug. This will:
1. Fix the code
2. Update Lexicon
3. Update Bible if needed
4. Test the fix
5. Commit with documentation

### Work on Gantt Feature
```
/chapter
```
Then say "Chapter 9" - this will:
1. Read Bible Chapter 9 rules
2. Read Lexicon Chapter 9 bug history
3. Guide you through changes

### Run All Tests
```
/test
```
Then specify which tests (e.g., "run E2E tests" or "run Bug Hunter tests")

### Get Project Status
```
/status
```

### Health Check All Systems
```
/all-agents
```

## Manual Shortcuts (Type These Phrases)

You can also type these phrases naturally:

| What You Type | What Happens |
|---------------|--------------|
| "deploy" | Runs deploy-manager agent |
| "all agents" | Runs all 6 agents in parallel |
| "backend dev" | Runs backend-developer agent |
| "frontend dev" | Runs frontend-developer agent |
| "gantt" | Runs gantt-bug-hunter agent |
| "bug hunter" | Runs production-bug-hunter agent |
| "plan" | Runs planning-collaborator agent |

## Creating New Commands

To add a new command:

1. Create `.claude/commands/your-command.md`
2. Write the instructions for what Claude Code should do
3. Use it with `/your-command`

## Examples

**Deploy to staging:**
```
You: /deploy
Claude: *reads deploy-manager agent instructions and deploys*
```

**Fix timezone bug:**
```
You: /fix-bug
Claude: What bug would you like to fix?
You: Gantt timezone violations in cascade updates
Claude: *reads Bible Chapter 9, fixes bug, updates Lexicon, tests, commits*
```

**Check project status:**
```
You: /status
Claude: *shows git branch, servers, deployments, migrations status*
```

**Run Gantt tests:**
```
You: /gantt
Claude: *reads gantt-bug-hunter.md, runs all 12 visual tests, checks Bible compliance*
```
