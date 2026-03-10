# EPIC Engage Analytics Metrics

Implemented analytics metrics for EPIC Engage, tracking the complete user journey from email submission through survey completion.

---

## CSV Implementation Status

```mermaid
%%{init: {'theme':'base'}}%%
graph TD
    subgraph Implemented
        R5[Row 5: Email Non-Click Rate ✅]
        R8[Row 8: Multiple Link Requests ✅]
        R11[Row 11: Landing Page Visit Rate ✅]
        R16[Row 16: Survey Completion Time ✅]
    end
    
    subgraph Future[Future]
        R9[Row 9-10: Survey Step Tracking 🔄]
    end
    
    subgraph Not_Possible[Not Possible]
        R6[Row 6: Email Open Rate ❌<br/>Requires GC Notify]
    end
    
    style R5 fill:#c3e6cb
    style R8 fill:#c3e6cb
    style R11 fill:#c3e6cb
    style R16 fill:#c3e6cb
    style R9 fill:#fff3cd
    style R6 fill:#f8d7da
```

| Row | Metric | Status | Section |
|-----|--------|--------|---------|
| 5 | Email non-click rate | ✅ Implemented | [Email Non-Click Rate](#email-non-click-rate) |
| 6 | Email open rate | ❌ Not Possible | [Email Open Rate](#email-open-rate) |
| 8 | Multiple link request correlation | ✅ Implemented | [Multiple Link Request Correlation](#multiple-link-request-correlation) |
| 9 | Track which step users drop off | 🔄 Future | [Survey Step Progression](#survey-step-progression) |
| 10 | Track completion rate per step | 🔄 Future | [Survey Step Progression](#survey-step-progression) |
| 11 | Landing page visit rate | ✅ Implemented | [Landing Page Visit Rate](#landing-page-visit-rate) |
| 16 | Survey completion time | ✅ Implemented | [Survey Completion Time](#survey-completion-time) |

---

## Events Summary

All analytics events tracked by EPIC Engage:

| Event | Trigger | File | Key Properties |
|-------|---------|------|----------------|
| `email_submitted` | Email submitted in modal | `EmailModal.tsx` | `verification_token`, `participant_id` |
| `survey_start` | Survey page loaded from email link | `SubmitSurveyContext.tsx` | `verification_token`, `participant_id` |
| `completed_step` | User completes a survey step | `MultiPageForm.tsx` | `step_number`, `step_name`, `step_count` |
| `survey_submit` | Survey successfully submitted | `SubmitSurveyContext.tsx` | `verification_token`, `participant_id` |

**Correlation Keys:**
- `verification_token` - Links email submission to survey landing (single journey)
- `participant_id` - Identifies repeat users across multiple link requests

**Event Flow:**

```mermaid
graph TD
    A[User Submits Email] -->|email_submitted| B{Clicks Email Link?}
    B -->|Yes| C[survey_start]
    B -->|No| D[Non-Click]
    C --> E{Multi-Page Survey?}
    E -->|Yes| F[completed_step<br/>Step 1]
    E -->|No| H[survey_submit]
    F --> G[completed_step<br/>Step 2...N]
    G --> H
    
    style A fill:#e1f5ff
    style C fill:#e1f5ff
    style F fill:#e1f5ff
    style G fill:#e1f5ff
    style H fill:#c3e6cb
    style D fill:#f8d7da
```

---

## Pre-Survey Entry

### Landing Page Visit Rate

> **CSV Row 11** - Landing page visit rate

Tracks email submission through to survey landing page visit.

```mermaid
sequenceDiagram
    participant User
    participant EmailModal
    participant API
    participant Analytics as Analytics Service
    participant Email as Email System
    participant Survey as Survey Page
    
    User->>EmailModal: Clicks "Share your Thoughts"
    User->>EmailModal: Enters email and submits
    EmailModal->>API: createEmailVerification()
    API-->>EmailModal: { verification_token, participant_id }
    EmailModal->>Analytics: 📊 email_submitted
    API->>Email: Send link /surveys/.../token
    
    Note over User,Email: Time gap - user checks email
    
    User->>Survey: Clicks email link
    Survey->>API: Verify token
    Survey->>Analytics: 📊 survey_start
```

**Metabase Cards:**
- Landing Page Visit Rate (smartscalar) - Conversion percentage
- Landing Page Visit Rate - Over Time (line) - Daily trend
- Landing Page Visit Rate - Journey Details (table) - Individual journeys, exportable

---

### Email Non-Click Rate

> **CSV Row 5** - Email non-click rate

Tracks email submissions that did not result in survey landing page visits. Useful for identifying potential email delivery issues or user engagement barriers.

**Metabase Cards:**
- Email Non-Click Count (scalar) - Total non-conversions
- Email Non-Click Details (table) - Individual non-converted emails with timestamps

**Query:**
```sql
SELECT 
  properties->>'verification_token' as token,
  MIN(timestamp) as email_submitted_at,
  EXTRACT(EPOCH FROM (NOW() - MIN(timestamp))) / 3600 as hours_since_email
FROM events
WHERE event_type IN ('email_submitted', 'survey_start')
  AND properties->>'verification_token' IS NOT NULL
GROUP BY properties->>'verification_token'
HAVING COUNT(CASE WHEN event_type = 'survey_start' THEN 1 END) = 0
ORDER BY email_submitted_at DESC;
```

---

### Email Open Rate

> **CSV Row 6** - Email open rate

> **⚠️ NOT POSSIBLE** - Email open rate tracking requires a tracking pixel embedded in emails by GC Notify. This is outside the scope of the analytics platform and would require changes to the BC Gov email service. Contact the GC Notify team to request open tracking if this metric is needed.

---

### Multiple Link Request Correlation

> **CSV Row 8** - Track correlation between users requesting the link multiple times and completing the survey

Tracks users who request survey links multiple times using `participant_id`. Helps identify users facing barriers to survey completion.

```mermaid
sequenceDiagram
    participant User
    participant App as EPIC Engage
    participant Analytics as Analytics Service
    
    User->>App: Request link (email 1)
    App->>Analytics: 📊 email_submitted<br/>(participant_id: "p123", token: "t1")
    
    Note over User: Link expires or user forgets
    
    User->>App: Request link again (email 2)
    App->>Analytics: 📊 email_submitted<br/>(participant_id: "p123", token: "t2")
    
    User->>App: Clicks link, completes survey
    App->>Analytics: 📊 survey_submit<br/>(participant_id: "p123")
```

**Metabase Cards:**
- Repeat Link Requesters (table) - Users with >1 link request, completion status
- Repeat Request Completion Rate (scalar) - % of repeat requesters who completed
- Link Request vs Completion Correlation (bar) - Completion rate by # of requests

**Query:**
```sql
SELECT 
  properties->>'participant_id' as participant_id,
  COUNT(DISTINCT CASE WHEN event_type = 'email_submitted' 
        THEN properties->>'verification_token' END) as link_requests,
  BOOL_OR(event_type = 'survey_submit') as completed_survey
FROM events
WHERE event_type IN ('email_submitted', 'survey_submit')
  AND properties->>'participant_id' IS NOT NULL
GROUP BY properties->>'participant_id'
HAVING COUNT(DISTINCT CASE WHEN event_type = 'email_submitted' 
              THEN properties->>'verification_token' END) > 1
ORDER BY link_requests DESC;
```

---

## After Accessing a Survey

### Survey Completion Time

> **CSV Row 16** - Track the average duration between first survey page load and final submission event

Tracks how long users take to complete surveys, from `survey_start` to `survey_submit`. Uses `verification_token` to correlate start and submit events.

```mermaid
sequenceDiagram
    participant User
    participant Survey as Survey Page
    participant Analytics as Analytics Service
    
    User->>Survey: Clicks email link
    Survey->>Analytics: 📊 survey_start<br/>(verification_token: "abc123")
    
    Note over User,Survey: User fills out survey
    
    User->>Survey: Submits survey
    Survey->>Analytics: 📊 survey_submit<br/>(verification_token: "abc123")
    
    Note over Analytics: Completion time =<br/>submit_time - start_time
```

**Metabase Cards:**
- Survey Completion Time (smartscalar) - Average completion time with trend
- Completed Surveys (scalar) - Total count of completed surveys
- Survey Completion Time - Over Time (line) - Daily average completion time trend
- Completed Surveys - Over Time (line) - Daily completion count trend
- Survey Completion Time - Distribution (bar) - Time buckets (0-5, 5-15, 15-30, 30+ min)
- Survey Completion Time - Details (table) - Individual completions with timestamps

**Query:**
```sql
WITH submit_events AS (
  SELECT 
    properties->>'verification_token' as token,
    MIN(timestamp) as submitted_at
  FROM events
  WHERE source_app = 'met-web'
    AND event_type = 'survey_submit'
    AND properties->>'verification_token' IS NOT NULL
  GROUP BY properties->>'verification_token'
),
start_events AS (
  SELECT 
    properties->>'verification_token' as token,
    MIN(timestamp) as started_at
  FROM events
  WHERE source_app = 'met-web'
    AND event_type = 'survey_start'
    AND properties->>'verification_token' IS NOT NULL
  GROUP BY properties->>'verification_token'
)
SELECT 
  s.token,
  st.started_at,
  s.submitted_at,
  ROUND(EXTRACT(EPOCH FROM (s.submitted_at - st.started_at)) / 60, 1) as completion_minutes
FROM submit_events s
JOIN start_events st ON s.token = st.token
ORDER BY s.submitted_at DESC;
```

---

### Survey Step Progression (Future)

> **CSV Rows 9-10** - Track which step users drop off / Track completion rate per step

🔄 **Planned for future implementation.** Will track user progression through multi-page survey steps using `completed_step` events.

---

## Metabase Dashboard

**Dashboard:** Engage Analytics

### Tabs

```mermaid
graph LR
    A[Engage Analytics Dashboard]
    A --> B[Pre-Survey Entry<br/>8 cards]
    A --> C[After Accessing a Survey<br/>6 cards]
    A --> D[Engagement Page<br/>Future]
    A --> E[Results<br/>Future]
    
    style A fill:#ED8936,color:#fff
    style B fill:#e1f5ff
    style C fill:#e1f5ff
    style D fill:#f0f0f0
    style E fill:#f0f0f0
```

| Tab | Cards | Purpose |
|-----|-------|---------|
| Pre-Survey Entry | 8 | Email-to-survey conversion, non-clicks, repeat users |
| After Accessing a Survey | 6 | Survey completion time and count metrics |
| Engagement Page | - | (Future) |
| Results | - | (Future) |

### Card Layout

**Pre-Survey Entry Tab:**

```mermaid
graph TD
    subgraph Row_0[Row 0]
        A1[Email Non-Click Count]
        A2[Email Non-Click Details]
    end
    
    subgraph Row_12[Row 12]
        B1[Landing Page Visit Rate]
        B2[Visit Rate Over Time]
    end
    
    subgraph Row_19[Row 19]
        C1[Journey Details<br/>Full Width]
    end
    
    subgraph Row_32[Row 32]
        D1[Repeat Request Rate]
        D2[Link Request Correlation]
    end
    
    subgraph Row_39[Row 39]
        E1[Repeat Link Requesters<br/>Full Width]
    end
    
    Row_0 --> Row_12
    Row_12 --> Row_19
    Row_19 --> Row_32
    Row_32 --> Row_39
    
    style A1 fill:#e1f5ff
    style A2 fill:#e1f5ff
    style B1 fill:#e1f5ff
    style B2 fill:#e1f5ff
    style C1 fill:#e1f5ff
    style D1 fill:#e1f5ff
    style D2 fill:#e1f5ff
    style E1 fill:#e1f5ff
```

| Row | Cards |
|-----|-------|
| 0 | Email Non-Click Count, Email Non-Click Details |
| 12 | Landing Page Visit Rate, Visit Rate Over Time |
| 19 | Journey Details (full width) |
| 32 | Repeat Request Completion Rate, Link Request Correlation |
| 39 | Repeat Link Requesters (full width) |

**After Accessing a Survey Tab:**

```mermaid
graph TD
    subgraph Row_0[Row 0]
        A1[Survey Completion Time]
        A2[Completed Surveys]
    end
    
    subgraph Row_7[Row 7]
        B1[Completion Time Over Time]
        B2[Completed Surveys Over Time]
    end
    
    subgraph Row_17[Row 17]
        C1[Time Distribution]
        C2[Completion Details]
    end
    
    Row_0 --> Row_7
    Row_7 --> Row_17
    
    style A1 fill:#fff3cd
    style A2 fill:#fff3cd
    style B1 fill:#fff3cd
    style B2 fill:#fff3cd
    style C1 fill:#fff3cd
    style C2 fill:#fff3cd
```

| Row | Cards |
|-----|-------|
| 0 | Survey Completion Time (smartscalar), Completed Surveys (scalar) |
| 7 | Survey Completion Time - Over Time, Completed Surveys - Over Time |
| 17 | Survey Completion Time - Distribution, Survey Completion Time - Details |

### Deployment

Dashboard cards are configured via YAML and deployed using the `setup-metabase-app.sh` script. Contact the analytics platform team for deployment instructions.

---

## Implementation Files

```mermaid
graph LR
    subgraph Components
        A[EmailModal.tsx]
        B[SubmitSurveyContext.tsx]
        C[MultiPageForm.tsx]
    end
    
    subgraph Events
        E1[email_submitted]
        E2[survey_start]
        E3[survey_submit]
        E4[completed_step]
    end
    
    A -->|tracks| E1
    B -->|tracks| E2
    B -->|tracks| E3
    C -->|tracks| E4
    
    style A fill:#61dafb,color:#000
    style B fill:#61dafb,color:#000
    style C fill:#61dafb,color:#000
    style E1 fill:#c3e6cb
    style E2 fill:#c3e6cb
    style E3 fill:#c3e6cb
    style E4 fill:#c3e6cb
```

| File | Events | Purpose |
|------|--------|---------|
| `met-web/src/components/public/engagement/view/EmailModal.tsx` | `email_submitted` | Email submission modal |
| `met-web/src/components/public/survey/submit/SubmitSurveyContext.tsx` | `survey_start`, `survey_submit` | Survey context and submission |
| `met-web/src/components/shared/form/FormBuilder/MultiPageForm.tsx` | `completed_step` | Multi-page form navigation |

---

## Related Documentation

- [Analytics Integration Guide](Penguin_Analytics_Integration.md) - Setup and configuration

