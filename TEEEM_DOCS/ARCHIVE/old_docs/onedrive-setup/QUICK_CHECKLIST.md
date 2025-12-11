# OneDrive Azure Setup - Quick Checklist

**Time Required:** ~15 minutes

## Quick Steps

### 1. Azure Portal Access
- [ ] Go to https://portal.azure.com
- [ ] Sign in with Microsoft account

### 2. Create App Registration
- [ ] Search "App registrations" → New registration
- [ ] Name: `TEEEM Document Management`
- [ ] Account type: Multitenant + personal accounts
- [ ] Redirect URI: `https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/onedrive/callback`
- [ ] Click Register

### 3. Save Application ID
- [ ] Copy **Application (client) ID** → Save securely
  ```
  ONEDRIVE_CLIENT_ID=____________________________________
  ```

### 4. Create Client Secret
- [ ] Go to "Certificates & secrets"
- [ ] New client secret → Description: "TEEEM Production"
- [ ] Expiration: 24 months
- [ ] Copy **Value** immediately (only shown once!) → Save securely
  ```
  ONEDRIVE_CLIENT_SECRET=_______________________________
  ```

### 5. Add API Permissions
- [ ] Go to "API permissions"
- [ ] Add permission → Microsoft Graph → Delegated
- [ ] Add: `Files.ReadWrite.All`
- [ ] Add: `Sites.ReadWrite.All` (optional)
- [ ] Add: `offline_access`
- [ ] Click "Grant admin consent" (if available)

### 6. Send Credentials Securely
- [ ] Send Client ID and Secret to dev team via secure method
- [ ] DO NOT email or commit to Git!

---

## What You'll Get

After setup, you'll have these three values:

```
ONEDRIVE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONEDRIVE_CLIENT_SECRET=abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ONEDRIVE_REDIRECT_URI=https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/onedrive/callback
```

---

## Important Notes

⚠️ **Client Secret is shown only ONCE** - copy it immediately
⚠️ **Never commit these to Git**
⚠️ **Set calendar reminder for secret expiration (24 months)**
✅ **If you lose the secret, you can create a new one**

---

## Next Steps After Setup

Once credentials are configured:
1. Dev team will implement the integration
2. You'll test by clicking "Connect to OneDrive" in TEEEM Settings
3. Sign in with your Microsoft account
4. Authorize TEEEM to access files
5. Done! OneDrive folders will auto-create for new jobs

---

**Need detailed instructions?** See `AZURE_APP_REGISTRATION_GUIDE.md`
