# TEEEM USER MANUAL

**Version:** 1.0.0
**Last Updated:** 2025-11-16 09:01 AEST
**Audience:** End Users (Non-Technical)

---

## Welcome to TEEEM!

This manual will guide you through using TEEEM's construction management features step-by-step.

**For Developers:**
- 📖 See [TEEEM_BIBLE.md](TEEEM_BIBLE.md) for technical rules
- 📕 See [TEEEM_LEXICON.md](TEEEM_LEXICON.md) for bug history

---

## Table of Contents

**Chapters follow your workflow from setup → job completion:**

- [Chapter 0: Getting Started](#chapter-0-getting-started)
- [Chapter 1: Logging In & User Profiles](#chapter-1-logging-in--user-profiles)
- [Chapter 2: Company Settings](#chapter-2-company-settings)
- [Chapter 3: Managing Contacts](#chapter-3-managing-contacts)
- [Chapter 4: Setting Up Price Books](#chapter-4-setting-up-price-books)
- [Chapter 5: Creating a New Job](#chapter-5-creating-a-new-job)
- [Chapter 6: Importing & Managing Estimates](#chapter-6-importing--managing-estimates)
- [Chapter 7: AI-Powered Plan Review](#chapter-7-ai-powered-plan-review)
- [Chapter 8: Generating Purchase Orders](#chapter-8-generating-purchase-orders)
- [Chapter 9: Building Construction Schedules](#chapter-9-building-construction-schedules)
- [Chapter 10: Daily Tasks & Checklists](#chapter-10-daily-tasks--checklists)
- [Chapter 11: Weather Tracking & Delays](#chapter-11-weather-tracking--delays)
- [Chapter 12: OneDrive File Management](#chapter-12-onedrive-file-management)
- [Chapter 13: Email Integration](#chapter-13-email-integration)
- [Chapter 14: Team Chat & SMS](#chapter-14-team-chat--sms)
- [Chapter 15: Xero Accounting Sync](#chapter-15-xero-accounting-sync)
- [Chapter 16: Payment Tracking](#chapter-16-payment-tracking)
- [Chapter 17: Workflow Automation](#chapter-17-workflow-automation)
- [Chapter 18: Custom Data Tables](#chapter-18-custom-data-tables)
- [Chapter 19: UI/UX Standards & Patterns](#chapter-19-uiux-standards--patterns)
- [Chapter 20: Corporate Module](#chapter-20-corporate-module)
- [Chapter 21: Work Health & Safety (WHS)](#chapter-21-work-health--safety-whs)
- [Chapter 22: Customer Portal](#chapter-22-customer-portal)
- [Chapter 23: File Warehouse](#chapter-23-file-warehouse)
- [Chapter 24: E-Signatures](#chapter-24-e-signatures)
- [Chapter 25: Data Warehouse & Reports](#chapter-25-data-warehouse--reports)

---

# Chapter 0: Getting Started

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 0 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 0 (Developers)  │
└─────────────────────────────────────────────────┘

## What is TEEEM?

TEEEM is a comprehensive construction management platform that helps you:
- ✅ Manage jobs from quote to completion
- ✅ Create and track construction schedules
- ✅ Generate purchase orders automatically
- ✅ Sync with your accounting software (Xero)
- ✅ Collaborate with your team
- ✅ Track project financials

## Quick Start (5 Minutes)

1. **Log in** to TEEEM
2. **Set up your company** (Settings → Company)
3. **Add contacts** (customers and suppliers)
4. **Create your first job**
5. **Import an estimate** or create one manually

**Ready to dive in?** Jump to [Chapter 1](#chapter-1-logging-in--user-profiles)

---

# Chapter 1: Logging In & User Profiles

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 1 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 1 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16 09:01 AEST

## Getting Started with TEEEM

Welcome to TEEEM! This chapter covers everything you need to log in, manage your profile, and understand user roles.

---

## Logging In

### Method 1: Email & Password (Standard Login)

1. **Navigate to TEEEM:**
   - Open your web browser
   - Go to `https://app.teeem.com` (or your company's custom URL)

2. **Enter your credentials:**
   - **Email:** Your work email address
   - **Password:** Your secure password (12+ characters)

3. **Click "Log In"**
   - You'll be redirected to the dashboard
   - Your session lasts 24 hours (auto-logout after)

**First time?** Click "Sign Up" to create your account.

---

### Method 2: Login with Microsoft (Recommended)

**Best for:** Users with Microsoft 365 accounts (Outlook, OneDrive)

1. **Click "Login with Microsoft"** on the login page
2. **Authenticate with Microsoft:**
   - Enter your Microsoft email
   - Enter your Microsoft password
   - Approve TEEEM access (first time only)
3. **Automatic redirect** to TEEEM dashboard
4. **Bonus:** Automatic OneDrive and Outlook integration

**Why use Microsoft login?**
- ✅ One less password to remember
- ✅ Automatic OneDrive folder creation for jobs
- ✅ Outlook email integration ready to go
- ✅ Same security as your Microsoft account

---

## Creating Your Account

**To sign up:**

1. **Click "Sign Up"** on the login page
2. **Fill in your details:**
   - **Name:** Your full name (e.g., "John Smith")
   - **Email:** Work email address (must be unique)
   - **Password:** Create a strong password (see requirements below)
   - **Mobile Phone** (optional): For SMS notifications
3. **Click "Create Account"**
4. **You're in!** Default role is "User" (your admin can upgrade you)

### Password Requirements

Your password MUST include:
- ✅ At least 12 characters
- ✅ 1 uppercase letter (A-Z)
- ✅ 1 lowercase letter (a-z)
- ✅ 1 number (0-9)
- ✅ 1 special character (!@#$%^&*)

**Example strong passwords:**
- `MyTEEEM2025!` ✅
- `Builder#Pass123` ✅
- `password123` ❌ (no uppercase, no special char)
- `Password123` ❌ (no special char)

**Pro Tip:** Use a passphrase like `Coffee&Donuts2025!` - easy to remember, very secure!

---

## Forgot Your Password?

**Don't worry, it happens!**

1. **Click "Forgot Password?"** on the login page
2. **Enter your email address**
3. **Click "Send Reset Link"**
4. **Check your email** (may take 1-2 minutes)
5. **Click the reset link** in the email
6. **Create a new password** (must meet requirements)
7. **Log in** with your new password

**Didn't receive the email?**
- Check your spam/junk folder
- Wait 5 minutes (server delays happen)
- Contact your system administrator
- Or ask an admin to reset your password manually

**Link expired?**
- Reset links expire after 2 hours for security
- Request a new link (it's instant!)

---

## Understanding User Roles

TEEEM has 6 user roles, each with different permissions:

### 👤 User (Default)
**What you can do:**
- View jobs and projects
- Access chat and documents
- View estimates and purchase orders
- Basic construction schedule viewing

**What you CAN'T do:**
- Create new jobs
- Approve purchase orders
- Edit construction schedules
- Manage users

**Best for:** General staff, office administrators

---

### 🔨 Builder
**What you can do:**
- Everything User can do, PLUS:
- View assigned construction tasks
- Update task progress
- Mark tasks complete
- Access builder-specific checklists

**What you CAN'T do:**
- Create schedules
- Approve POs
- Manage estimates

**Best for:** Site workers, tradespeople, construction crew

---

### 👷 Supervisor
**What you can do:**
- Everything User can do, PLUS:
- View all construction tasks on assigned projects
- Monitor progress across multiple tasks
- Access supervisor dashboard
- View builder assignments

**What you CAN'T do:**
- Edit schedules
- Approve POs
- Create estimates

**Best for:** Site supervisors, foremen, project leads

---

### 📊 Estimator
**What you can do:**
- Everything User can do, PLUS:
- Create and edit estimates
- Generate purchase orders from estimates
- Edit construction schedules
- Access price books

**What you CAN'T do:**
- Approve purchase orders (requires Manager/Admin)
- Create schedule templates

**Best for:** Estimators, project coordinators

---

### 📦 Product Owner
**What you can do:**
- Everything Estimator can do, PLUS:
- Create schedule templates
- Edit schedule templates
- View audit logs

**What you CAN'T do:**
- Manage users
- Change company settings

**Best for:** Project managers, senior estimators

---

### 👑 Admin
**What you can do:**
- **EVERYTHING** in the system, including:
- Manage users (create, edit, delete, change roles)
- Company settings and configuration
- All project management functions
- All construction management functions
- Full access to all data

**What you CAN'T do:**
- Nothing! Admins have complete access

**Best for:** System administrators, company owners, IT managers

---

## Managing Your Profile

### Viewing Your Profile

1. **Click your name** in the top right corner
2. **Select "My Profile"**
3. **View your details:**
   - Name
   - Email
   - Mobile phone
   - Role
   - Last login time

---

### Editing Your Profile

**You can change:**
- Your name
- Your mobile phone number
- Your password

**You CANNOT change:**
- Your email (contact admin if needed)
- Your role (only admins can change this)

**To update your profile:**

1. **Click your name** → "My Profile"
2. **Click "Edit Profile"**
3. **Update fields:**
   - Change name if needed
   - Update mobile phone
   - Leave password blank if not changing
4. **Click "Save Changes"**

**Result:** Profile updated instantly!

---

### Changing Your Password

**From your profile:**

1. **Go to "My Profile"** → "Edit Profile"
2. **Scroll to "Change Password" section**
3. **Enter your current password** (for security)
4. **Enter new password** (must meet requirements)
5. **Confirm new password** (type it again)
6. **Click "Update Password"**

**Result:** Password changed, you'll be logged out and must log in with new password.

**Security tip:** Change your password every 3-6 months!

---

## Managing Users (Admin Only)

**Only Admins can perform these actions.**

### Viewing All Users

1. **Click "Settings"** in main menu
2. **Select "Users"**
3. **See all users** with:
   - Name
   - Email
   - Role
   - Last login time
   - Mobile phone

**Filter by role:**
- Click role dropdown to filter (e.g., show only Admins)

---

### Creating a New User

1. **Go to Settings** → "Users"
2. **Click "+ New User"**
3. **Fill in details:**
   - Name
   - Email (must be unique)
   - Role (select from dropdown)
   - Mobile phone (optional)
   - Temporary password (user can change on first login)
4. **Click "Create User"**
5. **Share login details** with the new user

**Best practice:** Send them a temporary password via secure channel (not email!), ask them to change it on first login.

---

### Editing User Details

1. **Go to Settings** → "Users"
2. **Click the user's name**
3. **Click "Edit User"**
4. **Update details:**
   - Name
   - Email
   - Mobile phone
   - **Role** (change permissions!)
5. **Click "Save Changes"**

**Changing roles:**
- Upgrading User → Estimator: They can now create estimates
- Downgrading Admin → User: They lose all admin privileges (careful!)
- Role change is IMMEDIATE (user doesn't need to log out/in)

---

### Resetting a User's Password

**When a user forgets their password:**

1. **Go to Settings** → "Users"
2. **Click the user's name**
3. **Click "Reset Password"**
4. **Copy the reset link** (or click "Send Email" if configured)
5. **Share link with user** via secure channel
6. **User clicks link** → sets new password

**Security:** Reset links expire after 2 hours.

---

### Deactivating a User

**When someone leaves the company:**

1. **Go to Settings** → "Users"
2. **Click the user's name**
3. **Click "Deactivate User"**
4. **Confirm deletion**

**What happens:**
- User can no longer log in
- Their data (estimates, POs, chat messages) remains
- Their name shows as "Deactivated User" in historical records
- Can be re-activated later if needed

**Warning:** Cannot undo deletion easily. Consider just changing their role to "User" instead if you might need to re-enable access.

---

## Session & Security

### Auto-Logout

**Your session lasts 24 hours.**

After 24 hours of inactivity:
- You'll see "Unauthorized" error
- Click "Refresh" or navigate to login page
- Log in again to continue

**Why?**
- Security: Prevents unauthorized access on shared computers
- Compliance: Industry best practice

**Pro Tip:** Keep TEEEM tab open and active to avoid logout. But close it when stepping away from your computer!

---

### Security Best Practices

✅ **Do This:**
1. **Use a strong password** (12+ characters, mixed case, special chars)
2. **Don't share your password** (even with coworkers)
3. **Log out when leaving your computer** (or lock screen)
4. **Change password every 3-6 months**
5. **Use Microsoft login if available** (one less password to manage)
6. **Report suspicious activity** to your admin immediately

❌ **Avoid This:**
1. **Don't write password on sticky note** (seriously, don't!)
2. **Don't use same password as other sites** (breaches happen)
3. **Don't share your account** (get them their own account)
4. **Don't save password on shared computers** (only on your personal device)
5. **Don't ignore "Unauthorized" errors** (might indicate security issue)

---

## Troubleshooting Login Issues

### "Invalid email or password"

**Possible causes:**
- Wrong password (check caps lock!)
- Wrong email (try alternate email)
- Account doesn't exist (ask admin to create it)
- Password expired (should auto-prompt for reset, but ask admin if stuck)

**Solutions:**
1. Click "Forgot Password?" to reset
2. Double-check email spelling
3. Contact your admin to verify account exists

---

### "Account locked" (Supplier/Customer Portal Only)

**What it means:**
- Too many failed login attempts (5 attempts)
- Account temporarily locked for 30 minutes

**Solutions:**
1. Wait 30 minutes → try again
2. Contact company to unlock your account
3. Verify you're using correct password

**This doesn't happen to internal users** (Admins, Estimators, etc.) - only external portal users.

---

### "Session expired" or "Unauthorized"

**What it means:**
- Your 24-hour session timed out
- You need to log in again

**Solutions:**
1. Click "Refresh" or navigate to login page
2. Log in again with your credentials
3. Continue working

**Not a bug!** This is normal security behavior.

---

### Microsoft Login Not Working

**Possible issues:**
1. **Microsoft account not set up** - Contact IT to create Microsoft 365 account
2. **Permissions denied** - You must approve TEEEM access on first login
3. **Email mismatch** - Microsoft email must match TEEEM email
4. **Token expired** - Try logging out of Microsoft, then back in

**Solutions:**
- Log out of Microsoft completely → try again
- Use standard email/password login instead
- Contact admin if persists

---

### "Too Many Requests" Error

**What it means:**
- You tried logging in too many times too quickly
- Rate limit protection activated (5 attempts per 20 seconds)

**Solutions:**
1. Wait 20 seconds
2. Try logging in again
3. If you've forgotten password, click "Forgot Password?" instead of guessing

**Why this happens:**
- Security: Prevents brute force attacks
- You'll rarely see this unless trying many passwords quickly

---

## Frequently Asked Questions

### Can I have multiple accounts?

**No.** One account per person. If you need access to different roles, ask your admin to adjust your single account's role.

---

### Can I change my email address?

**No.** Email is your unique identifier. If your email changes (e.g., marriage, job change), contact your admin to update it manually.

---

### How long until my password expires?

**Never.** Passwords don't expire automatically in TEEEM. However, it's good practice to change them every 3-6 months.

---

### Can I use the same password on my phone?

**Yes!** TEEEM is mobile-friendly. Use the same login credentials on any device.

---

### What happens if I forget my password AND can't access my email?

**Contact your admin.** They can reset your password manually and share the new credentials with you securely.

---

### Can I login from multiple devices at once?

**Yes!** You can be logged in on your desktop, laptop, and phone simultaneously. All use the same 24-hour session token.

---

### Why does my session expire after 24 hours?

**Security best practice.** This prevents:
- Unauthorized access on shared computers
- Stale sessions lingering indefinitely
- Security breaches from stolen tokens

**Industry standard:** Most business apps use 12-24 hour sessions.

---

### Can I extend my session without logging out?

**Not currently.** Sessions are hard-limited to 24 hours. Just log in again when prompted - it's quick!

**Future feature:** Auto-refresh tokens to extend sessions indefinitely (coming soon).

---

### What's the difference between my role and my "assigned role"?

**Role:** Your permission level (Admin, Estimator, User, etc.)
**Assigned Role:** Your team/group assignment (Sales, Site, Supervisor, etc.)

- **Role** controls what you CAN do in the system
- **Assigned Role** is for filtering/grouping users (e.g., "Show all Sales users")

**Example:**
- Role: Estimator (can create estimates)
- Assigned Role: Sales (works on sales team)

---

### Can I delete my own account?

**No.** Only admins can delete accounts. Contact your admin if you need your account removed.

---

## Related Topics

- **Chapter 2: Company Settings** - Configure system-wide settings (Admin only)
- **Chapter 12: OneDrive Integration** - Using Microsoft login for automatic OneDrive access
- **Chapter 13: Outlook/Email Integration** - Connecting your Outlook account
- **Chapter 14: Chat & Communications** - Internal messaging system

---

# Chapter 2: Company Settings

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 2 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 2 (Developers)  │
└─────────────────────────────────────────────────┘

## What are Company Settings?

Company Settings control global configuration like working days, timezone, company details, and user management. These settings affect scheduling, time displays, and access permissions across the entire application.

**Who can access:** Admins and Product Owners only

---

## Getting Started

### Step 1: Access Settings

1. Click your **profile icon** (top-right)
2. Select **"Settings"** from dropdown
3. Go to **"Company"** tab (left sidebar)

You'll see two sub-tabs:
- **Company Info** - Company details, timezone, working days
- **Holidays** - Public holidays by region

---

### Step 2: Update Company Details

In the **Company Info** tab:

1. **Company Name** - Your business name
2. **ABN** - Australian Business Number (for Xero integration)
3. **Email** - Company contact email
4. **Phone** - Main phone number
5. **Address** - Company address

Click **"Save"** when done.

---

### Step 3: Set Your Timezone

**Important:** Timezone affects ALL date displays and schedule calculations.

1. Find **"Timezone"** dropdown
2. Select your region:
   - **Australia/Brisbane** - QLD (no daylight saving)
   - **Australia/Sydney** - NSW, ACT (daylight saving)
   - **Australia/Melbourne** - VIC (daylight saving)
   - **Australia/Adelaide** - SA (daylight saving)
   - **Australia/Perth** - WA (no daylight saving)
   - Plus 7 other Australian/NZ timezones
3. Click **"Save"**

**Result:** All dates and times now display in your selected timezone.

---

### Step 4: Configure Working Days

**Important:** Working days determine when tasks can be scheduled in the Gantt chart.

1. In **Company Info** tab, find **"Working Days"** section
2. Check boxes for days your crew works:
   - **Default:** Monday-Friday + Sunday
   - **Construction note:** Many crews work Sundays, skip Saturdays
3. Click **"Save"**

**Result:** Schedule Master won't schedule tasks on unchecked days (unless manually overridden with locks).

---

## Managing Users

### Add a New User

1. Click **profile icon** → **"Settings"**
2. Go to **"Users"** tab
3. Click **"Add User"** button
4. Fill in:
   - **Name** - Full name
   - **Email** - Login email (must be unique)
   - **Password** - Temporary password (12+ characters, mixed case, digit, special char)
   - **Role** - Permission level (see below)
   - **Assignable Role** - Task category (what tasks they see)
5. Click **"Save"**

**Password requirements:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character (@$!%*?&)

Example: `MyPassword123!`

---

### User Roles (Permissions)

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features |
| **Product Owner** | Full access + backlog management |
| **Estimator** | Create/edit estimates, schedules, quotes |
| **Supervisor** | Complete tasks, checklists (field work) |
| **Builder** | View/update assigned tasks |
| **User** | View-only access |

---

### Assignable Roles (Task Filtering)

**Separate from permission roles!** This controls which tasks a user sees:

| Assignable Role | Sees These Tasks |
|-----------------|------------------|
| **Admin** | All tasks |
| **Sales** | Sales-related tasks |
| **Site** | On-site construction tasks |
| **Supervisor** | Supervisor check-in tasks |
| **Builder** | Builder/contractor tasks |
| **Estimator** | Estimating/quoting tasks |
| **None** | No task assignment |

**Example:** User can be **Admin** (permission) + **Site** (sees site tasks).

---

### Edit a User

1. Go to **Settings** → **"Users"** tab
2. Find user in list
3. Click on any field to edit inline:
   - Name
   - Email
   - Role
   - Assignable Role
4. Press **Enter** or click outside field to save

---

### Reset User Password

**Note:** Email delivery not yet implemented. You must communicate new password manually.

1. Go to **Settings** → **"Users"** tab
2. Click user's **three-dot menu** (⋮)
3. Select **"Reset Password"**
4. Copy the temporary password shown
5. Communicate password to user via phone/Slack

**User must change password on next login.**

---

### Delete a User

1. Go to **Settings** → **"Users"** tab
2. Click user's **three-dot menu** (⋮)
3. Select **"Delete User"**
4. Confirm deletion

**Warning:** This cannot be undone. User's login will be disabled immediately.

---

## Public Holidays

### View Holidays

1. Go to **Settings** → **"Company"** → **"Holidays"** tab
2. See calendar of upcoming holidays by region:
   - QLD, NSW, VIC, SA, WA, TAS, NT, ACT
3. Filter by region using dropdown

**Purpose:** Schedule Master skips these dates when calculating task dates.

---

### Add Custom Holiday

If your region has a local holiday not in the system:

1. Go to **"Holidays"** tab
2. Click **"Add Holiday"** button
3. Fill in:
   - **Name** - "Local Show Day"
   - **Date** - Select from calendar
   - **Region** - Your state (QLD, NSW, etc.)
4. Click **"Save"**

**Result:** Tasks won't be scheduled on this date for jobs in that region.

---

## Troubleshooting

**Issue: Dates showing in wrong timezone**

**Cause:** Timezone setting doesn't match your location.

**Solution:**
- Go to **Settings** → **"Company"** → **"Company Info"**
- Update **Timezone** to your region
- Click **"Save"**
- Refresh browser

---

**Issue: Tasks being scheduled on weekends**

**Cause:** Working days include Saturday/Sunday.

**Solution:**
- Go to **Settings** → **"Company"** → **"Company Info"**
- Uncheck **Saturday** and/or **Sunday** in Working Days
- Click **"Save"**
- Re-run Gantt cascade (tasks will reschedule to working days)

---

**Issue: Can't create new user - password validation error**

**Cause:** Password doesn't meet complexity requirements.

**Solution:**
Ensure password has:
- At least 12 characters
- Uppercase + lowercase + digit + special character
- Example: `Construction2025!`

---

**Issue: User can't access Settings page**

**Cause:** User role is not Admin or Product Owner.

**Solution:**
- Only Admins and Product Owners can access Settings
- Go to **Settings** → **"Users"**
- Find user and change **Role** to **Admin**
- User must log out and back in to see Settings

---

## Related Topics

- **Chapter 9: Gantt & Schedule Master** - How working days affect scheduling
- **Chapter 11: Weather & Public Holidays** - Regional holidays integration
- **Chapter 1: Authentication & Users** - Login and user accounts

---

# Chapter 3: Managing Contacts

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 3 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 3 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16 09:01 AEST

## What are Contacts?

Contacts are the people and businesses you work with - customers, suppliers, sales reps, and land agents. TEEEM's contact system is flexible, allowing each contact to have multiple roles (for example, a business can be both a customer and a supplier).

**Key Features:**
- **Multi-role Contacts:** Mark contacts as customers, suppliers, or both
- **Xero Integration:** Automatic two-way sync with Xero accounting
- **Contact Relationships:** Link related businesses (parent companies, referrals, partners)
- **Portal Access:** Give suppliers and customers secure access to their information
- **Activity History:** Complete timeline of all interactions and changes

---

## Quick Start

### Adding a New Contact

1. Navigate to **Contacts** from the main menu
2. Click **+ New Contact**
3. Enter basic information:
   - Full name or company name
   - Email address
   - Phone number
   - Contact type (customer, supplier, or both)
4. Click **Save**

**Tip:** Add the ABN (Australian Business Number) if available - this helps prevent duplicates when syncing with Xero.

---

### Contact Types Explained

**Customer:**
- Businesses or people who hire you for construction projects
- Linked to jobs and estimates
- Can access customer portal to view project progress

**Supplier:**
- Vendors who provide materials or services
- Linked to purchase orders and pricebook items
- Can access supplier portal to view and manage POs

**Both (Customer + Supplier):**
- Common in construction (e.g., a plumber who both hires you and provides specialized services)
- Has access to all features for both roles

**Sales:**
- External sales representatives or agents
- Linked to customer relationships

**Land Agent:**
- Real estate agents or land developers
- Linked to property information

---

## Key Features

### Contact Relationships

Link related contacts to track business connections:

**How to Add a Relationship:**
1. Open a contact
2. Go to **Relationships** tab
3. Click **+ Add Relationship**
4. Select the related contact and relationship type:
   - Previous Client
   - Parent Company / Subsidiary
   - Partner
   - Referral
   - Other
5. Add optional notes
6. Click **Save**

Relationships are automatically bidirectional - adding "Company A → Parent of Company B" also creates "Company B → Subsidiary of Company A".

---

### Xero Sync

TEEEM automatically syncs contacts with Xero accounting software:

**What Syncs:**
- Contact names and company details
- Email addresses and phone numbers
- Banking details and payment terms
- Tax numbers (ABN/ACN)
- Contact groups from Xero

**How It Works:**
- **Automatic Matching:** TEEEM matches contacts by ABN, email, or name
- **Two-way Sync:** Changes in either system update the other
- **Manual Linking:** You can manually link contacts if auto-match doesn't work

**To Manually Link a Contact to Xero:**
1. Open the contact
2. Click **Link to Xero**
3. Search for the Xero contact
4. Click **Link**

---

### Portal Access (for Suppliers and Customers)

Give contacts secure access to view their information:

**How to Enable Portal Access:**
1. Open a contact (must be customer or supplier type)
2. Click **Enable Portal Access**
3. Enter the portal email address
4. Set a temporary password (user will be prompted to change it)
5. Click **Create Portal User**

**What Portal Users Can Do:**
- **Customers:** View job progress, estimates, and invoices
- **Suppliers:** View and respond to purchase orders, update delivery status

**Security:**
- Strong password requirements (12+ characters)
- Account lockout after 5 failed login attempts
- Password reset via email

---

### Contact Merge

Combine duplicate contacts into a single record:

**When to Use:**
- After Xero sync creates duplicates
- When same business entered multiple times with slight name variations
- When consolidating old records

**How to Merge:**
1. Select the contacts to merge (use checkboxes)
2. Click **Merge Contacts**
3. Choose which contact to keep (the "target")
4. Review the merge preview
5. Click **Confirm Merge**

**What Happens:**
- Contact types combined (customer + supplier = both)
- Missing information filled in from duplicate
- All purchase orders, pricebook items, and jobs transferred
- Duplicate contact deleted
- Merge logged in activity history

---

## Common Tasks

### Finding Contacts

**Search:**
- Use the search bar to find by name, email, or phone
- Results update as you type

**Filter by Type:**
- Click **Customers**, **Suppliers**, or **Both** tabs
- Or use the type dropdown for more options

**Filter by Xero Status:**
- Show only synced contacts
- Show only non-synced contacts

---

### Adding Contact Persons

For businesses with multiple contact people:

1. Open the contact
2. Go to **Contact Persons** tab
3. Click **+ Add Person**
4. Enter:
   - Name
   - Email
   - Role (e.g., "Accounts", "Ordering", "Sales")
5. Mark as **Primary Contact** if needed
6. Click **Save**

**Note:** Only one person can be marked as primary per contact.

---

### Managing Supplier Information

For supplier contacts, you can track additional details:

1. Open a supplier contact
2. Go to **Supplier Details** tab
3. Add:
   - **Rating:** 1-5 stars for quality/reliability
   - **Supplier Code:** Your internal reference code
   - **Address:** Physical location
   - **Notes:** Special instructions or terms
4. Click **Save**

---

### Viewing Contact Activity

See complete history of all interactions:

1. Open a contact
2. Go to **Activity** tab
3. View timeline showing:
   - When contact was created/updated
   - Xero sync events
   - Purchase orders created
   - SMS messages sent/received
   - Contact merges

---

## Troubleshooting

### "Xero sync created duplicate contacts"

**Problem:** Same business appears twice after Xero sync

**Solution:**
1. Use the **Merge Contacts** feature to combine duplicates
2. In future, add ABN to contacts before syncing (prevents duplicates)
3. Or manually link the contact to Xero before running auto-sync

---

### "Can't delete a contact"

**Problem:** Delete button greyed out or error message appears

**Cause:** Contact has linked purchase orders or financial records

**Solution:**
- Review what's linked to the contact (check POs, jobs)
- If safe to remove, delete those records first
- If not safe, use **Merge** instead to consolidate with another contact
- Or mark contact as inactive instead of deleting

---

### "Portal login not working for supplier"

**Problem:** Supplier can't access portal after receiving login credentials

**Possible Solutions:**
1. **Check account lockout:** Wait 30 minutes or reset password
2. **Verify portal type:** Ensure they're using the supplier portal URL
3. **Check email address:** Confirm email matches exactly (case-sensitive)
4. **Reset password:** Use "Forgot Password" link to send new reset email

---

### "Contact relationship not showing"

**Problem:** Added a relationship but it's not visible on the related contact

**Solution:**
- Refresh the page - relationships are bidirectional and may need refresh
- Check you saved the relationship (look for confirmation message)
- Verify you're looking at the correct contact

---

## Related Topics

- **Chapter 4:** Price Books & Suppliers - Managing supplier pricing and materials
- **Chapter 5:** Jobs & Construction Management - Linking contacts to jobs
- **Chapter 8:** Purchase Orders - Creating POs for supplier contacts
- **Chapter 15:** Xero Integration - Detailed Xero sync settings

---

# Chapter 4: Setting Up Price Books

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 4 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 4 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16 09:01 AEST

## What are Price Books?

Price Books are your material cost library - storing item prices, supplier information, and categories for all the materials you commonly purchase. They power intelligent features throughout TEEEM:

- **Smart PO Generation:** Automatically match estimate items to pricebook entries, auto-filling suppliers and current pricing
- **Price Tracking:** Historical price tracking shows you how material costs change over time
- **Risk Alerts:** Get warnings about outdated or volatile pricing before creating purchase orders
- **Supplier Management:** Associate materials with preferred suppliers and track supplier reliability

The system automatically tracks every price change you make, creating a complete audit trail for cost analysis and budget forecasting.

---

## Quick Start

1. Navigate to **Settings → Price Books**
2. Click **"+ Add Item"**
3. Fill in item details:
   - Item name (be descriptive: "2x4x8 Douglas Fir Stud" not just "Stud")
   - Current price
   - Unit (EA, LF, SF, etc.)
   - Supplier
   - Category
4. Click **"Save"**
5. Price history begins automatically as you update prices

---

## Key Features

- **Automatic Price History:** Every price change is tracked automatically with timestamps and user attribution
- **Smart Item Matching:** Fuzzy matching finds items even with typos or slight wording differences (uses Levenshtein distance algorithm)
- **Supplier Normalization:** "Home Depot Inc." and "Home Depot LLC" are recognized as the same supplier
- **Price Volatility Detection:** Statistical analysis (Coefficient of Variation) flags items with unstable pricing
- **Risk Scoring:** Multi-factor scoring (freshness, reliability, volatility, missing data) helps prioritize updates
- **Bulk Updates:** Import CSV files or update multiple items at once with transaction safety

---

## Common Tasks

### Adding Items from Estimates

When generating POs from estimates, unfound items can be added directly:
1. Review estimate line items
2. Click **"Add to Pricebook"** on unmatched items
3. Fill in supplier and category
4. Item is immediately available for future POs

### Updating Prices

Price changes are tracked automatically:
1. Find item in Price Books list
2. Edit price field
3. Save changes
4. System creates price history entry with old/new prices

### Bulk Import

For large catalogs:
1. Export template CSV
2. Fill in item details (name, price, supplier, category, unit)
3. Import CSV
4. Review mapping and validation
5. Confirm import

### Checking Price Volatility

Before generating POs:
1. Open Price Books list
2. Sort by **Risk Score** (highest first)
3. Review high-risk items (red flags)
4. Update stale prices before creating POs

---

## Troubleshooting

### "Item not matching in Smart PO Lookup"

**Problem:** Estimate item doesn't auto-match to pricebook even though it exists

**Solutions:**
- Check spelling - must be at least 70% similar for fuzzy match
- Verify supplier matches if estimate has preferred supplier set
- Add exact item name variation to pricebook
- Remove supplier constraint from estimate to allow broader matching

---

### "High Volatility warning on stable item"

**Problem:** Item shows volatile pricing despite stable prices

**Solutions:**
- Requires at least 5 price history entries for accurate calculation
- Check for outlier entries (typos) and delete them
- Wait for more price updates to build history
- Low-value items naturally have higher % volatility

---

### "Bulk update failed partway through"

**Problem:** Some items updated, others failed, inconsistent state

**Solutions:**
- System uses database transactions - all-or-nothing updates
- Check validation errors on failed items (missing required fields)
- Review error messages and fix data issues
- Re-run bulk update after corrections

---

## Related Topics

- **Chapter 3:** Contacts & Relationships (managing suppliers and vendor contacts)
- **Chapter 6:** Estimates & Quoting (Smart PO Lookup uses pricebook for matching)
- **Chapter 8:** Purchase Orders (pricebook data populates PO line items)
- **Chapter 16:** Payments & Financials (price drift analysis compares PO prices to pricebook)

---

# Chapter 5: Jobs & Construction Management

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 5 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 5 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16 09:01 AEST

## What is Jobs & Construction Management?

Jobs (called "Constructions" in the system) are the central hub for managing construction projects from start to finish. Each job includes:
- **Basic Info:** Job name, site address, contract value, supervisor details
- **Contacts:** Clients, architects, subcontractors linked to this job
- **Financial Tracking:** Live profit calculations based on contract value minus purchase orders
- **Scheduling:** Optional project schedule with tasks, dependencies, and Gantt charts
- **Documentation:** OneDrive folder creation, document tabs, communication history

The system separates the physical job (Construction) from the schedule (Project) - allowing you to create jobs without scheduling, perfect for quotes or small jobs.

---

## Quick Start

1. Navigate to **Jobs** section
2. Click **"+ New Job"**
3. Fill in basic details:
   - Job name/address
   - Contract value
   - Site supervisor info
   - Select contacts
4. Optionally: Choose schedule template to auto-create project timeline
5. Optionally: Enable OneDrive folder creation
6. Click **"Create Job"**

---

## Key Features

- **Dual Structure:** Construction (job master) + Project (scheduling) kept separate
- **Live Profit:** Automatically calculates profit as contract value minus all PO costs
- **Schedule Templates:** Pre-built project templates with tasks and dependencies
- **Task Management:** Tasks with status, progress tracking, assignments, and materials
- **Auto-Documentation:** Photo and certificate tasks spawn automatically when work completes
- **OneDrive Integration:** Auto-create folder structure when job is created
- **Contact Linking:** Associate multiple contacts (client, architect, trades) with roles

---

## Common Tasks

### Creating a Job with Schedule

1. Create new job with basic info
2. Select a schedule template from dropdown
3. System creates project and all tasks automatically
4. Tasks include dependencies (Finish-to-Start, etc.)
5. View schedule in Gantt chart

### Managing Tasks

1. Open job → click "Schedule" tab
2. View tasks in list or Gantt view
3. Update task status: Not Started → In Progress → Complete
4. System auto-sets start/end dates when status changes
5. Dependent tasks automatically recalculate dates

### Tracking Job Profit

1. Open job detail page
2. View "Live Profit" section
3. See contract value minus all PO costs
4. Profit updates automatically as POs are created/modified

---

## Troubleshooting

### "Cannot create job without contacts"
**Problem:** Validation error when trying to save job
**Solution:** Add at least one contact before saving job

### "OneDrive folders stuck in 'Processing'"
**Problem:** Folder creation status never completes
**Solution:** Check your OneDrive credentials in Settings → Integrations. May need to reconnect.

### "Task won't start - predecessors incomplete"
**Problem:** Can't mark task as In Progress
**Solution:** Complete all predecessor tasks first. Check task dependencies in Gantt view.

---

## Related Topics

- **Chapter 3:** Contacts & Relationships (linking contacts to jobs)
- **Chapter 4:** Price Books & Suppliers (materials for tasks)
- **Chapter 8:** Purchase Orders (creating POs from estimates)
- **Chapter 9:** Gantt & Schedule Master (visualizing project schedule)
- **Chapter 12:** OneDrive Integration (automatic folder creation)

---

# Chapter 6: Importing & Managing Estimates

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 6 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 6 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16 09:01 AEST

## What are Estimates?

Estimates are material lists imported from external estimating software (primarily Unreal Engine). TEEEM automatically:
- **Matches** estimates to existing jobs using smart fuzzy matching
- **Converts** estimates into draft purchase orders grouped by trade
- **Reviews** estimates against actual construction plans using AI
- **Tracks** where estimates came from and their approval status

Think of estimates as the bridge between your estimating software and TEEEM's job management system.

---

## Quick Start

1. **External System Exports Estimate**
   - Unreal Engine sends estimate to TEEEM automatically
   - System attempts to match to existing job

2. **Review Match**
   - Check if auto-matched correctly (70%+ confidence)
   - Manually select job if needed

3. **Generate Purchase Orders**
   - Click "Generate POs" button
   - System creates draft POs grouped by trade category
   - Review and approve POs

4. **(Optional) AI Plan Review**
   - Upload construction plans to OneDrive
   - Click "AI Review" to compare estimate to plans
   - Review discrepancies and adjust POs

---

## Key Features

- **Smart Job Matching:** Fuzzy matching finds the right job even with typos or variations
- **Confidence Scoring:** Shows match confidence (70%+ auto-matches, 50-70% suggests candidates)
- **Auto-PO Generation:** Converts estimates to purchase orders automatically by trade
- **AI Plan Review:** Claude AI compares estimate quantities to actual construction plans
- **Status Tracking:** Pending → Matched → Imported workflow

---

## Common Tasks

### Reviewing Auto-Matched Estimate

1. Navigate to **Estimates** tab
2. Check "Auto-Matched" badge and confidence score
3. Verify matched job is correct
4. If incorrect, click "Change Job" and select correct one

### Generating Purchase Orders from Estimate

1. Open estimate detail
2. Verify all line items look correct
3. Click **"Generate Purchase Orders"**
4. System creates draft POs grouped by:
   - Plumbing (all plumbing items)
   - Electrical (all electrical items)
   - Carpentry (all carpentry items)
5. Review draft POs and approve when ready

### Running AI Plan Review

1. Ensure job has plans uploaded to OneDrive ("01 - Plans" folder)
2. Open estimate
3. Click **"AI Review"** button
4. Wait 30-60 seconds for analysis
5. Review discrepancy list:
   - **High severity:** >20% quantity difference
   - **Medium severity:** 10-20% difference
   - **Low severity:** <10% difference
6. Adjust PO quantities based on findings

---

## Troubleshooting

### "Estimate not auto-matched - manual selection needed"
**Problem:** Confidence score below 70%
**Solution:** Click "Select Job" and choose correct job from list. System will show candidates with 50%+ match confidence.

### "Wrong job auto-matched"
**Problem:** Estimate matched to incorrect job despite 72% confidence
**Solution:** Click "Reject Match" → Select correct job from list → Confirm. Future: This feedback helps improve matching algorithm.

### "AI Review shows 'Processing' for 5+ minutes"
**Problem:** Large PDF files causing timeout
**Solution:** Check that plan PDFs are <20MB and <30 pages. If larger, split into multiple files before uploading to OneDrive.

### "Generate POs creates duplicate categories"
**Problem:** "Electrical" and "electrical" create separate POs
**Solution:** Contact support - category normalization should handle this automatically. Temporary fix: Edit one PO to include all items.

---

## Related Topics

- **Chapter 4:** Price Books & Suppliers (pricing for PO line items)
- **Chapter 5:** Jobs & Construction Management (job matching)
- **Chapter 8:** Purchase Orders (reviewing and approving generated POs)
- **Chapter 12:** OneDrive Integration (uploading plans for AI review)

---

# Chapter 7: AI-Powered Plan Review

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 7 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 7 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## What is AI Plan Review?

AI Plan Review automatically validates your construction estimates against actual PDF plans using artificial intelligence. Think of it as:
- 🔍 **Quality Control** - AI reads your plans and checks if estimates match
- 📊 **Discrepancy Detection** - Flags quantity mismatches, missing items, and extras
- ⚡ **Fast Analysis** - Reviews in 30-60 seconds (vs hours of manual checking)
- 📈 **Confidence Scoring** - Get a 0-100% accuracy rating for each estimate

**How it works:**
1. Upload construction plans to OneDrive (PDF format)
2. Import or create an estimate in TEEEM
3. Click "AI Review" button
4. AI analyzes plans, extracts materials, compares against estimate
5. View detailed discrepancy report with recommendations

---

## Quick Start

### Step 1: Prepare Your Plans
1. **Save plans as PDFs** (from your architect/engineer)
2. **Upload to OneDrive** in your job folder:
   - `01 - Plans` (floor plans, elevations, sections)
   - `02 - Engineering` (structural, MEP drawings)
   - `03 - Specifications` (material specs, details)
3. **Keep files under 20MB each** (split large files if needed)

### Step 2: Match Estimate to Job
1. Go to **Estimates** page
2. Find your estimate
3. Click **"Match to Job"** button
4. Select the correct construction/job from dropdown
5. Save

### Step 3: Run AI Review
1. Click **"AI Review"** button on estimate
2. Wait 30-60 seconds (progress indicator shown)
3. View results automatically when complete

### Step 4: Review Results
**Summary Cards show:**
- ✅ **Items Matched** - Quantities align with plans
- ⚠️ **Quantity Mismatches** - Plans vs estimate differences
- ❌ **Missing Items** - In plans but not estimated
- ℹ️ **Extra Items** - In estimate but not in plans

**Confidence Score:**
- 90-100% = Excellent (minor review only)
- 75-89% = Good (check discrepancies)
- 50-74% = Moderate issues (thorough review needed)
- < 50% = Significant problems (revise estimate)

---

## Key Features

### 🔍 Automatic Material Extraction
- AI reads PDFs just like a human estimator would
- Extracts item descriptions, quantities, and units
- Recognizes construction terminology (framing, MEP, finishes)
- Handles tables, schedules, and callout notes

### ⚖️ Intelligent Matching
- Fuzzy matching handles description variations
  - "2x4x8 Stud" matches "2x4x8' Stud Timber"
  - "100mm PVC" matches "100 mm PVC Pipe"
- Groups by category (Framing, Plumbing, Electrical, etc.)
- 10% tolerance for rounding differences

### 🎯 Severity Ratings
**High (Red)** - > 20% quantity difference
- Example: Plan shows 10 units, estimate has 6 units (40% short)
- **Action:** Investigate immediately, likely shortage

**Medium (Yellow)** - 10-20% quantity difference
- Example: Plan shows 100 units, estimate has 85 units (15% short)
- **Action:** Review and adjust if necessary

**Low (Green)** - < 10% quantity difference
- Example: Plan shows 50 units, estimate has 48 units (4% variance)
- **Action:** Within acceptable tolerance

### 📋 Detailed Recommendations
Each discrepancy includes:
- Item description and category
- Plan quantity vs estimate quantity
- Percentage difference
- Specific recommendation (e.g., "Verify with plans - estimate may be short by 4 units")

---

## Common Tasks

### Re-running a Review
If you update your estimate or plans:
1. Open estimate details
2. Click "AI Review" button again
3. New review replaces previous results

### Exporting Results
(Feature coming soon)
- PDF export of full review report
- Email report to team members
- Download discrepancy CSV

### Updating Estimate from Review
**Manual process:**
1. Review discrepancy table
2. Note quantity corrections needed
3. Edit estimate line items manually
4. Re-run AI review to verify

**Auto-apply feature** (coming soon):
- One-click button to update estimate with plan quantities

---

## Troubleshooting

### "Estimate must be matched to a job before AI review"
**Problem:** Estimate not linked to a construction/job.

**Solution:**
1. Go to Estimates page
2. Find your estimate
3. Click "Match to Job" button
4. Select job from dropdown
5. Try AI review again

---

### "No plan documents found in OneDrive"
**Problem:** Plans not uploaded or in wrong folder.

**Solution:**
1. Check OneDrive for these exact folder names:
   - `01 - Plans`
   - `02 - Engineering`
   - `03 - Specifications`
2. Upload PDF files to at least one folder
3. Ensure files are < 20MB each (compress if needed)
4. Retry AI review

---

### "Review taking longer than expected"
**Problem:** Large or complex plans taking extra time.

**Solution:**
- Wait up to 2 minutes
- Refresh page to check status
- If processing > 5 minutes, contact support

---

### High confidence but missing items flagged
**Problem:** Plans show items you didn't include in estimate.

**Possible causes:**
- Future phase items (not needed now)
- Optional upgrades (not in this quote)
- Alternate materials (plan shows options)

**Solution:**
1. Review "Missing Items" list
2. Determine if items are required THIS phase
3. Add to estimate if necessary
4. Ignore if intentionally excluded

---

### Quantity looks correct but flagged as mismatch
**Problem:** Different units between plans and estimate.

**Example:** Plan shows "100 linear feet", estimate shows "30 meters" (actually the same)

**Solution:**
1. Convert units to match (use consistent unit system)
2. Update estimate
3. Re-run review

---

## Tips for Best Results

### Upload Quality Plans
✅ **Do:**
- Use high-resolution PDFs (text readable when zoomed)
- Include all relevant sheets (floor plans, elevations, details)
- Ensure text is searchable (not scanned images if possible)

❌ **Avoid:**
- Hand-drawn sketches (low accuracy)
- Photos of plans (poor quality)
- Incomplete plan sets (missing sheets)

### Organize by Folder
Store plans in correct OneDrive folders for best results:
- **01 - Plans** → Architectural drawings
- **02 - Engineering** → Structural, MEP, civil
- **03 - Specifications** → Material specs, details

### Match Estimate Detail Level
- If plans show "100 SF drywall", don't estimate "100 SF interior finishes"
- Use same item descriptions as plans when possible
- Break down assemblies to match plan detail

### Review Results Critically
- AI is a helper, not a replacement for human judgment
- Verify high-severity discrepancies manually
- Consider context (phasing, alternates, allowances)

---

## Related Topics

- **Chapter 5: Jobs & Construction** - Setting up jobs for plan upload
- **Chapter 6: Estimates & Quoting** - Creating estimates for review
- **Chapter 8: Purchase Orders** - Using validated estimates to generate POs
- **Chapter 12: OneDrive Integration** - Uploading and organizing plan files

---

# Chapter 8: Generating Purchase Orders

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 8 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 8 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16 09:01 AEST

## What are Purchase Orders?

Purchase Orders (POs) are your system for ordering materials, equipment, and services from suppliers. Think of them as:
- 📄 **Official Order Forms** - Professional documentation sent to suppliers
- 💰 **Budget Tracking** - Monitor spending against estimates
- 📦 **Delivery Tracking** - Know what's been ordered, received, and paid
- 🔗 **Schedule Integration** - Link orders to specific construction tasks

---

## Quick Start: Creating Your First PO

### Method 1: Generate from Estimate (Recommended)

**Best for:** Converting approved estimates into supplier orders

1. **Navigate to your job's Estimate page**
2. **Click "Generate Purchase Orders"** button (top right)
3. **Review the auto-generated POs:**
   - System groups line items by category
   - Smart lookup finds best supplier & price for each item
   - PO numbers assigned automatically (PO-000001, PO-000002, etc.)
4. **Verify details:**
   - Check supplier assignments (change if needed)
   - Review quantities and prices
   - Adjust delivery dates
5. **Click "Save All POs"**

**Result:** Multiple draft POs ready for approval, organized by category.

---

### Method 2: Create Manual PO

**Best for:** One-off purchases, change orders, additional items

1. **Navigate to job's Purchase Orders page**
2. **Click "+ New Purchase Order"**
3. **Fill in required fields:**
   - **Supplier:** Select from dropdown (or create new)
   - **Delivery Date:** When you need items on site
   - **Notes:** Special instructions, project phase, etc.
4. **Add line items:**
   - Click "+ Add Item"
   - Enter item name, quantity, unit price
   - Select category (helps with tracking)
   - Repeat for each item
5. **Review totals:**
   - Sub-total calculated automatically
   - Tax (10% GST) added
   - Total shown at bottom
6. **Click "Save as Draft"**

**Result:** Single PO saved, ready for approval.

---

## Understanding PO Status

Your PO moves through these stages:

### 📝 Draft
- **What it means:** PO is being prepared, not official yet
- **You can:** Edit freely, add/remove items, delete PO
- **Next step:** Submit for approval

### ⏳ Pending Approval
- **What it means:** PO submitted, waiting for manager approval
- **You can:** View only (creator can still edit)
- **Next step:** Manager approves or rejects

### ✅ Approved
- **What it means:** PO approved by manager, ready to send
- **You can:** Send to supplier, minor edits only
- **Next step:** Send to supplier

### 📧 Sent to Supplier
- **What it means:** Supplier received PO, items on order
- **You can:** Track delivery, cancel if needed (contact supplier first!)
- **Next step:** Mark as received when items arrive

### 📦 Received
- **What it means:** Goods/services delivered and checked
- **You can:** Record invoice, track payment
- **Next step:** Mark as invoiced

### 🧾 Invoiced
- **What it means:** Supplier invoice recorded in system
- **You can:** Record payments, track balance owing
- **Next step:** Mark as paid when fully paid

### 💰 Paid
- **What it means:** Fully paid, closed
- **You can:** View only (archived)
- **Next step:** None (completed)

---

## Smart Lookup: How It Works

**Smart Lookup** automatically finds the best supplier and price for each line item.

### How Items Are Matched

**Priority 1:** Exact match (best)
- Item name + your preferred supplier + category
- Example: "Pine Timber 90x45" from "Timber Co" in "Framing" category

**Priority 2:** Fuzzy match
- Similar name + preferred supplier + category
- Example: "Pine Tmber 90x45" matches "Pine Timber 90x45"

**Priority 3:** Any supplier in category
- Item name from any supplier in same category
- Example: "Pine Timber 90x45" from any timber supplier

**Priority 4:** Fallback
- Best available match from entire pricebook
- Better than blank!

### How Suppliers Are Selected

**Priority 1:** Supplier code on estimate
- If estimate specifies "ABC-123", use that supplier

**Priority 2:** Category default supplier
- Each category has preferred supplier (set in Settings)
- Example: "Framing" category → "Timber Co"

**Priority 3:** Any active supplier
- First active supplier with items in category

**Priority 4:** Fallback
- First active supplier in system

**Pro Tip:** Set default suppliers for each category to get accurate smart lookups!

---

## Working with Purchase Orders

### Editing a PO

**Draft status:**
1. Open PO
2. Click "Edit"
3. Change any field (supplier, items, dates, etc.)
4. Click "Save"

**Pending/Approved status:**
1. Open PO
2. Click "Edit"
3. Limited fields available (status prevents major changes)
4. To make major changes: Cancel PO → Creates new draft → Edit freely

**Sent/Received/Invoiced/Paid:**
- Cannot edit (locked)
- To change: Cancel and create new PO

### Approving a PO

**Required permission:** Manager or Admin

1. Open PO in "Pending" status
2. Review line items, quantities, prices
3. Check supplier and delivery date
4. **Click "Approve"** (or "Reject" to send back to draft)
5. PO moves to "Approved" status

**What to check:**
- ✅ Supplier is correct
- ✅ Prices match estimate (or within reason)
- ✅ Delivery date aligns with schedule
- ✅ Budget available for this purchase

### Sending to Supplier

1. Open PO in "Approved" status
2. Click "Send to Supplier"
3. **Choose method:**
   - **Email:** System sends PDF to supplier email
   - **Download PDF:** Print or attach to email manually
   - **Mark as Sent:** Already sent outside system
4. PO moves to "Sent" status

**Email includes:**
- Professional PO document (PDF)
- All line items with quantities and prices
- Delivery instructions and site address
- Contact information

### Receiving Goods

**When delivery arrives:**

1. **Check delivery against PO:**
   - Count items
   - Check condition
   - Note any shortages or damages
2. **Open PO in system**
3. **Click "Mark as Received"**
4. **Enter details:**
   - Date received
   - Quantity received (if partial delivery, note in comments)
   - Condition notes
5. **Click "Save"**
6. PO moves to "Received" status

**Partial deliveries:**
- Note what arrived in comments
- Keep PO in "Sent" status until complete
- Or mark as "Received" and note outstanding items

### Recording Invoices

**When supplier invoice arrives:**

1. Open PO (should be in "Received" status)
2. Click "Mark as Invoiced"
3. **Enter invoice details:**
   - Invoice number
   - Invoice date
   - Invoice amount
4. **Attach invoice PDF** (optional but recommended)
5. Click "Save"
6. PO moves to "Invoiced" status

**Payment status auto-calculated:**
- System compares invoice amount to PO total
- Shows "Pending", "Part Payment", or "Complete"
- 5% tolerance for rounding (see Payment Tracking below)

### Recording Payments

1. Open PO in "Invoiced" status
2. **Enter payment details:**
   - Amount paid
   - Payment date
   - Payment method (EFT, check, credit card)
   - Reference number
3. **Click "Record Payment"**
4. **Payment status updates:**
   - If paid in full → "Paid" status (PO closed)
   - If partial → "Part Payment" (can record more payments)

**Multiple payments:**
- Record each payment separately
- System tracks total paid
- Shows balance owing

---

## Understanding Payment Status

### 💰 Payment Status Indicators

**⏳ Pending**
- No payment recorded yet
- Invoice just received
- Action: Schedule payment

**🟡 Part Payment**
- Some amount paid, but not complete
- Example: $500 paid on $1000 PO
- Action: Record remaining payments

**✅ Complete**
- Fully paid (within tolerance)
- Example: $995-$1050 paid on $1000 PO (95-105% tolerance)
- Action: None, PO can close

**🚨 Manual Review**
- Payment doesn't make sense
- Example: $1100 paid on $1000 PO (overpaid!)
- Action: Check with accounts, may need credit

### Why 5% Tolerance?

**Real-world scenarios:**
- **Rounding:** $999.95 vs $1000.00
- **Early payment discounts:** Pay $980 for 2% discount
- **Partial shipments:** Last item $20, not worth separate invoice
- **GST differences:** Calculation rounding

**System considers these "Complete":**
- PO Total: $1000
- Paid: $950-$1050 = Complete ✅
- Paid: $949 or less = Part Payment 🟡
- Paid: $1051+ = Manual Review 🚨

**To override:**
- If $990 paid and supplier agrees that's full payment
- Accept "Part Payment" status (accurate reflection)
- Or adjust invoice amount to $990 → Shows "Complete"

---

## Price Drift Warnings

**What is price drift?**
- Comparison between pricebook price and PO line item price
- Helps catch data entry errors and price increases

**Color indicators:**
- 🟢 **Green (0-5%):** Normal variation, no concern
- 🟡 **Yellow (5-10%):** Notable increase, worth checking
- 🔴 **Red (>10%):** Significant increase, review required

**Common causes:**
- ✅ **Legitimate:** Supplier raised prices, market increase
- ✅ **Bulk pricing:** Ordered more, got discount (negative drift)
- ❌ **Data error:** Typed $1000 instead of $100 (900% drift!)
- ❌ **Wrong item:** Selected wrong pricebook item

**Example:**
- Pricebook: "2x4 Timber" = $5.00
- PO line item: $5.75 (15% drift)
- **Warning shows:** "Price is 15% higher than pricebook. Confirm before proceeding."

**Actions:**
- Review supplier quote
- Check for data entry errors
- Update pricebook if new normal price
- Proceed if increase is legitimate

---

## Linking POs to Schedule Tasks

**Why link?**
- See which POs support which construction phases
- Track material costs per task
- Know when items must arrive for task start date

**How to link:**

1. **Open PO**
2. **Scroll to "Schedule Task" field**
3. **Select task from dropdown:**
   - Shows all tasks for current job
   - Example: "Framing - Week 2"
4. **Click "Save"**

**Result:**
- PO appears in task details
- Task shows associated PO cost
- Delivery date aligned with task start

**Important:**
- One PO can link to ONE task only
- One task can have MULTIPLE POs
- Changing link moves PO to new task (safely handled)

---

## Common Workflows

### Workflow 1: Estimate → PO → Delivery

**Scenario:** Converting approved estimate into supplier orders

1. **Estimate approved** by client
2. **Generate POs** from estimate
   - Click "Generate Purchase Orders"
   - Review auto-created POs
   - Verify suppliers and prices
3. **Submit for approval**
   - Click "Submit All for Approval"
   - Manager reviews and approves
4. **Send to suppliers**
   - Approved POs → Click "Send to Supplier"
   - Email sent automatically
5. **Track deliveries**
   - Items arrive → "Mark as Received"
   - Record invoice → "Mark as Invoiced"
   - Record payment → "Record Payment"
6. **Close PO**
   - Fully paid → Status: "Paid"
   - Archived for records

**Timeline:** 2-3 days for approval, 5-10 days delivery (varies by supplier)

---

### Workflow 2: Emergency Purchase

**Scenario:** Need materials urgently, no estimate yet

1. **Create manual PO**
   - "+ New Purchase Order"
   - Select supplier
   - Add items needed
2. **Submit for approval**
   - Click "Submit for Approval"
   - Call/text manager for quick approval
3. **Call supplier**
   - Confirm availability
   - Arrange pickup or delivery
4. **Send PO**
   - Manager approves → "Send to Supplier"
   - Email or call supplier with PO number
5. **Pick up or receive**
   - Get items on site
   - "Mark as Received"
6. **Process invoice**
   - Invoice arrives → "Mark as Invoiced"
   - Pay ASAP → "Record Payment"

**Timeline:** Same day if supplier has stock

---

### Workflow 3: Bulk Ordering for Multiple Jobs

**Scenario:** Ordering common materials for 3 jobs to get bulk discount

1. **Create PO for primary job**
   - Select job with most items
   - Add ALL items (across all jobs)
   - Note other job numbers in PO notes
2. **Record total cost to primary job**
   - Full PO tracked in primary job
3. **Split costs in accounting**
   - Use custom tables or manual tracking
   - Allocate costs per job

**Alternative (better tracking):**
- Create separate PO per job
- Note bulk order in PO notes
- Coordinate delivery timing

---

## Troubleshooting

### "PO number already exists"

**What it means:** System tried to create duplicate PO number (rare!)

**Solutions:**
1. Refresh page and try again
2. Check existing POs for duplicates
3. Contact support if persists

**Prevention:** System uses database locks to prevent this

---

### "Cannot edit PO in 'Sent' status"

**What it means:** PO already sent to supplier, locked to prevent confusion

**Solutions:**
1. **Minor change:** Contact supplier directly, don't change system
2. **Major change:**
   - Cancel PO
   - Create new PO with correct details
   - Send new PO to supplier
   - Explain cancellation

**Why locked?** Prevents miscommunication with supplier

---

### "Smart lookup selected wrong supplier"

**What it means:** System picked different supplier than you expected

**Solutions:**
1. **Check category default:**
   - Settings → Price Books → Categories
   - Update default supplier if needed
2. **Manually override:**
   - Change supplier in PO after generation
   - Edit line items if needed
3. **Review pricebook:**
   - Ensure correct items are tagged to right suppliers

**Prevention:** Set accurate default suppliers for each category

---

### "Payment status stuck on 'Part Payment'"

**What it means:** Amount paid doesn't fall in "Complete" tolerance (95-105%)

**Example:**
- PO Total: $1000
- Paid: $990 (99% - outside tolerance)
- Shows: "Part Payment"

**Solutions:**
1. **Check if truly complete:**
   - Did supplier accept $990 as full payment?
   - Was there a discount?
2. **Adjust invoice amount:**
   - Change invoice from $1000 to $990
   - Status updates to "Complete"
3. **Pay remaining amount:**
   - Pay additional $10
   - Status updates to "Complete"
4. **Accept status:**
   - "Part Payment" is accurate if not fully paid

**Understanding:** Status is CALCULATED, not manually set

---

### "Price drift warning won't go away"

**What it means:** Line item price is >10% different from pricebook

**Solutions:**
1. **Update pricebook:**
   - Settings → Price Books
   - Update item price to current market price
   - Drift warning disappears
2. **Verify correct price:**
   - Check supplier quote
   - Ensure no data entry error
3. **Acknowledge and proceed:**
   - Click "I understand, proceed"
   - Warning is informational only

**Prevention:** Keep pricebook updated with current market prices

---

### "Cannot link PO to schedule task"

**What it means:** Task already linked to another PO

**Solutions:**
1. **Check existing link:**
   - Open schedule task
   - See which PO is linked
2. **Unlink other PO:**
   - Open that PO
   - Remove schedule task link
   - Now link to new PO
3. **Use different task:**
   - Create new task if needed
   - Link PO to new task

**Why?** System enforces: One task = One PO (one-to-one relationship)

---

## Tips & Best Practices

### ✅ Do This

**1. Set default suppliers for categories**
- Saves time on every PO generation
- Ensures consistent supplier relationships
- Better pricing through volume

**2. Use smart lookup for bulk POs**
- Faster than manual entry
- More accurate pricing
- Consistent item names

**3. Link POs to schedule tasks**
- Better cost tracking
- Delivery timing aligned with construction
- Easy to see material costs per phase

**4. Review before sending**
- Check all quantities and prices
- Verify delivery date
- Confirm supplier details
- Double-check site address

**5. Attach supplier invoices**
- Easy reference later
- Audit trail for accounting
- Dispute resolution if needed

**6. Record payments promptly**
- Accurate cash flow tracking
- Avoid duplicate payments
- Better supplier relationships

**7. Keep pricebook updated**
- Reduces price drift warnings
- Faster smart lookups
- More accurate estimates

### ❌ Avoid This

**1. Editing sent POs**
- Creates supplier confusion
- Better to cancel and resend
- Keep communication clear

**2. Skipping approval workflow**
- Budget overruns
- Unauthorized purchases
- Financial control issues

**3. Manual POs for everything**
- Slower than smart lookup
- More data entry errors
- Miss bulk discount opportunities

**4. Ignoring price drift warnings**
- May miss data entry errors
- Budget surprises
- Profit margin issues

**5. Not linking to schedule**
- Harder to track material costs
- Delivery timing issues
- Miss task dependencies

**6. Deleting POs**
- Lose purchase history
- Audit trail gaps
- Better to cancel instead

**7. Using outdated pricebook**
- Inaccurate estimates
- Constant drift warnings
- Manual price corrections

---

## Frequently Asked Questions

### Can I edit a PO after it's sent?

**No.** Once sent, PO is locked to prevent supplier confusion.

**To change:** Cancel PO → Create new one → Send new PO to supplier

---

### Why does smart lookup pick different suppliers?

**Reason:** System follows priority:
1. Supplier code on estimate
2. Category default supplier
3. Any active supplier

**Solution:** Set default suppliers in category settings

---

### Can I create POs without an estimate?

**Yes!** Manual PO creation is fully supported.

**Best for:** Change orders, additional items, emergency purchases

---

### What happens if I delete a PO?

**Draft/Pending:** PO deleted permanently
**Approved/Sent/Received/Invoiced/Paid:** Cannot delete (use cancel instead)

**Better:** Use "Cancel" to create audit trail

---

### Can I merge multiple POs?

**No.** System doesn't support merging.

**Workaround:** Create new PO with all items → Cancel old POs

---

### How do I track partial payments?

**Record each payment separately:**
1. Enter amount paid
2. Click "Record Payment"
3. Status updates to "Part Payment"
4. Repeat for next payment

System tracks total paid and balance owing.

---

### Can I copy a PO to another job?

**Not directly.** Must create new PO manually.

**Workaround:**
1. Open original PO
2. Note items and quantities
3. Create new PO in other job
4. Enter same items

**Feature request:** Copy PO function (coming soon!)

---

### What's the difference between "Received" and "Invoiced"?

**Received:** Goods physically delivered to site
**Invoiced:** Supplier invoice recorded in system

**Typical flow:**
1. Items arrive → Mark as "Received"
2. Days/weeks later → Invoice arrives → Mark as "Invoiced"
3. Process payment → Record payments

---

### Can I have multiple invoices for one PO?

**Not directly.** System tracks one invoice per PO.

**For multiple invoices:**
- Use comments to track each invoice number
- Record total amount paid across all invoices
- Attach all invoice PDFs

**Better:** Split into separate POs for each delivery

---

### How do I export PO data for accounting?

**Options:**
1. **Export to CSV:** POs page → "Export" button
2. **Xero Integration:** Auto-sync POs to Xero (if enabled)
3. **API Access:** Custom integration (developer required)

**CSV includes:** PO number, supplier, items, amounts, dates, status

---

## Related Topics

- **Chapter 4: Price Books & Suppliers** - Setting up pricebook for smart lookup
- **Chapter 6: Estimates & Quoting** - Creating estimates to generate POs from
- **Chapter 9: Schedule Master** - Linking POs to construction tasks
- **Chapter 11: Documents** - Attaching supplier invoices and quotes
- **Chapter 16: Payments** - Recording payments and tracking cash flow

---

# Chapter 9: Building Construction Schedules

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 9 (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter 9 (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16 09:01 AEST

## What is Schedule Master?

Schedule Master helps you create and manage construction timelines with:
- 📅 **Visual Gantt Chart** - See your entire project timeline
- 🔗 **Task Dependencies** - Link tasks that depend on each other
- 📋 **24-Column Table** - Detailed task information
- 🔒 **Lock System** - Prevent important dates from changing
- 🔄 **Auto-Cascade** - Dependent tasks update automatically

---

## Creating Your First Schedule

### Step 1: Navigate to Schedule Master

1. Go to your job
2. Click the **"Schedule"** tab
3. Click **"New Schedule from Template"**

### Step 2: Choose a Template

Pick a template that matches your project type:
- **NDIS Residential** - Disability housing construction
- **Standard Residential** - Regular home construction
- **Commercial** - Commercial building projects
- **Custom** - Start from scratch

### Step 3: Review the Schedule

The template creates tasks for you automatically:
- **Task Name** - What needs to be done (e.g., "Foundation", "Framing")
- **Duration** - How many days each task takes
- **Start Date** - When the task begins
- **Dependencies** - Which tasks must finish first

---

## Understanding the Schedule View

### The Table (Left Side)

**24 columns** show detailed information:
- **Task** - Task name
- **Start** - Start day (e.g., Day 5)
- **Duration** - How long it takes (in days)
- **Predecessors** - Tasks that must finish first
- **Owner** - Who's responsible
- **Status** - Not started, In progress, Complete

### The Gantt Chart (Right Side)

**Visual timeline** shows:
- **Task bars** - Length represents duration
- **Arrows** - Dependencies between tasks
- **Colors** - Different colors for different statuses

---

## Working with Tasks

### Moving a Task

**Drag the task bar** to change its start date:
1. Click and hold on the task bar
2. Drag left (earlier) or right (later)
3. Release to drop

**What happens:**
- Task moves to new date
- All dependent tasks move automatically
- Locked tasks stay in place

### Adding Dependencies

**Link tasks together:**
1. Click the **"Link"** icon next to a task
2. Click the task that depends on it
3. An arrow appears showing the link

**Dependency types:**
- **Finish-to-Start (FS)** - Most common. Task B starts when Task A finishes.
- **Start-to-Start (SS)** - Task B starts when Task A starts.
- **Finish-to-Finish (FF)** - Task B finishes when Task A finishes.

### Locking a Task

**Prevent a task from moving:**
1. Find the lock icon column
2. Click the checkbox to lock
3. Locked tasks won't move when predecessors change

**When to lock:**
- ✅ Supplier confirmed the date
- ✅ Work has already started
- ✅ Date is critical (e.g., inspection)

---

## Common Scenarios

### Scenario 1: Delay in Foundation

**Problem:** Foundation delayed by 3 days due to rain.

**Solution:**
1. Drag the "Foundation" task bar 3 days later
2. All dependent tasks (Framing, Plumbing, etc.) move automatically
3. Check the new completion date

### Scenario 2: Supplier Confirms Delivery Date

**Problem:** Windows supplier confirmed delivery for Day 45.

**Solution:**
1. Drag "Install Windows" task to Day 45
2. Lock the task (click lock icon)
3. Task won't move even if predecessors change

### Scenario 3: Task Taking Longer Than Expected

**Problem:** Framing taking 5 days instead of 3.

**Solution:**
1. Click on "Framing" task
2. Change **Duration** from 3 to 5
3. All dependent tasks shift by 2 days

---

## Tips & Best Practices

### Do's ✅

- ✅ **Use templates** - Saves time, proven workflows
- ✅ **Lock critical dates** - Prevents accidental changes
- ✅ **Update regularly** - Keep schedule current
- ✅ **Add dependencies** - Let cascade do the work
- ✅ **Check working days** - Settings → Company → Working Days

### Don'ts ❌

- ❌ **Don't ignore dependencies** - Manual updates are error-prone
- ❌ **Don't forget to lock** - Confirmed dates should be locked
- ❌ **Don't delete tasks** - Hide them instead (set status to "Cancelled")

---

## Troubleshooting

### Tasks not moving when I drag?

**Check if task is locked:**
- Look for lock icon
- Locked tasks don't move automatically
- Unlock to allow movement

### Schedule looks wrong after dragging?

**Try refreshing:**
- Click the refresh icon
- Or press F5 to reload page
- Schedule recalculates from server

### Can't find a task?

**Use the search:**
- Click in the table
- Press Ctrl+F (Windows) or Cmd+F (Mac)
- Type task name

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl/Cmd + S** | Save schedule |
| **Ctrl/Cmd + Z** | Undo last change |
| **Ctrl/Cmd + F** | Find task |
| **Delete** | Delete selected task |
| **Escape** | Cancel current action |

---

## Video Tutorials

**Coming soon:**
- Creating your first schedule
- Understanding dependencies
- Using the lock system
- Managing delays and changes

---

**For technical details, see:** Bible Chapter 9 (Developers)
**For bug history, see:** Lexicon Chapter 9 (Developers)

---

# Chapter 10: Daily Tasks & Checklists

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 10 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 10 (Developers) │
└─────────────────────────────────────────────────┘

## What are Project Tasks?

Project Tasks are individual work items within a construction job. They track progress, dependencies, assigned workers, and materials. Tasks can spawn automatically (photos, certificates, subtasks) and include supervisor checklists for quality assurance.

**Benefits:**
- **Work breakdown** - Large jobs split into manageable tasks
- **Progress tracking** - See what's done, in progress, or delayed
- **Dependencies** - Know which tasks must finish before others start
- **Supervisor checklists** - Quality and safety checks per task

---

## Getting Started

### Step 1: View Tasks for a Job

1. Open a **Job** from the Jobs page
2. Go to **Tasks** tab (or **Schedule Master** view)
3. See list of tasks with:
   - **Name** - Task description
   - **Status** - Not Started, In Progress, Complete, On Hold
   - **Dates** - Planned start/end, actual start/end
   - **Assigned To** - Who's responsible

**Automatic Creation:**
- If job created from Schedule Master template, tasks auto-created from template
- Otherwise, add tasks manually

---

### Step 2: Mark Task In Progress

When work starts on a task:

1. Find task in list
2. Click **status dropdown**
3. Select **"In Progress"**
4. System automatically sets **Actual Start Date** to today

**What happens:**
- If task has **subtasks** configured, they spawn automatically
- Task appears in "In Progress" filter
- Team can see work has started

---

### Step 3: Mark Task Complete

When task work is finished:

1. Find task in list
2. Click **status dropdown**
3. Select **"Complete"**
4. System automatically:
   - Sets **Actual End Date** to today
   - Sets **Progress** to 100%
   - Spawns **photo task** (if required)
   - Spawns **certificate task** (if required)

**Auto-completion:**
- If task has "Auto-complete predecessors" enabled, all tasks it depends on also complete automatically

---

## Key Features

**Task Status Lifecycle:**
- **Not Started** → Task planned but work hasn't begun
- **In Progress** → Work currently happening
- **Complete** → Task finished and verified
- **On Hold** → Blocked or delayed (can resume later)

**Automatic Task Spawning:**
- **Photo Tasks** - Spawned when parent completes (documentation)
- **Certificate Tasks** - Spawned with lag days after parent completes (compliance)
- **Subtasks** - Spawned when parent starts (work breakdown)

**Dependencies:**
- Tasks can depend on other tasks (predecessors)
- Dependency types: Finish-to-Start, Start-to-Start, Finish-to-Finish
- Prevents scheduling conflicts

**Supervisor Checklists:**
- Safety checks ("Hard hats required")
- Quality checks ("Inspect slab for cracks")
- Photo requirements ("Photo of completed framing")
- Note requirements ("Describe any defects found")

**Materials Tracking:**
- Tasks can link to purchase orders
- System shows if materials arrive on time or delayed
- Prevents starting tasks without materials

---

## Common Tasks

### Create a New Task

1. Go to **Job** → **Tasks** tab
2. Click **"Add Task"** button
3. Fill in:
   - **Name** - "Install kitchen cabinets"
   - **Duration** - Number of days (minimum 1)
   - **Planned Start Date** - When task should begin
   - **Assigned To** - Select worker or enter supplier name
4. Click **"Save"**

**Result:** Task appears in list with "Not Started" status.

---

### Add Task Dependency

To make Task B wait for Task A to finish:

1. Open **Task B** in edit mode
2. Find **"Dependencies"** section
3. Click **"Add Predecessor"**
4. Select **Task A** from dropdown
5. Select dependency type:
   - **Finish-to-Start** (most common) - B starts after A finishes
   - **Start-to-Start** - B starts when A starts
   - **Finish-to-Finish** - B finishes when A finishes
6. Click **"Save"**

**Result:** Task B cannot start until Task A completes (if using Finish-to-Start).

---

### View Supervisor Checklist (Template Setup)

**Note:** This feature is configured in Settings by admins. Field supervisors will complete checklists during job execution (UI coming soon).

1. Go to **Settings** → **Supervisor Checklists**
2. See list of checklist templates:
   - Safety items
   - Quality checks
   - Pre-start requirements
   - Completion verification
3. Click **template** to edit

**Checklist Types:**
- **Checkbox** - Simple yes/no ("Hard hats worn?")
- **Photo** - Requires photo upload ("Photo of slab")
- **Note** - Requires text explanation ("Describe defects")
- **Photo + Note** - Both required

---

### Link Task to Purchase Order

To track if materials arrive on time:

1. Open **Task** in edit mode
2. Find **"Purchase Order"** field
3. Select PO from dropdown
4. Check **"Critical PO"** if materials MUST arrive on time
5. Click **"Save"**

**Result:**
- Task shows materials status badge:
  - **No PO** (gray) - No materials linked
  - **On Time** (green) - PO delivery before task start
  - **Delayed** (red) - PO delivery after task start

---

## Troubleshooting

**Issue: Task won't mark complete**

**Cause:** Task has incomplete dependencies or required checklist items.

**Solution:**
- Check if task has predecessors that aren't complete yet
- Check if supervisor checklist items need completion
- If you need to override, use "On Hold" status temporarily

---

**Issue: Can't add dependency - "Circular dependency detected"**

**Cause:** Creating this dependency would cause a loop (A depends on B, B depends on C, C depends on A).

**Solution:**
- Review dependency chain to find the loop
- Remove one dependency to break the cycle
- Example: If A→B→C→A, remove either A→B, B→C, or C→A

---

**Issue: Subtasks didn't spawn when task started**

**Cause:** Template row doesn't have "Has Subtasks" enabled.

**Solution:**
- Go to **Settings** → **Schedule Master** → **Templates**
- Edit the template row for this task type
- Enable **"Has Subtasks"** checkbox
- Configure subtask templates
- Future jobs will spawn subtasks correctly (existing jobs must add manually)

---

## Related Topics

- **Chapter 9: Gantt & Schedule Master** - Template configuration for tasks
- **Chapter 8: Purchase Orders** - Linking materials to tasks
- **Chapter 5: Jobs & Construction Management** - Job lifecycle overview
- **Chapter 11: Weather & Public Holidays** - How weather affects task scheduling

---

# Chapter 11: Weather Tracking & Delays

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 11 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 11 (Developers) │
└─────────────────────────────────────────────────┘

## What is Weather Tracking?

Weather Tracking automatically logs rainfall and public holidays for your construction jobs. When it rains, the system records the amount and calculates severity. Public holidays are automatically recognized by region so your schedule knows when crews won't be working.

**Benefits:**
- **Automatic rain logging** - Weather data fetched daily at midnight
- **Public holiday calendar** - Regional holidays (QLD, NSW, VIC, etc.) prevent scheduling conflicts
- **Schedule integration** - Gantt respects non-working days and holidays
- **Delay documentation** - Rain history provides evidence for time extensions

---

## Getting Started

### Step 1: View Rain History

1. Open a **Job**
2. Go to **Weather** tab
3. See list of rain events:
   - **Date** - When it rained
   - **Amount** - Rainfall in mm
   - **Severity** - Light (<5mm), Moderate (5-15mm), Heavy (>15mm)
   - **Impact** - Work stopped? Delays caused?

**Automatic Logging:**
- System checks weather API daily at midnight
- Extracts location from job title or address
- Records rainfall if > 0mm
- Calculates severity automatically

---

### Step 2: Add Manual Rain Entry

If automatic logging missed a rain event:

1. Open **Job** → **Weather** tab
2. Click **"Add Rain Event"** button
3. Fill in:
   - **Date** - When it rained
   - **Rainfall (mm)** - Amount measured on site
   - **Notes** - Impact description (optional)
4. Click **"Save"**

**Tip:** Severity auto-calculates from rainfall amount. You don't need to select it manually.

---

### Step 3: Check Public Holidays

1. Go to **Settings** → **Public Holidays**
2. See calendar of upcoming holidays by region:
   - **National Holidays** - Australia-wide (e.g., Christmas Day)
   - **Regional Holidays** - State-specific (e.g., Melbourne Cup - VIC only)
3. Filter by region: QLD, NSW, VIC, SA, WA, TAS, NT, NZ

**Schedule Integration:**
- Gantt automatically skips public holidays when calculating task dates
- Working day logic respects company working days + public holidays
- Lock hierarchy prevents tasks from being scheduled on holidays

---

## Key Features

**Automatic Weather Tracking:**
- Daily midnight check for yesterday's rainfall
- Location extracted from job title (e.g., "House Build - Springfield, QLD")
- Severity auto-calculated based on rainfall amount
- Historical data stored permanently

**Regional Public Holidays:**
- Unique holidays per region (no duplicates)
- Covers all Australian states + New Zealand
- Used by Schedule Master for working day calculations

**Schedule Integration:**
- Gantt respects both working days AND public holidays
- Task dates auto-adjust to skip non-working days
- Manual override via lock hierarchy if needed

**Rain History Documentation:**
- Evidence for contract variations
- Time extension justification
- Weather delay tracking per job

---

## Common Tasks

### Add a Custom Public Holiday

If your region has a local holiday not in the system:

1. Go to **Settings** → **Public Holidays**
2. Click **"Add Holiday"** button
3. Fill in:
   - **Name** - "Local Show Day"
   - **Date** - Select from calendar
   - **Region** - QLD (or your region)
4. Click **"Save"**

**Result:** Schedule Master now skips this date when calculating task dates for jobs in that region.

---

### View Rain Impact on Schedule

1. Open **Job** → **Gantt** tab
2. See if any tasks were delayed by rain:
   - Tasks with weather delays show rain icon
   - Hover over icon to see rain event details
3. Check **Weather** tab to see full rain history

**Tip:** Use rain history to justify time extensions to clients or generate variation requests.

---

### Manual Rainfall Entry for Historical Jobs

If you're migrating an old job with known rain delays:

1. Open **Job** → **Weather** tab
2. Click **"Add Rain Event"** for each historical event
3. Enter date, rainfall amount, and impact notes
4. System stores as permanent record

**Benefit:** Complete weather history for contract documentation.

---

## Troubleshooting

**Issue: Automatic rain check not working**

**Cause:** Job location unclear or API limit exceeded.

**Solution:**
- Ensure job title includes suburb + region: "House Build - Springfield, QLD"
- Or add full address in Job Details
- Check Settings → Integrations to verify WeatherAPI is connected

---

**Issue: Wrong location being used for weather**

**Cause:** Ambiguous suburb name (e.g., "Springfield" exists in NSW and QLD).

**Solution:**
- Include state/region in job title: "Springfield, QLD" not just "Springfield"
- Or add full street address in Job Details
- System prioritizes: Address > Job title > Job site address > Contact address

---

**Issue: Public holiday not recognized**

**Cause:** Holiday might be region-specific or not in database.

**Solution:**
- Check Settings → Public Holidays to see if it exists
- Add manually if it's a local holiday
- Ensure job's region matches the holiday's region

---

## Related Topics

- **Chapter 9: Gantt & Schedule Master** - How schedule respects holidays
- **Chapter 5: Jobs & Construction Management** - Job location settings
- **Chapter 2: System Administration** - Company settings and working days

---

# Chapter 12: OneDrive File Management

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 12 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 12 (Developers) │
└─────────────────────────────────────────────────┘

## What is OneDrive Integration?

OneDrive stores all your job documents in the cloud: plans, quotes, photos, and contracts. Every job automatically gets its own folder with subfolders organized by document type.

**Benefits:**
- **Auto folder creation** - New job = instant OneDrive folder
- **Organized structure** - Plans, Quotes, Photos all separated
- **Team access** - Everyone sees same files
- **Version history** - OneDrive tracks all changes

---

## Getting Started

### Step 1: Connect to OneDrive

1. Go to **Settings** → **Integrations**
2. Find "OneDrive" card
3. Click **"Connect to OneDrive"**
4. Sign in with your Microsoft account
5. Click **"Accept"** to grant permissions

**Success!** OneDrive is now connected.

---

### Step 2: Create Folders for a Job

When you create a new job, TEEEM can auto-create folders:

**Option A: During Job Creation**
1. Fill out "New Job" form
2. Check **"Create OneDrive folders"** checkbox
3. Click "Create Job"
4. Folders created automatically!

**Option B: After Job Created**
1. Go to job detail page
2. Click **"Create OneDrive Folders"** button
3. Folders created in seconds

**What gets created:**
```
TEEEM Jobs/
  └── [Job Number] - [Job Name]/
      ├── Plans/
      ├── Quotes/
      ├── Contracts/
      ├── Photos/
      ├── Invoices/
      └── Correspondence/
```

---

## Uploading Files

### Upload to a Job

1. Go to **Job Detail** page
2. Click **"Documents"** tab
3. Choose document type (e.g., "Plans")
4. Click **"Upload File"** button
5. Select file from your computer
6. File uploads to correct OneDrive folder

---

## Opening Files in OneDrive

### View Files in Browser

1. Go to job detail page
2. Click **"Open in OneDrive"** button
3. OneDrive opens in new tab showing your job folder

**Tip:** Bookmark the OneDrive link for quick access!

---

## Common Scenarios

### Scenario 1: Upload Site Photos

**You took photos at the job site:**

1. Go to job → Documents tab
2. Select "Photos" folder
3. Upload photos (supports multiple files)
4. Photos appear in OneDrive immediately

---

### Scenario 2: Share Files with Client

**Client needs to see quote:**

1. Click "Open in OneDrive"
2. Navigate to Quotes folder
3. Right-click file → Share
4. Copy link and email to client

---

## Tips & Best Practices

### Tip #1: Use Descriptive File Names

Good: `Quote-Bathroom-Reno-Rev2.pdf`
Bad: `Document1.pdf`

### Tip #2: Create Folders Early

Create OneDrive folders when you create the job, not later. This ensures all documents go to the right place from day one.

---

# Chapter 13: Email Integration

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 13 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 13 (Developers) │
└─────────────────────────────────────────────────┘

## What is Email Integration?

Email Integration connects your Microsoft Outlook inbox to TEEEM, automatically importing job-related emails and matching them to the correct construction projects. **Note:** Currently inbound-only (Outlook → TEEEM). You cannot send emails from TEEEM yet.

**Benefits:**
- Centralized email history per job
- Automatic job matching (no manual filing)
- Complete audit trail of client communication

---

## Getting Started

### Step 1: Connect Outlook

1. Go to **Settings** → **Integrations**
2. Find **"Outlook"** card
3. Click **"Connect to Outlook"**
4. Sign in with your Microsoft account
5. Click **"Accept"** to grant permissions

**Permissions requested:**
- Read your email (Mail.Read)
- Read mailbox settings (MailboxSettings.Read)

**Result:** Outlook connected. Token refreshes automatically.

---

### Step 2: Import Emails for a Job

1. Open a **Job**
2. Go to **"Emails"** tab
3. Click **"Import from Outlook"** button
4. Choose import method:
   - **Search Query** - Enter keywords (e.g., "foundation inspection")
   - **Folder** - Select inbox, sent, or custom folder
5. Click **"Preview"** to see matching emails
6. Click **"Import"** to save to job

**Auto-Matching:**
System automatically matches emails to jobs using:
- Job reference in subject (#123 or JOB-123)
- Job reference in email body
- Sender email matches contact
- Address mentioned in email

---

## Common Tasks

### View Emails for a Job

1. Open **Job**
2. Go to **"Emails"** tab
3. See list of all emails:
   - Sender, subject, date
   - Preview snippet
   - Attachment indicator (if any)

**Note:** Attachment metadata shown but files not downloadable yet (coming soon).

---

### Manually Assign Email to Job

If auto-matching failed:

1. Go to **Settings** → **Emails** (unassigned emails list)
2. Find email in list
3. Click **"Assign to Job"** dropdown
4. Select correct job
5. Click **"Save"**

**Result:** Email now appears in that job's Emails tab.

---

### Search Emails Across All Jobs

1. Go to **Settings** → **Emails**
2. Use search box to find emails by:
   - Sender email
   - Subject keywords
   - Date range

**Tip:** Use advanced search for multi-job email history review.

---

## Troubleshooting

**Issue: Outlook connection failed**

**Cause:** OAuth permissions not granted or token expired.

**Solution:**
- Go to **Settings** → **Integrations** → **Outlook**
- Click **"Disconnect"**
- Click **"Connect to Outlook"** again
- Ensure you accept ALL permissions

---

**Issue: Email imported but not matched to job**

**Cause:** No job reference found, sender unknown, address not recognized.

**Solution:**
- Manually assign email to job (see "Manually Assign Email to Job" above)
- OR add job reference (#123) to subject line before importing

---

**Issue: Can't send emails from TEEEM**

**Cause:** Outbound sending not yet implemented.

**Solution:**
- Send emails manually from Outlook as usual
- Then import them into TEEEM to keep history
- Feature coming in future update

---

## Related Topics

- **Chapter 5: Jobs & Construction Management** - Job email history
- **Chapter 3: Contacts & Relationships** - Contact email matching

---

# Chapter 14: Team Chat & SMS

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 14 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 14 (Developers) │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## What is Team Chat & SMS?

TEEEM's communication tools help your team stay connected and keep records of important conversations. The system includes team chat channels, direct messaging between staff members, and SMS texting with contacts.

**Key Features:**
- **Team Channels** - Group discussions (#general, #team, #support)
- **Direct Messages** - Private conversations with team members
- **SMS Integration** - Send and receive text messages with suppliers and customers
- **Job Linking** - Attach conversations to specific jobs for record-keeping

All messages are searchable and can be saved to job records for reference.

---

## Getting Started

### Accessing Team Chat

1. Click the **chat icon** in the top navigation bar
2. Choose a channel from the sidebar:
   - **#general** - Company-wide announcements
   - **#team** - Internal team discussions
   - **#support** - Help and troubleshooting
3. Or click **Direct Messages** to message a specific team member
4. Type your message and press **Enter** to send

**Tip:** Messages update automatically every 3 seconds - no need to refresh!

### Sending an SMS to a Contact

1. Navigate to **Contacts** and select a contact
2. Click the **SMS** tab
3. Enter your message in the text box
4. Verify the phone number is correct
5. Click **Send SMS**
6. Watch for delivery status: ✓ Sent → ✓ Delivered

**Note:** SMS requires Twilio integration to be enabled by your administrator.

### Saving a Conversation to a Job

1. Open a chat conversation (channel or direct message)
2. Click **Save to Job** button
3. Select the job from the dropdown
4. Choose either:
   - **Save Single Message** - Save just one message
   - **Save Entire Conversation** - Save all visible messages
5. Click **Confirm**

**Saved messages appear in the job's Messages tab for future reference.**

---

## Common Tasks

### Checking for New Messages

**Unread Badge:** A red number appears on the chat icon in the navigation bar when you have new messages.

**To mark as read:**
1. Click the chat icon
2. The badge clears automatically when you view the chat page

### Viewing Messages for a Specific Job

1. Open the job detail page
2. Click the **Messages** tab
3. View all conversations saved to this job
4. Use the search box to find specific messages

### Replying to an Incoming SMS

When a contact sends you an SMS:

1. You'll see the message in the contact's SMS tab
2. Messages are marked with direction:
   - **Balloon on left** - Incoming from contact
   - **Balloon on right** - Sent by you
3. Type your reply in the text box
4. Click **Send SMS**

**Tip:** Incoming messages automatically match to the contact's record by phone number.

### Searching Chat History

1. Navigate to a job's Messages tab or the main Chat page
2. Use the search box at the top
3. Search by:
   - Keyword (searches message content)
   - User name
   - Date range
4. Results appear as you type

---

## Troubleshooting

### "Twilio not enabled" Error When Sending SMS

**Problem:** You see an error when trying to send an SMS.

**Solution:** Your administrator needs to enable Twilio integration:
1. Go to **Settings → Company**
2. Enable Twilio
3. Enter Twilio credentials (Account SID, Auth Token, Phone Number)

**Contact your system administrator if you don't have access.**

---

### SMS Shows "Failed" Status

**Problem:** Your SMS shows a red ✗ icon instead of delivered.

**Possible Causes:**
- Invalid phone number format
- Contact's phone is off or out of service
- Twilio account out of credits

**Solution:**
1. Check the phone number is correct
2. Verify the number includes area code
3. Contact your administrator to check Twilio account status

---

### Messages Not Appearing Immediately

**Problem:** You sent a message but it doesn't appear right away.

**Expected Behavior:** Messages appear within 3 seconds (auto-refresh interval).

**If delayed beyond 3 seconds:**
1. Check your internet connection
2. Refresh the page manually (F5)
3. Contact support if the issue persists

---

### Can't Find a Saved Conversation

**Problem:** You saved messages to a job but can't find them.

**Solution:**
1. Go to the job detail page
2. Click **Messages** tab (not Communications or Email)
3. Use search to filter by keyword or date
4. Verify you selected the correct job when saving

**Note:** Messages are permanently linked once saved - they cannot be unlinked.

---

## Related Topics

- **Chapter 5:** Jobs & Construction Management (viewing job messages)
- **Chapter 3:** Contacts & Relationships (SMS contact association)
- **Chapter 2:** System Administration (Twilio configuration)

---

# Chapter 15: Xero Accounting Sync

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 15 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 15 (Developers) │
└─────────────────────────────────────────────────┘

## What is Xero Integration?

Xero is an accounting software that manages your company's finances: invoices, payments, bills, and tax reporting. TEEEM connects to Xero to automatically sync contacts and track purchase order payments.

**Benefits:**
- **No duplicate data entry** - Contacts sync both ways
- **Invoice matching** - Link Xero invoices to purchase orders
- **Payment tracking** - Track what's been paid to suppliers
- **Tax compliance** - Xero handles GST/tax calculations

---

## Getting Started

### Step 1: Connect to Xero

1. Go to **Settings** → **Integrations**
2. Find "Xero Accounting" card
3. Click **"Connect to Xero"**
4. You'll be taken to Xero's login page
5. Sign in with your Xero account
6. Click **"Allow Access"** to authorize TEEEM
7. You'll be redirected back to TEEEM

**Success!** You should see "Connected to Xero" with your company name.

---

### Step 2: Sync Your Contacts

After connecting, sync your contacts between TEEEM and Xero:

1. Go to **Settings** → **Integrations** → **Xero**
2. Click **"Sync Contacts"** button
3. You'll see a progress bar showing sync status
4. Wait for it to complete (can take 1-2 minutes for 100 contacts)

**What happens during sync:**
- TEEEM contacts → Xero (creates new contacts in Xero)
- Xero contacts → TEEEM (imports contacts from Xero)
- Matching contacts (updates both sides if changes found)

**Tip:** Sync runs in the background. You can continue working while it runs!

---

## Managing Contacts

### Enable/Disable Sync for a Contact

By default, ALL contacts sync with Xero. To stop a contact from syncing:

1. Go to **Contacts** page
2. Click on the contact
3. Scroll to "Xero Settings" section
4. Toggle **"Sync with Xero"** OFF

**When to disable sync:**
- Internal contacts (staff, not suppliers/clients)
- Test/dummy contacts
- Contacts you don't want in Xero

### View Sync Status

Each contact shows its Xero sync status:

- **Synced** ✅ - Contact is in both TEEEM and Xero
- **Not Synced** - Contact only in TEEEM
- **Error** ❌ - Sync failed (click for details)

**Check sync time:**
- "Last synced: 2 hours ago" shows when it last updated

---

## Invoice Matching

Match Xero invoices to your purchase orders to track payments.

### Step 1: Find the Invoice in Xero

1. Go to **Purchase Orders** page
2. Click on a purchase order
3. Click **"Match Xero Invoice"** button
4. Search for the invoice by:
   - Supplier name
   - Invoice number
   - Amount
   - Date range

### Step 2: Confirm the Match

1. Select the invoice from search results
2. Review the details:
   - **Invoice total** should match **PO total** (±5% tolerance)
   - **Supplier** should match
   - **Date** should be around PO creation date
3. Click **"Match Invoice"** to confirm

**After matching:**
- PO shows "Xero Invoice: INV-12345"
- Payment status updates automatically from Xero
- Can now create payment in TEEEM

---

## Recording Payments

After matching an invoice, record a payment:

### Create a Payment

1. Go to the matched **Purchase Order**
2. Click **"Record Payment"** button
3. Fill in payment details:
   - **Amount:** How much you paid (can be partial)
   - **Date:** When payment was made
   - **Reference:** Bank transaction reference (optional)
4. Click **"Save Payment"**

### Sync Payment to Xero

After saving the payment in TEEEM:

1. Click **"Sync to Xero"** button on the payment
2. Payment is created in Xero
3. Invoice status updates in Xero (Partial Paid or Paid)

**Payment status:**
- **0%** - Not paid
- **50%** - Partially paid (e.g., paid $5,000 of $10,000)
- **100%** - Fully paid

---

## Common Scenarios

### Scenario 1: New Supplier Added

**You add a new supplier in TEEEM:**

1. Create contact in TEEEM (Contacts → New Contact)
2. Fill in supplier details (ABN, email, phone)
3. Save contact
4. Wait 5-10 minutes (auto-sync runs periodically)
5. OR: Manually click "Sync Contacts" in Settings → Xero

**Result:** Supplier appears in Xero automatically!

---

### Scenario 2: Invoice Already Paid in Xero

**You paid an invoice directly in Xero:**

1. Go to Purchase Order in TEEEM
2. Click "Match Xero Invoice"
3. Select the invoice
4. TEEEM detects it's already paid in Xero
5. Payment status shows 100%

**No action needed** - TEEEM recognizes it's paid!

---

### Scenario 3: Partial Payment

**You paid $5,000 of a $10,000 invoice:**

1. Create payment in TEEEM for $5,000
2. Sync to Xero
3. PO shows "50% paid"
4. Later, create another payment for $5,000
5. Sync again
6. PO shows "100% paid"

---

## Troubleshooting

### "Not authenticated with Xero"

**Problem:** Lost connection to Xero

**Solution:**
1. Go to Settings → Integrations → Xero
2. Click "Disconnect"
3. Click "Connect to Xero" again
4. Re-authorize TEEEM

---

### "Sync job stuck at 'queued'"

**Problem:** Contact sync not starting

**Solution:**
1. Refresh the page
2. Wait 1-2 minutes
3. If still stuck, contact support

---

### "Duplicate contacts in Xero"

**Problem:** Same contact appears twice in Xero

**Solution:**
1. In Xero, merge the duplicate contacts
2. In TEEEM, go to Settings → Xero
3. Click "Sync Contacts" again
4. TEEEM will detect the merge

---

### "Invoice total doesn't match PO"

**Problem:** Invoice is $10,500 but PO is $10,000

**Solution:**
- **Allowed:** ±5% difference (e.g., $9,500 - $10,500 is OK)
- **Not allowed:** >5% difference

**If difference is too large:**
1. Check if PO total is correct
2. Update PO line items if needed
3. OR: Match invoice manually (override check)

---

## Tips & Best Practices

### Tip #1: Sync Contacts Regularly

Run "Sync Contacts" weekly to keep both systems up-to-date.

**Why?**
- New suppliers added in Xero appear in TEEEM
- Updated emails/phones sync both ways

---

### Tip #2: Match Invoices Before Paying

Always match the Xero invoice BEFORE recording payment in TEEEM.

**Why?**
- Ensures payment syncs to correct invoice
- Prevents orphaned payments in Xero

---

### Tip #3: Use Reference Numbers

When recording payments, use the bank transaction reference.

**Example:** "NAB-TRANSFER-12345"

**Why?**
- Easier to reconcile in Xero
- Helps find payment in bank statement

---

### Tip #4: Check Sync Errors

If a contact shows "Sync Error":
1. Click on the contact
2. Scroll to "Xero Settings"
3. Read the error message
4. Fix the issue (usually missing email or ABN)
5. Click "Retry Sync"

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Xero settings | (none yet) |
| Match invoice | (none yet) |
| Record payment | (none yet) |

---

## FAQ

**Q: Do I need a Xero account?**
A: Yes, you need a Xero subscription. TEEEM connects to your existing Xero account.

**Q: Can I disconnect from Xero?**
A: Yes, go to Settings → Integrations → Xero → "Disconnect". This won't delete any data in Xero.

**Q: What if I change something in Xero?**
A: Run "Sync Contacts" in TEEEM to pull the changes from Xero.

**Q: Can I sync invoices?**
A: Not automatically. You must manually match Xero invoices to purchase orders.

**Q: Does TEEEM create invoices in Xero?**
A: No, TEEEM only matches existing invoices. You create invoices in Xero.

**Q: What happens if I delete a contact in TEEEM?**
A: It won't delete from Xero. Xero contacts are never deleted automatically.

---

## Next Steps

After setting up Xero integration:
1. **Chapter 16:** Learn how to track payments in detail
2. **Chapter 8:** Set up purchase orders for better invoice matching
3. **Chapter 5:** Add suppliers as contacts for Xero sync

---

# Chapter 16: Payment Tracking

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 16 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 16 (Developers) │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## What is Payment Tracking?

Payment tracking helps you record and monitor all payments made against purchase orders. The system tracks payment history, calculates remaining balances, and automatically syncs with Xero accounting software for accurate financial reporting.

**Key Benefits:**
- **Payment History** - See all payments made against each purchase order
- **Automatic Status Updates** - Payment status updates based on amounts paid
- **Xero Integration** - Payments sync automatically to your accounting software
- **Budget Monitoring** - Track spending against budgeted amounts

All financial data uses precise decimal calculations to ensure accuracy down to the cent.

---

## Getting Started

### Recording a Payment

1. Open a **Purchase Order** detail page
2. Scroll to the **Payments** section
3. Click **"Record Payment"** button
4. Fill in payment details:
   - **Amount**: Enter the payment amount (e.g., $1,234.56)
   - **Payment Date**: Select when payment was made
   - **Payment Method**: Choose from Bank Transfer, EFT, Check, Credit Card, Cash, or Other
   - **Reference Number**: Enter check number or transaction reference (optional)
   - **Notes**: Add any additional details (optional)
5. Click **"Save Payment"**

**The payment summary updates automatically showing total paid and remaining balance.**

### Understanding Payment Status

Purchase orders display a payment status badge with four states:

- **Pending** (Gray) - No payments recorded yet
- **Partial Payment** (Yellow) - Some amount paid, but not complete
- **Paid** (Green) - Fully paid (within 5% tolerance)
- **Needs Review** (Red) - Overpayment detected, requires manual review

**Status updates automatically as you record payments.**

### Viewing Payment History

On any Purchase Order page:

1. Look for the **Payments** section
2. View the **payment summary box** showing:
   - PO Total
   - Total Paid (green)
   - Remaining (red)
3. Scroll down to see **payment timeline** with:
   - Payment amount
   - Date paid
   - Payment method
   - Reference number
   - Who recorded the payment
   - Xero sync status (green checkmark if synced)

---

## Common Tasks

### Using "Pay Remaining" Quick Action

When making a final payment:

1. Click **"Record Payment"**
2. Click the **"Use remaining amount"** button
3. The amount field auto-fills with the remaining balance
4. Select payment method and reference
5. Click **"Save Payment"**

**This ensures exact payment amounts without manual calculation.**

### Matching Xero Invoices

If you use Xero accounting:

1. Open a Purchase Order
2. Click **"Match Xero Invoice"** button
3. Search for the invoice by number, supplier, or reference
4. Click **"Match to PO"** next to the correct invoice
5. Confirm the match

**The system automatically:**
- Links the invoice to the PO
- Updates payment status
- Syncs payment data to Xero

### Checking Budget Variance

If a PO has a budget set:

1. Open the Purchase Order
2. Look for the **Budget** section
3. View:
   - **Budgeted Amount**: Original budget
   - **Actual Amount**: Current PO total
   - **Variance**: Difference (red if over, green if under)

**Over-budget POs are highlighted in red for visibility.**

### Deleting an Incorrect Payment

1. Navigate to the Purchase Order
2. Find the payment in the payment timeline
3. Click the red **trash icon** next to the payment
4. Confirm deletion

**Warning:** This will update the PO payment status and remaining balance. Deleted payments cannot be recovered.

---

## Troubleshooting

### Payment Status Shows "Needs Review"

**Problem:** The payment status badge is red and shows "Needs Review."

**Cause:** The total paid amount exceeds the PO total by more than 5% or $1.

**Solution:**
1. Check the payment history for errors
2. Verify the PO total is correct
3. If overpayment is intentional (e.g., rush fees, shipping), note it in the payment notes
4. Contact your manager to approve the overage

---

### Xero Sync Failed

**Problem:** Payment shows a red X icon instead of green checkmark for Xero sync.

**Cause:** The payment failed to sync to Xero (network issue, authentication expired, or invoice not matched).

**Solution:**
1. Ensure the PO has a matched Xero invoice first
2. Click the **"Sync to Xero"** button to retry
3. If sync continues to fail, check Xero connection status (Settings → Xero Integration)
4. Contact your administrator if the problem persists

---

### Can't Find a Payment

**Problem:** You recorded a payment but can't see it in the timeline.

**Solution:**
1. Verify you're viewing the correct Purchase Order
2. Scroll down to the Payments section (below PO details)
3. Check the payment summary box shows updated Total Paid
4. Refresh the page (F5)
5. If still missing, check if payment was recorded on a different PO

---

### Remaining Balance Doesn't Match

**Problem:** The "Remaining" amount doesn't match your calculations.

**Explanation:** The system calculates:
- **Remaining = PO Total - Total Paid**

**Check:**
1. Verify the PO Total hasn't changed (line items updated?)
2. Sum all payments in the timeline manually
3. Ensure no payments were deleted or modified
4. If discrepancy persists, contact support with PO number

---

## Related Topics

- **Chapter 8:** Purchase Orders (creating and managing POs)
- **Chapter 15:** Xero Accounting Integration (invoice matching, sync setup)
- **Chapter 5:** Jobs & Construction Management (budget tracking)

---

# Chapter 17: Workflow Automation

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 17 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 17 (Developers) │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## What are Workflows & Automation?

Workflows in TEEEM help you manage multi-step approval processes for important business actions like Purchase Order approvals, Client onboarding, and Contract reviews. Each workflow has defined steps that must be completed in order by different team members.

Automation features run background tasks like:
- **Automated Price Updates** - Apply scheduled supplier price changes daily at midnight
- **OneDrive Folder Creation** - Automatically create job folder structures
- **Weather Tracking** - Check yesterday's rain automatically for active jobs
- **Xero Sync** - Keep contacts synchronized with your accounting system

These automations run in the background so you can focus on more important work.

---

## Getting Started

### Starting a Workflow

**Example: Purchase Order Approval Workflow**

1. **Navigate to the resource** (e.g., a Purchase Order)
2. **Click "Start Approval Workflow"** button
3. **Fill in metadata:**
   - Client details (name, email, phone)
   - Financial info (amount, payment terms)
   - Scope and requirements
   - Attach supporting documents
4. **Submit workflow** - The first approver is notified automatically

**What happens next:**
- Workflow appears in your "Pending Approvals" inbox
- First approver receives notification
- Each step must be completed before next step starts
- You can track progress from the Workflows page

---

### Approving a Workflow Step

When you receive a workflow approval notification:

1. **Open "My Tasks" or "Workflows"** from the sidebar
2. **Click on the workflow** to view details
3. **Review all information:**
   - Metadata (client info, amounts, scope)
   - Attached documents (plans, quotes, etc.)
   - Previous approval comments
4. **Choose an action:**
   - **Approve** - Move to next step (or complete workflow if final step)
   - **Reject** - Stop workflow and notify requester
   - **Request Changes** - Send back to requester with comments
5. **Add comment** (optional but recommended)
6. **Click "Submit"**

The workflow automatically advances to the next step (no manual routing needed).

---

### Viewing Workflow Status

**To check workflow progress:**

1. **Navigate to Workflows page** (sidebar)
2. **Filter workflows:**
   - My Pending Approvals (awaiting your action)
   - Workflows I Started
   - All Workflows (admin only)
3. **Click workflow** to see:
   - Current step and status
   - All completed steps with comments
   - Pending steps and assigned approvers
   - Full metadata and attachments

**Workflow Statuses:**
- 🟡 **Pending** - Not yet started
- 🔵 **In Progress** - Currently at an approval step
- ✅ **Completed** - All steps approved
- ❌ **Rejected** - Rejected by an approver
- ⏸️ **Cancelled** - Cancelled by requester or admin

---

## Common Tasks

### Viewing Automated Job Status

Some automations show their progress status:

**OneDrive Folder Creation:**
1. Go to Job page
2. Check "Folder Status" field:
   - Not Requested (not created yet)
   - Pending (queued for creation)
   - Processing (creating now)
   - Completed (folders ready)
   - Failed (see error message)

**Price Updates:**
1. Go to Price Books page
2. Check "Last Price Update" timestamp
3. View "Price History" to see when automated updates applied

**Weather Tracking:**
1. Go to Job page
2. Click "Weather History" tab
3. See automated rain logs from previous days

---

### Cancelling a Workflow

**If you started a workflow by mistake:**

1. Go to Workflows page
2. Click your workflow
3. Click "Cancel Workflow" button (top-right)
4. Confirm cancellation
5. Add reason (recommended)

**Note:** Only requester or admin can cancel workflows.

---

### Retrying a Failed Automation

**If an automated job fails (e.g., OneDrive folder creation):**

1. **Check the error message** (shown in red on the page)
2. **Fix the underlying issue:**
   - For OneDrive: Check connection in Settings → Integrations
   - For Xero: Verify Xero credentials
   - For Weather: Verify job has valid address
3. **Click "Retry" button** (appears on failed jobs)
4. **Monitor status** - Should change to "Processing" then "Completed"

**Still failing?** Contact your administrator or support.

---

## Troubleshooting

### "Workflow Step Won't Advance"

**Problem:** You approved a step but workflow didn't move to next step.

**Solution:**
- Refresh the page (workflow may have advanced)
- Check if you're the assigned approver for current step
- Verify you clicked "Submit" (not just "Save Draft")
- Contact admin if workflow is stuck for >5 minutes

---

### "Background Job Taking Too Long"

**Problem:** OneDrive folders show "Processing" for more than 10 minutes.

**Solution:**
- Check OneDrive connection: Settings → Integrations → OneDrive
- Verify OneDrive has sufficient storage space
- Click "Cancel" and retry if stuck >30 minutes
- Contact support if issue persists

---

### "Price Updates Not Applying"

**Problem:** Scheduled price changes didn't apply at midnight.

**Solution:**
- Verify price has "Effective Date" set correctly
- Check that supplier matches the item's "Default Supplier"
- Go to Price History and check if price was manually applied
- Only latest price for each date applies (duplicates skipped)

---

## Related Topics

- **Chapter 12:** OneDrive Integration (folder automation details)
- **Chapter 15:** Xero Accounting Integration (sync automation)
- **Chapter 7:** AI Plan Review (automated plan analysis)
- **Chapter 11:** Weather & Public Holidays (automated weather tracking)
- **Chapter 4:** Price Books & Suppliers (price update automation)

---

# Chapter 18: Custom Data Tables

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter 18 (Developers) │
│ 📕 LEXICON (BUGS):     Chapter 18 (Developers) │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## What are Custom Data Tables?

Custom Data Tables let you create your own database tables without needing a developer. You can design tables tailored to your specific business needs - like tracking equipment, managing inventory, or storing client information - with 17 different column types including text, numbers, dates, dropdowns, and calculated formulas.

Think of it like creating your own mini-database or Excel spreadsheet, but with better data validation, relationships between tables, and automatic calculations.

---

## Getting Started

### Creating Your First Table

1. **Navigate to Settings → Custom Tables**
2. **Click "Create New Table"**
3. **Fill in table details:**
   - **Name:** "Equipment Inventory" (user-friendly name)
   - **Description:** What this table tracks
   - **Icon:** Choose an icon (optional)
4. **Click "Create Table"**

The system creates a new empty table. Now you'll add columns to define what data it stores.

---

### Adding Columns

**After creating a table:**

1. **Click "Add Column"** button
2. **Select column type:**
   - **Single Line Text** - Short text (names, codes)
   - **Multiple Lines Text** - Long text (descriptions, notes)
   - **Number** - Decimal numbers (prices, measurements)
   - **Currency** - Money amounts
   - **Date** - Calendar dates
   - **Checkbox** - Yes/No fields
   - **Lookup** - Reference to another table's records
   - **Computed** - Calculated field (formulas)
   - ... and 9 more types
3. **Configure column:**
   - **Name:** "Equipment Name"
   - **Required:** Check if this field is mandatory
   - **Default Value:** Pre-fill new records (optional)
4. **Click "Save Column"**

The column is immediately added to your table!

---

### Adding Data (Records)

**To add data to your table:**

1. **Open your table** from Settings → Custom Tables
2. **Click "+ New Record"**
3. **Fill in the fields:**
   - Type values for text/number fields
   - Pick dates from calendar
   - Select values from lookup dropdowns
   - Checkboxes for yes/no fields
4. **Click "Save"**

Your record appears in the table instantly.

---

## Common Tasks

### Creating Calculated Columns (Formulas)

**Example: Calculate total price from quantity × unit price**

1. **Add a new column** to your table
2. **Select type: "Computed"**
3. **Enter formula:**
   ```
   {quantity} * {unit_price}
   ```
4. **Test formula** (button shows preview result)
5. **Save column**

**Formula Tips:**
- Use `{column_name}` to reference other fields
- Supports +, -, *, /, parentheses
- Can reference lookup fields: `{supplier.tax_rate} * {amount}`

**Formula Examples:**
```
{cost} + {tax}                          // Sum
{amount} / {units}                      // Division
({price} - {discount}) * {quantity}     // Complex calculation
```

---

### Linking Tables with Lookups

**Example: Link Purchase Orders to Suppliers**

1. **Create a "Suppliers" table** first (if not exists)
2. **In your "Purchase Orders" table, add column**
3. **Select type: "Lookup"**
4. **Choose:**
   - **Lookup Table:** Suppliers
   - **Display Column:** "Company Name" (what users see)
5. **Save column**

**When creating records:**
- Lookup columns show dropdown of all Suppliers
- Select the supplier from dropdown
- Value displays as company name (not raw ID)

---

### Searching and Filtering Records

**To find specific records:**

1. **Use search box** (top of table)
   - Searches all text columns
   - Type keywords, press Enter
2. **Click column headers** to sort
   - Click once: Ascending (A-Z)
   - Click twice: Descending (Z-A)
3. **Use column filters** (if enabled)
   - Filter icon next to column name
   - Enter filter criteria

---

### Editing Records

**Two ways to edit:**

**Inline Editing:**
1. Click any cell in the table
2. Type new value
3. Press Enter or click outside cell
4. Saves automatically

**Edit Modal:**
1. Click row's "Edit" button
2. Update fields in modal
3. Click "Save"

---

### Deleting Records

**To delete a record:**

1. **Click trash icon** on the record row
2. **Confirm deletion** (can't be undone!)
3. **Record removed** permanently

**⚠️ Warning:** Deleting records is permanent. No undo!

---

## Troubleshooting

### "Can't Delete Table - Has Records"

**Problem:** Trying to delete a table but it says it has records.

**Solution:**
1. Delete all records from the table first
2. Go to Settings → Custom Tables
3. Click "View Records"
4. Delete records one by one or use bulk delete (if available)
5. Try deleting table again

---

### "Formula Returns ERROR"

**Problem:** Computed column shows "ERROR: ..." instead of calculated result.

**Solution:**
- **Check field names:** Use exact column names in `{curly braces}`
- **Check syntax:** Formulas use math operators: +, -, *, /, ()
- **Missing fields:** If you reference a field that doesn't exist, formula fails
- **Click "Test Formula"** button when creating column to check it works

**Common Mistakes:**
```
❌ {Quantity} * {Price}     // Capital letters (wrong)
✅ {quantity} * {price}     // Lowercase (correct)

❌ quantity * price         // Missing braces (wrong)
✅ {quantity} * {price}     // With braces (correct)
```

---

### "Lookup Shows 'Unknown'"

**Problem:** Lookup column displays "Unknown" instead of the related record's name.

**Solution:**
- The related record was deleted
- Lookup references a record that no longer exists
- Either:
  1. **Select a different record** from the dropdown
  2. **Leave as "Unknown"** (preserves historical data)

---

### "Can't Add Column - Reserved Name"

**Problem:** Error says column name is reserved or already exists.

**Solution:**
- Don't use: id, created_at, updated_at (system columns)
- Column names must be unique within the table
- Choose a different name

---

## Advanced Features

### Column Types Reference

| Type | Use For | Example |
|------|---------|---------|
| Single Line Text | Names, codes | "ABC-123" |
| Multiple Lines Text | Descriptions | Long paragraphs |
| Email | Email addresses | Validates format |
| Phone | Phone numbers | "(555) 123-4567" |
| URL | Website links | "https://..." |
| Number | Decimals | 123.45 |
| Whole Number | Integers | 100 |
| Currency | Money | $1,234.56 |
| Percentage | Percent values | 15.5% |
| Date | Dates only | 2025-11-16 |
| Date and Time | Timestamps | 2025-11-16 14:30 |
| Checkbox | Yes/No | ☑ / ☐ |
| Lookup | Related records | Link to another table |
| Computed | Formulas | Auto-calculated |

---

### Table Safety Features

**Protected Tables:**
- Set "Is Live" checkbox to prevent accidental deletion
- Live tables can't be deleted until unchecked

**Reference Protection:**
- Can't delete table if other tables reference it
- Must remove lookup columns first

**Data Protection:**
- Can't delete table with records
- Must delete records first

---

## Related Topics

- **Chapter 3:** Contacts & Relationships (similar lookup patterns)
- **Chapter 4:** Price Books & Suppliers (similar data structures)

---

## Getting Help

**Need assistance?**
- Check this manual first
- Contact your team lead
- Email support (coming soon)

---

**Last Updated:** 2025-11-16 09:01 AEST
**Maintained By:** Development Team

---

# Chapter 19: UI/UX Standards & Patterns

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter 19                │
│ 📕 LEXICON (BUGS):    Chapter 19                │
└─────────────────────────────────────────────────┘

**Audience:** End Users
**Purpose:** User guide for navigating TEEEM's interface
**Last Updated:** 2025-11-16

---

## What is This Chapter About?

This chapter explains how to use TEEEM's interface effectively. While most features are intuitive, knowing these tips will help you work faster and more efficiently.

**Key Interface Elements:**
- **Tables:** Resize columns, filter data, search across records
- **Modals:** Pop-up windows for creating/editing items
- **Search Boxes:** Quick filtering with clear buttons
- **Empty States:** Helpful prompts when starting fresh
- **Dark Mode:** Automatic dark theme based on your computer settings

---

## Getting Started

### Using Tables

Tables are the heart of TEEEM - they display contacts, jobs, purchase orders, suppliers, and more.

#### Searching and Filtering

**Quick Search:**
1. Find the search box at the top of any page
2. Type to filter results instantly
3. Click the **X button** to clear your search

**Column Filters:**
1. Look for filter boxes in the table headers
2. Type to filter specific columns
3. Combine filters to narrow results

**Sorting:**
1. Click any column header to sort
2. Click again to reverse sort direction
3. Arrow icons show current sort

#### Customizing Columns

**Resize Columns:**
1. Hover between column headers
2. Drag the resize handle left/right
3. Your preferences are saved automatically

**Reorder Columns:**
1. Click and hold a column header
2. Drag left or right to reorder
3. Drop in new position

**Scroll Long Lists:**
- Table headers "stick" to the top as you scroll
- Never lose track of which column you're viewing

---

### Working with Modals (Pop-ups)

Modals appear when creating or editing items.

**Opening a Modal:**
- Click buttons like "Add Contact", "New Job", "Create PO"
- Modal appears on top of current page

**Closing a Modal:**
- Click the **X button** (top-right corner)
- Press **ESC key** on keyboard
- Click **Cancel** button
- Click outside the modal (on the dark background)

**Saving Changes:**
- Fill out the form fields
- Click **Save** or **Submit** button
- Modal closes automatically on success

---

### Using Search Effectively

**Search Tips:**
- Search works across all visible columns
- Results update as you type (no need to press Enter)
- Use the **X button** to clear and start over

**Advanced Filtering:**
- Use column filters for targeted searches
- Example: Filter "City" column for "Sydney", then search for "John"
- Filters stack - narrow results step by step

---

### Understanding Empty States

When a page has no data, you'll see an empty state message.

**What They Tell You:**
- "No items found" - nothing matches your filters
- "Get started by..." - helpful next steps
- Action button - creates your first item

**Example:**
```
No contacts found
Get started by adding your first contact

[+ Add Contact]  ← Click this button
```

---

### Dark Mode

TEEEM automatically matches your computer's dark mode setting.

**How It Works:**
- **Mac:** System Preferences → General → Appearance → Dark
- **Windows:** Settings → Personalization → Colors → Choose your color → Dark
- TEEEM instantly switches to dark theme

**Manual Toggle:**
- Currently uses system preference only
- Manual toggle coming in future update

---

## Common Tasks

### Finding Records Quickly

**Use Case:** "I need to find a specific contact"

**Steps:**
1. Go to Contacts page
2. Type name in search box
3. Click contact to open details

**Pro Tip:** Use column filters if you know specifics:
- Filter "City" for "Melbourne"
- Filter "Type" for "Customer"
- Then search by name

---

### Organizing Table Views

**Use Case:** "I want to see different columns"

**Steps:**
1. **Resize:** Drag column borders to ideal width
2. **Reorder:** Drag column headers to rearrange
3. **Hide:** (Feature coming soon)

**Pro Tip:** Your column preferences are saved per-page and persist between sessions.

---

### Working with Long Lists

**Use Case:** "I need to scroll through 500 contacts"

**Steps:**
1. Scroll down the table
2. Headers "stick" to top - you always see column names
3. Use search/filters to narrow results instead of scrolling

**Pro Tip:** Filter by specific criteria to see fewer results:
- Active customers only
- Suppliers in a specific city
- Jobs created this month

---

## Troubleshooting

### "I Can't Find the Search Box"

**Problem:** Can't locate search on a page.

**Solution:**
- Look at the very top of the page content
- Search box has a magnifying glass icon
- Usually above the table

---

### "My Search Isn't Working"

**Problem:** Typing in search doesn't show results.

**Solution:**
- Check your spelling
- Remove column filters (they stack with search)
- Click the X button to clear and try again
- Refresh the page if search seems stuck

---

### "Table Columns Are Too Narrow"

**Problem:** Can't see full text in columns.

**Solution:**
- Hover between column headers
- Drag the resize handle to widen column
- Preferences save automatically

---

### "Modal Won't Close"

**Problem:** Pop-up window stuck on screen.

**Solution:**
- Try the X button (top-right)
- Press ESC key on keyboard
- Click outside modal on dark background
- Click Cancel button if available
- Last resort: Refresh the page (unsaved changes will be lost)

---

### "I Accidentally Cleared My Filters"

**Problem:** Clicked X and lost filter settings.

**Solution:**
- Column filters: Type them again
- Search: Type query again
- Column order/size: These persist, don't worry

---

## Advanced Features

### Keyboard Shortcuts

**Navigation:**
- `ESC` - Close modal
- `TAB` - Move between form fields
- `ENTER` - Submit form (when in text field)

**Future Shortcuts** (coming soon):
- `Cmd+K` / `Ctrl+K` - Quick search
- `Cmd+N` / `Ctrl+N` - New item

---

### Bulk Operations

Some tables support selecting multiple items:

1. Click checkboxes in left column
2. Select individual items or "Select All"
3. Bulk action buttons appear at top
4. Perform action (delete, export, etc.)

**Available On:**
- Contacts page
- (More coming soon)

---

## Related Topics

- **Chapter 3:** Contacts & Relationships (how to use Contacts table)
- **Chapter 4:** Price Books & Suppliers (using Suppliers table)
- **Chapter 5:** Jobs & Construction (Jobs table features)
- **Chapter 8:** Purchase Orders (PO table with advanced features)

---

## Getting Help

**Need assistance?**
- Check feature-specific chapters (1-18) for details
- Contact your team lead
- Email support (coming soon)

---

# Chapter 20: Corporate Module

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter 20                │
│ 📕 LEXICON (BUGS):    Chapter 20                │
└─────────────────────────────────────────────────┘

**Audience:** End Users (Corporate Administrators)
**Purpose:** Managing company groups, directors, shareholders, and compliance
**Last Updated:** 2026-01-31

---

## What is the Corporate Module?

The Corporate Module helps you manage your corporate structure, including:
- ✅ Company groups and subsidiaries
- ✅ Directors and their appointments
- ✅ Shareholders and share registers
- ✅ Trust beneficiaries
- ✅ ASIC compliance and filings
- ✅ Corporate documents and minutes

**Who Uses This:**
- Company secretaries
- Accountants
- Business owners managing multiple entities
- Compliance officers

---

## Company Structure

### Viewing the Structure

1. **Navigate to:** Corporate → Structure
2. **See your hierarchy:**
   - Parent companies at the top
   - Subsidiaries branching below
   - Click to expand/collapse branches
3. **Click any company** to view its details

### Adding a Company

1. **Click "Add Company"**
2. **Enter company details:**
   - **Name:** Full legal name
   - **ACN/ABN:** Australian Company/Business Number
   - **Type:** Company, Trust, Partnership, etc.
   - **Parent:** Select parent company (or leave blank for top-level)
3. **Click "Save"**

### Company Types

| Type | Description |
|------|-------------|
| Company | Pty Ltd, Ltd companies |
| Trust | Family trusts, unit trusts |
| Partnership | Business partnerships |
| Sole Trader | Individual businesses |
| Association | Clubs, charities |

---

## Managing Directors

### Viewing Directors

1. **Navigate to:** Corporate → Directors
2. **See all directors** across all companies
3. **Filter by:** Company, status, appointment date

### Adding a Director

1. **Click "Add Director"**
2. **Enter details:**
   - **Name:** Full legal name
   - **Date of Birth:** Required for ASIC
   - **Address:** Residential address
   - **Appointment Date:** When they became a director
3. **Link to companies:** Select which companies they direct
4. **Click "Save"**

### Recording Appointments/Resignations

**New Appointment:**
1. Open the director record
2. Click "Add Appointment"
3. Select company and enter date
4. Specify position (Director, Secretary, etc.)

**Resignation:**
1. Open the director record
2. Find the appointment
3. Click "Record Resignation"
4. Enter resignation date

---

## Shareholders & Share Register

### Viewing Shareholders

1. **Navigate to:** Corporate → Shareholders
2. **See all shareholders** and their holdings
3. **Filter by:** Company, share class

### Recording Share Ownership

1. **Click "Add Shareholder"**
2. **Enter details:**
   - **Shareholder:** Name or company
   - **Company:** Which company they hold shares in
   - **Share Class:** Ordinary, Preference, etc.
   - **Number of Shares:** How many shares held
3. **Click "Save"**

### Share Transfers

1. **Find the shareholding** to transfer
2. **Click "Transfer Shares"**
3. **Enter:**
   - Number of shares to transfer
   - New shareholder (existing or new)
   - Transfer date
   - Consideration (price paid)
4. **Click "Complete Transfer"**

### Generating Share Register

1. **Go to:** Corporate → Companies → [Company] → Share Register
2. **Click "Generate Register"**
3. **Select date** (current or historical)
4. **Download PDF** or view on screen

---

## Trust Beneficiaries

### Adding Beneficiaries

1. **Navigate to:** Corporate → Beneficiaries
2. **Click "Add Beneficiary"**
3. **Enter details:**
   - **Name:** Beneficiary name
   - **Trust:** Which trust they're a beneficiary of
   - **Type:** Primary, Secondary, Default
   - **Entitlement:** Percentage or fixed amount
4. **Click "Save"**

### Recording Distributions

1. **Open the beneficiary** record
2. **Click "Record Distribution"**
3. **Enter:**
   - Distribution amount
   - Date of distribution
   - Tax year
4. **Click "Save"**

---

## ASIC Logins & Compliance

### Storing ASIC Credentials

1. **Navigate to:** Corporate → ASIC Logins
2. **Click "Add ASIC Login"**
3. **Enter:**
   - **Company:** Which company this login is for
   - **Username:** ASIC portal username
   - **Password:** Portal password (stored securely)
   - **Last Updated:** When password was changed
4. **Click "Save"**

### Compliance Calendar

1. **Navigate to:** Corporate → Compliance Calendar
2. **View upcoming deadlines:**
   - Annual reviews
   - ASIC filings
   - Director appointments/resignations
   - Shareholder meetings
3. **Click any deadline** to see details
4. **Mark as complete** when done

### Setting Reminders

1. **Open a compliance task**
2. **Click "Set Reminder"**
3. **Choose:**
   - Days before deadline
   - Who to notify
4. **Click "Save"**

---

## Corporate Documents

### Minute Templates

1. **Navigate to:** Corporate → Minute Templates
2. **Browse templates:**
   - Director meetings
   - Shareholder meetings
   - Resolutions
   - Consents
3. **Click "Use Template"** to create from template
4. **Customize** with your company details
5. **Save or export** as PDF

### Uploading Documents

1. **Open a company** record
2. **Go to "Documents" tab**
3. **Click "Upload"**
4. **Select files** from your computer
5. **Choose document type:**
   - Constitution
   - Minutes
   - ASIC Forms
   - Certificates
6. **Click "Upload"**

---

## Corporate Health Dashboard

### Understanding Health Indicators

1. **Navigate to:** Corporate → Health
2. **See status indicators:**
   - 🟢 **Green:** All compliant
   - 🟡 **Yellow:** Action needed soon
   - 🔴 **Red:** Overdue/urgent
3. **Click indicators** to see specific issues

### Common Issues

| Issue | Action Required |
|-------|-----------------|
| Annual review due | File with ASIC |
| Director expired | Update or remove |
| Missing shareholder | Add to register |
| Document expired | Upload new version |

---

## Related Topics

- **Chapter 3:** Contacts & Relationships (linking contacts to directors)
- **Chapter 12:** OneDrive File Management (corporate document storage)
- **Chapter 15:** Xero Accounting Sync (corporate financial data)

---

# Chapter 21: Work Health & Safety (WHS)

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter 21                │
│ 📕 LEXICON (BUGS):    Chapter 21                │
└─────────────────────────────────────────────────┘

**Audience:** End Users (Safety Officers, Site Managers)
**Purpose:** Managing workplace health and safety compliance
**Last Updated:** 2026-01-31

---

## What is WHS in TEEEM?

The WHS module helps you manage workplace safety, including:
- ✅ Incident reporting and tracking
- ✅ Safety inspections
- ✅ Site inductions
- ✅ SWMS (Safe Work Method Statements)
- ✅ Action items and corrective measures

**Who Uses This:**
- Safety officers
- Site supervisors
- Project managers
- HR administrators

---

## WHS Dashboard

### Accessing the Dashboard

1. **Navigate to:** WHS → Dashboard
2. **View at a glance:**
   - Open incidents
   - Upcoming inspections
   - Expiring inductions
   - Overdue action items

### Understanding Metrics

| Metric | What It Shows |
|--------|--------------|
| Open Incidents | Incidents requiring action |
| Days Since Last Incident | Safety streak |
| Pending Inspections | Scheduled but not completed |
| Expired Inductions | Workers needing re-induction |

---

## Incident Reporting

### Reporting an Incident

1. **Navigate to:** WHS → Incidents
2. **Click "Report Incident"**
3. **Fill in details:**
   - **Date/Time:** When it happened
   - **Location:** Site or area
   - **Type:** Injury, near-miss, property damage, etc.
   - **Severity:** Minor, moderate, serious, critical
   - **Description:** What happened
   - **People Involved:** Workers, witnesses
4. **Attach evidence:**
   - Photos of scene
   - Witness statements
5. **Click "Submit"**

### Incident Types

| Type | Examples |
|------|----------|
| Injury | Cuts, falls, strains |
| Near Miss | Almost hit, close call |
| Property Damage | Equipment, materials |
| Environmental | Spills, contamination |
| Security | Theft, trespass |

### Managing Incidents

**Update Status:**
1. Open the incident
2. Change status: Open → Investigating → Corrective Action → Closed
3. Add notes at each stage

**Add Corrective Actions:**
1. Open the incident
2. Click "Add Action Item"
3. Describe the action needed
4. Assign to a person
5. Set due date

---

## Safety Inspections

### Scheduling an Inspection

1. **Navigate to:** WHS → Inspections
2. **Click "Schedule Inspection"**
3. **Enter details:**
   - **Type:** Daily, weekly, monthly, annual
   - **Location:** Site or area
   - **Inspector:** Who will conduct
   - **Date:** When scheduled
4. **Click "Save"**

### Conducting an Inspection

1. **Open the scheduled inspection**
2. **Click "Start Inspection"**
3. **Work through the checklist:**
   - Check each item
   - Mark as Pass, Fail, or N/A
   - Add comments where needed
4. **Record any issues:**
   - Take photos
   - Create action items
5. **Click "Complete Inspection"**

### Inspection Checklists

Common checklist items:
- PPE compliance
- Housekeeping
- Electrical safety
- Fire safety
- First aid
- Signage
- Equipment condition

---

## Site Inductions

### Recording an Induction

1. **Navigate to:** WHS → Inductions
2. **Click "Record Induction"**
3. **Enter details:**
   - **Worker:** Name or select from contacts
   - **Site:** Which site inducted for
   - **Inducted By:** Who conducted induction
   - **Date:** When inducted
   - **Expiry:** When re-induction required
4. **Click "Save"**

### Managing Expirations

1. **View expiring inductions** on the dashboard
2. **Filter by:**
   - Expired (past due)
   - Expiring soon (next 30 days)
   - Valid
3. **Click "Renew"** to record re-induction

### Induction Report

1. **Navigate to:** WHS → Inductions
2. **Click "Generate Report"**
3. **Select:**
   - Site (or all sites)
   - Date range
   - Status filter
4. **Export to PDF or Excel**

---

## SWMS (Safe Work Method Statements)

### Creating a SWMS

1. **Navigate to:** WHS → SWMS
2. **Click "Create SWMS"**
3. **Enter details:**
   - **Title:** What work is covered
   - **Job/Site:** Where it applies
   - **Description:** Scope of work
4. **Add hazards and controls:**
   - Identify each hazard
   - Add risk rating (likelihood × consequence)
   - Describe control measures
5. **Click "Save Draft"**

### SWMS Sign-off

1. **Open the SWMS**
2. **Click "Request Sign-off"**
3. **Select workers** who need to sign
4. **Workers sign electronically:**
   - They receive notification
   - Click to review SWMS
   - Sign on screen
5. **Track completion** on the SWMS record

### SWMS Review

- Review SWMS regularly (at least annually)
- Update when work conditions change
- Create new versions (keeps history)

---

## Action Items

### Viewing Action Items

1. **Navigate to:** WHS → Action Items
2. **See all safety actions:**
   - From incidents
   - From inspections
   - Standalone items
3. **Filter by:**
   - Status (open, overdue, complete)
   - Assigned person
   - Priority

### Creating Action Items

1. **Click "Add Action Item"**
2. **Enter details:**
   - **Description:** What needs to be done
   - **Priority:** Low, medium, high, critical
   - **Assigned To:** Who is responsible
   - **Due Date:** Deadline
   - **Linked To:** Incident, inspection (optional)
3. **Click "Save"**

### Completing Actions

1. **Open the action item**
2. **Add completion notes:**
   - What was done
   - Photos of completed work
3. **Click "Mark Complete"**
4. **Optionally:** Have supervisor verify

---

## Related Topics

- **Chapter 5:** Jobs & Construction Management (linking WHS to jobs)
- **Chapter 10:** Daily Tasks & Checklists (safety checklists)
- **Chapter 17:** Workflow Automation (safety workflows)

---

# Chapter 22: Customer Portal

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter 22                │
│ 📕 LEXICON (BUGS):    Chapter 22                │
└─────────────────────────────────────────────────┘

**Audience:** End Users (and their Customers)
**Purpose:** External client access to project information
**Last Updated:** 2026-01-31

---

## What is the Customer Portal?

The Customer Portal gives your clients secure access to:
- ✅ View their project status and progress
- ✅ Review and approve quotes
- ✅ View and pay invoices online
- ✅ Access project documents
- ✅ See their project schedule
- ✅ Communicate with your team

**Benefits:**
- Reduces phone calls and emails
- Clients can self-serve information
- Faster quote approvals
- Online payment collection

---

## Portal Access for Your Customers

### Inviting a Customer

1. **Open the customer's contact** record
2. **Click "Invite to Portal"**
3. **Customer receives email:**
   - Link to create account
   - Instructions for logging in
4. **Customer creates password** and accesses portal

### Managing Portal Access

1. **Navigate to:** Contacts → [Customer]
2. **See "Portal Access" section:**
   - ✅ Has Access / ❌ No Access
   - Last login date
3. **Options:**
   - Resend invitation
   - Disable access
   - Reset password

---

## What Customers See

### Portal Dashboard

Your customers see:
- **Their jobs** with status indicators
- **Recent updates** on their projects
- **Unread messages** from your team
- **Outstanding invoices** with pay button

### Portal Jobs

Customers can view:
- Job details (address, status)
- Current progress
- Scheduled tasks
- Key milestones

**They CANNOT:**
- Edit job details
- See internal notes
- View costs/margins

### Portal Documents

Customers can access:
- Plans and drawings (if shared)
- Signed contracts
- Variations
- Invoices
- Any documents you share

### Portal Schedule

Customers see:
- Upcoming work dates
- Milestone dates
- Task completion status

**View only** - they cannot make changes.

---

## Portal Quotes

### Sending a Quote for Approval

1. **Create the estimate** (Chapter 6)
2. **Click "Send to Portal"**
3. **Customer is notified**
4. **Customer views in portal:**
   - Line items and pricing
   - Total amount
   - Terms and conditions

### Customer Approving/Rejecting

**To Approve:**
1. Customer reviews quote
2. Clicks "Accept Quote"
3. Signs electronically
4. You receive notification

**To Request Changes:**
1. Customer clicks "Request Changes"
2. Adds comments
3. You receive notification
4. Revise and resend

---

## Portal Invoices & Payments

### Viewing Invoices

Customers see:
- Invoice number and date
- Line items
- Amount due
- Due date
- Payment status

### Making Payments Online

1. **Customer clicks "Pay Now"**
2. **Selects invoices** to pay
3. **Enters payment details:**
   - Credit card
   - Bank account (if enabled)
4. **Confirms payment**
5. **Receives receipt** via email

### Payment Methods

| Method | Processing Time |
|--------|-----------------|
| Credit Card | Instant |
| Bank Transfer | 1-3 business days |

---

## Portal Messages

### Customer Sending a Message

1. Customer clicks "Send Message"
2. Types their message
3. Attaches files if needed
4. You receive notification

### Responding to Customers

1. **Navigate to:** Chat or Job → Messages
2. **See portal messages** marked with 📤
3. **Reply as normal**
4. **Customer sees your response** in portal

---

## Customizing the Portal

### Portal Branding

1. **Navigate to:** Settings → Company → Brand
2. **Upload your logo**
3. **Set brand colors**
4. **Portal shows your branding**

### What to Share

Control what customers can see:
- **Documents:** Mark as "Portal Visible"
- **Schedule:** Choose which tasks to show
- **Messages:** All messages are visible to them

---

## Related Topics

- **Chapter 3:** Contacts & Relationships (customer records)
- **Chapter 6:** Estimates & Quoting (creating quotes for portal)
- **Chapter 16:** Payment Tracking (payment processing)

---

# Chapter 23: File Warehouse

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter 23                │
│ 📕 LEXICON (BUGS):    Chapter 23                │
└─────────────────────────────────────────────────┘

**Audience:** End Users
**Purpose:** Central document storage across all modules
**Last Updated:** 2026-01-31

---

## What is the File Warehouse?

The File Warehouse is your central document storage, containing:
- ✅ All job documents
- ✅ All contact documents
- ✅ Email attachments
- ✅ Corporate documents
- ✅ User uploads

**Key Features:**
- Browse by folder structure
- Search across all documents
- Preview files without downloading
- Track document versions

---

## Navigating the Warehouse

### Folder Structure

Documents are organized into folders:
- **Jobs** → Job folders → Document categories
- **Contacts** → Contact folders
- **Emails** → Year → Month
- **Corporate** → Company folders
- **Teeem Docs** → User personal files

### Browsing Folders

1. **Navigate to:** Warehouse
2. **Click a folder** to open it
3. **See contents:**
   - Subfolders (📁 icon)
   - Documents (file icons)
4. **Use breadcrumbs** to navigate back

### Searching Documents

1. **Enter search term** in search box
2. **Results show:**
   - File name matches
   - Folder location
   - File type
3. **Click to open** document

---

## Working with Documents

### Previewing Documents

1. **Click a document** in the list
2. **Preview panel** opens
3. **Supported formats:**
   - PDF - full preview
   - Images - full preview
   - Word/Excel - basic preview
4. **Click "Download"** for full version

### Uploading Documents

1. **Navigate to the folder** where you want to upload
2. **Click "Upload"** or drag files
3. **Select files** from your computer
4. **Wait for upload** to complete
5. **Documents appear** in the folder

### Moving Documents

1. **Select the document(s)**
2. **Click "Move"**
3. **Select destination folder**
4. **Confirm move**

Note: Moving in File Warehouse is instant (virtual folders).

### Renaming Documents

1. **Right-click the document**
2. **Click "Rename"**
3. **Enter new name**
4. **Press Enter** to save

---

## Document Properties

### Viewing Properties

Click a document to see:
- **Display Name:** What you see
- **Send Name:** Download filename
- **Size:** File size
- **Type:** File format
- **Uploaded:** When added
- **Source:** Where it came from (job, email, etc.)

### Two Names Explained

| Name | Purpose | Example |
|------|---------|---------|
| Display Name | What you see in TEEEM | "RE: Invoice Question" |
| Send Name | Download filename | "RE Invoice Question - 2026-01-17.eml" |

---

## Linking Documents to Records

### From the Warehouse

1. **Select a document**
2. **Click "Link to..."**
3. **Choose:**
   - Job
   - Contact
   - Task
4. **Select the record**
5. **Document appears** in that record's files

### From a Record

1. **Open a job/contact/task**
2. **Go to "Documents" tab**
3. **Click "Upload"** or "Link Existing"
4. **Document linked** to that record

---

## Document Types

### Available Types

| Type | Use For |
|------|---------|
| Plans | Construction drawings |
| Contracts | Signed agreements |
| Invoices | Bills and invoices |
| Quotes | Estimates and quotes |
| Correspondence | Letters, emails |
| Photos | Site photos |
| Reports | Inspection reports |
| Other | Everything else |

### Setting Document Type

1. **Select a document**
2. **Click "Change Type"**
3. **Select appropriate type**
4. **Type is saved**

---

## Storage Providers

### Supported Providers

| Provider | Description |
|----------|-------------|
| Wasabi/S3 | Cloud storage (default) |
| SharePoint | Microsoft cloud |
| Local | On-premises server |

### Checking Provider

1. **Navigate to:** Settings → Connections → Storage
2. **See active provider**
3. **Connection status** (green = connected)

---

## Related Topics

- **Chapter 5:** Jobs & Construction (job documents)
- **Chapter 12:** OneDrive File Management (Microsoft integration)
- **Chapter 13:** Email Integration (email attachments)

---

# Chapter 24: E-Signatures

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter 24                │
│ 📕 LEXICON (BUGS):    Chapter 24                │
└─────────────────────────────────────────────────┘

**Audience:** End Users
**Purpose:** Electronic document signing
**Last Updated:** 2026-01-31

---

## What are E-Signatures?

Electronic signatures allow you to:
- ✅ Send documents for signing
- ✅ Track signature status
- ✅ Store signed documents
- ✅ Legally binding signatures

**Common Uses:**
- Contracts and agreements
- Quotes and variations
- SWMS sign-offs
- Timesheets

---

## Sending for Signature

### Preparing a Document

1. **Navigate to:** E-Signature → Prepare
2. **Upload your document** (PDF)
3. **Add signature fields:**
   - Drag signature box to location
   - Add date, initials, text fields
4. **Add signers:**
   - Enter email addresses
   - Set signing order (if needed)
5. **Click "Send for Signing"**

### Signature Fields

| Field Type | Purpose |
|------------|---------|
| Signature | Full signature |
| Initials | Short initials |
| Date | Auto-fills signing date |
| Text | Custom text input |
| Checkbox | Tick to agree |

### Signing Order

**Sequential:** Signer 1, then Signer 2, etc.
**Parallel:** All signers at once

---

## Tracking Signatures

### Viewing Status

1. **Navigate to:** E-Signature
2. **See all requests:**
   - Pending (waiting for signatures)
   - Completed (all signed)
   - Expired (deadline passed)
3. **Click request** for details

### Status Indicators

| Status | Meaning |
|--------|---------|
| 📤 Sent | Waiting for signer |
| 👁️ Viewed | Signer opened document |
| ✍️ Signed | Signer completed |
| ✅ Complete | All signers done |
| ❌ Declined | Signer refused |
| ⏰ Expired | Deadline passed |

### Sending Reminders

1. **Open the signature request**
2. **Click "Send Reminder"**
3. **Signer receives email** prompt

---

## Signing Documents

### For External Signers

When someone receives a signing request:
1. **Click link in email**
2. **Review the document**
3. **Click each signature field**
4. **Draw or type signature**
5. **Click "Complete Signing"**
6. **Receive copy** via email

### For TEEEM Users

1. **See notification** in TEEEM
2. **Click to open document**
3. **Sign as above**
4. **Document saved** automatically

---

## Completed Documents

### Accessing Signed Documents

1. **Navigate to:** E-Signature → Completed
2. **Click the document**
3. **Download signed PDF**
4. **Includes:**
   - All signatures
   - Signing timestamps
   - Certificate of completion

### Certificate of Completion

Shows:
- Document ID
- All signers
- When each signed
- IP addresses (optional)

---

## Settings

### Default Settings

1. **Navigate to:** Settings → E-Signature
2. **Configure:**
   - Reminder frequency
   - Expiry period
   - Email templates

### Branding

Your logo and colors appear on:
- Email notifications
- Signing page
- Completed documents

---

## Related Topics

- **Chapter 6:** Estimates & Quoting (signing quotes)
- **Chapter 21:** WHS (SWMS sign-offs)
- **Chapter 22:** Customer Portal (portal signatures)

---

# Chapter 25: Data Warehouse & Reports

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter 25                │
│ 📕 LEXICON (BUGS):    Chapter 25                │
└─────────────────────────────────────────────────┘

**Audience:** End Users (Advanced)
**Purpose:** Advanced reporting and data analysis
**Last Updated:** 2026-01-31

---

## What is the Data Warehouse?

The Data Warehouse provides:
- ✅ Cross-module reporting
- ✅ Custom data queries
- ✅ Export to Excel
- ✅ Scheduled reports

**Who Uses This:**
- Business analysts
- Managers needing custom reports
- Accountants

---

## Accessing Reports

### Standard Reports

1. **Navigate to:** Data Warehouse → Reports
2. **Browse report categories:**
   - Jobs & Projects
   - Financial
   - Contacts
   - Safety
3. **Click to run** a report
4. **Set parameters** (date range, filters)
5. **View results** or export

### Report Types

| Category | Reports |
|----------|---------|
| Jobs | Job summary, status breakdown, profitability |
| Financial | Revenue, costs, outstanding invoices |
| Contacts | Contact list, activity summary |
| Safety | Incidents, inspections, compliance |

---

## Custom Queries

### Building a Query

1. **Navigate to:** Data Warehouse → Custom Query
2. **Select data source:**
   - Jobs
   - Contacts
   - Invoices
   - etc.
3. **Choose columns** to include
4. **Add filters:**
   - Date ranges
   - Status filters
   - Text matches
5. **Run query**
6. **View results**

### Saving Queries

1. **After running a query**
2. **Click "Save Query"**
3. **Enter name**
4. **Find in "My Queries"** for later use

---

## Exporting Data

### Export Formats

| Format | Best For |
|--------|----------|
| Excel (.xlsx) | Further analysis |
| CSV | Data import |
| PDF | Sharing/printing |

### Exporting

1. **Run your report** or query
2. **Click "Export"**
3. **Select format**
4. **Download file**

---

## Scheduled Reports

### Setting Up a Schedule

1. **Open a report** or saved query
2. **Click "Schedule"**
3. **Configure:**
   - Frequency (daily, weekly, monthly)
   - Day/time to run
   - Email recipients
4. **Click "Save Schedule"**

### Managing Schedules

1. **Navigate to:** Data Warehouse → Scheduled
2. **See all scheduled reports**
3. **Options:**
   - Edit schedule
   - Pause/resume
   - Delete

---

## System Health

### Monitoring System Status

1. **Navigate to:** System Health
2. **View status:**
   - 🟢 All systems operational
   - 🟡 Some issues
   - 🔴 System problems
3. **Check components:**
   - API status
   - Background jobs
   - Storage
   - Integrations

### Performance Metrics

- Response times
- Job queue depth
- Storage usage
- API call volume

---

## Related Topics

- **Chapter 15:** Xero Accounting Sync (financial data)
- **Chapter 18:** Custom Data Tables (custom data)
- **Chapter 20:** Corporate Module (corporate reports)

---

**Last Updated:** 2026-01-31
**Maintained By:** Development Team
