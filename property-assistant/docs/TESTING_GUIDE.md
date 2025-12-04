# 🧪 OpenHouse AI - Complete Testing Guide

**For:** Super Admin Testing (sam@evolvai.ie)  
**Environment:** Development/Staging  
**Last Updated:** November 16, 2025

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Developer Portal Walkthrough](#developer-portal-walkthrough)
3. [Homeowner Portal Testing](#homeowner-portal-testing)
4. [Advanced Features](#advanced-features)
5. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Step 1: Access the Developer Portal

**URL:** Use the Developer Portal workflow URL (port 3001) shown in your Replit

**IMPORTANT:** Your super_admin database record has been pre-created. You just need to sign up in Supabase with the same email.

1. **First-Time Setup (Create Account in Supabase):**
   - Navigate to the login page
   - Email: `sam@evolvai.ie` (must match exactly)
   - Password: Choose a secure password (min 8 characters)
   - Click **"Need an account? Sign up"**
   - Fill in your email and password
   - Click **"Sign up"**
   - **Check your email** for Supabase confirmation link
   - Click the confirmation link in the email
   - Return to login page and sign in

2. **Subsequent Logins:**
   - Email: `sam@evolvai.ie`
   - Password: Your chosen password
   - Click "Sign in"

**✅ Success:** You should be redirected to `/dashboard`

**🔐 How Authentication Works:**
- Your admin record exists in database with `super_admin` role
- Supabase authenticates your email/password
- Backend matches your Supabase email to the admin record
- Grants you full super_admin platform access

### Step 2: Verify Your Super Admin Access

Once logged in, you should see:
- **Top Navigation:** Dashboard, Admin
- **Admin Menu:** Access to Developments, Developers, Theme Editor
- **Dashboard:** Analytics overview

**Your Role:** `super_admin`  
**Tenant:** `OpenHouse AI Platform`  
**Access Level:** Full platform access

---

## 🏢 Developer Portal Walkthrough

### Part 1: Creating a New Development

**Goal:** Create "Longview Park" development with complete configuration

#### 1.1 Navigate to Developments

1. Click **"Admin"** in top navigation
2. Click **"Developments"** in sidebar
3. Click **"+ New Development"** button

#### 1.2 Fill in Development Details

**Basic Information:**
```
Name: Longview Park
Slug: longview-park (auto-generated)
Address: Drogheda, Co. Louth, Ireland
```

**Coordinates (for map):**
```
Latitude: 53.7153
Longitude: -6.3490
```

**Developer Assignment:**
- Select a developer from dropdown (or create one first)
- For testing, you can select any existing developer

**Status:**
- Set to `active` for immediate use

#### 1.3 Save Development

- Click **"Create Development"**
- You'll be redirected to the developments list
- ✅ Verify: "Longview Park" appears in the list

---

### Part 2: Uploading Documents

**Goal:** Upload property documents that will be processed for the RAG chat assistant

#### 2.1 Navigate to Document Manager

1. From **Developments** list, click on "Longview Park"
2. Click **"Documents"** tab
3. Click **"Upload Document"** button

#### 2.2 Prepare Test Documents

**Recommended test documents:**
- Property manuals (PDF)
- Warranty information (PDF)
- House specifications (PDF, DOCX)
- Maintenance guides (PDF)

**📝 Example Document:** Create a simple PDF with property info:
```
LONGVIEW PARK - HOMEOWNER MANUAL

BOILER INFORMATION:
- Model: Vaillant EcoTEC Plus
- Reset procedure: Press reset button for 3 seconds
- Annual servicing required

WARRANTY:
- Structural warranty: 10 years
- Appliances: 2 years
- Snag repairs: 12 months
```

#### 2.3 Upload Process

1. **Click "Upload Document"** or drag-and-drop
2. **Select file** (PDF, DOCX, TXT supported)
3. **System processes automatically:**
   - OCR text extraction (if needed)
   - Vector embedding generation
   - Chunk storage for RAG

4. **Wait for processing** (10-30 seconds per document)
5. ✅ Verify: Document appears in list with status "Processed"

#### 2.4 Upload Multiple Documents

Recommended test set:
- [ ] Homeowner Manual (main reference)
- [ ] Warranty Documentation
- [ ] Appliance Manuals
- [ ] Emergency Contacts
- [ ] Maintenance Schedule

**💡 Tip:** The more comprehensive your documents, the better the chat assistant will perform.

---

### Part 3: Managing Homeowners

**Goal:** Create homeowner accounts for property residents

#### 3.1 Navigate to Homeowners

1. Click **"Dashboard"** in top navigation
2. Click **"Homeowners"** in sidebar
3. Click **"+ New Homeowner"** button

#### 3.2 Create Homeowner Account

**Homeowner Details:**
```
Development: Longview Park
House Number/Unit: 1
Address: 1 Longview Park, Drogheda, Co. Louth
```

**Contact Information:**
```
Primary Contact Name: John Smith
Email: john.smith@example.com (optional)
Phone: +353 87 123 4567 (optional)
```

**Additional Details:**
```
Move-in Date: Select current date
Status: Active
```

#### 3.3 Save Homeowner

- Click **"Create Homeowner"**
- ✅ Verify: Homeowner appears in list

#### 3.4 Create Multiple Houses

For comprehensive testing, create at least 3-5 houses:
```
House 1: 1 Longview Park
House 2: 2 Longview Park  
House 3: 3 Longview Park
```

---

### Part 4: Generating QR Codes

**Goal:** Create secure QR codes for homeowner onboarding

#### 4.1 Navigate to QR Generation

1. From **Dashboard** → **Homeowners**
2. Click on a specific homeowner (e.g., "House 1")
3. Look for **"Generate QR Code"** section

#### 4.2 Generate QR Code

1. Click **"Generate New QR Code"** button
2. **System generates:**
   - Unique JWT token (tamper-proof)
   - QR code image (PNG)
   - Printable format

3. **Download QR Code:**
   - Click **"Download QR"** button
   - Saves as `longview-park-house-1-qr.png`

4. ✅ Verify: QR code image downloads successfully

#### 4.3 QR Code Usage

**What homeowners will do:**
1. Scan QR code with phone camera
2. Opens tenant portal automatically
3. JWT token authenticates them instantly
4. No username/password required

**Security Features:**
- JWT signed with secret key
- Contains: house_id, development_id, tenant_id
- Cannot be tampered with
- One QR per house

---

### Part 5: Theme Customization

**Goal:** Customize the tenant portal branding for Longview Park

#### 5.1 Navigate to Theme Editor

1. Click **"Admin"** in top navigation
2. Click **"Theme Editor"** in sidebar

#### 5.2 Customize Colors

**Primary Color (Main brand color):**
```
Example: #2563eb (Blue)
Usage: Buttons, headers, accents
```

**Secondary Color (Complementary):**
```
Example: #7c3aed (Purple)
Usage: Highlights, links
```

**Background Color:**
```
Example: #f9fafb (Light gray)
Usage: Page backgrounds
```

#### 5.3 Upload Logo

1. **Prepare logo file:**
   - Format: PNG, SVG (transparent background recommended)
   - Size: 200x60px (approximately)
   - File size: < 500KB

2. **Upload process:**
   - Click **"Upload Logo"**
   - Select file
   - Preview appears

3. ✅ Verify: Logo displays in preview

#### 5.4 Save Theme

- Click **"Save Theme"**
- Changes apply immediately to tenant portal

**💡 Test:** Open tenant portal to see your theme changes

---

### Part 6: Noticeboard Management

**Goal:** Create community announcements for homeowners

#### 6.1 Navigate to Noticeboard

1. Click **"Dashboard"** in top navigation
2. Click **"Noticeboard"** in sidebar  
3. Click **"+ New Post"** button

#### 6.2 Create Announcement

**Post Details:**
```
Title: Welcome to Longview Park!
Category: General
Development: Longview Park
```

**Content:**
```
Dear Residents,

Welcome to your new home at Longview Park! We're delighted to have you as part of our community.

IMPORTANT DATES:
• Snag Inspection: Book within 30 days
• Warranty Registration: Complete online
• Community Meeting: First Saturday of each month

EMERGENCY CONTACTS:
• Site Manager: +353 87 XXX XXXX
• After-hours: +353 87 YYY YYYY

Best regards,
Longview Estates Team
```

**Publishing:**
```
Status: Published (visible immediately)
Pin to Top: Yes (for important announcements)
```

#### 6.3 Save Post

- Click **"Create Post"**
- ✅ Verify: Post appears in noticeboard list

#### 6.4 Create Multiple Posts

Test different categories:
- [ ] General announcements
- [ ] Maintenance schedules
- [ ] Community events
- [ ] Emergency notices

---

## 🏠 Homeowner Portal Testing

### Part 7: QR Code Onboarding

**Goal:** Test the complete homeowner onboarding flow

#### 7.1 Prepare for Testing

1. **Download QR code** (from Part 4)
2. **Open on mobile device** or use QR scanner

**Alternative (Desktop Testing):**
- Extract QR code URL manually
- Open in browser directly

#### 7.2 Scan QR Code

1. **Use phone camera** or QR scanner app
2. **Point at QR code**
3. **Click the link** that appears

**Expected Flow:**
```
QR Scan → Opens Tenant Portal → Auto-login → Welcome Screen
```

#### 7.3 Verify Onboarding Success

**✅ Check for:**
- Property address displayed correctly
- Welcome message personalized
- Development name shown
- Theme/branding applied

**🔐 Authentication:**
- No login prompt (JWT auto-auth)
- User identified by house
- Session persists in browser

---

### Part 8: Testing the Chat Assistant

**Goal:** Verify RAG-powered AI assistant with your uploaded documents

#### 8.1 Navigate to Chat

- On homeowner portal home screen
- Click **"Chat Assistant"** icon/tab
- Chat interface appears

#### 8.2 Test Document Retrieval

**Example Questions:**

1. **Simple Factual:**
   ```
   Q: What model is the boiler?
   Expected: Should reference your uploaded manual
   ```

2. **Process Question:**
   ```
   Q: How do I reset the boiler?
   Expected: Should provide step-by-step from manual
   ```

3. **Warranty Query:**
   ```
   Q: What is the warranty period for the property?
   Expected: Should cite warranty documentation
   ```

4. **Contact Information:**
   ```
   Q: Who do I contact for emergency maintenance?
   Expected: Should provide emergency contacts
   ```

#### 8.3 Verify RAG Features

**✅ Check for:**
- **Response Speed:** 1-4 seconds
- **Source Citations:** [1], [2] markers in response
- **Click Citations:** Opens source document
- **Chat History:** Previous messages saved
- **Context Awareness:** Follows conversation thread

**Example with Citations:**
```
Assistant: The boiler is a Vaillant EcoTEC Plus model [1]. 
To reset it, press and hold the reset button for 3 seconds [1].

[1] Homeowner Manual - Page 15
```

#### 8.4 Test Edge Cases

1. **Question with no relevant docs:**
   ```
   Q: What's the weather forecast?
   Expected: Polite response indicating info not available
   ```

2. **Ambiguous query:**
   ```
   Q: How do I fix it?
   Expected: Asks for clarification
   ```

3. **Multiple document sources:**
   ```
   Q: What are all the warranties included?
   Expected: Combines info from multiple docs with citations
   ```

---

### Part 9: Document Access

**Goal:** Verify homeowners can view/download property documents

#### 9.1 Navigate to Documents

- Click **"Documents"** tab in homeowner portal
- Document library appears

#### 9.2 Verify Document List

**✅ Check:**
- All uploaded documents appear
- Document names displayed correctly
- File types indicated (PDF, DOCX)
- Upload dates shown

#### 9.3 Test Document Viewing

1. **Click on a document**
2. **Expected behavior:**
   - PDF: Opens in browser viewer
   - DOCX: Downloads or opens in viewer
   - Full text searchable

3. **Download:**
   - Click download icon
   - File saves to device

---

### Part 10: Map View

**Goal:** Test interactive development map (if configured)

#### 10.1 Navigate to Map

- Click **"Map"** tab in homeowner portal
- Interactive map loads

#### 10.2 Verify Map Features

**✅ Check:**
- Development location marked
- Your house highlighted
- Nearby amenities (if added)
- Zoom/pan functionality
- Mobile-responsive

---

### Part 11: Noticeboard

**Goal:** Verify homeowners see community announcements

#### 11.1 Navigate to Noticeboard

- Click **"Noticeboard"** tab
- Posts display in chronological order

#### 11.2 Verify Post Display

**✅ Check:**
- All published posts visible
- Pinned posts appear at top
- Categories displayed
- Dates formatted correctly
- Content rendered properly

#### 11.3 Test Filtering

- Filter by category
- Search posts
- Sort by date

---

### Part 12: PWA Features

**Goal:** Test Progressive Web App functionality

#### 12.1 Install PWA (Mobile)

**On iOS:**
1. Open Safari
2. Tap Share icon
3. Tap "Add to Home Screen"
4. Tap "Add"
5. ✅ App icon appears on home screen

**On Android:**
1. Open Chrome
2. Tap menu (3 dots)
3. Tap "Install app" or "Add to Home Screen"
4. Tap "Install"
5. ✅ App icon appears in app drawer

#### 12.2 Test Offline Functionality

1. **Install PWA first**
2. **Enable airplane mode**
3. **Open PWA**

**Expected:**
- Offline fallback page shows
- Previously cached pages accessible
- Service worker handles requests

4. **Disable airplane mode**
5. **Refresh PWA**
- ✅ Full functionality restored

#### 12.3 Verify PWA Branding

**✅ Check:**
- App name: "[Your Development] Property Assistant"
- App icon: Custom or default
- Splash screen: Branded
- Theme color: Matches your theme

---

## 🔧 Advanced Features

### Part 13: Multi-Language Testing

**Goal:** Test localization (EN, IE, PL, ES, FR)

#### 13.1 Change Language

**In tenant portal:**
1. Look for language selector (typically in settings/menu)
2. Select language
3. Page content updates

#### 13.2 Verify Translations

**✅ Check:**
- Navigation labels translated
- Button text translated
- Chat prompts translated
- Error messages translated

**💡 Note:** Document content remains in original language, but UI adapts.

---

### Part 14: Analytics Dashboard

**Goal:** View usage statistics (Developer Portal)

#### 14.1 Navigate to Analytics

- **Dashboard** → View charts and metrics

#### 14.2 Review Metrics

**Available Data:**
- Total developments
- Total homeowners
- Document upload stats
- Chat usage statistics
- Active users

---

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: Login Not Working

**Symptoms:** Cannot log in, password rejected

**Solutions:**
1. **Reset password:**
   - Click "Forgot password" on login page
   - Check email for reset link

2. **Verify email:**
   - Check spam folder for confirmation email
   - Resend confirmation if needed

3. **Check credentials:**
   - Ensure email is `sam@evolvai.ie`
   - Password is case-sensitive

#### Issue 2: QR Code Not Scanning

**Symptoms:** QR code doesn't work, link broken

**Solutions:**
1. **Check QR generation:**
   - Regenerate QR code for house
   - Download fresh QR image

2. **Test manually:**
   - Extract URL from QR code
   - Open URL directly in browser

3. **Verify JWT:**
   - Check browser console for errors
   - Ensure JWT hasn't expired

#### Issue 3: Documents Not Processing

**Symptoms:** Document stuck in "Processing" status

**Solutions:**
1. **Check file format:**
   - Supported: PDF, DOCX, TXT
   - File size < 10MB

2. **View server logs:**
   - Check for OCR errors
   - Verify OpenAI API key configured

3. **Re-upload:**
   - Delete failed document
   - Upload again

#### Issue 4: Chat Not Responding

**Symptoms:** Chat loads but doesn't respond to queries

**Solutions:**
1. **Check OpenAI API:**
   - Verify API key is set
   - Check API quota/limits

2. **Check documents:**
   - Ensure documents are processed
   - Verify embeddings generated

3. **Browser console:**
   - Open developer tools
   - Check for JavaScript errors

#### Issue 5: Theme Not Applying

**Symptoms:** Custom theme/logo not showing

**Solutions:**
1. **Clear cache:**
   - Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
   - Clear browser cache

2. **Re-save theme:**
   - Re-upload logo
   - Re-save colors

3. **Check tenant:**
   - Verify correct tenant selected
   - Theme is tenant-specific

---

## ✅ Testing Checklist

Use this checklist to track your testing progress:

### Developer Portal
- [ ] Login with sam@evolvai.ie
- [ ] Create "Longview Park" development
- [ ] Upload 3+ property documents
- [ ] Create 3+ homeowner accounts
- [ ] Generate QR codes for each house
- [ ] Customize theme (logo + colors)
- [ ] Create 3+ noticeboard posts
- [ ] View analytics dashboard

### Homeowner Portal  
- [ ] Scan QR code successfully
- [ ] Auto-login works
- [ ] Chat assistant responds to queries
- [ ] Citations work and link to docs
- [ ] View all documents
- [ ] Download a document
- [ ] View development map
- [ ] Read noticeboard posts
- [ ] Install as PWA (mobile)
- [ ] Test offline mode
- [ ] Switch language
- [ ] Chat history persists

### End-to-End Flow
- [ ] Developer creates development
- [ ] Developer uploads documents
- [ ] Developer creates homeowner
- [ ] Developer generates QR code
- [ ] Homeowner scans QR
- [ ] Homeowner asks question
- [ ] Chat responds with citation
- [ ] Homeowner clicks citation
- [ ] Document opens correctly
- [ ] Full workflow validated ✅

---

## 📊 Test Data Reference

### Sample Questions for Chat Testing

```
1. What appliances are included in the property?
2. How long is the structural warranty?
3. What is the annual service charge?
4. Who do I contact for repairs?
5. How do I operate the heating system?
6. What is included in the snag period?
7. Are there any parking restrictions?
8. What are the community rules?
9. How do I report an emergency?
10. What utility providers service the area?
```

### Sample Noticeboard Posts

```
1. Title: Welcome Package
   Category: General
   Content: Welcome message + key info

2. Title: Bin Collection Schedule
   Category: Maintenance
   Content: Weekly collection days

3. Title: Community BBQ Event
   Category: Events
   Content: Date, time, location

4. Title: Planned Maintenance
   Category: Maintenance
   Content: Schedule for grounds work

5. Title: Emergency Contact Update
   Category: Important
   Content: New emergency numbers
```

---

## 🚀 Next Steps After Testing

Once you've completed testing:

1. **Document Issues:** Note any bugs or improvements
2. **Gather Feedback:** Share with test homeowners
3. **Production Prep:** Review deployment checklist
4. **Go Live:** Launch to real residents

---

## 📞 Support

**Technical Issues:** Check troubleshooting section above

**System Status:** Run automated smoke test:
```bash
npm run smoke:test
```

**Database Health:** Check pool status:
```
GET /api/health/db
```

---

## 📝 Notes

- **Test Environment:** This guide assumes development/staging
- **Real Data:** For production, use real homeowner information
- **Privacy:** Test data should be anonymized
- **Security:** Never share QR codes or JWT tokens publicly

**Last Validated:** Phase 21 - 100% smoke test success

---

**Happy Testing! 🎉**

If you encounter any issues not covered in this guide, check the smoke test results or review the system logs.
