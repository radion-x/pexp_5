# PEXP - Patient Experience Assessment Platform

## Project Overview
- **Name**: PEXP - Patient Experience Assessment Platform
- **Goal**: Comprehensive patient intake and assessment system for orthopaedic healthcare providers
- **Features**: 
  - Interactive body pain area selection
  - Pain intensity tracking with real-time slider
  - Medical history and red flag symptom screening
  - Treatment goals and expectations assessment
  - Automatic form autosave to prevent data loss
  - HIPAA-compliant design considerations
  - Responsive mobile-first design

## URLs
- **Development**: https://3000-ipw9plo68tx2aaa1ctpnf-a402f90a.sandbox.novita.ai
- **Local**: http://localhost:3000
- **GitHub**: (Not yet deployed)
- **Production**: (Not yet deployed to Cloudflare Pages)

## Key Features Implemented

### ✅ Completed Features
1. **Personal Information Collection**
   - Full name, email, phone, date of birth
   - Form validation for required fields

2. **Interactive Body Pain Map**
   - 16 clickable body areas (Head, Neck, Shoulders, Back, Arms, Hips, Legs, Knees, Feet)
   - Visual feedback with active state highlighting
   - Real-time selection summary

3. **Pain Assessment**
   - Pain duration input
   - Pain intensity slider (0-10 scale)
   - Real-time slider value display

4. **Red Flag Symptom Screening**
   - 7 critical red flag symptoms
   - Modal alert when red flags are selected
   - Urgent care recommendations

5. **Medical History**
   - Pain/injury onset description
   - Previous orthopaedic conditions (multi-select)
   - Current treatments (multi-select)
   - Current medications
   - Mobility aids usage
   - Daily activity impact assessment
   - Additional medical history notes

6. **Treatment Goals**
   - 14 comprehensive goal options
   - Recovery timeline expectation
   - Specific activity milestones
   - Treatment concerns/questions

7. **Consent Management**
   - HIPAA-compliant consent checkbox
   - Required for form submission

8. **Auto-save Functionality**
   - Automatic save every 30 seconds
   - Debounced save on input changes (800ms)
   - LocalStorage-based draft recovery
   - Timestamp tracking for saved drafts

9. **Form Submission**
   - API endpoint: POST /api/submit-intake
   - JSON payload with all form data
   - Success/error feedback
   - Draft cleanup after successful submission

## Data Architecture

### Data Models
```javascript
{
  fullName: String,
  email: String (required),
  phone: String,
  dob: Date,
  selectedAreas: Array<String>,
  painDuration: String (required),
  painIntensity: Number (0-10),
  redFlags: Array<String>,
  painStart: String,
  prevOrtho: Array<String>,
  currentTreatments: Array<String>,
  medications: String,
  mobilityAids: String,
  dailyImpact: Array<String>,
  additionalHistory: String,
  goals: Array<String>,
  timeline: String,
  milestones: String,
  concerns: String,
  consent: Boolean (required),
  _savedAt: ISO8601 Timestamp
}
```

### Storage Services
- **Current**: LocalStorage (client-side autosave for development)
- **Recommended for Production**: 
  - Cloudflare D1 (SQLite database) for structured patient data
  - Cloudflare KV for session/cache management
  - Server-side encryption at rest and in transit

### Data Flow
1. User fills form → Auto-save to LocalStorage every 30s
2. User submits → POST to `/api/submit-intake`
3. Backend validates → (Production: Save to D1 database)
4. Success response → Clear LocalStorage draft
5. Confirmation shown → Form reset

## Design Patterns

### Color Scheme
- **Primary Accent**: `#0b84ff` (Blue)
- **Background**: `#f7fbfd` to `#ffffff` (Gradient)
- **Card Background**: `#ffffff` (White)
- **Muted Text**: `#6b7280` (Gray)
- **Danger/Alert**: `#e53935` (Red)
- **Success**: `#16a34a` (Green)
- **Glass Effect**: `rgba(11, 132, 255, 0.08)`

### Layout Strategy
- **Container**: Max-width 960px, centered
- **Responsive Grid**: Auto-fit columns with minimum 220px
- **Body Map Grid**: Auto-fill with minimum 110px tiles
- **Mobile-First**: Single column on mobile, multi-column on desktop

### Interactive Components
1. **Toggle Buttons** (Body areas)
   - Inactive: White with gray border
   - Active: Blue background with white text
   - Hover: Border color change + lift effect

2. **Range Slider** (Pain intensity)
   - Custom thumb styling
   - Real-time value display
   - Labels: "No Pain" to "Worst Pain"

3. **Modal Dialog** (Red flag alert)
   - Backdrop blur effect
   - Slide-in animation
   - Keyboard accessibility (ESC to close)

4. **Autosave Indicator**
   - Color-coded status:
     - Gray: Saving...
     - Green: Saved with timestamp
     - Red: Failed

## User Guide

### For Patients

1. **Start the Assessment**
   - Open the application in your web browser
   - Your progress is automatically saved every 30 seconds

2. **Fill Personal Information**
   - Enter your full name and email (required)
   - Optionally add phone number and date of birth

3. **Select Pain Areas**
   - Click on body areas where you experience pain
   - Multiple areas can be selected
   - Click again to deselect

4. **Describe Your Pain**
   - Enter how long you've had the pain (required)
   - Use the slider to rate pain intensity (0-10)

5. **Review Red Flag Symptoms**
   - Check any symptoms you're experiencing
   - ⚠️ If you check any red flags, seek immediate medical attention

6. **Provide Medical History**
   - Describe how your pain started
   - Select previous conditions and current treatments
   - List medications and mobility aids

7. **Set Treatment Goals**
   - Check your top priorities for treatment
   - Describe expected timeline and milestones
   - Share any concerns or questions

8. **Submit Assessment**
   - Review your information
   - Check the consent box
   - Click "Submit Assessment"
   - Wait for confirmation

### For Healthcare Providers

- **Review Submissions**: Access through backend API (implement admin dashboard)
- **Red Flag Monitoring**: Critical symptoms are highlighted for immediate attention
- **Treatment Planning**: Goals and expectations clearly documented
- **Follow-up**: Contact information readily available

## Technical Stack

- **Framework**: Hono (v4.10.3) - Lightweight web framework
- **Runtime**: Cloudflare Workers/Pages
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: Custom CSS with CSS Variables
- **Build Tool**: Vite (v6.3.5)
- **Deployment**: Wrangler (v4.4.0)

## Development Commands

```bash
# Install dependencies
npm install

# Start local development (Vite)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Start sandbox development server
npm run dev:sandbox

# Deploy to Cloudflare Pages
npm run deploy

# Clean port 3000
npm run clean-port

# Test local server
npm run test

# Git shortcuts
npm run git:commit "Your message"
npm run git:status
npm run git:log
```

## PM2 Management

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# Check status
pm2 list

# View logs (non-blocking)
pm2 logs pexp-webapp --nostream

# Restart
pm2 restart pexp-webapp

# Stop
pm2 stop pexp-webapp

# Delete from PM2
pm2 delete pexp-webapp
```

## Deployment Status

- **Platform**: Cloudflare Pages (Ready for deployment)
- **Status**: ✅ Development Active
- **Build**: ✅ Successful
- **Server**: ✅ Running on port 3000
- **Last Updated**: 2025-10-27

## Features Not Yet Implemented

### Backend Enhancements
- [ ] Cloudflare D1 database integration
- [ ] Secure data encryption at rest
- [ ] Email notification system
- [ ] Provider dashboard for reviewing submissions
- [ ] Patient authentication/login system
- [ ] Audit logging for HIPAA compliance

### Frontend Enhancements
- [ ] Anatomical SVG body map (instead of button grid)
- [ ] Multi-step wizard with progress indicator
- [ ] Form validation with inline error messages
- [ ] Accessibility improvements (WCAG 2.1 AA)
- [ ] Print/PDF export of assessment
- [ ] Multi-language support (i18n)

### Security & Compliance
- [ ] Server-side form validation
- [ ] Rate limiting for API endpoints
- [ ] CSRF protection
- [ ] Content Security Policy (CSP) headers
- [ ] Full HIPAA compliance audit
- [ ] Data retention policy implementation

## Recommended Next Steps

1. **Immediate**
   - Test all form fields and validation
   - Verify autosave functionality
   - Test responsive design on multiple devices
   - Check accessibility with screen readers

2. **Short Term** (1-2 weeks)
   - Set up Cloudflare D1 database
   - Implement secure data storage
   - Create provider dashboard
   - Add email notifications
   - Deploy to Cloudflare Pages production

3. **Medium Term** (1 month)
   - Implement patient authentication
   - Add appointment scheduling integration
   - Create data export functionality
   - Enhance with anatomical SVG body map
   - Conduct security audit

4. **Long Term** (3+ months)
   - Full HIPAA compliance certification
   - Integration with EHR systems
   - Advanced analytics and reporting
   - Mobile app development
   - Telehealth integration

## Architecture Decisions

### Why Cloudflare Pages/Workers?
- **Global Edge Network**: Low latency worldwide
- **Serverless**: No server management overhead
- **Cost-Effective**: Generous free tier
- **Integrated Services**: D1, KV, R2 for data persistence
- **Security**: Built-in DDoS protection and SSL

### Why Hono Framework?
- **Lightweight**: Minimal bundle size (~13KB)
- **Fast**: Optimized for edge runtime
- **TypeScript**: Full type safety
- **Simple**: Easy to learn and maintain
- **Cloudflare-First**: Native Workers support

### Why Autosave to LocalStorage?
- **User Experience**: Never lose progress
- **Privacy**: Data stays on device until submission
- **Offline Capability**: Works without network
- **Simple**: No backend session management needed
- **Fallback**: Production should use server-side autosave

## Security Considerations

### Current Implementation (Development)
- ⚠️ Client-side storage only (LocalStorage)
- ⚠️ No authentication required
- ⚠️ No data encryption
- ✅ HTTPS in production (Cloudflare)
- ✅ CORS configured for API routes

### Production Requirements
- 🔒 Server-side data storage with encryption
- 🔒 User authentication (OAuth/SAML)
- 🔒 Role-based access control
- 🔒 Audit logging for all data access
- 🔒 Data retention and deletion policies
- 🔒 HIPAA Business Associate Agreement
- 🔒 Regular security audits
- 🔒 Incident response plan

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile Safari (iOS 14+)
- ✅ Chrome Mobile (Android 10+)

## License

Proprietary - Healthcare Application

## Contact

For questions or support, contact your healthcare provider.

---

**Note**: This is a development version. Do not use for production healthcare data without implementing proper security, encryption, and HIPAA compliance measures.
