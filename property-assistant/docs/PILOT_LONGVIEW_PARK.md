# Longview Park Pilot Deployment Guide

**Generated:** November 15, 2025  
**Development:** Longview Park, Drogheda, Co. Louth  
**Developer:** Longview Estates  
**Status:** Production Pilot Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Pilot Configuration](#pilot-configuration)
3. [Deployment Steps](#deployment-steps)
4. [Homeowner Onboarding](#homeowner-onboarding)
5. [Developer Portal Access](#developer-portal-access)
6. [Testing & Validation](#testing--validation)
7. [Known Limitations](#known-limitations)
8. [Support & Troubleshooting](#support--troubleshooting)

---

## Overview

### What is This Pilot?

The Longview Park pilot is the **first real-world deployment** of OpenHouse AI, featuring:

- ✅ **20 houses** with unique QR code onboarding
- ✅ **Multi-tenant architecture** (Longview Estates tenant)
- ✅ **AI chat assistant** powered by RAG and OpenAI
- ✅ **Document management** with OCR and embeddings
- ✅ **White-label branding** with custom theme
- ✅ **Developer staff portal** for content management
- ✅ **Secure JWT authentication** for homeowners

### Success Criteria

1. ✅ All 20 houses have functional QR codes
2. ✅ Homeowners can scan QR → onboard → access portal
3. ✅ AI chat responds accurately using uploaded documents
4. ✅ Developer staff can upload documents and moderate content
5. ✅ Platform performs reliably with no critical bugs

---

## Pilot Configuration

### Tenant Details

| Property | Value |
|----------|-------|
| **Name** | Longview Estates |
| **Slug** | `longview-estates` |
| **Theme Color** | `#10b981` (Green) |
| **Contact Email** | info@longviewestates.ie |
| **Contact Phone** | +353 41 987 6543 |

### Development Details

| Property | Value |
|----------|-------|
| **Name** | Longview Park |
| **Location** | Drogheda, Co. Louth, Ireland |
| **Address** | Longview Park, Drogheda, Co. Louth |
| **Total Houses** | 20 |
| **House Types** | A (4 bed), B (3 bed semi), C (2 bed terrace), D (3 bed end-terrace) |
| **Features** | A-rated energy, solar panels, EV charging |

### House Distribution

- **Type A (4 bed detached):** 5 houses
- **Type B (3 bed semi-detached):** 6 houses
- **Type C (2 bed terraced):** 4 houses
- **Type D (3 bed end-terrace):** 5 houses

---

## Deployment Steps

### 1. Database Setup

Run the seed script to create tenant, development, and houses:

```bash
npm run seed:longview
```

**Expected Output:**
```
✓ Created tenant: Longview Estates
✓ Created development: Longview Park
✓ Created 20 houses with QR tokens
✓ Created 3 developer staff accounts
```

### 2. Generate QR Codes

Generate QR codes for all houses:

```bash
npm run generate:qrs
```

**Output Location:** `attached_assets/qrs/`

**Files Generated:**
- `house_1.png` through `house_20.png` (QR code images)
- `qr-manifest.json` (metadata for all QR codes)
- `QR_CODES_README.md` (detailed QR documentation)

### 3. Validate Configuration

Run the validation script:

```bash
npm run validate:pilot
```

This checks:
- ✅ Tenant and development configuration
- ✅ All houses have QR tokens
- ✅ Staff accounts created
- ✅ QR code files generated
- ✅ Environment variables set

### 4. Upload Sample Documents

**Via Developer Portal:**

1. Login as developer staff member (see credentials below)
2. Navigate to **Documents** section
3. Upload sample documents:
   - House Manual (PDF)
   - Warranty Information (PDF)
   - BER Certificate (PDF)
   - Appliance Manuals (PDF)
   - Development Map (PDF)

**Recommended Documents:**
- Comprehensive house manual covering all systems
- Warranty pack with contact information
- BER energy certificate
- Appliance user guides (boiler, hob, oven, etc.)
- Estate layout map

### 5. Test Onboarding Flow

1. **Scan QR code** for House 1
2. **Complete onboarding** form (name, email)
3. **Access portal** and verify:
   - AI chat responds
   - Documents are accessible
   - Noticeboard loads
   - Theme/branding is correct

---

## Homeowner Onboarding

### How It Works

1. **Homeowner receives welcome pack** with QR code
2. **Scans QR code** using smartphone camera
3. **Redirected to onboarding URL:**
   ```
   https://app.openhouseai.ie/onboarding?uid=UNIQUE_TOKEN
   ```
4. **Enters details:**
   - Full name
   - Email address
5. **Receives JWT token** for authentication
6. **Gains access to:**
   - AI chat assistant
   - Document library
   - Noticeboard
   - Property information
   - Contact directory

### QR Code Distribution

**Physical Placement:**
- Include QR code in welcome pack
- Mount on inside of electrical cabinet door
- Include in homeowner handbook

**Format:**
- Print size: Minimum 5cm x 5cm
- Material: Weatherproof sticker for outdoor use
- Include text: "Scan to access your home portal"

### Sample Onboarding URLs

| House | QR Token (Sample) | Onboarding URL |
|-------|-------------------|----------------|
| 1 | `a1b2c3d4-...` | `https://app.openhouseai.ie/onboarding?uid=a1b2c3d4-...` |
| 2 | `e5f6g7h8-...` | `https://app.openhouseai.ie/onboarding?uid=e5f6g7h8-...` |

*(See `qr-manifest.json` for complete list)*

---

## Developer Portal Access

### Staff Accounts

Three developer staff accounts have been created:

| Name | Email | Role |
|------|-------|------|
| Sarah Murphy | sarah.murphy@longviewestates.ie | Development Manager |
| James O'Connor | james.oconnor@longviewestates.ie | Customer Care Lead |
| Emma Walsh | emma.walsh@longviewestates.ie | Technical Coordinator |

### Login Process

1. Navigate to: `https://developers.openhouseai.ie`
2. Click **Sign In**
3. Enter staff email address
4. Click magic link sent to email
5. Access developer portal

### Developer Portal Features

**Document Management:**
- Upload new documents (PDF, Word, images)
- Auto-chunking and embedding
- Document versioning
- Tag and categorize

**Noticeboard Management:**
- Create announcements
- Schedule posts
- Moderate content
- Pin important notices

**Theme Configuration:**
- Customize colors and branding
- Live preview
- White-label configuration

**Analytics:**
- Track homeowner engagement
- View popular chat queries
- Monitor document access

---

## Testing & Validation

### Pre-Launch Checklist

- [ ] All 20 houses created in database
- [ ] All QR codes generated and verified
- [ ] At least 5 sample documents uploaded
- [ ] Developer staff can login
- [ ] Test onboarding with 3 sample houses
- [ ] AI chat responds with relevant answers
- [ ] Documents are viewable and downloadable
- [ ] Theme/branding displays correctly
- [ ] Mobile experience tested (iOS and Android)

### Test Scenarios

#### Scenario 1: Happy Path Onboarding
1. Scan QR code for House 1
2. Enter name: "Test Homeowner"
3. Enter email: "test@example.com"
4. Verify redirect to portal
5. Send chat message: "Where is the boiler?"
6. Verify AI responds with document citation

#### Scenario 2: Document Access
1. Login as homeowner
2. Navigate to Documents section
3. Filter by category: "Manuals"
4. Open "House Manual.pdf"
5. Verify PDF renders correctly
6. Download and verify file

#### Scenario 3: Developer Upload
1. Login as developer
2. Upload new document: "Heating System Guide.pdf"
3. Wait for processing
4. Verify document appears in portal
5. Test AI can answer questions from new document

#### Scenario 4: Mobile Onboarding
1. Scan QR with iPhone camera
2. Complete onboarding on mobile
3. Verify responsive layout
4. Test chat on mobile
5. Verify touch interactions work

---

## Known Limitations

### Current Constraints

1. **Document Processing Time**
   - Large PDFs (>50 pages) may take 2-3 minutes to process
   - Embedding generation is asynchronous

2. **AI Chat Limitations**
   - Responses limited to uploaded document knowledge
   - Cannot handle real-time queries (weather, traffic, etc.)
   - May hallucinate if no relevant documents found

3. **Authentication**
   - JWT tokens expire after 30 days
   - No password reset flow (magic link only)
   - One QR code per house (no multi-user support yet)

4. **Browser Support**
   - Best on Chrome, Safari, Edge (latest versions)
   - Limited support for IE11

### Planned Improvements

- Multi-homeowner support per house
- Push notifications for noticeboard
- Offline document access
- Video content support
- Advanced analytics dashboard

---

## Support & Troubleshooting

### Common Issues

#### QR Code Won't Scan
**Symptoms:** Camera doesn't recognize QR code

**Solutions:**
- Ensure good lighting
- Clean camera lens
- Hold phone 6-12 inches away
- Try dedicated QR scanner app
- Manually type URL from manifest

#### Onboarding Link Shows 404
**Symptoms:** URL loads but shows "Not Found"

**Solutions:**
- Verify production URL is correct
- Check QR token is valid UUID
- Ensure database is accessible
- Check browser console for errors

#### AI Chat Not Responding
**Symptoms:** Messages sent but no response

**Solutions:**
- Check OpenAI API key is set
- Verify documents are uploaded and processed
- Check browser console for errors
- Ensure development ID is correct

#### Documents Won't Open
**Symptoms:** PDF viewer shows blank or error

**Solutions:**
- Clear browser cache
- Try different browser
- Verify document uploaded successfully
- Check file size (<10MB recommended)

### Debug Commands

```bash
# Validate pilot configuration
npm run validate:pilot

# Check database connection
npm run db:verify

# View database studio
npm run db:studio

# Check workflow logs
# (View in Replit console)
```

### Support Contacts

**Technical Support:**
- Email: tech@openhouseai.ie
- Phone: [Support number]

**Longview Estates:**
- Email: info@longviewestates.ie
- Phone: +353 41 987 6543

### Escalation Path

1. **Level 1:** Homeowner contacts Longview Estates
2. **Level 2:** Longview staff checks developer portal
3. **Level 3:** Contact OpenHouse AI technical support
4. **Level 4:** Emergency hotline for critical issues

---

## Appendix

### A. House Inventory

Complete list in `attached_assets/qrs/qr-manifest.json`

**Sample:**
```json
{
  "house_id": "abc123...",
  "house_number": "1",
  "house_type": "A",
  "qr_uid": "a1b2c3d4-...",
  "onboarding_url": "https://app.openhouseai.ie/onboarding?uid=...",
  "address": "1 Longview Park, Drogheda, Co. Louth"
}
```

### B. Environment Variables

Required for production:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Database
DATABASE_URL=postgresql://...

# App URLs
NEXT_PUBLIC_APP_BASE_URL=https://app.openhouseai.ie
NEXT_PUBLIC_DEVELOPER_BASE_URL=https://developers.openhouseai.ie
```

### C. Database Schema

**Key Tables:**
- `tenants` - Longview Estates
- `developments` - Longview Park
- `homeowners` - 20 houses with QR tokens
- `admins` - Developer staff accounts
- `documents` - Uploaded PDFs and files
- `doc_chunks` - Embedded document chunks
- `messages` - Chat history

---

## Quick Start Summary

```bash
# 1. Setup database
npm run seed:longview

# 2. Generate QR codes
npm run generate:qrs

# 3. Validate everything
npm run validate:pilot

# 4. Upload documents via Developer Portal

# 5. Test onboarding with QR code

# 6. Launch! 🚀
```

---

**Document Version:** 1.0  
**Last Updated:** November 15, 2025  
**Status:** Production Pilot Ready ✅

For questions or support, contact: tech@openhouseai.ie
