# Merge All Branches (Back-merge)

**Shortcut:** `/ma` (Merge All)

Merges Live changes back through Beta to Staging. Use this after hotfixes to sync all branches.

## Pipeline Flow
```
Staging ◄── Beta ◄── Live
   ▲          ▲        │
   │          │        │
   └──────────┴────────┘
        Back-merge flow
```

## When to Use

- After hotfixes were applied to Live
- To sync all branches before continuing development
- To ensure Staging has all Live and Beta changes

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

### Step 2 - Stash Any Uncommitted Changes
```bash
# Check if there are changes to stash
if [ -n "$(git status --porcelain)" ]; then
    git stash push -m "ma-auto-stash-$(date +%Y%m%d-%H%M%S)"
    echo "✅ Changes stashed"
fi
```

### Step 3 - Fetch All Branches
```bash
git fetch origin Live Beta Staging
```

### Step 4 - Merge Live into Beta
```bash
git checkout Beta
git pull origin Beta
git merge origin/Live --no-edit
```

**If merge conflicts occur:**
- Handle each conflict one at a time
- Show both versions and recommend a resolution
- Wait for user input before proceeding

```bash
git push origin Beta
echo "✅ Live → Beta merge complete"
```

### Step 5 - Merge Beta into Staging
```bash
git checkout Staging
git pull origin Staging
git merge origin/Beta --no-edit
```

**If merge conflicts occur:**
- Handle each conflict one at a time
- Show both versions and recommend a resolution
- Wait for user input before proceeding

```bash
git push origin Staging
echo "✅ Beta → Staging merge complete"
```

### Step 6 - Pop Stash if Needed
```bash
# Check if we stashed changes earlier
if git stash list | grep -q "ma-auto-stash"; then
    git stash pop
    echo "✅ Stashed changes restored"
fi
```

### Step 7 - Report Status

```bash
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
```

**Output format:**
```
========================================
MERGED ALL: HH:MM DD/MM (Brisbane)
----------------------------------------
✅ Live → Beta: merged
✅ Beta → Staging: merged
----------------------------------------
All branches synchronized
========================================
```

## Error Handling

If merge conflicts occur:
1. Show each conflict with both versions
2. Recommend resolution based on context
3. Wait for user choice
4. Apply resolution and continue
5. If user chooses to abort, restore original state

If any step fails:
1. Report which merge failed
2. Show current branch state
3. Provide recovery commands

## Notes

- This does NOT deploy - it only merges branches
- Use `/sa` after this to deploy Staging if needed
- Ends on Staging branch
- Automatically stashes and restores local changes
