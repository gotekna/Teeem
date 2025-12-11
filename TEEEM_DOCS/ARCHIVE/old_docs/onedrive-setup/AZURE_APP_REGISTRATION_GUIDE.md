# OneDrive Integration Setup Guide - Azure App Registration

This guide will walk you through setting up a Microsoft Azure App Registration for TEEEM's OneDrive integration.

## Prerequisites

- A Microsoft account with access to Azure Portal
- Admin permissions in your Microsoft 365 organization (if using business OneDrive)
- Approximately 15-20 minutes

---

## Step 1: Access Azure Portal

1. Go to **https://portal.azure.com**
2. Sign in with your Microsoft account
3. If prompted, select your organization/tenant

---

## Step 2: Navigate to App Registrations

1. In the search bar at the top, type **"App registrations"**
2. Click on **"App registrations"** from the results
3. Click the **"+ New registration"** button at the top

---

## Step 3: Register the Application

### Basic Information:

**Name:**
```
TEEEM Document Management
```

**Supported account types:**
- Select: **"Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**
- ℹ️ This allows both business and personal OneDrive accounts

**Redirect URI:**
- Platform: Select **"Web"**
- URI: Enter the following based on your environment:

For **Production** (Heroku):
```
https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/onedrive/callback
```

For **Local Development**:
```
http://localhost:3001/api/v1/onedrive/callback
```

> **Note:** You can add multiple redirect URIs later. For now, add the production URL.

Click **"Register"** button at the bottom.

---

## Step 4: Save the Application (Client) ID

After registration, you'll see the app overview page.

**IMPORTANT:** Copy and save these values immediately:

1. **Application (client) ID**
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - This is your `ONEDRIVE_CLIENT_ID`
   - Save this in a secure location (password manager, secure notes)

2. **Directory (tenant) ID**
   - Also visible on the overview page
   - Save this as well (may be needed later)

---

## Step 5: Create a Client Secret

1. In the left sidebar, click **"Certificates & secrets"**
2. Click the **"+ New client secret"** button
3. Add a description:
   ```
   TEEEM Production Secret
   ```
4. Set expiration: **"24 months"** (recommended)
   - ⚠️ You'll need to rotate this secret before it expires
5. Click **"Add"**

6. **CRITICAL - COPY NOW:** The secret value will only be shown ONCE
   - Copy the **"Value"** (NOT the "Secret ID")
   - Format: Long string like `abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - This is your `ONEDRIVE_CLIENT_SECRET`
   - Store this in a VERY secure location
   - ⚠️ If you lose this, you'll need to generate a new secret

---

## Step 6: Configure API Permissions

1. In the left sidebar, click **"API permissions"**
2. You'll see "Microsoft Graph" with "User.Read" already added
3. Click **"+ Add a permission"**

### Add Microsoft Graph Permissions:

4. Click **"Microsoft Graph"**
5. Click **"Delegated permissions"**
6. Search for and select the following permissions:

   ✅ **Files.ReadWrite.All**
   - Description: "Have full access to all files user can access"
   - Required for: Creating folders, uploading/downloading files

   ✅ **Sites.ReadWrite.All** (Optional - for SharePoint)
   - Description: "Edit or delete items in all site collections"
   - Required for: SharePoint document libraries (if using SharePoint instead of OneDrive)

   ✅ **offline_access**
   - Description: "Maintain access to data you have given it access to"
   - Required for: Refresh tokens (stay logged in)

7. Click **"Add permissions"** at the bottom

### Grant Admin Consent (If Required):

8. If you're using a business Microsoft 365 account, you may need admin consent:
   - Click the **"Grant admin consent for [Your Organization]"** button
   - Confirm by clicking **"Yes"**
   - All permissions should now show a green checkmark

> **Note:** If you don't have admin rights, send this page to your IT admin and ask them to grant consent.

---

## Step 7: Add Additional Redirect URIs (Optional)

If you need to support both local development and production:

1. In the left sidebar, click **"Authentication"**
2. Under "Web" platform, click **"Add URI"**
3. Add the local development URL:
   ```
   http://localhost:3001/api/v1/onedrive/callback
   ```
4. If you're using Vercel for frontend:
   ```
   https://teeem.vercel.app/settings/onedrive/callback
   ```
5. Click **"Save"** at the bottom

---

## Step 8: Verify Configuration

Your app registration should now have:

✅ Application (client) ID - Copied and saved
✅ Client secret - Copied and saved
✅ Redirect URI(s) configured
✅ API Permissions added:
   - User.Read
   - Files.ReadWrite.All
   - Sites.ReadWrite.All (optional)
   - offline_access
✅ Admin consent granted (if applicable)

---

## Step 9: Provide Credentials to Development Team

Send the following information **SECURELY** to the development team:

```
ONEDRIVE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONEDRIVE_CLIENT_SECRET=abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ONEDRIVE_REDIRECT_URI=https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/onedrive/callback
```

⚠️ **Security Notes:**
- DO NOT send these via regular email
- Use a secure password sharing service (1Password, LastPass, etc.)
- Or use encrypted messaging
- Never commit these to Git repositories
- These credentials give access to OneDrive files - treat them like passwords!

---

## Step 10: Testing the Integration

Once the development team has configured the credentials:

1. Go to TEEEM Settings → Integrations
2. You should see a "Connect to OneDrive" button
3. Click it and sign in with your Microsoft account
4. Authorize the app to access your files
5. You should be redirected back to TEEEM with a success message

---

## Troubleshooting

### "Redirect URI mismatch" Error
- Ensure the redirect URI in Azure matches exactly what's configured in the app
- Check for http vs https
- Check for trailing slashes

### "Admin consent required" Error
- Your organization requires admin approval for this app
- Contact your IT admin to grant consent in Step 6

### "Invalid client secret" Error
- The client secret may have expired
- Generate a new secret in Step 5
- Update the credentials with the development team

### "Insufficient permissions" Error
- Ensure all permissions from Step 6 are added
- Ensure admin consent is granted if required

---

## Maintenance

### Secret Rotation:
- Client secrets expire after the period you selected (e.g., 24 months)
- Set a calendar reminder to rotate the secret 1 month before expiration
- Generate a new secret following Step 5
- Update the app configuration with the new secret
- The old secret will continue to work until you delete it or it expires

### Monitoring:
- Azure Portal → App registrations → Your app → "Sign-ins"
- Monitor authentication failures and usage patterns

---

## Additional Resources

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [OneDrive API Reference](https://docs.microsoft.com/en-us/onedrive/developer/)
- [Azure App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

## Support

If you encounter issues during setup:
1. Check the Troubleshooting section above
2. Verify all steps were followed exactly
3. Check Azure Portal for any error messages
4. Contact the TEEEM development team

---

**Setup Date:** _________________

**Completed By:** _________________

**Client ID:** _________________

**Secret Expiration:** _________________
