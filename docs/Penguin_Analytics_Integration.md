# Penguin Analytics Integration

Event tracking for EPIC Engage using analytics.js with a custom plugin. Uses path-based proxy routes (`/analytics`) to bypass ad blockers.

## Architecture

```mermaid
graph TB
    A[React Components] -->|analyticsService| B[Analytics Service]
    B -->|analytics.js| C[Penguin Plugin]
    C -->|POST /analytics| D[OpenShift Proxy Route]
    D -->|Forward| E[Penguin API]
    E -->|Store| F[(TimescaleDB)]
    
    style A fill:#e1f5ff
    style C fill:#fff4e1
    style E fill:#ffe4b5
    style F fill:#e8f5e9
```

**Files:**
- `analytics.ts` - Service wrapper with feature flag
- `penguinPlugin.ts` - Custom analytics.js plugin (session management, auto-context)
- `types.ts` - TypeScript interfaces (11 action types)
- `PageViewTracker.tsx` - Auto-tracks page navigation

## Event Model

```typescript
analyticsService.track({
  action: 'survey_start',        // required - one of 11 types
  survey_id?: string,
  engagement_id?: string,
  step_number?: number,          // 1-indexed
  text?: string,                 // contextual info
  // ... other optional fields
});
```

**Actions:** `page_view`, `survey_start`, `completed_step`, `survey_submit`, `video_play`, `document_open`, `link_click`, `subscription_click`, `map_click`, `cta_click`, `error`

## Usage

```typescript
import { analyticsService } from 'services/penguinAnalytics';

// Page views (auto-tracked by PageViewTracker)
analyticsService.page('Engagement Page', 'eng-456');

// Survey flow
analyticsService.track({ action: 'survey_start', survey_id: '82124', engagement_id: 'eng-456' });
analyticsService.track({ action: 'completed_step', survey_id: '82124', step_number: 1 });
analyticsService.track({ action: 'survey_submit', survey_id: '82124' });

// Widget interactions
analyticsService.track({ action: 'video_play', engagement_id: 'eng-456', text: 'Overview' });
analyticsService.track({ action: 'cta_click', engagement_id: 'eng-456', text: 'Share Thoughts' });

// User identification
analyticsService.identify(userId);  // After login
analyticsService.reset();           // On logout
```

## Configuration

**Environment Variables (in OpenShift ConfigMap `met-web`):**
```javascript
window["_env_"] = {
  "REACT_APP_PENGUIN_URL": "/analytics",    // Proxy route path
  "REACT_APP_PENGUIN_ENABLED": "true",      // Feature flag
}
```

### How ConfigMaps Work in This Project

ConfigMaps in epic-engage are **manually managed** - they're created once during initial deployment and updated via direct patches or the OpenShift console. The CI/CD pipelines only handle image promotion, not config updates.

**For New Deployments:**

The [openshift/web.dc.yml](../openshift/web.dc.yml) template includes Penguin Analytics with `PENGUIN_ENABLED=true` by default:

```bash
oc process -f web.dc.yml -p ENV=dev -p IMAGE_TAG=dev | oc create -f - -n c72cba-dev
```

**For Existing Deployments:**

Patch the ConfigMap directly to add Penguin Analytics:

```bash
# Get current config
oc get configmap met-web -n c72cba-test -o jsonpath='{.data.config\.js}' > /tmp/config.js

# Edit /tmp/config.js to add:
#   "REACT_APP_PENGUIN_URL": "/analytics",
#   "REACT_APP_PENGUIN_ENABLED": "true",

# Apply the update
oc create configmap met-web --from-file=config.js=/tmp/config.js \
  --dry-run=client -o yaml | oc apply -f - -n c72cba-test

# Restart pods to pick up changes
oc delete pod -l app=met-web -n c72cba-test
```

**Feature Flag Logic:**
```typescript
if (!AppConfig.penguinEnabled) return;  // No-op if disabled
```

## Metrics Coverage

| Metric | Action(s) | Backend Analysis |
|--------|-----------|------------------|
| Survey completion time | `survey_start` → `survey_submit` | Timestamp diff |
| Survey abandonment rate | Count ratio | `survey_start` vs `survey_submit` |
| Step-level drop-off | `completed_step` | Last completed step |
| Widget interactions | `video_play`, `document_open`, `map_click` | Event counts |
| CTA effectiveness | `cta_click` | Click-through rate |
| Link tracking | `link_click` | URL analysis |
| Page analytics | `page_view` | Time-on-page, referrers |
| Geo-location | All events | Server-side IP enrichment |

**Coverage:** 85% of `engage_analytics_tracker.csv` requirements

## Auto-Captured Context

- **Session ID**: `crypto.randomUUID()` stored in `sessionStorage` (per-tab)
- **Browser**: URL, referrer, user agent, viewport/screen dimensions
- **Device**: Mobile detection, touch points, pixel ratio, color depth
- **Network**: Connection type, downlink, RTT
- **Locale**: Timezone, language preferences, platform

## Testing

```bash
yarn test tests/unit/services/penguinAnalytics.test.ts  # 21 tests
```

**Coverage:** Feature flag, all 11 actions, session management, complete survey flow

## Deployment

### Prerequisites

1. **Penguin Analytics backend** must be deployed to the cluster (API, TimescaleDB, Metabase)
2. **Proxy route** `/analytics` must be configured to forward to the Penguin API (for frontend)
3. **Direct API access** from met-api pods to Penguin Analytics endpoint (for server-side tracking)

### Environment Configuration

#### met-web (Frontend)

Uses proxy route for ad-blocker bypass. ConfigMap variables:

| Variable | Description | Value |
|----------|-------------|-------|
| `REACT_APP_PENGUIN_URL` | Proxy route path | `/analytics` |
| `REACT_APP_PENGUIN_ENABLED` | Feature flag | `true` / `false` |

#### met-api (Server-side)

Tracks events with sensitive data (verification tokens). Deployment config parameters:

| Variable | Description | Example |
|----------|-------------|---------|
| `PENGUIN_ANALYTICS_ENABLED` | Enable server-side tracking | `true` |
| `PENGUIN_ANALYTICS_URL` | Direct API endpoint | `https://penguin-analytics-api-c72cba-dev.apps.gold.devops.gov.bc.ca/analytics` |
| `PENGUIN_ANALYTICS_SOURCE_APP` | Source identifier | `epic-engage` |

**Penguin Analytics URLs by Environment:**

| Environment | URL |
|------------|-----|
| dev | `https://penguin-analytics-api-c72cba-dev.apps.gold.devops.gov.bc.ca/analytics` |
| test | `https://penguin-analytics-api-c72cba-test.apps.gold.devops.gov.bc.ca/analytics` |
| prod | `https://penguin-analytics-api-c72cba-prod.apps.gold.devops.gov.bc.ca/analytics` |

### Deployment Commands

**Dev Environment:**
```bash
oc process -f api.dc.yml \
  -p ENV=dev \
  -p IMAGE_TAG=dev \
  -p PENGUIN_ANALYTICS_ENABLED=true \
  -p PENGUIN_ANALYTICS_URL='https://penguin-analytics-api-c72cba-dev.apps.gold.devops.gov.bc.ca/analytics' \
  -p PENGUIN_ANALYTICS_SOURCE_APP='epic-engage' \
  | oc apply -f - -n e903c2-dev
```

**Test Environment:**
```bash
oc process -f api.dc.yml \
  -p ENV=test \
  -p IMAGE_TAG=test \
  -p PENGUIN_ANALYTICS_ENABLED=true \
  -p PENGUIN_ANALYTICS_URL='https://penguin-analytics-api-c72cba-test.apps.gold.devops.gov.bc.ca/analytics' \
  -p PENGUIN_ANALYTICS_SOURCE_APP='epic-engage' \
  | oc apply -f - -n e903c2-test
```

**Production Environment:**
```bash
oc process -f api.dc.yml \
  -p ENV=prod \
  -p IMAGE_TAG=prod \
  -p PENGUIN_ANALYTICS_ENABLED=true \
  -p PENGUIN_ANALYTICS_URL='https://penguin-analytics-api-c72cba-prod.apps.gold.devops.gov.bc.ca/analytics' \
  -p PENGUIN_ANALYTICS_SOURCE_APP='epic-engage' \
  | oc apply -f - -n e903c2-prod
```

### Current Status (March 2026)

| Environment | met-web ConfigMap | Proxy Route | met-api ConfigMap | Status |
|-------------|------------------|-------------|-------------------|--------|
| dev | ✅ | ✅ | ⏳ Ready | Active (frontend) |
| test | ✅ | ✅ | ⏳ Ready | Active (frontend) |
| prod | ❌ | ❌ | ⏳ Ready | Not enabled |

**Server-side tracking** (`email_submitted` events with verification tokens) requires re-deploying met-api with the new PENGUIN_ANALYTICS_* parameters.

### Enabling in a New Environment

1. **Deploy Penguin Analytics** using the penguin-analytics Helm chart
2. **Add proxy route** in the OpenShift Routes configuration
3. **Update ConfigMap** (see Configuration section above)
4. **Restart pods** to apply config changes

## Troubleshooting

| Issue | Check | Expected |
|-------|-------|----------|
| No events sent | `window._env_.REACT_APP_PENGUIN_ENABLED` | `"true"` |
| Network errors | DevTools → Network → `/analytics` | 201 Created |
| Proxy route | `curl https://engage.eao.gov.bc.ca/analytics/health` | `{"status":"healthy"}` |
| Session ID | `sessionStorage.getItem('penguin_session_id')` | UUID string |

**Note:** Sessions are per-tab (by design). New tab = new session ID.

## Privacy

- **Sessions**: Anonymous UUIDs (no cross-device tracking)
- **User IDs**: Only captured after Keycloak authentication
- **Participant IDs**: Optional field (requires privacy approval)
- **IP Addresses**: Client IP hashed (4-byte prefix), not stored in raw form
- **Data Retention**: Configured in TimescaleDB (time-series partitioning)

## Metric Implementations

See [Analytics Metrics Tracker](Analytics_Metrics_Tracker.md) for implemented metrics with event flows and queries.
