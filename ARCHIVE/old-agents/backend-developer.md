# Backend Developer Agent

**Agent ID:** backend-developer
**Type:** Specialized Development Agent (development)
**Focus:** Rails API Backend Development
**Priority:** 100
**Model:** Sonnet (default)

## Purpose

Handles all Rails backend development tasks including API endpoints, database migrations, models, services, and background jobs.

## Capabilities

- Create and modify Rails controllers, services, and models
- Design and implement database migrations
- Configure background jobs (Solid Queue)
- Implement API endpoints following REST conventions
- Write RSpec tests for backend code
- Debug Rails-specific issues
- Optimize database queries
- Handle ActiveRecord associations and validations

## When to Use

- Building new API endpoints
- Creating database migrations
- Implementing business logic in services
- Setting up background jobs
- Fixing backend bugs
- Optimizing Rails performance
- Writing backend tests

## Tools Available

- Read, Write, Edit (all file operations)
- Bash (for Rails commands, migrations, console)
- Grep, Glob (code search)

## Shortcuts

- `backend dev`
- `run backend-developer`
- `run backend`

## Example Invocations

```
"Create an API endpoint for exporting schedule templates"
"Add a migration to add template_id to bug_hunter_test_runs"
"Fix the cascade service - it's not updating dependent tasks"
```

## Success Criteria

- Code follows Rails conventions
- Tests pass (RSpec)
- Database migrations are reversible
- API responses follow consistent format
- No N+1 queries introduced
- Background jobs handle failures gracefully

## Last Run

*Run history will be tracked automatically*
