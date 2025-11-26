# Claude Code Setup for TEEEM

This folder contains configuration for Claude Code, the AI pair programmer used on this project.

## What is Claude Code?

Claude Code is an AI-powered development assistant that helps with:
- Writing code (frontend & backend)
- Reviewing code and finding bugs
- Deploying to production
- Planning features
- Answering questions about the codebase

## Quick Setup

### 1. Install Claude Code

Follow the instructions at: https://docs.claude.com/docs/claude-code

### 2. Configure Your Machine

The project is already configured in this `.claude/` folder, but you need to allow file access for your user:

**On Mac/Linux:**
```bash
# Clone the repo first
cd /path/to/teeem

# Claude Code will use the settings.json in this folder automatically
# No additional setup needed!
```

**Optional: Add user-specific permissions**

If you want Claude Code to access files outside this repo, create `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Read(//Users/YOUR_USERNAME/**)"
    ]
  }
}
```

Replace `YOUR_USERNAME` with your actual username.

## Available Agents

Claude Code has specialized agents for different tasks:

### Backend Developer Agent
- Handles Rails backend code
- Database migrations
- API endpoints
- Background jobs

### Frontend Developer Agent
- React components
- Tailwind CSS styling
- UI/UX implementation
- Following design system (see `docs/FRONTEND_DESIGN_GUIDELINES.md`)

### Bug Hunter Agent
- Finds and fixes bugs
- Reviews Heroku logs
- Traces issues
- Provides fixes

### Deploy Manager Agent
- Deploys backend to Heroku
- Deploys frontend to Vercel (via GitHub Actions)
- Runs migrations
- Checks for leaked secrets

### Planning Collaborator Agent
- Helps brainstorm features
- Creates documentation
- Plans architecture

## How to Use

### Starting Claude Code

```bash
cd /path/to/teeem
claude  # Opens Claude Code in this directory
```

### Example Commands

**Get help:**
```
How does the contact system work?
```

**Build a feature:**
```
I need to add a new field to the jobs table
```

**Deploy:**
```
Deploy my changes to production
```

**Review code:**
```
Review this file for bugs: backend/app/models/contact.rb
```

## Project Documentation

Read these files to understand how Claude Code works with TEEEM:

- `TEEEM_DOCS/TEEEM_BIBLE.md` - RULES (absolute authority)
- `TEEEM_DOCS/TEEEM_LEXICON.md` - Bug history & knowledge base
- `docs/CONTRIBUTING.md` - Development workflow

## Important Notes

### Deployments

- **Backend:** Deploys to Heroku via `git subtree push`
- **Frontend:** Auto-deploys via GitHub Actions when you push to `main`
- **You don't need Vercel access** - GitHub Actions handles it

### What Gets Deployed

When you merge to `main`:
1. GitHub Actions automatically deploys frontend to https://teeem.vercel.app
2. For backend changes, Claude Code will deploy to Heroku
3. Migrations run automatically

### Permissions

The `settings.json` file gives Claude Code permission to:
- Run git commands
- Deploy to Heroku/Vercel
- Run Rails commands
- Install npm packages
- Read/write files in this project

These permissions are **project-wide** and safe for all team members.

## Troubleshooting

### Claude Code can't access files

Make sure you're running Claude Code from the project root:
```bash
cd /path/to/teeem
claude
```

### Deployments failing

Check that you have:
- Heroku CLI installed and logged in: `heroku auth:whoami`
- GitHub access configured: `gh auth status`

### Need more help?

Ask Claude Code:
```
How do I set up my development environment?
```

Or check: https://docs.claude.com/docs/claude-code
