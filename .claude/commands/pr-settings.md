# PR Section 5: Settings Pages (All Tabs, Sub-tabs, Sub-sub-tabs)

You are a QA engineer. Test EVERY settings tab, sub-tab, and sub-sub-tab. This is the largest section (~45 pages). No shortcuts.

**This section is large. Work methodically through each settings category. If context runs low, save progress and tell the user to re-run `/pr-settings`.**

## Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load
5. Read `.claude/pr-progress.json` - skip any pages already tested in section "settings"
6. Navigate to `/settings`

## Test Protocol (run for EVERY tab/sub-tab)

### Step A: Click Tab & Snapshot
- Click the tab/sub-tab element
- Wait 3 seconds for content to load
- `take_snapshot` - verify content rendered

### Step B: Error Check
- `list_console_messages({ types: ["error"] })` - record console errors
- In snapshot, search for: "Failed to", "Error", "Something went wrong", "Retry"
- **If ANY error: status = FAIL**

### Step C: Content Validation
- Record what you SEE: form fields, tables, toggles, buttons
- If table: verify it has rows (not "0 records" when data expected)
- If form: verify fields have values or proper empty states

### Step D: Interaction Test
- If table with Add button: click Add, verify form opens, close without saving
- If toggle/switch visible: note its state (don't change it)

### Step E: Scroll Check
```javascript
() => {
  const el = document.querySelector('[class*="main-scroll"]') || document.querySelector('main') || document.documentElement;
  const before = el.scrollTop;
  el.scrollTo(0, el.scrollHeight);
  const after = el.scrollTop;
  el.scrollTo(0, 0);
  return { scrollable: after > before || el.scrollHeight <= el.clientHeight, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
}
```

## Pages to Test (in exact order)

### Personal Settings (4 tabs)
1. `/settings/profile` - Profile
2. `/settings/notifications` - Notifications
3. `/settings/security` - Security (password, 2FA)
4. `/settings/preferences` - UI Preferences

### Users (1 tab)
5. `/settings/users` - User management table

### Access Control (3 sub-tabs)
6. `/settings/roles` - Landing (should show first sub-tab)
7. `/settings/roles/permissions` - Permissions matrix
8. `/settings/roles/user-roles` - User Roles table
9. `/settings/roles/groups` - Groups table

### Corporate (varies)
10. `/settings/corporate` - Corporate settings

### Company (8 sub-tabs, some with sub-sub-tabs)
11. `/settings/company/info` - Company info form
12. `/settings/company/brand-colors` - Brand colors palette
13. `/settings/company/documents` - Documents landing
14. `/settings/company/documents/document-types` - Document Types table
15. `/settings/company/documents/templates` - Templates table
16. `/settings/company/documents/pdf-fields` - PDF Fields
17. `/settings/company/holidays` - Public holidays
18. `/settings/company/workflows` - Workflows
19. `/settings/company/job-setup` - Job Setup landing
20. `/settings/company/job-setup/types` - Job Types table
21. `/settings/company/job-setup/statuses` - Job Statuses table
22. `/settings/company/job-setup/stages` - Job Stages table
23. `/settings/company/job-setup/suburbs` - Suburbs table
24. `/settings/company/job-setup/workflow` - Job Workflow
25. `/settings/company/warehouse-config` - Warehouse Config landing
26. `/settings/company/warehouse-config/warehouse-folders` - Warehouse Folders
27. `/settings/company/warehouse-config/document-types` - WH Document Types
28. `/settings/company/warehouse-config/corporate` - WH Corporate config
29. `/settings/company/warehouse-config/jobs` - WH Jobs config
30. `/settings/company/warehouse-config/contacts` - WH Contacts config
31. `/settings/company/warehouse-config/email-config` - WH Email config
32. `/settings/company/warehouse-config/config-sync` - Config Sync
33. `/settings/company/offline` - Offline mode

### Operations (7 sub-tabs)
34. `/settings/operations` - Operations landing
35. `/settings/operations/schedule-master` - Schedule Master settings
36. `/settings/operations/sm-tasks` - SM Tasks
37. `/settings/operations/contact-types` - Contact Types table
38. `/settings/operations/meeting-types` - Meeting Types table
39. `/settings/operations/supervisor-checklist` - Supervisor Checklist
40. `/settings/operations/cost` - Cost settings
41. `/settings/operations/po-templates` - PO Templates

### Connections (5 sub-tabs)
42. `/settings/connections/provider` - Storage Provider config
43. `/settings/connections/integrations` - Integrations (Xero, Cloudflare)
44. `/settings/connections/migration` - Migration tools
45. `/settings/connections/costs` - Cost comparison
46. `/settings/connections/backups` - Backup config

### System (7 sub-tabs)
47. `/settings/system` - System landing
48. `/settings/system/navigation` - Navigation config
49. `/settings/system/ai-agents` - AI Agents
50. `/settings/system/scheduled-jobs` - Scheduled Jobs
51. `/settings/system/email-accounts` - Email Accounts
52. `/settings/system/ai-processing` - AI Processing
53. `/settings/system/config-sync` - Config Sync
54. `/settings/system/system-health` - System Health

### Developer (4 sub-tabs)
55. `/settings/developer` - Developer landing
56. `/settings/developer/components` - Components Lab
57. `/settings/developer/tools` - Developer Tools
58. `/settings/developer/brand-guidelines` - Brand Guidelines
59. `/settings/developer/unreal-engine` - Unreal Engine

### Email Reseller (4 sub-tabs)
60. `/settings/email-reseller` - Email Reseller landing
61. `/settings/email-reseller/subscriptions` - Subscriptions
62. `/settings/email-reseller/migrations` - Migrations
63. `/settings/email-reseller/reports` - Reports
64. `/settings/email-reseller/settings` - Reseller Settings

## Progress Tracking

Save to `.claude/pr-progress.json` after EVERY 5 pages (merge with existing):
```json
{
  "sections": {
    "settings": {
      "status": "in_progress",
      "tested": [...],
      "failed": [],
      "remaining": ["/settings/system/navigation", "..."]
    }
  }
}
```

**CRITICAL:** If context is running low, save progress IMMEDIATELY and tell the user:
```
Context running low. Saved progress at page XX/64.
Run /pr-settings again to resume from where I left off.
```

## Section Summary

```
========================================
PR SECTION 5: SETTINGS - COMPLETE
========================================
Page                                         Status    Details
--------------------------------------------------------------
Profile                                      [PASS]    Form loaded, fields populated
Notifications                                [PASS]    Toggle settings visible
Security                                     [PASS]    Password + 2FA sections
...
Company > Documents > Templates              [PASS]    Table, 8 templates
Company > Job Setup > Types                  [PASS]    Table, 5 types
Company > Warehouse Config > Folders         [PASS]    Tree view, 12 folders
...
System > AI Agents                           [FAIL]    Spinner stuck
Developer > Components Lab                   [PASS]    Component showcase loaded
...
========================================
TOTAL: 64 tested | XX PASS | XX FAIL
Next: Run /pr-admin
========================================
```
