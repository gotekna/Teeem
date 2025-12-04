# SharePoint Folder Mapping Summary

## ✅ Completed Actions

All companies have been mapped to their correct SharePoint folders in the database.

## 📁 Folder Structure

### Co Invest Group
- **Co Invest Capital Pty Ltd** → `Co Invest Group/Co Invest Capital`
- **Co Invest Homes Pty Ltd** → `Co Invest Group/Co Invest Homes`

### Team Harder Group
- **Gen2612** → `Team Harder Group/Gen2612`
- **Prov1322 Global** → `Team Harder Group/Prov1322 Global`
- **Prov1322 Global ATF Team Harder Family Trust** → `Team Harder Group/Prov1322 Global`
- **Rachel Harder** → `Team Harder Group/Rachel`
- **Robert Harder** → `Team Harder Group/Robert`
- **Team Harder** (Family Trust) → `Team Harder Group/Team Harder Family Trust`

### Team Harder Super Fund
- **Team Harder ATF Team Harder Super Fund** → `Team Harder Super Fund/Team Harder`
- **Team Harder Super Investments** → `Team Harder Super Fund/Team Harder Super Investments`

### Tekna Group
- **Tekna** → `Tekna Group/Tekna`
- **Tekna Admin Pty LTd** → `Tekna Group/Tekna Admin`
- **Tekna Drafting (formerly Rock Invest Qld)** → `Tekna Group/Tekna Drafting`
- **Tekna Homes formerly Tekna Licence** → `Tekna Group/Tekna Homes`

### Individual Trusts & Entities
- **The Promise QLD Pty Ltd** → `The Promise Family Trust`
- **The Promise Family Trust** → `The Promise Family Trust`
- **W2G Assets** → `W2G Assets`

### Individual Family Members (No dedicated folders)
- **Jared Harder** → No folder
- **Grace Harder** → No folder
- **Sophie Mee-Jeong Harder** → No folder

## 🗑️ Folders to Clean Up

### Old/Incorrect Folders
**Tekna Group-DESKTOP-T134KRR/Tekna Pty Ltd**
- This folder contains old files with a desktop machine name in the path
- Files should be migrated to: `Tekna Group/Tekna`
- Can be deleted after migration is complete

## 🔧 Technical Details

### Database Field
Each company now has a `sharepoint_folder_name` field that contains the relative path from the "Corporate File" folder.

### URL Generation
The `sharepoint_folder_url` method on the Company model:
- Takes the `sharepoint_folder_name` value
- URL encodes it properly
- Returns a full SharePoint URL

Example:
```ruby
company.sharepoint_folder_name
# => "Tekna Group/Tekna Drafting"

company.sharepoint_folder_url
# => "https://gotekna.sharepoint.com/sites/TEEEM/Shared Documents/Corporate File/Tekna%20Group%2FTekna%20Drafting"
```

### Frontend Display
Companies page now shows clickable SharePoint folder links when available.

## 📊 Current State (v847)

All mappings are live in staging (teeem-rob-dev). Companies with mapped folders will show SharePoint links in the UI.

## 🚀 Next Steps

1. ✅ **Verify in UI** - Check company pages show correct SharePoint links
2. ⚠️ **Migrate files** - Move files from "Tekna Group-DESKTOP-T134KRR" to "Tekna Group/Tekna"
3. 🗑️ **Delete old folder** - Remove "Tekna Group-DESKTOP-T134KRR" folder after migration
