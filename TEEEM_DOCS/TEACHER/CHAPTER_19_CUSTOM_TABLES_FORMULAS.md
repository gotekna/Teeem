# TEEEM TEACHER - Chapter 19: Custom Tables & Formulas

**Last Updated:** 2025-11-20 10:09 AEST
**Authority Level:** Reference (HOW to implement Bible rules)
**Audience:** Claude Code + Human Developers

---

## 📚 Navigation

**Other Teacher Chapters:**
- [Main Teacher Index](../TEEEM_TEACHER.md)

**Related Documentation:**
- 📖 [TEEEM Bible (Rules)](../TEEEM_BIBLE.md)
- 📕 [TEEEM Lexicon (Bug History)](../TEEEM_LEXICON.md)
- 📘 [User Manual](../TEEEM_USER_MANUAL.md)

---

## Chapter 19: Custom Tables & Formulas

## §T19.001: Column Type: Single line text

📚 Reference

### Step-by-Step Guide
Frontend Value: single_line_text. Display Label: Single line text. SQL Mapping: VARCHAR(255)

### Description
Single line text (single_line_text) - Short text (up to 255 characters). Category: Text. SQL Type: VARCHAR(255). Validation Rules: Optional text field, max 255 characters, alphanumeric. Example: CONC-001, STL-042A. Used For: Unique identifier code for inventory


## §T19.002: Column Type: Long text

📚 Reference

### Step-by-Step Guide
Frontend Value: multiple_lines_text. Display Label: Long text. SQL Mapping: TEXT

### Description
Long text (multiple_lines_text) - Multi-line text field. Category: Text. SQL Type: TEXT. Validation Rules: Optional text field, supports line breaks. Example: Additional notes, second line, third line. Used For: Notes, comments, multi-line descriptions


## §T19.003: Column Type: Email

📚 Reference

### Step-by-Step Guide
Frontend Value: email. Display Label: Email. SQL Mapping: VARCHAR(255)

### Description
Email (email) - Email address. Category: Text. SQL Type: VARCHAR(255). Validation Rules: Must contain @ symbol, valid email format. Example: supplier@example.com, contact@business.com.au. Used For: Email addresses for contacts


## §T19.004: Column Type: Phone number

📚 Reference

### Step-by-Step Guide
Frontend Value: phone. Display Label: Phone number. SQL Mapping: VARCHAR(20)

### Description
Phone number (phone) - Phone number. Category: Text. SQL Type: VARCHAR(20). Validation Rules: Format: (03) 9123 4567 or 1300 numbers. Example: (03) 9123 4567, 1300 123 456. Used For: Landline phone numbers


## §T19.005: Column Type: Mobile

📚 Reference

### Step-by-Step Guide
Frontend Value: mobile. Display Label: Mobile. SQL Mapping: VARCHAR(20)

### Description
Mobile (mobile) - Mobile phone number. Category: Text. SQL Type: VARCHAR(20). Validation Rules: Format: 0407 397 541, starts with 04. Example: 0407 397 541, 0412 345 678. Used For: Mobile phone numbers


## §T19.006: Column Type: URL

📚 Reference

### Step-by-Step Guide
Frontend Value: url. Display Label: URL. SQL Mapping: VARCHAR(500)

### Description
URL (url) - Website URL. Category: Text. SQL Type: VARCHAR(500). Validation Rules: Valid URL format, clickable in table. Example: https://example.com/doc.pdf. Used For: Links to external documents or files


## §T19.007: Column Type: Number

📚 Reference

### Step-by-Step Guide
Frontend Value: number. Display Label: Number. SQL Mapping: INTEGER

### Description
Number (number) - Decimal number. Category: Numbers. SQL Type: INTEGER. Validation Rules: Positive integers, shows sum in footer. Example: 10, 250, 15. Used For: Quantity of items


## §T19.008: Column Type: Whole number

📚 Reference

### Step-by-Step Guide
Frontend Value: whole_number. Display Label: Whole number. SQL Mapping: INTEGER

### Description
Whole number (whole_number) - Integer number. Category: Numbers. SQL Type: INTEGER. Validation Rules: Integers only (no decimals), shows sum. Example: 5, 100, 42. Used For: Counts, units, days - no fractional values


## §T19.009: Column Type: Currency

📚 Reference

### Step-by-Step Guide
Frontend Value: currency. Display Label: Currency. SQL Mapping: DECIMAL(10,2)

### Description
Currency (currency) - Money amount. Category: Numbers. SQL Type: DECIMAL(10,2). Validation Rules: Positive numbers, 2 decimal places, shows sum in footer. Example: $125.50, $1,234.99. Used For: Price in Australian dollars


## §T19.010: Column Type: Percent

📚 Reference

### Step-by-Step Guide
Frontend Value: percentage. Display Label: Percent. SQL Mapping: DECIMAL(5,2)

### Description
Percent (percentage) - Percentage value. Category: Numbers. SQL Type: DECIMAL(5,2). Validation Rules: 0-100, displayed with % symbol. Example: 10.5%, 25%, 0%. Used For: Discount percentage for pricing


## §T19.011: Column Type: Date

📚 Reference

### Step-by-Step Guide
Frontend Value: date. Display Label: Date. SQL Mapping: DATE

### Description
Date (date) - Date only. Category: Date & Time. SQL Type: DATE. Validation Rules: Format: YYYY-MM-DD, no time component. Example: 2025-11-19, 1990-01-15. Used For: Date values without time, for contracts, events, start dates


## §T19.012: Column Type: Date & Time

📚 Reference

### Step-by-Step Guide
Frontend Value: date_and_time. Display Label: Date & Time. SQL Mapping: DATETIME

### Description
Date & Time (date_and_time) - Date and time. Category: Date & Time. SQL Type: DATETIME. Validation Rules: Auto-populated on creation, not editable. Example: 19/11/2024 14:30. Used For: Record creation timestamp


## §T19.013: Column Type: GPS Coordinates

📚 Reference

### Step-by-Step Guide
Frontend Value: gps_coordinates. Display Label: GPS Coordinates. SQL Mapping: VARCHAR(100)

### Description
GPS Coordinates (gps_coordinates) - Latitude and Longitude. Category: Special. SQL Type: VARCHAR(100). Validation Rules: Latitude, Longitude format. Example: -33.8688, 151.2093 (Sydney). Used For: GPS coordinates for job sites, delivery addresses, asset tracking


## §T19.014: Column Type: Color Picker

📚 Reference

### Step-by-Step Guide
Frontend Value: color_picker. Display Label: Color Picker. SQL Mapping: VARCHAR(7)

### Description
Color Picker (color_picker) - Hex color code. Category: Special. SQL Type: VARCHAR(7). Validation Rules: Hex color format (#RRGGBB). Example: #FF5733, #3498DB, #000000. Used For: Visual categorization, status indicators, UI customization


## §T19.015: Column Type: File Upload

📚 Reference

### Step-by-Step Guide
Frontend Value: file_upload. Display Label: File Upload. SQL Mapping: TEXT

### Description
File Upload (file_upload) - File attachment reference. Category: Special. SQL Type: TEXT. Validation Rules: File path or URL to uploaded file. Example: /uploads/doc.pdf, https://example.com/file.png. Used For: File references, document links, image paths


## §T19.016: Column Type: Checkbox

📚 Reference

### Step-by-Step Guide
Frontend Value: boolean. Display Label: Checkbox. SQL Mapping: BOOLEAN

### Description
Checkbox (boolean) - True/false value. Category: Selection. SQL Type: BOOLEAN. Validation Rules: True or False only. Example: true, false. Used For: Active/inactive status flag


## §T19.017: Column Type: Single select

📚 Reference

### Step-by-Step Guide
Frontend Value: choice. Display Label: Single select. SQL Mapping: VARCHAR(50)

### Description
Single select (choice) - Select one option from a list. Category: Selection. SQL Type: VARCHAR(50). Validation Rules: Limited options: active, inactive (with colored badges). Example: active (green), inactive (red). Used For: Status with visual indicators


## §T19.018: Column Type: Link to another record

📚 Reference

### Step-by-Step Guide
Frontend Value: lookup. Display Label: Link to another record. SQL Mapping: VARCHAR(255)

### Description
Link to another record (lookup) - Link to records in another table. Category: Relationships. SQL Type: VARCHAR(255). Validation Rules: Must match predefined category list. Example: Concrete, Timber, Steel, Plasterboard. Used For: Material type classification


## §T19.019: Column Type: Link to multiple records

📚 Reference

### Step-by-Step Guide
Frontend Value: multiple_lookups. Display Label: Link to multiple records. SQL Mapping: TEXT

### Description
Link to multiple records (multiple_lookups) - Link to multiple records. Category: Relationships. SQL Type: TEXT. Validation Rules: Array of IDs stored as JSON. Example: [1, 5, 12]. Used For: Multiple relationships to other records


## §T19.020: Column Type: User

📚 Reference

### Step-by-Step Guide
Frontend Value: user. Display Label: User. SQL Mapping: INTEGER

### Description
User (user) - Link to a user. Category: Relationships. SQL Type: INTEGER. Validation Rules: Must reference valid user ID. Example: User #7, User #1. Used For: Assignment to users, ownership tracking


## §T19.021: Column Type: Formula

📚 Reference

### Step-by-Step Guide
Frontend Value: computed. Display Label: Formula. SQL Mapping: COMPUTED

### Description
Formula (computed) - Calculated value based on other fields. Category: Computed. SQL Type: COMPUTED. Validation Rules: Formula: price × quantity, read-only, shows sum. Example: $1,255.00 (from $125.50 × 10). Used For: Automatic calculations from other columns



---

**Last Generated:** 2025-11-20 10:09 AEST
**Generated By:** `scripts/generate_teacher_chapters.rb`
**Maintained By:** Development Team via Database UI