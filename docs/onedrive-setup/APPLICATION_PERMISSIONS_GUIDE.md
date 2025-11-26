# Azure App - Switching to Application Permissions

## Overview

You've already set up your Azure app with **Delegated permissions**, but for organization-wide OneDrive access (no manual approvals per job), you need to switch to **Application permissions**.

**Time Required:** 5 minutes

---

## What's the Difference?

| Delegated Permissions | Application Permissions |
|----------------------|------------------------|
| Acts on behalf of a signed-in user | Acts as the application itself |
| Requires user to click "Connect" per job | No user interaction after setup |
| User sees consent screen | Admin grants consent once |
| Good for: Per-user features | Good for: Organization-wide features |

---

## Step-by-Step Guide

### 1. Go to Your Existing App Registration

1. Navigate to https://portal.azure.com
2. Search for "App registrations"
3. Click on your app: **TEEEM Document Management**

### 2. Remove Delegated Permissions

1. Click "API permissions" in the left sidebar
2. You should see these **Delegated** permissions:
   - `Files.ReadWrite.All`
   - `offline_access` (if you added it)
3. Click the "..." menu next to each permission
4. Select "Remove permission"
5. Confirm removal

### 3. Add Application Permissions

1. Click "Add a permission"
2. Select "Microsoft Graph"
3. **Important:** Click "Application permissions" (NOT Delegated permissions)
4. Search for and check:
   - ☑️ `Files.ReadWrite.All`
5. Click "Add permissions" at the bottom

### 4. Grant Admin Consent ⭐ (CRITICAL STEP)

**This is the most important step!**

1. You should see your new permission with a warning icon
2. Click the **"Grant admin consent for [Your Organization]"** button
3. Click "Yes" to confirm
4. The status should change from "Not granted" to "Granted for [Your Organization]" with a green checkmark

✅ **Done!** Your app now has organization-wide access.

---

## Verify Setup

Your API permissions should now show:

| Permission | Type | Status |
|-----------|------|--------|
| Files.ReadWrite.All | Application | ✅ Granted for [Org Name] |

---

## What Happens Next?

1. **In TEEEM Settings:**
   - Admin clicks "Connect OneDrive"
   - Connection happens instantly (no user consent screen!)
   - All jobs immediately have OneDrive access

2. **For Any Job:**
   - Go to Documents tab
   - Click "Create Folder Structure"
   - Done! No approvals needed

---

## Troubleshooting

### Error: "Admin consent required"

**Solution:** Make sure you clicked "Grant admin consent" in Step 4 above. Only organization admins can do this.

### Error: "Insufficient privileges"

**Solution:**
1. Verify you added **Application** permissions (not Delegated)
2. Verify admin consent was granted (green checkmark)
3. Wait 5 minutes for Azure to propagate changes

### Error: "Token request failed"

**Solution:**
1. Verify your Client ID and Client Secret are correct in Heroku
2. Make sure the secret hasn't expired (check expiration date in Azure)

---

## Security Notes

**Application permissions are more powerful than delegated permissions.** With this setup:

✅ **What your app CAN do:**
- Create folders in your organization's OneDrive
- Upload/download files to those folders
- Manage job-specific document structures

❌ **What your app CANNOT do:**
- Access personal OneDrive files outside the "TEEEM Jobs" folder
- Delete files (not implemented in the app)
- Access other Microsoft services (not granted)

The app only has `Files.ReadWrite.All`, which is limited to file operations.

---

## Need Help?

- **Azure Portal:** https://portal.azure.com
- **Microsoft Graph Docs:** https://learn.microsoft.com/en-us/graph/permissions-reference

---

## Summary Checklist

- [ ] Removed all Delegated permissions
- [ ] Added `Files.ReadWrite.All` as **Application** permission
- [ ] Clicked "Grant admin consent" button
- [ ] Verified green checkmark appears
- [ ] Tested connection in TEEEM Settings

Once all boxes are checked, you're ready to connect OneDrive in TEEEM!
