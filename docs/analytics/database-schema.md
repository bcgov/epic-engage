# Database Schema for Business Analysts

This guide helps you write SQL queries against the Penguin Analytics database to create custom reports and dashboards.

---

## Quick Start

**Connection:** Access via Metabase SQL query editor or direct PostgreSQL connection.

```sql
-- Your first query: Count events by type
SELECT event_type, COUNT(*) as count
FROM events
WHERE source_app = 'epic-engage'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

---

## Events Table

All analytics data is stored in a single `events` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Unique event identifier |
| `timestamp` | timestamptz | When the event occurred |
| `event_type` | varchar | Type of event (see [Event Types](#event-types)) |
| `session_id` | varchar | Browser session ID (UUID, per-tab) |
| `user_id` | varchar | Keycloak user ID (NULL if anonymous) |
| `survey_id` | varchar | Survey identifier (extracted from properties) |
| `source_app` | varchar | Always `'epic-engage'` for Engage data |
| `properties` | jsonb | Event-specific data (see [Properties](#properties-reference)) |
| `created_at` | timestamptz | When the event was recorded |

---

## Event Types

### Survey Journey Events

| Event Type | When It Fires | Key Properties |
|------------|---------------|----------------|
| `email_submitted` | User submits email to request survey link | `verification_token`, `participant_id`, `survey_id` |
| `survey_start` | User clicks email link, lands on survey | `verification_token`, `participant_id`, `survey_id` |
| `completed_step` | User completes a survey page/step | `step_number`, `step_name`, `step_count`, `survey_id` |
| `survey_submit` | User submits completed survey | `verification_token`, `participant_id`, `survey_id` |

### Page View Events

| Event Type | When It Fires | Key Properties |
|------------|---------------|----------------|
| `page_view` | User navigates to any page | `page_name`, `path`, `url`, `referrer` |

---

## Properties Reference

Properties are stored as JSON. Access them using `properties->>'field_name'` syntax.

### Survey Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `survey_id` | string | Survey identifier | `"387"` |
| `engagement_id` | string | Parent engagement identifier | `"271"` |
| `verification_token` | string | Email link token (links email → survey) | `"abc123..."` |
| `participant_id` | string | User identifier across link requests | `"p_12345"` |
| `step_number` | string | Current step (1-indexed) | `"2"` |
| `step_name` | string | Step title | `"Demographics"` |
| `step_count` | string | Total steps in survey | `"4"` |

### Page Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `page_name` | string | Page path | `"/xEA"` |
| `path` | string | URL path | `"/engagements/271/dashboard/public"` |
| `url` | string | Full URL | `"https://engage.eao.gov.bc.ca/xEA"` |
| `referrer` | string | Previous page URL | `"https://google.com"` |
| `title` | string | Page title | `"EPIC Engage"` |

### GeoIP Properties (Auto-Enriched)

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `country` | string | ISO country code | `"CA"` |
| `country_name` | string | Country name | `"Canada"` |
| `region` | string | Province/state code | `"BC"` |
| `region_name` | string | Province/state name | `"British Columbia"` |
| `city` | string | City name | `"Victoria"` |
| `postal_code` | string | Postal/ZIP code | `"V8W"` |
| `latitude` | number | Approximate latitude | `48.4284` |
| `longitude` | number | Approximate longitude | `-123.3656` |

### Browser Properties (Auto-Captured)

| Property | Type | Description |
|----------|------|-------------|
| `user_agent` | string | Browser user agent string |
| `platform` | string | OS platform |
| `language` | string | Browser language |
| `mobile` | boolean | Is mobile device |
| `screen_width` | number | Screen width in pixels |
| `screen_height` | number | Screen height in pixels |
| `viewport_width` | number | Browser viewport width |
| `viewport_height` | number | Browser viewport height |
| `timezone` | string | User timezone |

---

## Common Queries

### Survey Completion Funnel

How many users complete each stage of the survey process?

```sql
SELECT 
  'Email Submitted' as stage,
  COUNT(DISTINCT properties->>'verification_token') as users
FROM events
WHERE source_app = 'epic-engage'
  AND event_type = 'email_submitted'
  AND timestamp > NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
  'Survey Started' as stage,
  COUNT(DISTINCT properties->>'verification_token') as users
FROM events
WHERE source_app = 'epic-engage'
  AND event_type = 'survey_start'
  AND timestamp > NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
  'Survey Submitted' as stage,
  COUNT(DISTINCT properties->>'verification_token') as users
FROM events
WHERE source_app = 'epic-engage'
  AND event_type = 'survey_submit'
  AND timestamp > NOW() - INTERVAL '30 days';
```

### Survey Step Drop-Off

Which survey step has the highest abandonment?

```sql
SELECT 
  properties->>'survey_id' as survey_id,
  properties->>'step_name' as step_name,
  (properties->>'step_number')::int as step_num,
  COUNT(DISTINCT session_id) as users_reached
FROM events
WHERE source_app = 'epic-engage'
  AND event_type = 'completed_step'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY 1, 2, 3
ORDER BY survey_id, step_num;
```

### Average Survey Completion Time

How long does it take users to complete surveys?

```sql
SELECT 
  properties->>'survey_id' as survey_id,
  COUNT(*) as completions,
  ROUND(AVG(duration_minutes), 1) as avg_minutes,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes), 1) as median_minutes
FROM (
  SELECT 
    session_id,
    properties->>'survey_id' as survey_id,
    EXTRACT(EPOCH FROM (
      MAX(timestamp) FILTER (WHERE event_type = 'survey_submit') -
      MIN(timestamp) FILTER (WHERE event_type = 'survey_start')
    )) / 60 as duration_minutes
  FROM events
  WHERE source_app = 'epic-engage'
    AND event_type IN ('survey_start', 'survey_submit')
    AND timestamp > NOW() - INTERVAL '30 days'
  GROUP BY session_id, properties->>'survey_id'
  HAVING MAX(timestamp) FILTER (WHERE event_type = 'survey_submit') IS NOT NULL
) t
WHERE duration_minutes > 0
GROUP BY survey_id
ORDER BY completions DESC;
```

### Daily Active Sessions

How many unique sessions per day?

```sql
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(*) as events
FROM events
WHERE source_app = 'epic-engage'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY day;
```

### Geographic Distribution

Where are users located?

```sql
SELECT 
  COALESCE(properties->>'region_name', 'Unknown') as region,
  COALESCE(properties->>'country_name', 'Unknown') as country,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(*) as events
FROM events
WHERE source_app = 'epic-engage'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY sessions DESC
LIMIT 20;
```

### Page View Rankings

Which pages get the most traffic?

```sql
SELECT 
  properties->>'page_name' as page,
  COUNT(*) as views,
  COUNT(DISTINCT session_id) as unique_sessions
FROM events
WHERE source_app = 'epic-engage'
  AND event_type = 'page_view'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY views DESC
LIMIT 20;
```

### Filter by Survey ID

Add survey filtering to any query:

```sql
SELECT *
FROM events
WHERE source_app = 'epic-engage'
  AND survey_id = '387'  -- Use column for better performance
  AND timestamp > NOW() - INTERVAL '30 days';
```

---

## Tips for Analysts

### Working with JSONB Properties

```sql
-- Extract text value
properties->>'survey_id'          -- Returns: '387' (text)

-- Extract as JSON (for nested objects)
properties->'survey_id'           -- Returns: "387" (json)

-- Cast to number for calculations
(properties->>'step_number')::int -- Returns: 2 (integer)

-- Check if property exists
properties ? 'survey_id'          -- Returns: true/false

-- Filter by property value
WHERE properties->>'survey_id' = '387'
```

### Performance Tips

1. **Always filter by `source_app`** - The table contains data from multiple applications
2. **Always filter by time range** - Use `timestamp > NOW() - INTERVAL 'X days'`
3. **Use `COUNT(DISTINCT session_id)`** for unique users, not `COUNT(*)`
4. **The database auto-partitions by week** - Time-based queries are fast
5. **Filter by survey_id column** - Use `WHERE survey_id = '387'` for better index usage

---

## Available Surveys

Query to see all tracked surveys:

```sql
SELECT DISTINCT 
  properties->>'survey_id' as survey_id,
  properties->>'engagement_id' as engagement_id,
  COUNT(*) as total_events,
  MIN(timestamp) as first_event,
  MAX(timestamp) as last_event
FROM events
WHERE source_app = 'epic-engage'
  AND properties->>'survey_id' IS NOT NULL
GROUP BY 1, 2
ORDER BY last_event DESC;
```
