---
description: Fast deploy to teeem-sam-dev Heroku (backend only)
---

Deploy the backend to teeem-sam-dev Heroku app using the fast method:

1. Create a temporary git repo in the backend directory
2. Commit all changes
3. Force push to teeem-sam-dev Heroku
4. Clean up the temporary git repo
5. Show deployment summary with version and time

Use this command when you want to quickly deploy backend changes to your dev environment.

**Target:** teeem-sam-dev Heroku app
**Method:** Backend subdirectory deployment (git init → push → cleanup)
**Time:** ~2-3 minutes
