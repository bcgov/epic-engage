# Analytics Integration Guide

## Table of Contents

- [Configuration](#configuration)
- [Usage](#usage)
- [Integration](#integration)
- [Event Schemas](#event-schemas)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

Provider-agnostic analytics tracking with Snowplow as the current implementation. Server-side tracking bypasses ad blockers and automatically enriches events with tenant, JWT, and request context.  

---

## Configuration

Add to `.env`:

```bash
ANALYTICS_ENABLED=true
SNOWPLOW_ENABLED=true
SNOWPLOW_COLLECTOR=spm.apps.gov.bc.ca  # Dev/Test: spm.apps.gov.bc.ca, Prod: spt.apps.gov.bc.ca
SNOWPLOW_APP_ID=Snowplow_standalone_MET
SNOWPLOW_NAMESPACE=met-api-dev  # met-api-dev, met-api-test, met-api-prod
```

**Environment-Specific Collectors:**
- **Development/Test:** `spm.apps.gov.bc.ca` (development pipeline)
- **Production:** `spt.apps.gov.bc.ca` (production pipeline)

Change `SNOWPLOW_NAMESPACE` per environment: `met-api-dev`, `met-api-test`, `met-api-prod`

---

## Usage

```python
from met_api.utils import analytics

# Track survey submission
analytics.track_survey_submission(
    survey_id=123,
    engagement_id=456,
    submission_id=789
)

# Track email verification
analytics.track_email_verification(
    survey_id=123,
    engagement_id=456,
    verification_type='survey'
)

# Track errors
analytics.track_error(
    error_type='ValidationError',
    error_message=str(error),
    properties={'endpoint': '/api/submissions', 'status_code': 400}
)
```

---

## Integration

### Service Integration Points

- `SubmissionService.create()` - Track survey submissions
- `EmailVerificationService.verify()` - Track email verifications  
- `Error handlers` - Track API errors

### Example

```python
from met_api.utils import analytics

class SubmissionService:
    @classmethod
    def create(cls, token, submission: SubmissionSchema):
        with session_scope() as session:
            submission_result = SubmissionModel.create(submission, session)
            
            analytics.track_survey_submission(
                survey_id=submission.survey_id,
                engagement_id=submission_result.engagement_id,
                submission_id=submission_result.id
            )
        
        return submission_result
```

**Important:** Track after successful operations. Don't track PII, passwords, or survey content.

---

## Event Schemas

### Frontend-Compatible Schemas

- `iglu:ca.bc.gov.met/submit-survey/jsonschema/1-0-0` - Survey submissions
- `iglu:ca.bc.gov.met/verify-email/jsonschema/1-0-0` - Email verifications

### Backend Schemas (Need Iglu Registration)

- `iglu:ca.bc.gov.met/api_error/jsonschema/1-0-0` - API errors
- `iglu:ca.bc.gov.met/tenant/jsonschema/1-0-0` - Tenant context
- `iglu:ca.bc.gov.met/jwt_context/jsonschema/1-0-0` - JWT context
- `iglu:ca.bc.gov.met/api_request/jsonschema/1-0-0` - Request metadata

### Auto-Enrichment

All events automatically include: user IP, user agent, user ID (JWT), tenant info, JWT roles, API endpoint, request method, timestamp.

---

## Testing

```bash
# Run tests
pytest tests/unit/utils/test_analytics_integration.py -v

# Test with tracking disabled
export ANALYTICS_ENABLED=false
```

Mock tracking in tests:
```python
from unittest.mock import patch

@patch('met_api.utils.analytics.track_survey_submission')
def test_service(mock_track):
    result = my_service.create(data)
    mock_track.assert_called_once_with(123, 456, 789)
```

---

## Deployment

### Pre-Deployment
- Install `snowplow-tracker==1.0.2` in requirements.txt
- Verify tests passing
- Ensure no PII tracked

### OpenShift Deployment

When deploying to production, ensure the correct collector endpoint:

```bash
oc process -f openshift/api.dc.yml \
  -p ENV=prod \
  -p SNOWPLOW_COLLECTOR=spt.apps.gov.bc.ca \
  -p SNOWPLOW_NAMESPACE=met-api-prod \
  ... | oc apply -f -
```

**Note:** Dev/test environments automatically use `spm.apps.gov.bc.ca` (development pipeline).

### Production Rollout
1. Deploy with `ANALYTICS_ENABLED=false`
2. Monitor for 24 hours
3. Set `ANALYTICS_ENABLED=true`
4. Monitor for 48 hours
5. Verify event data quality

### Verification

Check application logs for successful initialization:
```
Analytics initialized successfully with Snowplow provider
Snowplow initialized: collector=spt.apps.gov.bc.ca, app_id=Snowplow_standalone_MET, namespace=met-api-prod
```

**Analytics Dashboard:** https://intranet.qa.gov.bc.ca/analytics/epic-engage

### Rollback
If issues occur: Set `ANALYTICS_ENABLED=false` and restart pods

---

## Troubleshooting

**Tracker not initializing:**
- Check `ANALYTICS_ENABLED=true` in environment
- Verify `SNOWPLOW_COLLECTOR` is set
- Review application logs

**Events not appearing:**
- Verify collector endpoint is reachable
- Check network connectivity
- Validate schemas match Iglu registry

**Performance issues:**
- Set `ANALYTICS_ENABLED=false` to isolate
- Check network latency to collector

**Common errors:**
```bash
# Missing module
pip install snowplow-tracker==1.0.2

# Analytics disabled
export ANALYTICS_ENABLED=true
```

---

## Implementation

### Architecture
```
Service Layer → analytics.track_*() → AnalyticsManager → SnowplowProvider → Snowplow Collector
```

### Key Files
- `src/met_api/utils/analytics.py` - Core abstraction layer, manager, and initialization
- `src/met_api/utils/snowplow_tracker.py` - Snowplow provider (implements BaseAnalyticsProvider)
- `tests/unit/utils/test_analytics_integration.py` - Integration tests (14 tests)

### Adding New Providers

Implement `BaseAnalyticsProvider` interface:

```python
from met_api.utils.analytics import BaseAnalyticsProvider

class GoogleAnalyticsProvider(BaseAnalyticsProvider):
    def initialize(self, config):
        # Setup GA
        return True
    
    def track_survey_submission(self, survey_id, engagement_id, **kwargs):
        # GA implementation
        pass

# Use in analytics.py init_analytics()
analytics.initialize_analytics(
    primary_provider=SnowplowTracker(),
    fallback_providers=[GoogleAnalyticsProvider()]
)
```
