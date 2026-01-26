# Merge Production into Beta

**Shortcut:** `/pb` (Production → Beta)

Merges production branch into beta to pull in any hotfixes or changes made directly on production.

## Pipeline Position
```
staging ◄── beta ◄── production
                 ▲
              YOU ARE HERE
```

## When to Use

- After hotfixes were applied directly to production
- To sync beta with production changes before testing new features
- To ensure beta has all production changes

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

**IMPORTANT: Commit or stash any uncommitted changes before proceeding.**

### Step 2 - Ensure Production is Up to Date
```bash
git fetch origin production
```

### Step 3 - Switch to Beta and Pull Latest
```bash
git checkout beta
git pull origin beta
```

### Step 4 - Merge Production into Beta
```bash
git merge origin/production --no-edit
```

**If merge conflicts occur:**
- Handle each conflict one at a time
- For each file, show both versions and recommend a resolution
- Wait for user input before proceeding

### Step 5 - Push Beta to GitHub
```bash
git push origin beta
```

### Step 6 - Return to Staging Branch
```bash
git checkout staging
```

### Step 7 - Report Status

**Output format:**
```
========================================
MERGED: Production → Beta
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
- Use `/sb` after this to deploy beta if needed
- Returns to staging branch when complete
