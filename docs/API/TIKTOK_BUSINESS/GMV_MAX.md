# GMV Max

## Sources

- GMV Max API reference: https://business-api.tiktok.com/portal/docs?id=1822000911166465
- Create GMV Max Campaigns guide: https://business-api.tiktok.com/portal/docs?id=1822009058467842
- Product GMV Max guide: https://business-api.tiktok.com/portal/docs?id=1822009220448257
- LIVE GMV Max guide: https://business-api.tiktok.com/portal/docs?id=1822009242546258
- Get GMV Max campaigns: https://business-api.tiktok.com/portal/docs?id=1826463372290177
- Create GMV Max campaign: https://business-api.tiktok.com/portal/docs?id=1822000988713089
- Recommended ROI/budget: https://business-api.tiktok.com/portal/docs?id=1822001024720897
- GMV Max shop list: https://business-api.tiktok.com/portal/docs?id=1822001044479041
- GMV Max report: https://business-api.tiktok.com/portal/docs?id=1824721673497601
- GMV Max metrics: https://business-api.tiktok.com/portal/docs?id=1824722485971009
- Spark Ads post list: https://business-api.tiktok.com/portal/docs?id=1738376465972226
- Spark Ads post info: https://business-api.tiktok.com/portal/docs?id=1738376324021250

## Concept

GMV Max is an automated ad campaign type that optimizes total channel ROI for a TikTok Shop. It has Product GMV Max and LIVE GMV Max variants.

GMV Max is not shop-only in Business API. The primary endpoints require `advertiser_id`; shop selection and authorization add `store_id`/`store_ids` and often `store_authorized_bc_id`.

## Required IDs by Workflow

| Workflow | Required IDs |
|---|---|
| List GMV Max campaigns | `advertiser_id`, filter `gmv_max_promotion_types`; optional `store_ids` |
| Get campaign details | `advertiser_id`, `campaign_id` |
| Create Product GMV Max | `request_id`, `advertiser_id`, `store_id`, `store_authorized_bc_id`, `shopping_ads_type=PRODUCT`, `optimization_goal`, `deep_bid_type`, `budget`; optional `item_group_ids`, `roas_bid` |
| Create LIVE GMV Max | `advertiser_id`, `store_id`, `store_authorized_bc_id`, `shopping_ads_type=LIVE`, identity/live fields as documented |
| Recommended ROI/budget | `advertiser_id`, `store_id`, `shopping_ads_type`, `optimization_goal`; optional `item_group_ids`, conditional `identity_id` |
| Get eligible shops | `advertiser_id` |
| Get identities | `advertiser_id`, `store_id`, `store_authorized_bc_id` |
| Get products | `bc_id`, `store_id`, conditional `advertiser_id` when `ad_creation_eligible=GMV_MAX` |
| Run report | `advertiser_id`, `store_ids` max 1, dates, `metrics`, `dimensions` |

No reviewed GMV Max endpoint requires `catalog_id` for the core shop-based workflow. `catalog_id` belongs to Catalog Ads / catalog product management, not Product GMV Max shop product selection.

## Endpoint Summary

| Purpose | Method | Endpoint | Key params |
|---|---:|---|---|
| Get campaigns | GET | `/open_api/v1.3/gmv_max/campaign/get/` | `advertiser_id`, `filtering.gmv_max_promotion_types`, optional `store_ids`, `campaign_ids` |
| Get details | GET | `/open_api/v1.3/campaign/gmv_max/info/` | `advertiser_id`, `campaign_id` |
| Create campaign | POST | `/open_api/v1.3/campaign/gmv_max/create/` | `request_id`, `advertiser_id`, `store_id`, `store_authorized_bc_id`, type, ROI/budget fields |
| Update campaign | POST | `/open_api/v1.3/campaign/gmv_max/update/` | `advertiser_id`, `campaign_id`, `roas_bid`, `budget`, promotion/auto budget fields |
| Recommend ROI/budget | GET | `/open_api/v1.3/gmv_max/bid/recommend/` | `advertiser_id`, `store_id`, `shopping_ads_type`, `optimization_goal` |
| List shops | GET | `/open_api/v1.3/gmv_max/store/list/` | `advertiser_id` |
| Check shop availability | GET | `/open_api/v1.3/gmv_max/store/shop_ad_usage_check/` | `advertiser_id`, `store_id` |
| Get identities | GET | `/open_api/v1.3/gmv_max/identity/get/` | `advertiser_id`, `store_id`, `store_authorized_bc_id` |
| Check occupied assets | GET | `/open_api/v1.3/gmv_max/occupied_custom_shop_ads/list/` | `advertiser_id`, `store_id`, `occupied_asset_type`, `asset_ids` |
| Get posts | GET | `/open_api/v1.3/gmv_max/video/get/` | `advertiser_id`, `store_id`, `store_authorized_bc_id`; optional `spu_id_list`, `need_auth_code_video`, `identity_list`, `keyword`; `page_size` max 50 |
| Update creatives | POST | `/open_api/v1.3/campaign/gmv_max/creative/update/` | `advertiser_id`, `campaign_id`, `action`, `item_list` |
| Create shop-level custom posts | POST | `/open_api/v1.3/gmv_max/creation/custom_anchor_video_list/create/` | `advertiser_id`, `store_id`, `store_authorized_bc_id`, `custom_anchor_video_list` |
| Get custom posts | POST | `/open_api/v1.3/gmv_max/creation/custom_anchor_video_list/get/` | `advertiser_id`, `store_id`, `store_authorized_bc_id`, `creative_source`, filters |
| Video-product linkage | POST | `/open_api/v1.3/gmv_max/creation/shop_video/video_anchors/` | `advertiser_id`, `store_id`, `store_authorized_bc_id`, `item_ids` |
| Exclusive auth status | GET | `/open_api/v1.3/gmv_max/exclusive_authorization/get/` | `advertiser_id`, `store_id`, `store_authorized_bc_id` |
| Grant exclusive auth | POST | `/open_api/v1.3/gmv_max/exclusive_authorization/create/` | `advertiser_id`, `store_id`, `store_authorized_bc_id` |
| Report | GET | `/open_api/v1.3/gmv_max/report/get/` | `advertiser_id`, `store_ids`, dates, `metrics`, `dimensions`, `filtering` |

## Product / Creative Dimensions and Metrics

Report supports campaign, product, creative, livestream, and duration levels. The official `gmv_max/report/get` dimension enum includes `campaign_id`, `item_group_id`, `item_id`, and `stat_time_day`, so campaign-product-creative daily reporting is a valid Product GMV Max performance grain. Important Product GMV Max fields:

- Product: `item_group_id`, `product_name`, `product_image_url`, `product_status`.
- Creative/video: `item_id`, `creative_delivery_status`, video view metrics.
- Delivery metrics: `cost`, `net_cost`, `orders`, `cost_per_order`, `gross_revenue`, `roi`.
- Budget/ROI attributes: `roas_bid`, `target_roi_budget`, `max_delivery_budget`, `bid_type`.

Confirmed Product GMV Max report grains:

| Level | Supported dimensions | Notes |
|---|---|---|
| Product daily | `item_group_id`, `stat_time_day`; optionally `campaign_id` | Use for product/SPU performance and campaign-product attribution. |
| Creative-product | `campaign_id`, `item_group_id`, `item_id` | Use for Seller Center style GMV Max creative/detail exports. |
| Creative-product daily | `campaign_id`, `item_group_id`, `item_id`, `stat_time_day` | The API returns only records with associated cost data for this exact grouping. |
| Creative daily | `item_id`, `stat_time_day` | Use when product attribution is not required. |

Creative-product delivery metrics are sufficient for the performance side of GMV Max detail exports. Supported fields include `item_id`, `creative_delivery_status`, `cost`, `orders`, `cost_per_order`, `gross_revenue`, `roi`, `product_impressions`, `product_clicks`, `product_click_rate`, `ad_click_rate`, `ad_conversion_rate`, and `ad_video_view_rate_2s/6s/p25/p50/p75/p100`.

`item_group_id` is the Product GMV Max product/SPU ID and is the correct source for Seller Center export fields labeled as product ID or link ID in GMV Max campaign/product reports. Product card creatives do not have a TikTok post ID; for `shop_content_type=PRODUCT_CARD`, `item_id` is returned as `-1`.

Attribute metrics have compatibility constraints. The official metrics page allows attribute metrics at campaign level, or at product/livestream/duration level only when a single filtered ID is used and only one ID dimension is included. It explicitly disallows attribute metrics when querying product, creative, livestream, or duration levels with multiple filtered IDs or multiple ID dimensions. Therefore creative attributes such as `title`, `tt_account_name`, `tt_account_authorization_type`, and `shop_content_type` are not stable in the daily creative-product fact query. Store the stable IDs and raw report payload in MySQL, then enrich display attributes from creative/video metadata endpoints such as `gmv_max/video/get`, customized-post endpoints, single-ID report pulls, or prior dimension snapshots.

For `gmv_max/video/get`, the Product SPU filter is named `spu_id_list` even though report dimensions call the same ID `item_group_id`. If `need_auth_code_video` is false or omitted and `identity_list` is not specified, TikTok returns an empty post list. The response list is `data.item_list`; post caption/title is `text`, account display name is `identity_info.display_name`, authorization type is `identity_info.identity_type`, and the media video ID is under `video_info.video_id`. The reviewed response does not expose a stable post publish timestamp, so Seller Center `Time posted` should be modeled as nullable metadata unless another endpoint is confirmed for the specific creative source.

Spark Ads post metadata endpoints do not close the `Time posted` gap. `/tt_video/list/` returns authorized Spark posts with `item_info.item_id`, `item_info.text`, `item_info.status`, `item_info.item_type`, product anchors such as `spu_id` and `store_id`, `video_info` preview/media fields, `user_info.tiktok_name`, and authorization windows. `/tt_video/info/` returns similar `auth_info`, `item_info`, `video_info`, and `user_info` fields for one authorization code. Neither reviewed endpoint exposes `post_time`, `create_time`, `publish_time`, or an equivalent publish timestamp.

For EasyClaw reporting, `Time posted` can be enriched from TikTok Shop analytics video/product performance when the same onboarded shop has a matching video/post ID. Treat that as shop-side creative metadata fallback, not as an Ads report metric. If the shop analytics row is absent or the creative is a product card (`item_id=-1`), keep `Time posted` null.

For report modeling, treat `campaign_id + item_group_id + item_id + stat_time_day` as the stable performance fact grain, and treat creative title, TikTok account, authorization/source type, shop content type, and post time as creative metadata dimensions. This prevents a Seller Center style export from losing performance rows when TikTok rejects attribute metrics for a multi-ID query.

## Ad Account Exclusive Authorization

TikTok Shop can have exclusive GMV Max authorization for one ad account. The status endpoint returns:

- `authorization_status`: `EFFECTIVE`, `INEFFECTIVE`, or `UNAUTHORIZED`.
- `advertiser_status`: ad account status, including approved, suspended, disabled, and pending/review states.
- `identity_id` when an official TikTok account is set for the shop.

This is a binding between an ad account and a shop for GMV Max, not a general shop-level Ads API authorization.

## Uncertain / Needs Confirmation

- If `advertiser_status` is suspended/disabled, docs do not state whether historical reports still work. Assume no until tested.
- Exact product eligibility response fields should be validated for each region/shop because `store/product/get` eligibility is conditional.
