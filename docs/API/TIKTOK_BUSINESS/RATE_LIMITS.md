# Rate Limits

Source: https://business-api.tiktok.com/portal/docs/rate-limits/v1.3

Research date: 2026-07-09

TikTok Business API rate limits have two layers:

1. Global rate limits apply to each developer app across all API calls.
2. Endpoint-specific rate limits apply to selected endpoints or endpoint groups. These limits are independent between endpoints, but they do not replace the global app limit.

When both layers apply, a request must fit both the developer-app global bucket and the endpoint-specific bucket.

## Global Developer App Limits

All apps default to the Basic tier unless TikTok approves an upgrade.

| Tier | QPS | QPM | QPD |
|---|---:|---:|---:|
| Basic | 10 | 600 | 864,000 |
| Standard | 20 | 1,200 | 1,728,000 |
| Advanced | 30 | 1,800 | 2,592,000 |
| Partner | 50 | 3,000 | 4,320,000 |

If a request exceeds rate limits, TikTok returns code `40100`. QPD resets at 00:00 UTC. For QPM throttling, the docs recommend waiting about 5 minutes before retrying.

## Endpoint-Specific Limits

Endpoint-specific limits are separate per endpoint or endpoint group. For example, hitting the `/campaign/get/` limit does not consume the `/ad/get/` endpoint-specific quota, but both still share the developer app global quota.

Important endpoint-specific limits for EasyClaw:

| Endpoint / group | Basic QPS | Basic QPM | Basic QPD | Notes |
|---|---:|---:|---:|---|
| `/open_api/v1.3/gmv_max/report/get/` | 8 | 240 | 20,000 | Main GMV Max BI source. This is tighter than the global Basic QPM and should be the primary limiter for GMV report backfills. |
| Async report task create, POST `/report/task/create/` | 2 | 60 | 4,500 | Same limits across all tiers per docs. Use carefully for large exports. |
| Streaming API | 10,000 | 600,000 | 864,000,000 | Much higher than normal reporting; not relevant to current warehouse GMV Max pulls. |
| Event reporting endpoints such as `/pixel/track/`, `/app/track/`, `/offline/track/` | 1,000 | 600,000 | 86,400,000 | Event ingestion limits; not relevant to current warehouse GMV Max reporting. |

## Airflow Design Implications

Airflow is the dominant source of EasyClaw TikTok Business API traffic, but it is not guaranteed to be the only source. Therefore:

- Airflow should proactively enforce app-level and endpoint-level token buckets using Redis so different DAGs and workers share one limiter.
- GMV Max report calls must acquire both:
  - global app bucket: Basic default `10 QPS / 600 QPM / 864,000 QPD`
  - GMV endpoint bucket: Basic default `8 QPS / 240 QPM / 20,000 QPD`
- Endpoint-specific buckets should be keyed by the actual TikTok endpoint family, not by Airflow task name.
- Per-advertiser concurrency can still be used as a fairness guard, but it is not the official quota unit.
- `40100`, HTTP `429`, and retryable backend responses should still use exponential backoff with jitter. This protects against traffic from non-Airflow sources, TikTok-side quota drift, clock skew, or undocumented endpoint behavior.
- Large catchups should be modeled as resumable work windows. The scheduler should queue windows and let the shared limiter control throughput rather than launching unbounded parallel requests.

For the current Basic-tier GMV Max BI pipeline, the safe default is to keep local worker fan-out moderate, then let the `/gmv_max/report/get/` endpoint bucket enforce the effective throughput.
