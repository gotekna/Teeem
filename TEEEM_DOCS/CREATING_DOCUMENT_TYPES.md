# Creating New DocumentTypes - Cheat Sheet

## Required Fields Checklist

When creating a new DocumentType, ensure ALL of these are set:

| Field | Example | Notes |
|-------|---------|-------|
| `name` | "Common Seal Register" | Unique, descriptive name |
| `abbreviation` | "CSR" | 2-4 letter code |
| `folder` | "ASIC" | Groups in UI (ASIC, GENERAL, MINUTES, etc.) |
| `category` | "company" | company, job, or contacts |
| `scope` | "company" | company, job, or contacts |
| `active` | true | Must be true to appear |
| `file_name` | "{CompanyCode} Common Seal Register" | File naming template |
| `entity_tab_ids` | [32] | Primary tab (use `sync_entity_tab_ids`) |
| `aliases` | ["seal register", "company seal"] | For smart matching |

## Quick Create Script

```ruby
# Find the target EntityTab first
asic_tab = EntityTab.find_by(tab_key: "asic")  # ID: 32 on production

# Create the DocumentType
dt = DocumentType.create!(
  name: "My New Type",
  abbreviation: "MNT",
  folder: "ASIC",
  category: "company",
  scope: "company",
  active: true,
  file_name: "{CompanyCode} My New Type {Date}",
  aliases: ["alias1", "alias2"]
)

# Set the primary tab (REQUIRED for UI grouping)
dt.sync_entity_tab_ids([asic_tab.id])

puts "Created: #{dt.name} (ID: #{dt.id})"
```

## Common EntityTab IDs (Production)

| Tab | ID | tab_key |
|-----|-----|---------|
| ASIC | 32 | asic |
| GENERAL | ? | general |
| MINUTES | ? | minutes |
| ASSETS | ? | assets |

*Run `EntityTab.where(scope: 'corporate_entity').pluck(:id, :tab_key, :display_name)` to get current list*

## File Name Placeholders

Common placeholders for `file_name` template:
- `{CompanyCode}` - Company code (e.g., "TEE")
- `{Date}` - Current date
- `{PersonName}` - Person's name
- `{Description}` - Custom description
- `{YY}` - 2-digit year

## Suggest API Integration

New types automatically work with the suggest API if you set `aliases`:

```
GET /api/v1/document_types/suggest?filename=Common%20Seal%20Register.docx
```

Returns matching types with confidence scores (100% exact, 90% alias, 80% pattern).

## Verification

After creating, verify:

```ruby
dt = DocumentType.find_by(name: "My New Type")
puts "Name: #{dt.name}"
puts "Active: #{dt.active}"
puts "Folder: #{dt.folder}"
puts "File Name: #{dt.file_name}"
puts "Entity Tabs: #{dt.entity_tab_ids}"
puts "Aliases: #{dt.aliases}"
```

## Bulk Create Example

```ruby
asic_tab = EntityTab.find_by(tab_key: "asic")

types = [
  { name: "Type A", abbr: "TA", aliases: ["type a"] },
  { name: "Type B", abbr: "TB", aliases: ["type b"] },
]

types.each do |t|
  dt = DocumentType.create!(
    name: t[:name],
    abbreviation: t[:abbr],
    folder: "ASIC",
    category: "company",
    scope: "company",
    active: true,
    file_name: "{CompanyCode} #{t[:name]} {Date}",
    aliases: t[:aliases]
  )
  dt.sync_entity_tab_ids([asic_tab.id])
  puts "Created: #{dt.name}"
end
```
