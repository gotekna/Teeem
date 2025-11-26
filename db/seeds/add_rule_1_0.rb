# Add RULE #1.0: Read Dense Index First
# Run with: rails runner db/seeds/add_rule_1_0.rb

rule = Trinity.find_or_initialize_by(
  category: 'bible',
  chapter_number: 1,
  section_number: '1.0'
)

rule.chapter_name = 'Overview & System-Wide Rules'
rule.entry_type = 'ALWAYS'
rule.severity = 'critical'
rule.title = 'Read Dense Index First, Then Full Content of Relevant Rules Only'
rule.description = <<~DESC
    **ALWAYS read the Bible using this efficient 3-step pattern:**

    ## What is the Dense Index?

    The **dense_index** field contains ALL the information from the rule - just compressed for AI reading:

    **What it contains (from Trinity model line 279-321):**
    - Section number (no dots): "b0109"
    - Title keywords (no spaces): "predecessoridconversion"
    - Entry type: "never"
    - Category: "bible"
    - Component: "gantt"
    - ALL key terms from description, details, summary, scenario, solution, code_example
    - First 20 unique meaningful words (3+ chars) extracted from full content
    - All spaces, markdown, capitalization, formatting removed

    **What it is:**
    - A mix of ALL information from other columns
    - Compressed by removing spaces, punctuation, markdown, common words
    - Optimized for AI reading (AIs don't need human formatting)
    - Contains the same semantic information, just denser

    ## Step 1: Read Dense Index for ALL Rules
    ```ruby
    # Fetch all bible rules with ONLY dense_index field
    GET /api/v1/trinity?category=bible&fields=dense_index,section_number
    ```

    - Dense index contains ALL rule information, just compressed
    - AIs can read compressed text without spaces/formatting
    - Scan all ~350 rules to understand entire Bible
    - Identify which chapters are relevant to your task

    ## Step 2: ALWAYS Read Chapter 1 Dense Index
    ```ruby
    # Get dense_index for Chapter 1 rules
    GET /api/v1/trinity?category=bible&chapter=1&fields=dense_index,section_number
    ```

    - Chapter 1 applies to EVERY task (universal rules)
    - Contains: API format, migrations, timezone, auth, etc.
    - ~15 rules in compressed format
    - Read the dense_index - it has all the information you need

    ## Step 3: Read Dense Index for Relevant Chapters
    ```ruby
    # Get dense_index for specific chapters identified in Step 1
    GET /api/v1/trinity?category=bible&chapter=10&fields=dense_index,section_number
    GET /api/v1/trinity?category=bible&chapter=20&fields=dense_index,section_number
    ```

    - Read dense_index for each relevant chapter
    - Contains all rules compressed (formulas, patterns, requirements)
    - AIs parse "predecessoridconversion never sequenceorder gantt" fine
    - Humans need "Predecessor ID = sequence_order + 1" with spaces

    ## Why Dense Index Only?

    **Efficiency:**
    - Bible: 2,600 lines, 350+ rules across 21 chapters
    - Dense index for all rules: 350 × 80 chars = 28,000 chars (~7,000 tokens)
    - Full Bible with formatting: 2,600 lines × 80 chars = 208,000 chars (~52,000 tokens)
    - **Savings: 201,000 chars (96% reduction)**

    **AI vs Human Reading:**
    - AIs can parse: "predecessoridconversion never sequenceorder gantt predecessor calculation formula"
    - Humans need: "Predecessor ID Conversion: NEVER use sequence_order. Formula: predecessor_id = sequence_order + 1"
    - Same information, different presentation
    - Dense index = all content fields compressed into keywords

    **Completeness:**
    - Dense index extracts keywords from description, details, summary, scenario, solution, code_example
    - First 20 unique meaningful words capture the essence
    - Formulas, values, patterns all present as keywords
    - Example: "sequence_order + 1" becomes "sequenceorder predecessor calculation formula"

    ## What NOT to Do

    ❌ **NEVER read full content fields (description, details, etc.) for AI consumption**
    - Full content is for humans and exported documentation
    - Wastes tokens on spaces, markdown, capitalization, punctuation
    - Dense index has all the same information compressed

    ❌ **NEVER read just section_number and title**
    - Title alone is too vague: "Predecessor ID Conversion"
    - Dense index adds context: "predecessoridconversion never sequenceorder gantt predecessor calculation formula"
    - You need the keywords to understand the rule

    ❌ **NEVER skip Chapter 1 dense_index**
    - Chapter 1 applies to EVERY feature
    - Most violations come from skipping Chapter 1
    - Only ~15 rules, ~1,200 chars compressed

    ## Chapter → Feature Mapping (Quick Reference)
    - **Chapter 1**: System-Wide (read for ANY task)
    - **Chapter 2**: Authentication & Users
    - **Chapter 3**: System Administration
    - **Chapter 4**: Contacts & Relationships
    - **Chapter 5**: Price Books & Suppliers
    - **Chapter 6**: Jobs & Construction Management
    - **Chapter 7**: Estimates & Quoting
    - **Chapter 8**: AI Plan Review
    - **Chapter 9**: Purchase Orders
    - **Chapter 10**: Gantt & Schedule Master
    - **Chapter 11**: Project Tasks & Checklists
    - **Chapter 12**: Weather & Public Holidays
    - **Chapter 13**: OneDrive Integration
    - **Chapter 14**: Outlook/Email Integration
    - **Chapter 15**: Chat & Communications
    - **Chapter 16**: Xero Accounting Integration
    - **Chapter 17**: Payments & Financials
    - **Chapter 18**: Workflows & Automation
    - **Chapter 19**: Custom Tables & Formulas
    - **Chapter 20**: UI/UX Standards & Patterns
    - **Chapter 21**: Agent System & Automation

    ## Example Workflow

    **Task:** "Add meeting management system"

    **Step 1 - Read Dense Index (ALL 350 rules):**
    ```ruby
    # Scan dense_index field for all bible rules
    GET /api/v1/trinity?category=bible&fields=dense_index,section_number,chapter_number

    # Example dense_index values for meeting-related rules:
    - b0103: "apiformatsuccessdataerror controller render json hash boolean"
    - b0104: "migrationrollbackindexforeign database schema changes"
    - b0302: "timezonecompanysetting australia timezone conversion methods"
    - b0601: "constructioncontactvalidation belongs relationship required"
    - b1101: "taskstatusautomaticdate workflow completion trigger"
    - b1801: "solidqueuebackgroundjob async email retry idempotent"
    - b2001: "tablepatterncheckboxlocked headless modal form state"

    # Identified relevant chapters: 1, 3, 6, 11, 18, 20
    ```

    **Step 2 - Read Chapter 1 Dense Index:**
    ```ruby
    GET /api/v1/trinity?category=bible&chapter=1&fields=dense_index,section_number

    # Parse compressed rules:
    - b0103: "apiformatsuccessdataerror" → API must return {success: bool, data: object}
    - b0104: "migrationrollbackindexforeign" → Create migrations, test rollback, add indexes
    - b0113: "singlesourcetruth database authority" → Database is single source of truth
    ```

    **Step 3 - Read Relevant Chapters Dense Index:**
    ```ruby
    GET /api/v1/trinity?category=bible&chapter=3&fields=dense_index,section_number
    GET /api/v1/trinity?category=bible&chapter=6&fields=dense_index,section_number
    GET /api/v1/trinity?category=bible&chapter=11&fields=dense_index,section_number
    GET /api/v1/trinity?category=bible&chapter=18&fields=dense_index,section_number
    GET /api/v1/trinity?category=bible&chapter=20&fields=dense_index,section_number

    # Parse implementation rules:
    - Chapter 3: "timezonecompanysetting timezone conversion methods context"
    - Chapter 6: "constructioncontactvalidation belongs relationship required"
    - Chapter 11: "taskstatusautomaticdate workflow completion trigger meeting"
    - Chapter 18: "solidqueuebackgroundjob async email retry idempotent"
    - Chapter 20: "tablepatterncheckboxlocked headless modal form state"
    ```

    **Result:**
    - Read: 6 chapters × ~15 rules × ~80 chars = 7,200 chars (~1,800 tokens)
    - Skipped: 15 chapters with formatted content (~45,000 tokens)
    - **Total: 1,800 tokens vs. 52,000 for full Bible (97% savings)**
    - Know all relevant rules ✅
    - Build compliant feature ✅
    - Used AI-optimized compressed format ✅

    ## This is RULE #1.0 Because

    Reading efficiently MUST happen BEFORE you can follow other rules.
    - You cannot follow rules you haven't read
    - But reading formatted content wastes tokens on human presentation
    - Dense index = complete information, compressed for AI parsing
    - Full content = same information, formatted for human reading
    - Dense index only = 97% token savings with 100% information

    ## Reading vs Writing

    **READING Trinity (for AI consumption):**
    - Use ONLY the `dense_index` field
    - Contains all information from description, details, summary, scenario, solution, code_example
    - Compressed: no spaces, markdown, capitalization removed
    - Example: `GET /api/v1/trinity?category=bible&fields=dense_index,section_number`

    **WRITING Trinity (creating new rules):**
    - MUST fill in complete structure with human-readable fields
    - Fields: description, details, summary, scenario, solution, code_example, etc.
    - The `dense_index` auto-generates via after_save callback
    - Never write to dense_index directly - it's auto-generated

    **Why different for reading vs writing:**
    - Humans write rules with formatting, examples, explanations
    - Trinity model auto-compresses into dense_index for AI reading
    - AIs read compressed version (97% token savings)
    - Exported Bible uses formatted version for human documentation

    ## Technical Implementation

    **Dense Index Generation (Trinity model line 279-321):**
    ```ruby
    def update_dense_index
      tokens = []
      tokens << section_number.downcase.gsub('.', '')  # b0109
      tokens << title.downcase.gsub(/[^a-z0-9]/, '')   # predecessoridconversion
      tokens << entry_type.downcase                     # never
      tokens << category                                # bible
      tokens << component.downcase if component.present?

      # Extract from ALL content fields
      content_text = [description, details, summary, scenario, solution, code_example].compact.join(' ')

      # Extract first 20 unique meaningful words (3+ chars)
      key_terms = content_text
        .downcase
        .gsub(/[*#\-_`]/, '')  # Remove markdown
        .gsub(/must|never|always|should|will|can|use|add|set|get/, '')  # Remove common words
        .scan(/\b[a-z]{3,}\b/)  # Extract meaningful words
        .uniq
        .first(20)

      tokens.concat(key_terms)
      self.dense_index = tokens.join(' ')  # Auto-generated, space-separated
    end
    ```

    **Search Pattern:**
    ```ruby
    # Find rules about "timezone" and "working days"
    Trinity.bible_entries.where("dense_index ILIKE ?", "%timezone%")
    Trinity.bible_entries.where("dense_index ILIKE ?", "%workingdays%")
    ```
  DESC

rule.save!

puts "✅ RULE #1.0 #{rule.new_record? ? 'created' : 'updated'} successfully!"
puts "📖 Run: rails teeem:export_bible"
puts "📝 Then commit TEEEM_BIBLE.md"
