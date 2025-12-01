# Deploy Live Branch to Production

**Shortcut:** `/l` (Live to Production)

Deploys the `Live` branch backend to production Heroku (`teeemlive`) using git subtree.

## 🔴 PRODUCTION DEPLOY - USE WITH CAUTION

This deploys directly to **PRODUCTION**:
- Backend: https://teeemlive-ce8e2660a615.herokuapp.com/
- Frontend: https://teeemlive.vercel.app/

## Instructions

### Step 1 - Confirm on Live Branch
```bash
git checkout Live
git pull origin Live
```

### Step 2 - Deploy Backend to Production via Git Subtree

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-live-deploy
git push heroku-teeemlive temp-live-deploy:main --force
git branch -D temp-live-deploy
```

### Step 3 - Verify Deploy
```bash
sleep 10
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version
```

### Step 4 - Report Status
- ✅ Branch: Live
- ✅ Backend deployed to: teeemlive (production)
- ✅ Version: [version from /version endpoint]
- ✅ Backend URL: https://teeemlive-ce8e2660a615.herokuapp.com/
- ✅ Frontend URL: https://teeemlive.vercel.app/

## Heroku Remote Setup

The `heroku-teeemlive` remote must be configured:
```bash
git remote add heroku-teeemlive https://git.heroku.com/teeemlive.git
```

Verify with: `git remote -v | grep teeemlive`
