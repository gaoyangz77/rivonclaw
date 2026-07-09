# Reporting

## Sources

- Reporting overview: https://business-api.tiktok.com/portal/docs?id=1751087777884161
- Reporting report types: https://business-api.tiktok.com/portal/docs?id=1738864835805186
- Basic report dimensions: https://business-api.tiktok.com/portal/docs?id=1751443956638721
- Basic report metrics: https://business-api.tiktok.com/portal/docs?id=1751443967255553
- Basic report dimension/metric compatibility: https://business-api.tiktok.com/portal/docs?id=1759239462689793
- Basic report filters: https://business-api.tiktok.com/portal/docs?id=1751443975608321
- Synchronous report API: https://business-api.tiktok.com/portal/docs?id=1740302848100353
- Async report task API: https://business-api.tiktok.com/portal/docs?id=1740302766489602
- Creative basic reports: https://business-api.tiktok.com/portal/docs?id=1740662135093314
- Video Insights reports: https://business-api.tiktok.com/portal/docs?id=1789700050715650
- GMV Max report API: https://business-api.tiktok.com/portal/docs?id=1824721673497601
- GMV Max report metrics: https://business-api.tiktok.com/portal/docs?id=1824722485971009
- Audience report dimensions: https://business-api.tiktok.com/portal/docs?id=1751454103714818
- Audience report metrics: https://business-api.tiktok.com/portal/docs?id=1751454162042882
- Rate limits overview: https://business-api.tiktok.com/portal/docs/rate-limits/v1.3

Rate-limit summary: report pipelines must obey the developer-app global rate bucket and any endpoint-specific bucket. `/gmv_max/report/get/` has a Basic-tier endpoint-specific limit of `8 QPS / 240 QPM / 20,000 QPD`; see [RATE_LIMITS.md](RATE_LIMITS.md).

## Integrated Reporting Endpoints

| Purpose | Method | Endpoint | Scope | Key params |
|---|---:|---|---|---|
| Synchronous report | GET | `/open_api/v1.3/report/integrated/get/` | advertiser or BC, conditional | `advertiser_id` or `advertiser_ids` or `bc_id`, `report_type`, `data_level`, `dimensions`, `metrics`, dates, filtering |
| Create async task | POST | `/open_api/v1.3/report/task/create/` | advertiser or BC, conditional | same report selection fields, `start_date`, `end_date` |
| Check async task | GET | `/open_api/v1.3/report/task/check/` | advertiser | `advertiser_id`, `task_id` |
| Download async task | GET | `/open_api/v1.3/report/task/download/` | advertiser | `advertiser_id`, `task_id` |
| Cancel async task | POST | `/open_api/v1.3/report/task/cancel/` | advertiser | `advertiser_id`, `task_id` |

Synchronous reports can return up to 20,000 ads; for larger data, use async reports or split by campaign/adgroup/ad IDs.

## Basic Report Metrics

Important metric fields for EasyClaw:

| Need | Basic report field |
|---|---|
| Cost | `spend` |
| Net cost | `billed_cost` |
| Cash cost | `cash_spend` |
| Campaign budget | `campaign_budget` |
| Campaign/ad/adgroup IDs | `campaign_id`, `adgroup_id`, `ad_id` dimensions/attributes |
| Shop ROAS | `onsite_shopping_roas` |
| Shop purchases | `onsite_shopping` |
| Shop gross revenue | `total_onsite_shopping_value` |
| Newer Shop order fields | `shop_total_purchase_by_order_submission`, `shop_gross_revenue_by_order_submission`, `shop_total_items_purchased` |

Notes:

- `billed_cost` is documented as net cost and is only supported in synchronous basic reports, with possible data delay.
- Dimension/metric compatibility must be checked against the supported metrics for each dimension page before querying.

## Dimensions

Common Basic report dimensions include:

- Time: `stat_time_day`, `stat_time_hour`.
- Hierarchy: `campaign_id`, `adgroup_id`, `ad_id`.
- Creative/product related fields vary by report type and dimension compatibility.
- Campaign attributes include `campaign_budget` as a metric/attribute in supported contexts.

## Creative Reports

| Report | Method | Endpoint | Key params | Use |
|---|---:|---|---|---|
| Creative basic report | GET | `/open_api/v1.3/creative/report/get/` | `advertiser_id`, `material_type`, dates/lifetime, `info_fields`, `metrics_fields` | material-level creative performance |
| Video Insights report | GET | `/open_api/v1.3/creative/report/get/` | `report_type`, `advertiser_id` or `advertiser_ids`, dates, `metrics_fields` | video-level insight reporting |
| Ad benchmark | GET | `/open_api/v1.3/report/ad_benchmark/get/` | `advertiser_id`, `dimensions`, `metrics_fields`, `filtering` | benchmark comparison |
| In-second performance | GET | `/open_api/v1.3/report/video_performance/get/` | `advertiser_id`, `report_type`, `metrics_fields`, `filtering` | second-by-second video performance |

## GMV Max Report

Endpoint: `GET /open_api/v1.3/gmv_max/report/get/`

Basic-tier endpoint-specific rate limit: `8 QPS / 240 QPM / 20,000 QPD`, in addition to the global developer-app limit.

Required params:

- `advertiser_id`
- `store_ids` with max size 1
- `start_date`
- `end_date`
- `metrics`
- `dimensions`

Important dimensions include campaign, product, creative/video, livestream, and duration levels depending on GMV Max campaign type. Product examples include `item_group_id`; creative examples include `item_id` and creative delivery status filters.

For Product GMV Max, the official metrics page confirms a combined creative-product grain. Use `dimensions=["campaign_id","item_group_id","item_id","stat_time_day"]` for daily creative-by-product performance reporting, or omit `stat_time_day` for the same grain across a date range. This is the correct fact source for Seller Center style GMV Max detail exports that include campaign ID, product/SPU ID, TikTok post/creative ID, cost, SKU orders, product clicks, conversion rate, and video view rates.

Important caveat: when querying `["campaign_id","item_group_id","item_id","stat_time_day"]`, TikTok returns only records with associated cost data. If an export must include zero-cost organic-only creative rows, use the documented creative-type filters such as `creative_types=["ADS_AND_ORGANIC"]` with a compatible single-product/single-campaign query and merge the result into the daily fact deliberately.

Attribute caveat: creative display attributes such as creative title, TikTok account, authorization/source type, shop content type, and post time should not be modeled as guaranteed columns from the multi-ID daily report query. The official metrics page disallows attribute metrics in several multi-ID or multi-dimension creative/product scenarios. Model the daily report as a performance fact and enrich display fields from creative/video metadata endpoints or single-ID compatible pulls.

`Time posted` is not guaranteed by reviewed Ads GMV Max or Spark post metadata endpoints. For EasyClaw BI, it can be enriched from TikTok Shop video/product performance facts when the onboarded shop has a matching video/post ID; unmatched rows and product-card rows should keep this field null.

Important GMV Max metrics:

| Need | GMV Max field |
|---|---|
| Cost | `cost` |
| Net cost | `net_cost` |
| SKU orders | `orders` |
| Cost per order | `cost_per_order` |
| Gross revenue | `gross_revenue` |
| ROI | `roi` |
| Target ROI | `roas_bid` |
| Product ad impressions/clicks/rates | `product_impressions`, `product_clicks`, `product_click_rate` |
| Ad video view rates | `ad_video_view_rate_2s`, `ad_video_view_rate_6s`, `ad_video_view_rate_p25`, `p50`, `p75`, `p100` |

GMV Max report docs explicitly cover Product GMV Max campaign-level, product-level, creative-level, and duration-level metrics, plus LIVE GMV Max campaign/livestream/duration levels.

## Scope Classification

- Integrated basic reports: advertiser-scoped for ad account data; BC reports can use `bc_id` for Business Center report types.
- Creative reports: advertiser-scoped.
- GMV Max reports: mixed advertiser + store/shop scoped; still requires `advertiser_id` and `store_ids`.
- Audience reports: advertiser-scoped audience performance/insight reports with their own dimension/metric compatibility pages.

## Agent Report Presets

Recommended server-side presets to avoid large context payloads:

| Preset | API | Dimensions | Metrics |
|---|---|---|---|
| `campaign_daily_basic` | integrated | `stat_time_day`, `campaign_id` | `spend`, `billed_cost`, impressions/clicks/conversions, campaign budget where compatible |
| `adgroup_daily_basic` | integrated | `stat_time_day`, `adgroup_id` | spend, conversion, CPA/ROAS fields |
| `ad_daily_creative` | integrated + creative report | `stat_time_day`, `ad_id`; material fields | spend, video views, CTR/CVR, creative metrics |
| `shop_gmv_campaign_daily` | GMV Max report | day + campaign/store dimensions | `cost`, `net_cost`, `gross_revenue`, `roi`, `orders` |
| `shop_gmv_product_daily` | GMV Max report | day + `item_group_id`/product dimensions | product clicks/impressions, orders, gross revenue, ROI |
| `shop_gmv_creative_daily` | GMV Max report | day + item/video creative dimensions | video view rates, cost, revenue, ROI |

The agent should request a preset and date range, not arbitrary metric arrays, unless operating in a developer/debug run profile.

## Uncertain / Needs Confirmation

- Whether any report can be queried after advertiser suspension is not documented. Runtime tests should check error codes for `STATUS_LIMIT`/`STATUS_DISABLE`.
- Some Shop metrics in Basic report have dimension compatibility constraints; client should pre-validate or maintain a compatibility matrix.
