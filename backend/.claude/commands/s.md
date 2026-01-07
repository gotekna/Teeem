# Merge SamTestMerge to Live

Merge Sam's test branch into the Live branch.

## Instructions

1. First, ensure we're on the Live branch and it's up to date:
   ```bash
   git checkout Live
   git pull origin Live
   ```

2. Fetch the latest SamTestMerge branch:
   ```bash
   git fetch origin SamTestMerge
   ```

3. Check what will be merged (preview):
   ```bash
   git log --oneline Live..origin/SamTestMerge
   ```

4. Attempt the merge:
   ```bash
   git merge origin/SamTestMerge --no-edit
   ```

5. **If merge conflicts occur, handle ONE AT A TIME:**

   For EACH conflicted file (one by one):

   a) **Show the file path and conflict location** (line numbers)

   b) **Explain what Live branch has:**
      - Show the actual code from Live (ours)
      - Explain what this code does in plain English
      - When was it last modified and by whom

   c) **Explain what SamTestMerge has:**
      - Show the actual code from SamTestMerge (theirs)
      - Explain what this code does in plain English
      - What feature/fix was Sam working on

   d) **Analyze the conflict:**
      - Why do these conflict? (same lines edited, code moved, etc.)
      - Are they doing the same thing differently, or different things?
      - Is one a subset of the other?

   e) **RECOMMEND a solution with reason**

   Format like this:
   ```
   ═══════════════════════════════════════════════════════
   CONFLICT 1 of 3: backend/app/models/job.rb (lines 45-52)
   ═══════════════════════════════════════════════════════

   📍 LIVE VERSION:
   ```ruby
   def calculate_total
     items.sum(&:price)
   end
   ```
   → Calculates total by summing item prices
   → Last changed: Dec 10 by Rob

   📍 SAM'S VERSION:
   ```ruby
   def calculate_total
     items.sum(&:price) * (1 + tax_rate)
   end
   ```
   → Adds tax calculation to the total
   → Part of: "Add GST to job totals" feature

   🔍 ANALYSIS:
   Sam added tax calculation. Live doesn't have this.
   Sam's version is more complete.

   ✅ RECOMMENDATION: s (Sam's version)

   ┌─────────────────────────────┐
   │  s = Sam's version          │
   │  l = Live version           │
   │  b = Combine both           │
   │  x = Abort entire merge     │
   └─────────────────────────────┘

   Your choice?
   ```

6. **Wait for user response before moving to next conflict**

7. Apply the chosen resolution immediately:
   ```bash
   # For Sam's version (theirs)
   git checkout --theirs <filename>
   git add <filename>

   # For Live version (ours)
   git checkout --ours <filename>
   git add <filename>

   # For combine - manually merge the code, then:
   git add <filename>
   ```

8. **Then show the next conflict** (repeat steps 5-7 until all resolved)

9. After ALL conflicts resolved, complete merge and push:
   ```bash
   git commit --no-edit
   git push origin Live
   ```

10. Report final summary:
    ```
    ✅ MERGE COMPLETE

    Commits merged: X
    Files changed: Y

    Conflict resolutions:
    - file1.rb → Sam's version
    - file2.tsx → Live version
    - file3.ts → Combined
    ```
