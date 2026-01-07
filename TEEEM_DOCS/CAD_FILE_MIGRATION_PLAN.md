# CAD File Migration Plan

**Created:** 2024-12-30
**Status:** In Progress - Job 69 Test Complete

---

## Completed ✅

### RevitTab Component
- [x] Created `frontend-next/components/jobs/RevitTab.tsx`
- [x] Drag & drop file upload to SharePoint
- [x] File browser with icons for RVT, DWG, Datasmith, SKP
- [x] Upload button for manual file selection

### SSoT Configuration
- [x] Added `is_cad_category` boolean to `entity_tabs` table
- [x] Added "CAD Files View" checkbox to tab configurator (Admin → System → Tabs)
- [x] Jobs page renders RevitTab when `is_cad_category=true`
- [x] Deployed to production

### Job 69 Test
- [x] Enabled `is_cad_category` on revit-dwg tab
- [x] Moved `Lot 83 High.rvt` (297MB) from Site → Revit folder
- [x] RevitTab displaying file correctly

---

## Remaining Work

### 1. Clean Up Job 69 Revit Folder
The Revit folder has 13 empty subfolders:
```
/Jobs/069/Revit/
├── CAD/          (empty)
├── DATASMITH/    (empty)
├── DWGs/         (empty)
├── Old/          (empty)
├── Old 2-10/     (empty x9)
└── Lot 83 High.rvt  ← only file
```

**Decision needed:**
- Delete empty `Old` folders?
- Keep `CAD/`, `DATASMITH/`, `DWGs/` for organization?

---

### 2. Files in `rob fix/` Root Folder
Location: `/Shared Documents/rob fix/`

| Subfolder | Items | Contents | Action |
|-----------|-------|----------|--------|
| `0. REVIT TEMP/` | 5 | Templates: Colour Selection Plan.rvt, Blank Template.rte, 2-38.udatasmith | Move to `/Templates/Revit/` |
| `01 Drafting/` | 21 | Job folders with addresses (CAD files inside) | Match to TEEEM jobs → move to Revit folders |
| `00 Current Kitchen Jobs/` | 17 | Job folders by client name | Match to TEEEM jobs → move to Revit folders |
| `00 Active - Soon to be moved/` | ? | Unknown | Check contents |
| `00 Draft Contracts/` | ? | Contracts | Check if needed |
| `00 Job Template/` | ? | Template structure | May keep for reference |
| `00 Standard Colour Selections/` | ? | Colour docs | Move to Templates? |
| `00 Tekna Kitchens/` | ? | Kitchen files | Check contents |
| `00 Waiting to Go Active/` | ? | Pending jobs | Check contents |
| `01 Jobs Complete/` | ? | Archived jobs | May archive elsewhere |
| `TEEEM Jobs 5/` | 1 | Only Job 048 | Move to proper Jobs folder |

---

### 3. Job Matching from `01 Drafting/`
These folders need to be matched to TEEEM jobs:

```
01 Drafting/
├── 11 Nicole Street Crestmead
├── 142 Fletcher Parade, Bardon - QLD 4065
├── 3 Pine st Nambour
├── 3 Quinn Street
├── 34 Club Gympie
├── 513 Hickory Street Gleneagle
├── 6 School Rd Yandina
├── 7 BART STREET
├── Andrew - Oakvale Ave
├── Brendan
├── Burnside Estate - Andrew Ockrim
├── Duplex
├── Gympie Duplex
├── gympie preservation
├── Jared Site - Tingalpa Block
├── lot 1&2 Johnstone Road, Southside Gympie
├── Lot 2751 Cooloola Street, Palmview QLD 2553
├── Rebecca - 9 Curfew St Upper Mt Gravatt
├── Tekna Details
├── Waiting on Client
└── Preservation Street Gympie.0001.rvt
```

---

### 4. Job Matching from `00 Current Kitchen Jobs/`
```
00 Current Kitchen Jobs/
├── 1 Tristania Cornubia
├── 13 Azanian Street, Upper Mt Gravatt
├── 36 Bowen Rd Kitchens
├── ANDREW - 22 Oakview Circuit Brookwater
├── DOM - 113 Carlton Terrace, Manly
├── GABY - 39 Cowell Street, Carindale, QLD - 4152
├── ISSAC - 16 Farsley Place Manly West
├── KERRI - 23 Orana Street, Victoria Point
├── NATACHE - 43 Bougainvillea St Calamvale
├── RAMAN - 14 Ruggles Ct, Mcdowall
├── TRACEY - 146 Balmoral Road, Montville
├── ZZ Completed
├── ZZ Old
└── zz Photos of fixs up required
```

---

### 5. Fix MicrosoftCredential Drive ID
The `sharepoint_drive_id` field is empty. Should store:
```ruby
# Run on production:
cred = MicrosoftCredential.sharepoint_credential
cred.update!(
  sharepoint_site_id: "gotekna.sharepoint.com,d551d458-8c0e-4e22-98b0-434ba9b0e85d,5892a9c8-67f7-4d87-92ca-b1c9a6dd327c",
  sharepoint_drive_id: "b!WNRR1Q6MIk6YsENLqbDoXcipklj3Z4dNksqxyabdMnxc_jwWEl2CRq2ELSJhljDi"
)
```

---

### 6. Create Migration Rake Task
Build `lib/tasks/sharepoint_cad_migration.rake`:

```ruby
namespace :sharepoint do
  desc "Migrate CAD files from rob fix to job Revit folders"
  task migrate_cad_files: :environment do
    # 1. Scan rob fix/01 Drafting/ folders
    # 2. For each folder, fuzzy match address to Job.name
    # 3. If match found:
    #    - Ensure job has Revit folder
    #    - Move CAD files (*.rvt, *.dwg, *.udatasmith, *.skp)
    # 4. Log unmatched for manual review
  end
end
```

---

### 7. Enable RevitTab on Other Jobs
Once migration tested:
1. For each job with CAD files moved:
   - Ensure `Revit` folder exists
   - Find/create EntityTab with `is_cad_category: true`
2. Or: Make RevitTab appear automatically when Revit folder has files

---

## Priority Order

1. **Fix credential drive_id** - Quick win, prevents future API issues
2. **Clean up Job 69 empty folders** - Test the cleanup process
3. **Audit `rob fix/` contents** - Document what's in each subfolder
4. **Build migration script** - Automate matching and moving
5. **Run migration** - Start with kitchen jobs (clear naming)
6. **Enable RevitTab** on migrated jobs
7. **Delete `rob fix/`** when confirmed empty

---

## Commands Reference

### Check Job 69 Revit folder contents
```bash
heroku run 'rails runner "
  job = Job.find(69)
  cred = MicrosoftCredential.sharepoint_credential
  client = MicrosoftGraphClient.new(cred)
  items = client.list_folder_items(job.sharepoint_folder_id)
  revit = items[\"value\"].find { |i| i[\"name\"] == \"Revit\" }
  contents = client.list_folder_items(revit[\"id\"])
  contents[\"value\"].each { |i| puts i[\"name\"] }
"' --app teeemlive
```

### Move file between folders
```bash
# Get drive_id first, then:
response = HTTP.auth("Bearer #{token}")
  .headers("Content-Type" => "application/json")
  .patch(
    "https://graph.microsoft.com/v1.0/drives/#{drive_id}/items/#{file_id}",
    json: { parentReference: { id: dest_folder_id } }
  )
```

### Delete empty folder
```bash
HTTP.auth("Bearer #{token}")
  .delete("https://graph.microsoft.com/v1.0/drives/#{drive_id}/items/#{folder_id}")
```

---

## Notes
- Large RVT files (297MB+) move quickly via Graph API - no chunking needed for move operations
- The RevitTab caches folder contents for 5 minutes - use refresh button after changes
- `is_cad_category` takes precedence over `is_photo_category` in tab rendering
