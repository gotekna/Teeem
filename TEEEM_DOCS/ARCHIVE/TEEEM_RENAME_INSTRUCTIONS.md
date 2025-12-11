# TEEEM Rename - External Services Instructions

## Overview

The codebase has been fully renamed from **Trapid** to **TEEEM**. The following external services need to be renamed by their respective owners/admins.

**Branch with changes:** `rob`
**Commits:** `cdbf2c4c` (main rename), `83d0aac2` (migration fix)

---

## 1. Heroku App Rename

**Required by:** jake@tekna.com.au (app owner)

### Steps:

```bash
# Login to Heroku (if not already)
heroku login

# Rename the app
heroku apps:rename teeem-backend --app trapid-backend
```

### What this changes:
- App name: `trapid-backend` → `teeem-backend`
- Git URL: `https://git.heroku.com/trapid-backend.git` → `https://git.heroku.com/teeemlive.git`
- App URL: `https://trapid-backend-XXXXX.herokuapp.com` → `https://teeem-backend-XXXXX.herokuapp.com`

### After Heroku rename:

Everyone on the team needs to update their local git remote:

```bash
git remote set-url heroku https://git.heroku.com/teeemlive.git
```

---

## 2. GitHub Repository Rename

**Required by:** gotekna organization admin

### Steps:

1. Go to https://github.com/gotekna/trapid
2. Click **Settings** (gear icon)
3. Under "Repository name", change `trapid` to `teeem`
4. Click **Rename**

### What this changes:
- Repo URL: `github.com/gotekna/trapid` → `github.com/gotekna/teeem`
- Clone URL: `https://github.com/gotekna/trapid.git` → `https://github.com/gotekna/teeem.git`

### After GitHub rename:

Everyone on the team needs to update their local git remote:

```bash
git remote set-url origin https://github.com/gotekna/teeem.git
```

**Note:** GitHub will automatically redirect the old URL for a period of time, but it's best to update immediately.

---

## 3. Vercel Project Rename

**Required by:** Vercel project admin

### Steps:

1. Go to https://vercel.com (login)
2. Select the trapid/frontend project
3. Go to **Settings** → **General**
4. Under "Project Name", change to `teeem` or `teeem-frontend`
5. Save changes

### Optional - Custom Domain:
If using a custom domain, update DNS records if needed.

---

## 4. Post-Rename Checklist

After all external services are renamed, verify:

- [ ] Heroku app accessible at new URL
- [ ] GitHub Actions workflows run successfully
- [ ] Vercel deployments work
- [ ] API endpoints responding correctly
- [ ] Frontend can connect to backend

---

## 5. Database Migration

The database migration will run automatically on deploy. It renames:

| Old Column | New Column | Table |
|------------|------------|-------|
| `trapid_rating` | `teeem_rating` | contacts |
| `trapid_has` | `teeem_has` | feature_trackers |

**Manual verification after deploy:**

```bash
heroku run rails runner "puts Contact.column_names.grep(/teeem/)" --app teeemlive
# Should output: teeem_rating

heroku run rails runner "puts FeatureTracker.column_names.grep(/teeem/)" --app teeemlive
# Should output: teeem_has
```

---

## 6. Update Database Content (Optional)

If Trinity documentation exists in the database, run:

```bash
heroku run rails teeem:rename_content --app teeemlive
```

This updates any "Trapid" references in:
- DocumentationEntry records
- Rule records
- AgentDefinition records
- FeatureTracker feature names

---

## 7. Environment Variables to Check

After Heroku rename, verify these env vars are updated (if they reference the old URL):

| Variable | Old Value | New Value |
|----------|-----------|-----------|
| `VITE_API_URL` | `https://trapid-backend-XXX.herokuapp.com` | `https://teeem-backend-XXX.herokuapp.com` |
| Any webhook URLs | trapid-backend | teeem-backend |

---

## 8. Third-Party Integrations

Check if these need URL updates:

- [ ] **Xero** - OAuth callback URLs
- [ ] **OneDrive/Azure** - Redirect URIs
- [ ] **Sentry** - Project names (optional)
- [ ] **Any webhooks** pointing to old Heroku URL

---

## Questions?

Contact the developer who performed the rename or check the commit history:

```bash
git log --oneline | head -5
```

---

## Rollback (Emergency Only)

If something goes wrong:

1. **Heroku:** `heroku apps:rename trapid-backend --app teeemlive`
2. **GitHub:** Rename back to `trapid` in settings
3. **Code:** `git revert 83d0aac2 cdbf2c4c`

The database migration is reversible - Rails will rename columns back if rolled back.
