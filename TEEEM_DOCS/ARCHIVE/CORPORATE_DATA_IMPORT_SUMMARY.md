# Corporate Credentials Import Summary

## ✅ What Was Completed

### 1. Data Import (Local Database)
Successfully imported corporate credentials from `Corporate File.xlsx` → `All Companies` sheet:

**Fields Imported:**
- `corporate_key` ✓
- `asic_username` ✓
- `encrypted_asic_password` ✓ (stored unencrypted in dev)
- `recovery_question` ✓
- `encrypted_recovery_answer` ✓ (stored unencrypted in dev)

**Statistics:**
- ✅ 11 companies updated with credentials
- ⏭️ 10 companies skipped (no new data)
- ❌ 1 company not found ("Personal")

**Companies With Credentials:**
1. Gen2612
2. Prov1322 Global
3. Team Harder
4. Team Harder Super Investments
5. Tekna
6. Tekna Admin Pty Ltd
7. Tekna Drafting (formerly Rock Invest Qld)
8. Tekna Homes formerly Tekna Licence
9. The Promise QLD Pty Ltd
10. W2G Assets
11. Co Invest Capital Pty Ltd (partial - 4 fields)

### 2. Import Scripts Created
- **For Production/Staging:** `/backend/lib/tasks/import_corporate_credentials.rake`
  - Use: `heroku run rails corporate:import_credentials CORPORATE_FILE_PATH=/tmp/Corporate\ File.xlsx`
  - Requires proper encryption keys (available in Heroku)

- **For Development:** `/backend/tmp/import_credentials_sql.rb`
  - Use: `bin/rails runner tmp/import_credentials_sql.rb`
  - Bypasses encryption for local testing

### 3. API Endpoints Verified
The `/api/v1/companies/asic_logins` endpoint already returns:
- `corporate_key`
- `asic_username`
- `asic_password`
- `recovery_question`
- `recovery_answer`

### 4. Frontend Page Verified
The ASIC Logins page (`/corporate/asic-logins`) displays:
- Company name
- Company group
- ACN
- Corporate Key (with copy button)
- Username (with copy button)
- Password (with show/hide toggle)
- Recovery Q&A

## 🚀 Deployment Steps

### Option A: Deploy to Staging (Recommended)

Since you've already pushed to the `rob` branch, the data needs to be imported on staging:

```bash
# 1. Upload the Corporate File to Heroku staging
# (This needs to be done manually via Heroku CLI or web console)

# 2. SSH into Heroku and run the import
heroku run bash --app teeem-rob-dev
# Then in the Heroku console:
rails corporate:import_credentials CORPORATE_FILE_PATH=/app/Corporate\ File.xlsx

# 3. Verify the data
rails runner "puts Company.where.not(corporate_key: [nil, '']).count"
```

### Option B: Manual Entry via UI

If you prefer, you can manually enter the corporate keys via the ASIC Logins page:
1. Go to https://teeemrob.vercel.app/corporate/asic-logins
2. Click on each company
3. Edit the credentials fields

### Option C: API Import

Create a simple API script that reads the Excel file and POSTs the data via the API.

## 📊 Verification

To verify the import worked on staging:

```bash
# Check companies with corporate_key
heroku run rails runner "
  puts 'Companies with Corporate Key:'
  Company.where.not(corporate_key: [nil, '']).order(:name).each do |c|
    puts \"  - #{c.name}: #{c.corporate_key ? '[SET]' : '[BLANK]'}\"
  end
" --app teeem-rob-dev
```

## ⚠️ Important Notes

1. **Encryption:**
   - Local development stores passwords unencrypted (no master key)
   - Production/Staging properly encrypts sensitive fields
   - Never commit the master.key file to git

2. **Data Security:**
   - The Corporate File.xlsx contains sensitive credentials
   - Ensure it's not committed to git (already in .gitignore)
   - Only upload temporarily to Heroku, then delete

3. **Missing Companies:**
   - "Personal" was not found in the database
   - Individual people (Robert, Rachel, Jared, Grace, Sophie) had no credentials in the spreadsheet

## 📝 Next Steps

1. ✅ Local import complete
2. ⏳ Deploy/import to staging
3. ⏳ Verify data appears in UI at https://teeemrob.vercel.app/corporate/asic-logins
4. ⏳ Optional: Import to production when ready
