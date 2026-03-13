# EPIC Engage Analytics

Real-time event tracking for user journey analytics using Penguin Analytics platform.

## What This Tracks

Penguin Analytics captures **user behavior events** throughout the engagement and survey experience:

```mermaid
graph LR
    subgraph "User Journey Events"
        A[Email Submitted] --> B[Survey Started]
        B --> C[Step Completed]
        C --> D[Survey Submitted]
    end
    
    subgraph "Engagement Events"
        E[Page Views]
        F[Widget Clicks]
        G[CTA Clicks]
    end
    
    style A fill:#e1f5ff
    style B fill:#e1f5ff
    style C fill:#e1f5ff
    style D fill:#c3e6cb
```

| Event Type | Purpose |
|------------|---------|
| `email_submitted` | User enters email to request survey link |
| `survey_start` | User clicks email link, lands on survey |
| `completed_step` | User completes a survey page/step |
| `survey_submit` | User submits completed survey |
| `page_view` | User views engagement or survey page |
| Widget events | Document opens, video plays, map clicks, etc. |

## How It Differs from Analytics API

EPIC Engage has **two separate analytics systems**:

| System | Purpose | Data |
|--------|---------|------|
| **Penguin Analytics** (this) | User journey tracking | Events, sessions, drop-off analysis |
| **Analytics API** | Survey response warehouse | Aggregated survey answers for Redash |

```mermaid
graph TB
    subgraph "Penguin Analytics (Event Tracking)"
        PA[met-web] -->|POST /analytics| PB[Penguin API]
        PB --> PC[(TimescaleDB)]
        PC --> PD[Metabase Dashboards]
    end
    
    subgraph "Analytics API (Survey Data)"
        AA[met-api] -->|ETL Job| AB[Analytics DB]
        AB --> AC[Redash Dashboards]
    end
    
    style PA fill:#e1f5ff
    style PB fill:#fff4e1
    style PC fill:#e8f5e9
    style PD fill:#ED8936,color:#fff
    style AA fill:#f0f0f0
    style AB fill:#f0f0f0
    style AC fill:#f0f0f0
```

## Documentation

| Document | Description |
|----------|-------------|
| [Integration Guide](integration-guide.md) | Setup, configuration, usage examples |
| [Metrics Reference](metrics-reference.md) | Event details, queries, dashboard layout |
| [Database Schema](database-schema.md) | SQL guide for business analysts |

## Current Status (March 2026)

| Environment | Status |
|-------------|--------|
| Dev | ✅ Active |
| Test | ✅ Active |
| Prod | ✅ Active |

All environments have Penguin Analytics enabled via ConfigMap (`REACT_APP_PENGUIN_ENABLED=true`).
