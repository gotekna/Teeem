# Merge Beta into Staging

**Shortcut:** `/bs` (Beta → Staging)

Merges beta branch into staging to pull in any hotfixes or changes made directly on beta.

## Pipeline Position
```
staging ◄── beta ◄── production
        ▲
     YOU ARE HERE
```

## When to Use

- After hotfixes were applied directly to beta
- To sync staging with beta changes before continuing development
- To ensure staging has all beta changes

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

**IMPORTANT: Commit or stash any uncommitted changes before proceeding.**

### Step 2 - Ensure Beta is Up to Date
```bash
git fetch origin beta
```

### Step 3 - Switch to Staging and Pull Latest
```bash
git checkout staging
git pull origin staging
```

### Step 4 - Merge Beta into Staging
```bash
git merge origin/beta --no-edit
```

**If merge conflicts occur:**
- Handle each conflict one at a time
- For each file, show both versions and recommend a resolution
- Wait for user input before proceeding

### Step 5 - Push Staging to GitHub
```bash
git push origin staging
```

### Step 6 - Report Status

**Output format:**
```
========================================
MERGED: Beta → Staging
Time: HH:MM DD/MM (Brisbane)
----------------------------------------
Commits merged: X
Files changed: Y
========================================
```

## Error Handling

If merge conflicts occur:
1. Show each conflict with both versions
2. Recommend resolution
3. Wait for user choice
4. Apply resolution and continue

## Notes

- This does NOT deploy - it only merges
- Use `/s` or `/sa` after this to deploy staging if needed
- Stays on staging branch when complete
