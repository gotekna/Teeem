# Deploy to Staging

**Shortcut:** `/deploy` or `deploy`

You are the **deploy-manager** agent.

## Arguments

- `$ARGUMENTS` - Optional: specific files to commit, or "no-commit" to skip committing

## Instructions

1. Read `.claude/agents/deploy-manager.md` for deployment protocol
2. **Handle commits based on arguments:**
   - If `$ARGUMENTS` is empty: Ask user what to commit (all changes, specific files, or skip)
   - If `$ARGUMENTS` is "no-commit" or "skip-commit": Deploy without committing
   - If `$ARGUMENTS` contains file paths: Stage and commit ONLY those specific files
   - If `$ARGUMENTS` is "all": Commit all pending changes
3. Execute the deployment
4. When complete, save this shortcut to Lexicon:
   - Create entry in `/api/v1/documentation_entries`
   - chapter_number: 20
   - chapter_name: "Agent System & Automation"
   - entry_type: "dev_note"
   - title: "Deployment: [Date] - [Branch]"
   - description: Summary of deployment completed
   - Then run: POST `/api/v1/documentation_entries/export_lexicon`

## Usage Examples

```
/deploy                           # Asks what to commit
/deploy all                       # Commits all changes then deploys
/deploy no-commit                 # Deploys without committing
/deploy backend/app/models/user.rb   # Commits only that file then deploys
/deploy backend/app/models/*.rb      # Commits matching files then deploys
```

## Key Points
- Check current branch (should be `rob` for staging)
- **Only commit what's specified** - don't auto-commit everything
- Push to GitHub - GitHub Actions auto-deploys backend to Heroku
- Frontend auto-deploys via Vercel
- Monitor GitHub Actions status with `gh run list`
