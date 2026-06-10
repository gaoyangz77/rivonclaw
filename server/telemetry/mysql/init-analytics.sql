-- =============================================================================
-- EasyClaw Data Warehouse Schema (MySQL)
-- Auto-applied on first container start via docker-entrypoint-initdb.d
--
-- Layers:
--   DIM  — dimension tables (dim_*)
--   FCT  — fact tables (fct_*)
--
-- See server/telemetry/airflow/docs/DATA_WAREHOUSE.md for full design documentation.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS easyclaw_analytics
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE easyclaw_analytics;

-- =============================================================================
-- DIM LAYER — Dimension Tables
-- =============================================================================

-- dim_date: Calendar dimension (pre-populated via seed-dimensions.sql)
CREATE TABLE IF NOT EXISTS dim_date (
    date_key      DATE        NOT NULL,
    year          SMALLINT    NOT NULL,
    quarter       TINYINT     NOT NULL,
    month         TINYINT     NOT NULL,
    week_of_year  TINYINT     NOT NULL,
    day_of_week   TINYINT     NOT NULL,       -- 1=Mon, 7=Sun
    day_of_month  TINYINT     NOT NULL,
    is_weekend    BOOLEAN     NOT NULL,
    month_name    VARCHAR(16) NOT NULL,
    PRIMARY KEY (date_key)
) ENGINE=InnoDB;

-- dim_platform: Platform dimension (3 static rows)
CREATE TABLE IF NOT EXISTS dim_platform (
    platform_key  SMALLINT     NOT NULL AUTO_INCREMENT,
    platform_code VARCHAR(16)  NOT NULL,
    platform_name VARCHAR(32)  NOT NULL,
    PRIMARY KEY (platform_key),
    UNIQUE KEY uk_platform_code (platform_code)
) ENGINE=InnoDB;

-- dim_version: App version dimension (auto-discovered by Airflow)
CREATE TABLE IF NOT EXISTS dim_version (
    version_key   SMALLINT     NOT NULL AUTO_INCREMENT,
    version_str   VARCHAR(32)  NOT NULL,
    major         TINYINT      NOT NULL DEFAULT 0,
    minor         TINYINT      NOT NULL DEFAULT 0,
    patch         TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (version_key),
    UNIQUE KEY uk_version_str (version_str)
) ENGINE=InnoDB;

-- dim_locale: Locale/language dimension (auto-discovered by Airflow)
CREATE TABLE IF NOT EXISTS dim_locale (
    locale_key  SMALLINT     NOT NULL AUTO_INCREMENT,
    locale_code VARCHAR(16)  NOT NULL,
    locale_name VARCHAR(64)  NOT NULL DEFAULT '',
    PRIMARY KEY (locale_key),
    UNIQUE KEY uk_locale_code (locale_code)
) ENGINE=InnoDB;

-- dim_event_type: Event type dimension (53 static rows + auto-discover)
CREATE TABLE IF NOT EXISTS dim_event_type (
    event_type_key   SMALLINT     NOT NULL AUTO_INCREMENT,
    event_type_code  VARCHAR(64)  NOT NULL,
    category         VARCHAR(32)  NOT NULL,
    display_name     VARCHAR(64)  NOT NULL DEFAULT '',
    PRIMARY KEY (event_type_key),
    UNIQUE KEY uk_event_type_code (event_type_code)
) ENGINE=InnoDB;

-- dim_device: Device/user dimension (auto-discovered by Airflow)
-- Uses INT key — device cardinality can grow much larger than other dims
CREATE TABLE IF NOT EXISTS dim_device (
    device_key      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    device_id       VARCHAR(64)  NOT NULL,    -- hashed device ID from client (per-install hardware identifier)
    first_seen_date DATE         NOT NULL,
    last_seen_date  DATE         NOT NULL,
    first_version   VARCHAR(32)  DEFAULT NULL,
    last_version    VARCHAR(32)  DEFAULT NULL,
    platform_key    SMALLINT     DEFAULT NULL,
    locale_key      SMALLINT     DEFAULT NULL,
    PRIMARY KEY (device_key),
    UNIQUE KEY uk_device_id (device_id),
    KEY idx_first_seen (first_seen_date)
) ENGINE=InnoDB;

-- dim_llm_model: LLM model dimension (auto-discovered by Airflow)
CREATE TABLE IF NOT EXISTS dim_llm_model (
    model_key       SMALLINT     NOT NULL AUTO_INCREMENT,
    model_code      VARCHAR(64)  NOT NULL,
    provider        VARCHAR(32)  NOT NULL,
    model_family    VARCHAR(32)  NOT NULL,
    model_tier      VARCHAR(32)  NOT NULL DEFAULT 'flagship',
    PRIMARY KEY (model_key),
    UNIQUE KEY uk_model_code (model_code)
) ENGINE=InnoDB;

-- dim_tool: Tool-name dimension for ecom_tool_calls and CS-local tools.
-- Auto-discovered by bi.ecom.daily.refresh_dim_tool from distinct
-- ecom_tool_calls.toolName values. first_seen_date is immutable and excluded
-- from ON DUPLICATE KEY UPDATE. tool_category is one of {'read','write','cs_local'},
-- classified by toolName prefix/suffix rules. See ADR-005.
CREATE TABLE IF NOT EXISTS dim_tool (
    tool_key         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tool_code        VARCHAR(64)       NOT NULL,               -- raw toolName (e.g. ecom_get_order, cs_escalate)
    tool_category    VARCHAR(16)       NOT NULL,               -- 'read' | 'write' | 'cs_local'
    is_cs_wrapper    TINYINT(1)        NOT NULL DEFAULT 0,     -- 1 if toolName starts with 'ecom_cs_' (context-aware wrapper)
    first_seen_date  DATE              NOT NULL,               -- first LA date this tool was observed; immutable
    etl_loaded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (tool_key),
    UNIQUE KEY uk_tool_code (tool_code),
    KEY idx_tool_category (tool_category),
    KEY idx_first_seen (first_seen_date)
) ENGINE=InnoDB;

-- dim_exchange_rate_daily: Daily FX dimension for backend payment conversion.
-- Grain: one row per date_key x base_currency x quote_currency. rate is
-- quoted as 1 base_currency = rate quote_currency.
CREATE TABLE IF NOT EXISTS dim_exchange_rate_daily (
    date_key       DATE          NOT NULL,
    base_currency  CHAR(3)       NOT NULL,
    quote_currency CHAR(3)       NOT NULL,
    rate           DECIMAL(18,8) NOT NULL,
    source         VARCHAR(64)   NOT NULL,
    observed_at    DATETIME      NULL,
    etl_loaded_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key, base_currency, quote_currency)
) ENGINE=InnoDB;

-- dim_user: User dimension (canonical). Mirrored from the MongoDB `users`
-- collection — every authenticated user (MongoDB User._id) has a row here.
-- SCD Type 1. Uses INT key — user cardinality can grow larger than other dims.
-- user_id is the MongoDB User._id (registered user), distinct from dim_device.device_id
-- (anonymous per-install hardware hash). `plan` is NOT NULL because the
-- MongoDB source contract guarantees it; a null would indicate upstream drift
-- and the mirror should fail fast rather than insert a sentinel.
CREATE TABLE IF NOT EXISTS dim_user (
    user_key                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                    VARCHAR(64)  NOT NULL,
    email                      VARCHAR(128) DEFAULT NULL,
    plan                       VARCHAR(16)  NOT NULL,
    ecommerce_module_enrolled  TINYINT(1)   NOT NULL DEFAULT 0,
    first_seen_date            DATE         NOT NULL,
    PRIMARY KEY (user_key),
    UNIQUE KEY uk_user_id (user_id),
    KEY idx_ecommerce_module_enrolled (ecommerce_module_enrolled),
    KEY idx_first_seen (first_seen_date)
) ENGINE=InnoDB;

-- dim_shop: Shop dimension. Mirrored from the MongoDB `shops` collection by
-- bi.core.daily.mirror_mongo_shops. BI subset only — operational fields
-- (OAuth tokens, webhook URLs, embedded service configs, billing state) are
-- deliberately excluded. SCD Type 1 — auth_status and shop_name updates
-- overwrite in place. user_key FKs dim_user, so this mirror runs after
-- mirror_mongo_users.
CREATE TABLE IF NOT EXISTS dim_shop (
    shop_key        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_id         VARCHAR(64)  NOT NULL,        -- MongoDB Shop._id
    shop_name       VARCHAR(255) NOT NULL,
    platform        VARCHAR(16)  NOT NULL,        -- ShopPlatform enum: TIKTOK_SHOP (extensible)
    region          VARCHAR(8)   NOT NULL,        -- ShopRegion enum: US/GB/TH/ID/MY/VN/PH/SG/ROW
    auth_status     VARCHAR(16)  NOT NULL,        -- ShopAuthStatus enum: AUTHORIZED/PENDING_AUTH/TOKEN_EXPIRED/REVOKED/DISCONNECTED
    timezone        VARCHAR(64)  NOT NULL DEFAULT 'America/Los_Angeles', -- Shop-local IANA timezone used for platform analytics dates
    timezone_source VARCHAR(32)  NOT NULL DEFAULT 'region_default',      -- Mongo timezoneSource or region_default fallback
    user_key        INT UNSIGNED NOT NULL,        -- FK → dim_user(user_key) — shop owner
    first_seen_date DATE         NOT NULL,        -- MongoDB createdAt, coerced to Beijing date
    etl_loaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_key),
    UNIQUE KEY uk_shop_id (shop_id),
    KEY idx_user (user_key),
    KEY idx_platform (platform),
    KEY idx_region (region),
    KEY idx_auth_status (auth_status),
    KEY idx_first_seen (first_seen_date)
) ENGINE=InnoDB;

-- Sentinel rows used by BI facts for telemetry that genuinely has no shop
-- context. Non-empty upstream shopId values must still resolve to a real
-- dim_shop row; ETL treats misses as data-quality failures.
INSERT INTO dim_user
  (user_id, email, plan, ecommerce_module_enrolled, first_seen_date)
VALUES
  ('__SYSTEM__', NULL, 'FREE', 0, '1970-01-01')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  plan = VALUES(plan),
  ecommerce_module_enrolled = VALUES(ecommerce_module_enrolled);

SET @system_user_key := (
  SELECT user_key FROM dim_user WHERE user_id = '__SYSTEM__'
);

INSERT INTO dim_shop
  (shop_id, shop_name, platform, region, auth_status,
   timezone, timezone_source, user_key, first_seen_date)
VALUES
  ('__SHOPLESS__', 'Shopless / Tenant Context', 'SYSTEM', 'ROW', 'SYSTEM',
   'UTC', 'system', @system_user_key, '1970-01-01')
ON DUPLICATE KEY UPDATE
  shop_name = VALUES(shop_name),
  platform = VALUES(platform),
  region = VALUES(region),
  auth_status = VALUES(auth_status),
  timezone = VALUES(timezone),
  timezone_source = VALUES(timezone_source),
  user_key = VALUES(user_key);

-- dim_affiliate_creator_snapshot: Creator fields returned inline by TikTok
-- Seller Search Sample Applications. Grain: one observed creator snapshot,
-- usually one-to-one with a terminal sample application.
CREATE TABLE IF NOT EXISTS dim_affiliate_creator_snapshot (
    creator_snapshot_key              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_key                          INT UNSIGNED    NOT NULL,
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id                 VARCHAR(128)    NOT NULL,
    user_id                           VARCHAR(64)     NOT NULL,
    shop_id                           VARCHAR(64)     NOT NULL,
    platform_creator_open_id          VARCHAR(128)    NOT NULL,
    creator_username                  VARCHAR(255)    DEFAULT NULL,
    creator_nickname                  VARCHAR(255)    DEFAULT NULL,
    creator_avatar_url                VARCHAR(1024)   DEFAULT NULL,
    follower_count                    BIGINT UNSIGNED DEFAULT NULL,
    sample_application_api_30d_gmv_amount      DECIMAL(18,4)   DEFAULT NULL,
    sample_application_api_30d_gmv_currency    VARCHAR(16)     DEFAULT NULL,
    sample_application_api_30d_content_count   INT UNSIGNED    DEFAULT NULL,
    sample_application_api_90d_sample_fulfillment_rate_percent
                                      DECIMAL(9,4)    DEFAULT NULL,
    sample_application_api_30d_median_shoppable_video_view_count
                                      BIGINT UNSIGNED DEFAULT NULL,
    snapshot_source                   VARCHAR(64)     NOT NULL DEFAULT 'SAMPLE_APPLICATION_SEARCH',
    source_sample_application_id      VARCHAR(128)    DEFAULT NULL,
    snapshot_observed_at              DATETIME        NOT NULL,
    raw_creator_payload               JSON            DEFAULT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (creator_snapshot_key),
    UNIQUE KEY uk_affiliate_creator_snapshot_sample
      (source_system, shop_id, snapshot_source, source_sample_application_id),
    KEY idx_affiliate_creator_snapshot_creator
      (source_system, shop_id, platform_creator_open_id, snapshot_observed_at),
    KEY idx_affiliate_creator_snapshot_shop_observed
      (shop_key, snapshot_observed_at),
    KEY idx_affiliate_creator_snapshot_source_account
      (source_system, source_account_id, snapshot_observed_at)
) ENGINE=InnoDB;

-- dim_ecommerce_product: Platform product dimension shared by BI features.
-- Grain: one row per source system × shop × platform product. Affiliate facts
-- join through product_key when product enrichment is available, while keeping
-- denormalized product IDs/titles for historical compatibility.
CREATE TABLE IF NOT EXISTS dim_ecommerce_product (
    product_key                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_key                        INT UNSIGNED    NOT NULL,
    source_system                   VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id               VARCHAR(128)    NOT NULL,
    user_id                         VARCHAR(64)     NOT NULL,
    shop_id                         VARCHAR(64)     NOT NULL,
    product_id                      VARCHAR(128)    NOT NULL,
    product_title                   VARCHAR(512)    DEFAULT NULL,
    product_status                  VARCHAR(64)     DEFAULT NULL,
    product_image_url               VARCHAR(1024)   DEFAULT NULL,
    product_detail_url              VARCHAR(2048)   DEFAULT NULL,
    product_description             TEXT            DEFAULT NULL,
    category_leaf_id                VARCHAR(128)    DEFAULT NULL,
    category_leaf_name              VARCHAR(255)    DEFAULT NULL,
    category_path_ids               JSON            DEFAULT NULL,
    category_path_names             JSON            DEFAULT NULL,
    brand_id                        VARCHAR(128)    DEFAULT NULL,
    brand_name                      VARCHAR(255)    DEFAULT NULL,
    product_type                    VARCHAR(64)     DEFAULT NULL,
    min_price_amount                DECIMAL(18,4)   DEFAULT NULL,
    max_price_amount                DECIMAL(18,4)   DEFAULT NULL,
    price_currency                  VARCHAR(16)     DEFAULT NULL,
    source_created_at               DATETIME        DEFAULT NULL,
    source_updated_at               DATETIME        DEFAULT NULL,
    first_seen_at                   DATETIME        NOT NULL,
    last_seen_at                    DATETIME        NOT NULL,
    raw_product_payload             JSON            DEFAULT NULL,
    etl_loaded_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (product_key),
    UNIQUE KEY uk_dim_ecommerce_product
      (source_system, shop_id, product_id),
    KEY idx_dim_ecommerce_product_shop_category
      (shop_key, category_leaf_id),
    KEY idx_dim_ecommerce_product_source_account
      (source_system, source_account_id, last_seen_at),
    KEY idx_dim_ecommerce_product_status
      (shop_key, product_status)
) ENGINE=InnoDB;

-- dim_ecommerce_sku: Platform SKU dimension shared by BI features.
-- Grain: one row per source system × shop × platform SKU.
CREATE TABLE IF NOT EXISTS dim_ecommerce_sku (
    sku_key                         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_key                     BIGINT UNSIGNED DEFAULT NULL,
    shop_key                        INT UNSIGNED    NOT NULL,
    source_system                   VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id               VARCHAR(128)    NOT NULL,
    user_id                         VARCHAR(64)     NOT NULL,
    shop_id                         VARCHAR(64)     NOT NULL,
    product_id                      VARCHAR(128)    DEFAULT NULL,
    sku_id                          VARCHAR(128)    NOT NULL,
    seller_sku                      VARCHAR(128)    DEFAULT NULL,
    sku_name                        VARCHAR(512)    DEFAULT NULL,
    sku_image_url                   VARCHAR(1024)   DEFAULT NULL,
    sku_status                      VARCHAR(64)     DEFAULT NULL,
    attributes_json                 JSON            DEFAULT NULL,
    price_amount                    DECIMAL(18,4)   DEFAULT NULL,
    price_currency                  VARCHAR(16)     DEFAULT NULL,
    source_created_at               DATETIME        DEFAULT NULL,
    source_updated_at               DATETIME        DEFAULT NULL,
    first_seen_at                   DATETIME        NOT NULL,
    last_seen_at                    DATETIME        NOT NULL,
    raw_sku_payload                 JSON            DEFAULT NULL,
    etl_loaded_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (sku_key),
    UNIQUE KEY uk_dim_ecommerce_sku
      (source_system, shop_id, sku_id),
    KEY idx_dim_ecommerce_sku_product_key (product_key),
    KEY idx_dim_ecommerce_sku_shop_product
      (shop_key, product_id),
    KEY idx_dim_ecommerce_sku_seller_sku
      (shop_key, seller_sku),
    KEY idx_dim_ecommerce_sku_source_account
      (source_system, source_account_id, last_seen_at)
) ENGINE=InnoDB;

-- dim_affiliate_content: Affiliate creator content dimension.
-- Grain: one row per source system × shop × platform content. Product
-- attribution stays in fct_affiliate_sample_fulfillment because one content
-- item can promote multiple products.
CREATE TABLE IF NOT EXISTS dim_affiliate_content (
    content_key                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_key                        INT UNSIGNED    NOT NULL,
    source_system                   VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id               VARCHAR(128)    NOT NULL,
    user_id                         VARCHAR(64)     NOT NULL,
    shop_id                         VARCHAR(64)     NOT NULL,
    platform_content_id             VARCHAR(128)    NOT NULL,
    platform_creator_open_id        VARCHAR(128)    DEFAULT NULL,
    creator_username                VARCHAR(255)    DEFAULT NULL,
    creator_nickname                VARCHAR(255)    DEFAULT NULL,
    content_format                  VARCHAR(32)     DEFAULT NULL,
    content_url                     VARCHAR(2048)   DEFAULT NULL,
    content_page_link               VARCHAR(2048)   DEFAULT NULL,
    content_description             TEXT            DEFAULT NULL,
    content_created_at              DATETIME        DEFAULT NULL,
    live_end_at                     DATETIME        DEFAULT NULL,
    product_ids                     JSON            DEFAULT NULL,
    observed_at                     DATETIME        NOT NULL,
    first_seen_at                   DATETIME        NOT NULL,
    last_seen_at                    DATETIME        NOT NULL,
    raw_content_payload             JSON            DEFAULT NULL,
    etl_loaded_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (content_key),
    UNIQUE KEY uk_dim_affiliate_content
      (source_system, shop_id, platform_content_id),
    KEY idx_dim_affiliate_content_creator
      (source_system, shop_id, platform_creator_open_id, content_created_at),
    KEY idx_dim_affiliate_content_created
      (shop_key, content_created_at),
    KEY idx_dim_affiliate_content_source_account
      (source_system, source_account_id, last_seen_at)
) ENGINE=InnoDB;

-- =============================================================================
-- FCT LAYER — Fact Tables
-- =============================================================================

-- fct_cs_performance: Per-shop, per-shop-local-date CS performance snapshot.
-- Populated by ecommerce.platform.shop_data_sync via backend internal REST calls.
-- Grain: one row per (shop_key, date_key).
CREATE TABLE IF NOT EXISTS fct_cs_performance (
    date_key                     DATE         NOT NULL,        -- shop-local analytics date
    shop_key                     INT UNSIGNED NOT NULL,        -- FK → dim_shop(shop_key)
    user_id                      VARCHAR(64)  NOT NULL,        -- MongoDB User._id; denormalized for backend reads
    shop_id                      VARCHAR(64)  NOT NULL,        -- MongoDB Shop._id; denormalized for backend reads
    support_session_count        INT          DEFAULT NULL,
    first_response_rate_percent  DECIMAL(9,4) DEFAULT NULL,
    satisfaction_percentage      DECIMAL(9,4) DEFAULT NULL,
    avg_first_response_time_mins DECIMAL(12,4) DEFAULT NULL,
    conversion_rate              DECIMAL(9,4) DEFAULT NULL,
    cs_guided_gmv                DECIMAL(18,6) DEFAULT NULL,
    currency                     VARCHAR(16)  DEFAULT NULL,
    etl_loaded_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_key, date_key),
    KEY idx_date (date_key),
    KEY idx_shop_id_date (shop_id, date_key),
    KEY idx_user_date (user_id, date_key)
) ENGINE=InnoDB;

-- fct_cs_platform_session: Terminal platform customer-service sessions.
-- Populated by ecommerce.customer_service.history via backend internal REST calls.
-- Grain: one row per (user_key, shop_key, platform_session_id). Analytical day is end_date_key.
CREATE TABLE IF NOT EXISTS fct_cs_platform_session (
    shop_key                   INT UNSIGNED    NOT NULL,
    user_key                   INT UNSIGNED    NOT NULL,
    source_system              VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id          VARCHAR(128)    NOT NULL,
    user_id                    VARCHAR(64)     NOT NULL,
    shop_id                    VARCHAR(64)     NOT NULL,
    platform_session_id        VARCHAR(128)    NOT NULL,
    conversation_id            VARCHAR(128)    DEFAULT NULL,
    begin_time                 DATETIME        NOT NULL,
    end_time                   DATETIME        NOT NULL,
    end_date_key               DATE            NOT NULL,
    duration_seconds           INT UNSIGNED    DEFAULT NULL,
    buyer_nickname             VARCHAR(255)    DEFAULT NULL,
    chat_tags_json             JSON            DEFAULT NULL,
    satisfaction_score         TINYINT         DEFAULT NULL,
    satisfaction_is_satisfied  TINYINT(1)      DEFAULT NULL,
    dissatisfaction_reason     VARCHAR(512)    DEFAULT NULL,
    etl_loaded_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, shop_key, platform_session_id),
    UNIQUE KEY uk_cs_platform_session_source
      (source_system, source_account_id, platform_session_id),
    KEY idx_cs_platform_session_end_date
      (end_date_key),
    KEY idx_cs_platform_session_end_date_satisfaction
      (end_date_key, satisfaction_is_satisfied),
    KEY idx_cs_platform_session_user_end_satisfaction
      (user_key, end_date_key, satisfaction_is_satisfied),
    KEY idx_cs_platform_session_user_shop_end_satisfaction
      (user_key, shop_key, end_date_key, satisfaction_is_satisfied),
    KEY idx_cs_platform_session_user_shop_begin
      (user_key, shop_key, begin_time),
    KEY idx_cs_platform_session_user_shop_conversation
      (user_key, shop_key, conversation_id)
) ENGINE=InnoDB;

-- fct_order: Ecommerce order header snapshot.
-- Populated by ecommerce.platform.shop_data_sync via backend internal REST calls.
-- Grain: one row per (source_system, shop_id, order_id).
CREATE TABLE IF NOT EXISTS fct_order (
    order_key              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_key               INT UNSIGNED    NOT NULL,
    source_system          VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    user_id                VARCHAR(64)     NOT NULL,
    shop_id                VARCHAR(64)     NOT NULL,
    order_id               VARCHAR(64)     NOT NULL,
    buyer_user_id          VARCHAR(64)     DEFAULT NULL,
    status                 VARCHAR(64)     DEFAULT NULL,
    create_time            DATETIME        DEFAULT NULL,
    update_time            DATETIME        DEFAULT NULL,
    paid_time              DATETIME        DEFAULT NULL,
    date_key               DATE GENERATED ALWAYS AS (DATE(COALESCE(paid_time, create_time))) STORED,
    total_amount           DECIMAL(18,4)   DEFAULT NULL,
    currency               VARCHAR(16)     DEFAULT NULL,
    payment_method_name    VARCHAR(128)    DEFAULT NULL,
    shipping_provider      VARCHAR(128)    DEFAULT NULL,
    tracking_number        VARCHAR(128)    DEFAULT NULL,
    recipient_region       VARCHAR(64)     DEFAULT NULL,
    recipient_postal_code  VARCHAR(32)     DEFAULT NULL,
    raw_payload            JSON            DEFAULT NULL,
    etl_loaded_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (order_key),
    UNIQUE KEY uk_source_order (source_system, shop_id, order_id),
    KEY idx_create_time (create_time),
    KEY idx_update_time (update_time),
    KEY idx_paid_time (paid_time),
    KEY idx_date (date_key),
    KEY idx_shop_create_time (shop_key, create_time),
    KEY idx_shop_update_time (shop_key, update_time),
    KEY idx_shop_paid_time (shop_key, paid_time),
    KEY idx_shop_date (shop_key, date_key),
    KEY idx_status_create_time (status, create_time),
    KEY idx_status_date (status, date_key),
    KEY idx_buyer_create_time (buyer_user_id, create_time),
    KEY idx_buyer_date (buyer_user_id, date_key),
    KEY idx_user_create_time (user_id, create_time),
    KEY idx_user_date (user_id, date_key),
    KEY idx_etl_loaded_at (etl_loaded_at)
) ENGINE=InnoDB;

-- fct_order_line: Ecommerce order line snapshot for SKU-level sales analysis.
-- Grain: one row per (source_system, shop_id, order_id, order_line_item_id).
CREATE TABLE IF NOT EXISTS fct_order_line (
    order_line_key          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_key               BIGINT UNSIGNED NOT NULL,
    shop_key                INT UNSIGNED    NOT NULL,
    source_system           VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    user_id                 VARCHAR(64)     NOT NULL,
    shop_id                 VARCHAR(64)     NOT NULL,
    order_id                VARCHAR(64)     NOT NULL,
    order_line_item_id      VARCHAR(64)     NOT NULL,
    product_id              VARCHAR(64)     DEFAULT NULL,
    product_name            VARCHAR(512)    DEFAULT NULL,
    sku_id                  VARCHAR(64)     DEFAULT NULL,
    sku_name                VARCHAR(512)    DEFAULT NULL,
    seller_sku              VARCHAR(128)    DEFAULT NULL,
    sku_image               VARCHAR(1024)   DEFAULT NULL,
    display_status          VARCHAR(64)     DEFAULT NULL,
    order_status            VARCHAR(64)     DEFAULT NULL,
    quantity                INT             NOT NULL DEFAULT 1,
    sale_price              DECIMAL(18,4)   DEFAULT NULL,
    original_price          DECIMAL(18,4)   DEFAULT NULL,
    currency                VARCHAR(16)     DEFAULT NULL,
    line_sale_amount        DECIMAL(18,4)   DEFAULT NULL,
    line_original_amount    DECIMAL(18,4)   DEFAULT NULL,
    order_create_time       DATETIME        DEFAULT NULL,
    order_update_time       DATETIME        DEFAULT NULL,
    order_paid_time         DATETIME        DEFAULT NULL,
    date_key                DATE GENERATED ALWAYS AS (DATE(COALESCE(order_paid_time, order_create_time))) STORED,
    raw_payload             JSON            DEFAULT NULL,
    etl_loaded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (order_line_key),
    UNIQUE KEY uk_source_order_line (source_system, shop_id, order_id, order_line_item_id),
    KEY idx_order_key (order_key),
    KEY idx_order_id (order_id),
    KEY idx_create_time (order_create_time),
    KEY idx_update_time (order_update_time),
    KEY idx_paid_time (order_paid_time),
    KEY idx_date (date_key),
    KEY idx_shop_create_time (shop_key, order_create_time),
    KEY idx_shop_update_time (shop_key, order_update_time),
    KEY idx_shop_paid_time (shop_key, order_paid_time),
    KEY idx_shop_date (shop_key, date_key),
    KEY idx_shop_product_create_time (shop_key, product_id, order_create_time),
    KEY idx_shop_product_paid_time (shop_key, product_id, order_paid_time),
    KEY idx_shop_product_date (shop_key, product_id, date_key),
    KEY idx_shop_sku_create_time (shop_key, sku_id, order_create_time),
    KEY idx_shop_sku_paid_time (shop_key, sku_id, order_paid_time),
    KEY idx_shop_sku_date (shop_key, sku_id, date_key),
    KEY idx_user_create_time (user_id, order_create_time),
    KEY idx_user_date (user_id, date_key),
    KEY idx_etl_loaded_at (etl_loaded_at),
    CONSTRAINT fk_fct_order_line_order
      FOREIGN KEY (order_key) REFERENCES fct_order(order_key)
      ON DELETE CASCADE
) ENGINE=InnoDB;

-- fct_order_shop_daily: Order-derived shop/day sales summary.
-- Grain: one row per (shop_key, date_key), where date_key is
-- DATE(COALESCE(order_paid_time, order_create_time)).
CREATE TABLE IF NOT EXISTS fct_order_shop_daily (
    date_key                DATE         NOT NULL,
    shop_key                INT UNSIGNED NOT NULL,
    user_id                 VARCHAR(64)  NOT NULL,
    shop_id                 VARCHAR(64)  NOT NULL,
    currency                VARCHAR(16)  DEFAULT NULL,
    gross_order_count       INT UNSIGNED NOT NULL DEFAULT 0,
    gross_units             INT UNSIGNED NOT NULL DEFAULT 0,
    gross_gmv               DECIMAL(18,4) DEFAULT NULL,
    cancelled_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    cancelled_units         INT UNSIGNED NOT NULL DEFAULT 0,
    cancelled_gmv           DECIMAL(18,4) DEFAULT NULL,
    effective_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    effective_units         INT UNSIGNED NOT NULL DEFAULT 0,
    effective_gmv           DECIMAL(18,4) DEFAULT NULL,
    completed_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    completed_units         INT UNSIGNED NOT NULL DEFAULT 0,
    completed_gmv           DECIMAL(18,4) DEFAULT NULL,
    etl_loaded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_key, date_key),
    KEY idx_date (date_key),
    KEY idx_shop_id_date (shop_id, date_key),
    KEY idx_user_date (user_id, date_key)
) ENGINE=InnoDB;

-- fct_order_product_daily: Order-derived product/day sales summary.
-- Grain: one row per (shop_key, product_id, date_key).
CREATE TABLE IF NOT EXISTS fct_order_product_daily (
    date_key                DATE         NOT NULL,
    shop_key                INT UNSIGNED NOT NULL,
    product_id              VARCHAR(64)  NOT NULL,
    user_id                 VARCHAR(64)  NOT NULL,
    shop_id                 VARCHAR(64)  NOT NULL,
    product_name            VARCHAR(512) DEFAULT NULL,
    currency                VARCHAR(16)  DEFAULT NULL,
    gross_order_count       INT UNSIGNED NOT NULL DEFAULT 0,
    gross_units             INT UNSIGNED NOT NULL DEFAULT 0,
    gross_gmv               DECIMAL(18,4) DEFAULT NULL,
    cancelled_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    cancelled_units         INT UNSIGNED NOT NULL DEFAULT 0,
    cancelled_gmv           DECIMAL(18,4) DEFAULT NULL,
    effective_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    effective_units         INT UNSIGNED NOT NULL DEFAULT 0,
    effective_gmv           DECIMAL(18,4) DEFAULT NULL,
    completed_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    completed_units         INT UNSIGNED NOT NULL DEFAULT 0,
    completed_gmv           DECIMAL(18,4) DEFAULT NULL,
    etl_loaded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_key, product_id, date_key),
    KEY idx_date (date_key),
    KEY idx_shop_date (shop_key, date_key),
    KEY idx_shop_id_date (shop_id, date_key),
    KEY idx_user_date (user_id, date_key)
) ENGINE=InnoDB;

-- fct_order_sku_daily: Order-derived SKU/day sales summary.
-- Grain: one row per (shop_key, sku_id, date_key).
CREATE TABLE IF NOT EXISTS fct_order_sku_daily (
    date_key                DATE         NOT NULL,
    shop_key                INT UNSIGNED NOT NULL,
    sku_id                  VARCHAR(64)  NOT NULL,
    user_id                 VARCHAR(64)  NOT NULL,
    shop_id                 VARCHAR(64)  NOT NULL,
    product_id              VARCHAR(64)  DEFAULT NULL,
    product_name            VARCHAR(512) DEFAULT NULL,
    sku_name                VARCHAR(512) DEFAULT NULL,
    seller_sku              VARCHAR(128) DEFAULT NULL,
    currency                VARCHAR(16)  DEFAULT NULL,
    gross_order_count       INT UNSIGNED NOT NULL DEFAULT 0,
    gross_units             INT UNSIGNED NOT NULL DEFAULT 0,
    gross_gmv               DECIMAL(18,4) DEFAULT NULL,
    cancelled_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    cancelled_units         INT UNSIGNED NOT NULL DEFAULT 0,
    cancelled_gmv           DECIMAL(18,4) DEFAULT NULL,
    effective_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    effective_units         INT UNSIGNED NOT NULL DEFAULT 0,
    effective_gmv           DECIMAL(18,4) DEFAULT NULL,
    completed_order_count   INT UNSIGNED NOT NULL DEFAULT 0,
    completed_units         INT UNSIGNED NOT NULL DEFAULT 0,
    completed_gmv           DECIMAL(18,4) DEFAULT NULL,
    etl_loaded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_key, sku_id, date_key),
    KEY idx_date (date_key),
    KEY idx_shop_date (shop_key, date_key),
    KEY idx_shop_product_date (shop_key, product_id, date_key),
    KEY idx_shop_id_date (shop_id, date_key),
    KEY idx_user_date (user_id, date_key)
) ENGINE=InnoDB;

-- fct_affiliate_sample_collaboration: Terminal sample-level affiliate outcome
-- fact. Grain: one row per TikTok sample application. This is the primary
-- affiliate BI fact; target/open collaboration offers are deliberately not the
-- grain because only sample applications cover both target and open flows with a
-- creator/product/SKU-level lifecycle.
CREATE TABLE IF NOT EXISTS fct_affiliate_sample_collaboration (
    sample_collaboration_key           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_key                           INT UNSIGNED    NOT NULL,
    source_system                      VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id                  VARCHAR(128)    NOT NULL,
    user_id                            VARCHAR(64)     NOT NULL,
    shop_id                            VARCHAR(64)     NOT NULL,
    creator_snapshot_key               BIGINT UNSIGNED DEFAULT NULL,
    product_key                        BIGINT UNSIGNED DEFAULT NULL,
    sku_key                            BIGINT UNSIGNED DEFAULT NULL,
    platform_sample_application_id     VARCHAR(128)    NOT NULL,
    platform_creator_open_id           VARCHAR(128)    DEFAULT NULL,
    creator_username                   VARCHAR(255)    DEFAULT NULL,
    creator_nickname                   VARCHAR(255)    DEFAULT NULL,
    product_id                         VARCHAR(128)    DEFAULT NULL,
    product_title                      VARCHAR(512)    DEFAULT NULL,
    sku_id                             VARCHAR(128)    DEFAULT NULL,
    sku_name                           VARCHAR(512)    DEFAULT NULL,
    sku_image_url                      VARCHAR(1024)   DEFAULT NULL,
    commission_rate                    DECIMAL(9,6)    DEFAULT NULL,
    application_status                 VARCHAR(64)     NOT NULL,
    sample_outcome                     VARCHAR(64)     DEFAULT NULL,
    fulfillment_status                 VARCHAR(64)     DEFAULT NULL,
    available_quantity                 INT             DEFAULT NULL,
    is_approvable                      TINYINT(1)      DEFAULT NULL,
    disapprovable_reasons              JSON            DEFAULT NULL,
    partner_name                       VARCHAR(255)    DEFAULT NULL,
    approve_expiration_at              DATETIME        DEFAULT NULL,
    shipment_expiration_at             DATETIME        DEFAULT NULL,
    tracking_number                    VARCHAR(128)    DEFAULT NULL,
    terminal_observed_at               DATETIME        NOT NULL,
    outcome_observed_at                DATETIME        DEFAULT NULL,
    outcome_mature_after_at            DATETIME        DEFAULT NULL,
    fulfillment_content_count          INT UNSIGNED    NOT NULL DEFAULT 0,
    fulfillment_video_count            INT UNSIGNED    NOT NULL DEFAULT 0,
    fulfillment_live_count             INT UNSIGNED    NOT NULL DEFAULT 0,
    first_content_created_at           DATETIME        DEFAULT NULL,
    last_content_created_at            DATETIME        DEFAULT NULL,
    last_live_end_at                   DATETIME        DEFAULT NULL,
    total_view_count                   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_like_count                   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_comment_count                BIGINT UNSIGNED NOT NULL DEFAULT 0,
    paid_order_count                   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    gross_gmv_amount                   DECIMAL(18,4)   DEFAULT NULL,
    net_gmv_amount                     DECIMAL(18,4)   DEFAULT NULL,
    gmv_currency                       VARCHAR(16)     DEFAULT NULL,
    estimated_commission_amount        DECIMAL(18,4)   DEFAULT NULL,
    actual_commission_amount           DECIMAL(18,4)   DEFAULT NULL,
    commission_currency                VARCHAR(16)     DEFAULT NULL,
    gmv_applicability                  VARCHAR(32)     NOT NULL DEFAULT 'UNKNOWN',
    raw_sample_payload                 JSON            DEFAULT NULL,
    raw_fulfillment_summary_payload    JSON            DEFAULT NULL,
    content_enriched_at                DATETIME        DEFAULT NULL,
    order_attribution_enriched_at      DATETIME        DEFAULT NULL,
    etl_loaded_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (sample_collaboration_key),
    UNIQUE KEY uk_affiliate_sample_collaboration
      (source_system, shop_id, platform_sample_application_id),
    KEY idx_affiliate_sample_collaboration_snapshot (creator_snapshot_key),
    KEY idx_affiliate_sample_collaboration_product_key
      (product_key, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_sku_key
      (sku_key, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_content_enriched
      (content_enriched_at, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_order_attr_enriched
      (order_attribution_enriched_at, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_approve_expiration
      (shop_key, approve_expiration_at),
    KEY idx_affiliate_sample_collaboration_shipment_expiration
      (shop_key, shipment_expiration_at),
    KEY idx_affiliate_sample_collaboration_first_content
      (shop_key, first_content_created_at),
    KEY idx_affiliate_sample_collaboration_gmv_applicability
      (gmv_applicability, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_creator
      (source_system, shop_id, platform_creator_open_id, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_product
      (shop_key, product_id, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_sku
      (shop_key, sku_id, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_status
      (shop_key, application_status, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_outcome
      (shop_key, sample_outcome, terminal_observed_at),
    KEY idx_affiliate_sample_collaboration_maturity
      (shop_key, outcome_mature_after_at),
    CONSTRAINT fk_affiliate_sample_collaboration_creator_snapshot
      FOREIGN KEY (creator_snapshot_key)
      REFERENCES dim_affiliate_creator_snapshot(creator_snapshot_key)
      ON DELETE SET NULL
) ENGINE=InnoDB;

-- fct_affiliate_sample_fulfillment: Content-level breakdown for terminal sample
-- collaborations. Grain: one row per sample application × content × product.
CREATE TABLE IF NOT EXISTS fct_affiliate_sample_fulfillment (
    sample_fulfillment_key             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sample_collaboration_key           BIGINT UNSIGNED NOT NULL,
    shop_key                           INT UNSIGNED    NOT NULL,
    source_system                      VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id                  VARCHAR(128)    NOT NULL,
    user_id                            VARCHAR(64)     NOT NULL,
    shop_id                            VARCHAR(64)     NOT NULL,
    content_key                        BIGINT UNSIGNED DEFAULT NULL,
    product_key                        BIGINT UNSIGNED DEFAULT NULL,
    sku_key                            BIGINT UNSIGNED DEFAULT NULL,
    platform_sample_application_id     VARCHAR(128)    NOT NULL,
    platform_content_id                VARCHAR(128)    NOT NULL,
    content_format                     VARCHAR(32)     DEFAULT NULL,
    product_id                         VARCHAR(128)    DEFAULT NULL,
    product_main_image_url             VARCHAR(1024)   DEFAULT NULL,
    content_url                        VARCHAR(2048)   DEFAULT NULL,
    content_page_link                  VARCHAR(2048)   DEFAULT NULL,
    content_description                TEXT            DEFAULT NULL,
    content_created_at                 DATETIME        DEFAULT NULL,
    live_end_at                        DATETIME        DEFAULT NULL,
    view_count                         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    like_count                         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    comment_count                      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    paid_order_count                   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    gross_gmv_amount                   DECIMAL(18,4)   DEFAULT NULL,
    net_gmv_amount                     DECIMAL(18,4)   DEFAULT NULL,
    gmv_currency                       VARCHAR(16)     DEFAULT NULL,
    estimated_commission_amount        DECIMAL(18,4)   DEFAULT NULL,
    actual_commission_amount           DECIMAL(18,4)   DEFAULT NULL,
    commission_currency                VARCHAR(16)     DEFAULT NULL,
    gmv_applicability                  VARCHAR(32)     NOT NULL DEFAULT 'APPLICABLE',
    order_attribution_enriched_at      DATETIME        DEFAULT NULL,
    raw_fulfillment_payload            JSON            DEFAULT NULL,
    etl_loaded_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (sample_fulfillment_key),
    UNIQUE KEY uk_affiliate_sample_fulfillment
      (source_system, shop_id, platform_sample_application_id, platform_content_id, product_id),
    KEY idx_affiliate_sample_fulfillment_collaboration (sample_collaboration_key),
    KEY idx_affiliate_sample_fulfillment_content_key
      (content_key, content_created_at),
    KEY idx_affiliate_sample_fulfillment_product_key
      (product_key, content_created_at),
    KEY idx_affiliate_sample_fulfillment_sku_key
      (sku_key, content_created_at),
    KEY idx_affiliate_sample_fulfillment_content
      (source_system, shop_id, platform_content_id),
    KEY idx_affiliate_sample_fulfillment_product
      (shop_key, product_id, content_created_at),
    KEY idx_affiliate_sample_fulfillment_created
      (shop_key, content_created_at),
    KEY idx_affiliate_sample_fulfillment_order_attr_enriched
      (shop_key, order_attribution_enriched_at),
    CONSTRAINT fk_affiliate_sample_fulfillment_collaboration
      FOREIGN KEY (sample_collaboration_key)
      REFERENCES fct_affiliate_sample_collaboration(sample_collaboration_key)
      ON DELETE CASCADE
) ENGINE=InnoDB;

-- fct_affiliate_order_attribution: Internal support fact for affiliate order
-- attribution. Grain: one row per TikTok affiliate order × SKU × content ×
-- product. BI should normally consume the rollups on
-- fct_affiliate_sample_collaboration / fct_affiliate_sample_fulfillment; this
-- table exists to make those rollups reproducible and incremental.
CREATE TABLE IF NOT EXISTS fct_affiliate_order_attribution (
    affiliate_order_attribution_key    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_key                           INT UNSIGNED    NOT NULL,
    source_system                      VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id                  VARCHAR(128)    NOT NULL,
    user_id                            VARCHAR(64)     NOT NULL,
    shop_id                            VARCHAR(64)     NOT NULL,
    content_key                        BIGINT UNSIGNED DEFAULT NULL,
    product_key                        BIGINT UNSIGNED DEFAULT NULL,
    sku_key                            BIGINT UNSIGNED DEFAULT NULL,
    platform_order_id                  VARCHAR(128)    NOT NULL,
    platform_sku_id                    VARCHAR(128)    NOT NULL,
    platform_content_id                VARCHAR(128)    NOT NULL,
    product_id                         VARCHAR(128)    NOT NULL,
    platform_open_collaboration_id     VARCHAR(128)    DEFAULT NULL,
    platform_target_collaboration_id   VARCHAR(128)    DEFAULT NULL,
    platform_campaign_id               VARCHAR(128)    DEFAULT NULL,
    creator_username                   VARCHAR(255)    DEFAULT NULL,
    order_created_at                   DATETIME        DEFAULT NULL,
    order_delivery_at                  DATETIME        DEFAULT NULL,
    settlement_status                  VARCHAR(64)     DEFAULT NULL,
    content_type                       VARCHAR(64)     DEFAULT NULL,
    quantity                           INT             DEFAULT NULL,
    price_amount                       DECIMAL(18,4)   DEFAULT NULL,
    price_currency                     VARCHAR(16)     DEFAULT NULL,
    gross_gmv_amount                   DECIMAL(18,4)   DEFAULT NULL,
    net_gmv_amount                     DECIMAL(18,4)   DEFAULT NULL,
    gmv_currency                       VARCHAR(16)     DEFAULT NULL,
    estimated_commission_amount        DECIMAL(18,4)   DEFAULT NULL,
    actual_commission_amount           DECIMAL(18,4)   DEFAULT NULL,
    commission_currency                VARCHAR(16)     DEFAULT NULL,
    raw_order_payload                  JSON            DEFAULT NULL,
    raw_order_sku_payload              JSON            DEFAULT NULL,
    etl_loaded_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (affiliate_order_attribution_key),
    UNIQUE KEY uk_affiliate_order_attribution
      (source_system, shop_id, platform_order_id, platform_sku_id, platform_content_id, product_id),
    KEY idx_affiliate_order_attribution_content
      (source_system, shop_id, platform_content_id, product_id),
    KEY idx_affiliate_order_attribution_product
      (shop_key, product_id, order_created_at),
    KEY idx_affiliate_order_attribution_created
      (shop_key, order_created_at),
    KEY idx_affiliate_order_attribution_content_key
      (content_key, order_created_at),
    KEY idx_affiliate_order_attribution_product_key
      (product_key, order_created_at),
    KEY idx_affiliate_order_attribution_sku_key
      (sku_key, order_created_at)
) ENGINE=InnoDB;

-- dim_affiliate_creator_platform: Platform-level affiliate creator identity.
-- Grain: one source-system creator Open ID.
CREATE TABLE IF NOT EXISTS dim_affiliate_creator_platform (
    creator_platform_key              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    platform_creator_open_id          VARCHAR(128)    NOT NULL,
    creator_username                  VARCHAR(255)    DEFAULT NULL,
    creator_nickname                  VARCHAR(255)    DEFAULT NULL,
    creator_avatar_url                VARCHAR(1024)   DEFAULT NULL,
    selection_region                  VARCHAR(64)     DEFAULT NULL,
    bio_description                   TEXT            DEFAULT NULL,
    profile_tt_uri                    VARCHAR(1024)   DEFAULT NULL,
    follower_count                    BIGINT UNSIGNED DEFAULT NULL,
    category_ids                      JSON            DEFAULT NULL,
    first_observed_at                 DATETIME        DEFAULT NULL,
    last_observed_at                  DATETIME        DEFAULT NULL,
    last_enriched_at                  DATETIME        DEFAULT NULL,
    latest_observation_reasons        JSON            DEFAULT NULL,
    latest_observed_shop_ids          JSON            DEFAULT NULL,
    raw_latest_payload                JSON            DEFAULT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (creator_platform_key),
    UNIQUE KEY uk_affiliate_creator_platform
      (source_system, platform_creator_open_id),
    KEY idx_affiliate_creator_platform_username
      (source_system, creator_username),
    KEY idx_affiliate_creator_platform_observed
      (source_system, last_observed_at),
    KEY idx_affiliate_creator_platform_enriched
      (source_system, last_enriched_at)
) ENGINE=InnoDB;

-- fct_affiliate_creator_marketplace_snapshot_daily: Current marketplace
-- creator profile/performance snapshot for observed creators.
-- Grain: one creator Open ID × UTC snapshot date.
CREATE TABLE IF NOT EXISTS fct_affiliate_creator_marketplace_snapshot_daily (
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    platform_creator_open_id          VARCHAR(128)    NOT NULL,
    snapshot_date                     DATE            NOT NULL,
    observed_at                       DATETIME        NOT NULL,
    selected_shop_id                  VARCHAR(64)     DEFAULT NULL,
    observation_reasons               JSON            DEFAULT NULL,
    observed_shop_ids                 JSON            DEFAULT NULL,
    creator_username                  VARCHAR(255)    DEFAULT NULL,
    creator_nickname                  VARCHAR(255)    DEFAULT NULL,
    creator_avatar_url                VARCHAR(1024)   DEFAULT NULL,
    selection_region                  VARCHAR(64)     DEFAULT NULL,
    bio_description                   TEXT            DEFAULT NULL,
    profile_tt_uri                    VARCHAR(1024)   DEFAULT NULL,
    follower_count                    BIGINT UNSIGNED DEFAULT NULL,
    category_ids                      JSON            DEFAULT NULL,
    top_collaborated_brand_ids        JSON            DEFAULT NULL,
    brand_collaboration_count         INT UNSIGNED    DEFAULT NULL,
    units_sold                        BIGINT UNSIGNED DEFAULT NULL,
    units_sold_range                  JSON            DEFAULT NULL,
    gmv_amount                        DECIMAL(18,4)   DEFAULT NULL,
    gmv_currency                      VARCHAR(16)     DEFAULT NULL,
    video_gmv_amount                  DECIMAL(18,4)   DEFAULT NULL,
    video_gmv_currency                VARCHAR(16)     DEFAULT NULL,
    live_gmv_amount                   DECIMAL(18,4)   DEFAULT NULL,
    live_gmv_currency                 VARCHAR(16)     DEFAULT NULL,
    gmv_range                         JSON            DEFAULT NULL,
    gpm_amount                        DECIMAL(18,4)   DEFAULT NULL,
    gpm_currency                      VARCHAR(16)     DEFAULT NULL,
    live_gpm_amount                   DECIMAL(18,4)   DEFAULT NULL,
    live_gpm_currency                 VARCHAR(16)     DEFAULT NULL,
    video_gpm_amount                  DECIMAL(18,4)   DEFAULT NULL,
    video_gpm_currency                VARCHAR(16)     DEFAULT NULL,
    gpm_range                         JSON            DEFAULT NULL,
    video_gpm_range                   JSON            DEFAULT NULL,
    live_gpm_range                    JSON            DEFAULT NULL,
    promoted_product_num              INT UNSIGNED    DEFAULT NULL,
    ec_live_count                     INT UNSIGNED    DEFAULT NULL,
    ec_video_count                    INT UNSIGNED    DEFAULT NULL,
    avg_ec_video_play_count           BIGINT UNSIGNED DEFAULT NULL,
    avg_commission_rate               DECIMAL(9,4)    DEFAULT NULL,
    avg_commission_rate_range         JSON            DEFAULT NULL,
    avg_gmv_per_buyer_amount          DECIMAL(18,4)   DEFAULT NULL,
    avg_gmv_per_buyer_currency        VARCHAR(16)     DEFAULT NULL,
    avg_gmv_per_buyer_range           JSON            DEFAULT NULL,
    avg_ec_live_view_count            BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_live_like_count            BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_live_comment_count         BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_live_share_count           BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_video_like_count           BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_video_comment_count        BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_video_share_count          BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_live_uv                    BIGINT UNSIGNED DEFAULT NULL,
    avg_ec_video_view_count           BIGINT UNSIGNED DEFAULT NULL,
    ec_live_engagement_rate           DECIMAL(18,8)   DEFAULT NULL,
    ec_video_engagement_rate          DECIMAL(18,8)   DEFAULT NULL,
    post_rate                         DECIMAL(18,8)   DEFAULT NULL,
    pps                               VARCHAR(64)     DEFAULT NULL,
    rating                            VARCHAR(64)     DEFAULT NULL,
    category_gmv_distribution         JSON            DEFAULT NULL,
    content_gmv_distribution          JSON            DEFAULT NULL,
    follower_location                 JSON            DEFAULT NULL,
    follower_age                      JSON            DEFAULT NULL,
    follower_gender                   JSON            DEFAULT NULL,
    top_follower_demographics         JSON            DEFAULT NULL,
    raw_snapshot_payload              JSON            DEFAULT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, platform_creator_open_id, snapshot_date),
    KEY idx_affiliate_creator_snapshot_date
      (source_system, snapshot_date),
    KEY idx_affiliate_creator_snapshot_observed
      (source_system, observed_at),
    KEY idx_affiliate_creator_snapshot_username
      (source_system, creator_username)
) ENGINE=InnoDB;

-- fct_affiliate_creator_feature_daily: Model-oriented creator features.
-- Grain: one creator × snapshot date × feature version.
CREATE TABLE IF NOT EXISTS fct_affiliate_creator_feature_daily (
    snapshot_date                     DATE            NOT NULL,
    feature_version                   VARCHAR(64)     NOT NULL DEFAULT 'structured_v1',
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    platform_creator_open_id          VARCHAR(128)    NOT NULL,
    observed_via_shop_key             INT UNSIGNED    DEFAULT NULL,
    observed_via_shop_id              VARCHAR(64)     DEFAULT NULL,
    creator_username                  VARCHAR(255)    DEFAULT NULL,
    creator_nickname                  VARCHAR(255)    DEFAULT NULL,
    selection_region                  VARCHAR(64)     DEFAULT NULL,
    bio_description                   TEXT            DEFAULT NULL,
    profile_tt_uri                    VARCHAR(1024)   DEFAULT NULL,
    category_ids                      JSON            DEFAULT NULL,
    category_gmv_distribution         JSON            DEFAULT NULL,
    content_gmv_distribution          JSON            DEFAULT NULL,
    follower_location_distribution    JSON            DEFAULT NULL,
    follower_age_distribution         JSON            DEFAULT NULL,
    follower_gender_distribution      JSON            DEFAULT NULL,
    follower_count                    BIGINT UNSIGNED DEFAULT NULL,
    marketplace_30d_gmv_amount        DECIMAL(18,4)   DEFAULT NULL,
    marketplace_30d_content_count     INT UNSIGNED    DEFAULT NULL,
    marketplace_90d_fulfillment_rate_percent DECIMAL(9,4) DEFAULT NULL,
    marketplace_30d_median_video_view_count BIGINT UNSIGNED DEFAULT NULL,
    marketplace_gmv_amount            DECIMAL(18,4)   DEFAULT NULL,
    marketplace_video_gmv_amount      DECIMAL(18,4)   DEFAULT NULL,
    marketplace_live_gmv_amount       DECIMAL(18,4)   DEFAULT NULL,
    marketplace_ec_video_count        INT UNSIGNED    DEFAULT NULL,
    marketplace_ec_live_count         INT UNSIGNED    DEFAULT NULL,
    marketplace_avg_video_view_count  BIGINT UNSIGNED DEFAULT NULL,
    marketplace_avg_commission_rate_bps INT UNSIGNED  DEFAULT NULL,
    prior_sample_count                INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_approved_count              INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_applicable_count            INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_positive_gmv_count          INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_gross_gmv_amount            DECIMAL(18,4)   NOT NULL DEFAULT 0,
    prior_avg_gross_gmv_amount        DECIMAL(18,4)   DEFAULT NULL,
    prior_approval_rate               DECIMAL(9,6)    DEFAULT NULL,
    prior_positive_gmv_rate           DECIMAL(9,6)    DEFAULT NULL,
    prior_video_content_share         DECIMAL(9,6)    DEFAULT NULL,
    prior_live_content_share          DECIMAL(9,6)    DEFAULT NULL,
    prior_median_product_price_amount DECIMAL(18,4)   DEFAULT NULL,
    feature_payload                   JSON            DEFAULT NULL,
    semantic_text_payload             JSON            DEFAULT NULL,
    built_at                          DATETIME        NOT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, platform_creator_open_id, snapshot_date, feature_version),
    KEY idx_affiliate_creator_feature_date (snapshot_date),
    KEY idx_affiliate_creator_feature_shop (observed_via_shop_key, snapshot_date),
    KEY idx_affiliate_creator_feature_gmv (snapshot_date, prior_gross_gmv_amount)
) ENGINE=InnoDB;

-- fct_affiliate_product_feature_daily: Model-oriented product features.
-- Grain: one shop product × snapshot date × feature version.
CREATE TABLE IF NOT EXISTS fct_affiliate_product_feature_daily (
    snapshot_date                     DATE            NOT NULL,
    feature_version                   VARCHAR(64)     NOT NULL DEFAULT 'structured_v1',
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    shop_key                          INT UNSIGNED    NOT NULL,
    source_account_id                 VARCHAR(128)    NOT NULL,
    user_id                           VARCHAR(64)     NOT NULL,
    shop_id                           VARCHAR(64)     NOT NULL,
    product_key                       BIGINT UNSIGNED DEFAULT NULL,
    product_id                        VARCHAR(128)    NOT NULL,
    product_title                     VARCHAR(512)    DEFAULT NULL,
    product_description               TEXT            DEFAULT NULL,
    product_status                    VARCHAR(64)     DEFAULT NULL,
    category_leaf_id                  VARCHAR(128)    DEFAULT NULL,
    category_leaf_name                VARCHAR(255)    DEFAULT NULL,
    category_path_names               JSON            DEFAULT NULL,
    brand_id                          VARCHAR(128)    DEFAULT NULL,
    brand_name                        VARCHAR(255)    DEFAULT NULL,
    min_price_amount                  DECIMAL(18,4)   DEFAULT NULL,
    max_price_amount                  DECIMAL(18,4)   DEFAULT NULL,
    price_currency                    VARCHAR(16)     DEFAULT NULL,
    sku_count                         INT UNSIGNED    NOT NULL DEFAULT 0,
    active_sku_count                  INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_sample_count                INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_approved_count              INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_applicable_count            INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_positive_gmv_count          INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_affiliate_gross_gmv_amount  DECIMAL(18,4)   NOT NULL DEFAULT 0,
    prior_affiliate_avg_gross_gmv_amount DECIMAL(18,4) DEFAULT NULL,
    prior_approval_rate               DECIMAL(9,6)    DEFAULT NULL,
    prior_positive_gmv_rate           DECIMAL(9,6)    DEFAULT NULL,
    prior_order_count                 INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_units                       INT UNSIGNED    NOT NULL DEFAULT 0,
    prior_order_gross_gmv_amount      DECIMAL(18,4)   NOT NULL DEFAULT 0,
    prior_order_effective_gmv_amount  DECIMAL(18,4)   NOT NULL DEFAULT 0,
    feature_payload                   JSON            DEFAULT NULL,
    semantic_text_payload             JSON            DEFAULT NULL,
    built_at                          DATETIME        NOT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, shop_id, product_id, snapshot_date, feature_version),
    KEY idx_affiliate_product_feature_date (snapshot_date),
    KEY idx_affiliate_product_feature_shop_category (shop_key, category_leaf_id, snapshot_date),
    KEY idx_affiliate_product_feature_gmv (snapshot_date, prior_affiliate_gross_gmv_amount)
) ENGINE=InnoDB;

-- fct_affiliate_creator_category_feature_daily: Smoothed point-in-time
-- creator × category priors for sparse creator/category combinations.
CREATE TABLE IF NOT EXISTS fct_affiliate_creator_category_feature_daily (
    snapshot_date                     DATE            NOT NULL,
    feature_version                   VARCHAR(64)     NOT NULL DEFAULT 'structured_v1',
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    shop_key                          INT UNSIGNED    NOT NULL,
    source_account_id                 VARCHAR(128)    NOT NULL,
    user_id                           VARCHAR(64)     NOT NULL,
    shop_id                           VARCHAR(64)     NOT NULL,
    platform_creator_open_id          VARCHAR(128)    NOT NULL,
    category_leaf_id                  VARCHAR(128)    NOT NULL,
    category_leaf_name                VARCHAR(255)    DEFAULT NULL,
    category_path_names               JSON            DEFAULT NULL,
    creator_category_sample_count     INT UNSIGNED    NOT NULL DEFAULT 0,
    creator_category_approved_count   INT UNSIGNED    NOT NULL DEFAULT 0,
    creator_category_applicable_count INT UNSIGNED    NOT NULL DEFAULT 0,
    creator_category_positive_gmv_count INT UNSIGNED  NOT NULL DEFAULT 0,
    creator_category_gross_gmv_amount DECIMAL(18,4)   NOT NULL DEFAULT 0,
    creator_category_avg_gmv_amount   DECIMAL(18,4)   DEFAULT NULL,
    creator_category_approval_rate    DECIMAL(9,6)    DEFAULT NULL,
    creator_category_positive_gmv_rate DECIMAL(9,6)   DEFAULT NULL,
    category_prior_sample_count       INT UNSIGNED    NOT NULL DEFAULT 0,
    category_prior_applicable_count   INT UNSIGNED    NOT NULL DEFAULT 0,
    category_prior_positive_gmv_count INT UNSIGNED    NOT NULL DEFAULT 0,
    category_prior_gross_gmv_amount   DECIMAL(18,4)   NOT NULL DEFAULT 0,
    category_prior_avg_gmv_amount     DECIMAL(18,4)   DEFAULT NULL,
    smoothed_avg_gmv_amount           DECIMAL(18,4)   DEFAULT NULL,
    smoothed_positive_gmv_rate        DECIMAL(9,6)    DEFAULT NULL,
    smoothing_weight                  DECIMAL(9,6)    DEFAULT NULL,
    fallback_level                    VARCHAR(32)     NOT NULL DEFAULT 'GLOBAL',
    feature_payload                   JSON            DEFAULT NULL,
    built_at                          DATETIME        NOT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, shop_id, platform_creator_open_id, category_leaf_id, snapshot_date, feature_version),
    KEY idx_affiliate_creator_category_date (snapshot_date),
    KEY idx_affiliate_creator_category_category (shop_key, category_leaf_id, snapshot_date),
    KEY idx_affiliate_creator_category_creator (source_system, platform_creator_open_id, snapshot_date)
) ENGINE=InnoDB;

-- fct_affiliate_creator_product_match_daily: Structured creator/product fit
-- features. Embedding scores can be added later without changing the raw facts.
CREATE TABLE IF NOT EXISTS fct_affiliate_creator_product_match_daily (
    snapshot_date                     DATE            NOT NULL,
    feature_version                   VARCHAR(64)     NOT NULL DEFAULT 'structured_v1',
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    shop_key                          INT UNSIGNED    NOT NULL,
    source_account_id                 VARCHAR(128)    NOT NULL,
    user_id                           VARCHAR(64)     NOT NULL,
    shop_id                           VARCHAR(64)     NOT NULL,
    platform_creator_open_id          VARCHAR(128)    NOT NULL,
    product_id                        VARCHAR(128)    NOT NULL,
    category_fit_score                DECIMAL(9,6)    DEFAULT NULL,
    price_band_fit_score              DECIMAL(9,6)    DEFAULT NULL,
    creator_product_gmv_fit_score     DECIMAL(9,6)    DEFAULT NULL,
    creator_affiliate_history_fit_score DECIMAL(9,6) DEFAULT NULL,
    content_format_fit_score          DECIMAL(9,6)    DEFAULT NULL,
    creator_category_sample_count     INT UNSIGNED    DEFAULT NULL,
    creator_category_smoothed_gmv_amount DECIMAL(18,4) DEFAULT NULL,
    creator_category_smoothed_positive_gmv_rate DECIMAL(9,6) DEFAULT NULL,
    category_text_fit_score           DECIMAL(9,6)    DEFAULT NULL,
    audience_fit_score                DECIMAL(9,6)    DEFAULT NULL,
    text_fit_score                    DECIMAL(9,6)    DEFAULT NULL,
    visual_fit_score                  DECIMAL(9,6)    DEFAULT NULL,
    match_feature_payload             JSON            DEFAULT NULL,
    built_at                          DATETIME        NOT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, shop_id, platform_creator_open_id, product_id, snapshot_date, feature_version),
    KEY idx_affiliate_match_date (snapshot_date),
    KEY idx_affiliate_match_product (shop_key, product_id, snapshot_date),
    KEY idx_affiliate_match_creator (source_system, platform_creator_open_id, snapshot_date)
) ENGINE=InnoDB;

-- mart_affiliate_collaboration_training_examples: Flattened model examples.
-- Grain: one sample collaboration × feature version.
CREATE TABLE IF NOT EXISTS mart_affiliate_collaboration_training_examples (
    sample_collaboration_key          BIGINT UNSIGNED NOT NULL,
    feature_version                   VARCHAR(64)     NOT NULL DEFAULT 'structured_v1',
    snapshot_date                     DATE            NOT NULL,
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    shop_key                          INT UNSIGNED    NOT NULL,
    source_account_id                 VARCHAR(128)    NOT NULL,
    user_id                           VARCHAR(64)     NOT NULL,
    shop_id                           VARCHAR(64)     NOT NULL,
    platform_sample_application_id    VARCHAR(128)    NOT NULL,
    platform_creator_open_id          VARCHAR(128)    DEFAULT NULL,
    creator_username                  VARCHAR(255)    DEFAULT NULL,
    creator_nickname                  VARCHAR(255)    DEFAULT NULL,
    product_id                        VARCHAR(128)    DEFAULT NULL,
    product_title                     VARCHAR(512)    DEFAULT NULL,
    product_description               TEXT            DEFAULT NULL,
    sku_id                            VARCHAR(128)    DEFAULT NULL,
    application_status                VARCHAR(64)     NOT NULL,
    sample_outcome                    VARCHAR(64)     DEFAULT NULL,
    gmv_applicability                 VARCHAR(32)     NOT NULL,
    seller_approved_proxy             TINYINT(1)      DEFAULT NULL,
    business_success_proxy            TINYINT(1)      DEFAULT NULL,
    positive_gmv_proxy                TINYINT(1)      DEFAULT NULL,
    gross_gmv_amount                  DECIMAL(18,4)   DEFAULT NULL,
    log1p_gross_gmv_amount            DECIMAL(18,8)   DEFAULT NULL,
    commission_rate                   DECIMAL(9,6)    DEFAULT NULL,
    post_paid_order_count             BIGINT UNSIGNED DEFAULT NULL,
    post_units_sold_count             BIGINT UNSIGNED DEFAULT NULL,
    log1p_post_paid_order_count       DECIMAL(18,8)   DEFAULT NULL,
    log1p_post_units_sold_count       DECIMAL(18,8)   DEFAULT NULL,
    post_order_attribution_gross_gmv_amount DECIMAL(18,4) DEFAULT NULL,
    product_category_leaf_id          VARCHAR(128)    DEFAULT NULL,
    product_category_leaf_name        VARCHAR(255)    DEFAULT NULL,
    product_category_path_names       JSON            DEFAULT NULL,
    product_brand_id                  VARCHAR(128)    DEFAULT NULL,
    product_brand_name                VARCHAR(255)    DEFAULT NULL,
    product_min_price_amount          DECIMAL(18,4)   DEFAULT NULL,
    product_max_price_amount          DECIMAL(18,4)   DEFAULT NULL,
    creator_follower_count            BIGINT UNSIGNED DEFAULT NULL,
    creator_marketplace_30d_gmv_amount DECIMAL(18,4) DEFAULT NULL,
    creator_marketplace_30d_content_count INT UNSIGNED DEFAULT NULL,
    creator_bio_description           TEXT            DEFAULT NULL,
    creator_selection_region          VARCHAR(64)     DEFAULT NULL,
    creator_category_ids              JSON            DEFAULT NULL,
    creator_category_gmv_distribution JSON            DEFAULT NULL,
    creator_follower_location_distribution JSON        DEFAULT NULL,
    creator_follower_age_distribution JSON             DEFAULT NULL,
    creator_follower_gender_distribution JSON          DEFAULT NULL,
    prior_creator_sample_count        INT UNSIGNED    DEFAULT NULL,
    prior_creator_approval_rate       DECIMAL(9,6)    DEFAULT NULL,
    prior_creator_positive_gmv_rate   DECIMAL(9,6)    DEFAULT NULL,
    prior_product_sample_count        INT UNSIGNED    DEFAULT NULL,
    prior_product_approval_rate       DECIMAL(9,6)    DEFAULT NULL,
    prior_product_positive_gmv_rate   DECIMAL(9,6)    DEFAULT NULL,
    category_fit_score                DECIMAL(9,6)    DEFAULT NULL,
    price_band_fit_score              DECIMAL(9,6)    DEFAULT NULL,
    creator_product_gmv_fit_score     DECIMAL(9,6)    DEFAULT NULL,
    creator_affiliate_history_fit_score DECIMAL(9,6) DEFAULT NULL,
    content_format_fit_score          DECIMAL(9,6)    DEFAULT NULL,
    creator_category_sample_count     INT UNSIGNED    DEFAULT NULL,
    creator_category_smoothed_gmv_amount DECIMAL(18,4) DEFAULT NULL,
    creator_category_smoothed_positive_gmv_rate DECIMAL(9,6) DEFAULT NULL,
    category_text_fit_score           DECIMAL(9,6)    DEFAULT NULL,
    post_fulfillment_content_count    INT UNSIGNED    DEFAULT NULL,
    post_fulfillment_video_count      INT UNSIGNED    DEFAULT NULL,
    post_fulfillment_live_count       INT UNSIGNED    DEFAULT NULL,
    post_total_view_count             BIGINT UNSIGNED DEFAULT NULL,
    post_total_like_count             BIGINT UNSIGNED DEFAULT NULL,
    post_total_comment_count          BIGINT UNSIGNED DEFAULT NULL,
    built_at                          DATETIME        NOT NULL,
    etl_loaded_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (sample_collaboration_key, feature_version),
    KEY idx_affiliate_training_snapshot (snapshot_date),
    KEY idx_affiliate_training_shop (shop_key, snapshot_date),
    KEY idx_affiliate_training_creator (source_system, platform_creator_open_id, snapshot_date),
    KEY idx_affiliate_training_product (shop_key, product_id, snapshot_date)
) ENGINE=InnoDB;

-- affiliate_etl_entity_watermark: optional entity-level API checkpoints for
-- future creator/product opportunity collectors.
CREATE TABLE IF NOT EXISTS affiliate_etl_entity_watermark (
    source_system                     VARCHAR(32)     NOT NULL DEFAULT 'TIKTOK_SHOP',
    source_account_id                 VARCHAR(128)    NOT NULL,
    dataset                           VARCHAR(128)    NOT NULL,
    entity_type                       VARCHAR(64)     NOT NULL,
    entity_id                         VARCHAR(128)    NOT NULL,
    shop_key                          INT UNSIGNED    DEFAULT NULL,
    shop_id                           VARCHAR(64)     DEFAULT NULL,
    last_scanned_until_at             DATETIME        DEFAULT NULL,
    status                            VARCHAR(32)     NOT NULL DEFAULT 'ACTIVE',
    details_json                      JSON            DEFAULT NULL,
    updated_at                        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, source_account_id, dataset, entity_type, entity_id),
    KEY idx_affiliate_entity_watermark_shop (shop_key, dataset, updated_at),
    KEY idx_affiliate_entity_watermark_scan (dataset, last_scanned_until_at)
) ENGINE=InnoDB;

-- fct_sessions: Session-level fact table (grain: one row per session)
-- Foundation for retention analysis and funnel computation
CREATE TABLE IF NOT EXISTS fct_sessions (
    session_id     VARCHAR(64)  NOT NULL,
    device_key     INT UNSIGNED DEFAULT NULL,
    user_key       INT UNSIGNED DEFAULT NULL,    -- FK→dim_user, NULL for anonymous sessions
    date_key       DATE         NOT NULL,
    platform_key   SMALLINT     NOT NULL,
    version_key    SMALLINT     NOT NULL,
    locale_key     SMALLINT     NOT NULL,
    -- Timing
    started_at     DATETIME(3)  NOT NULL,
    stopped_at     DATETIME(3)  DEFAULT NULL,
    runtime_ms     BIGINT       DEFAULT NULL,
    -- Counts
    event_count         INT UNSIGNED NOT NULL DEFAULT 0,
    error_count         INT UNSIGNED NOT NULL DEFAULT 0,
    heartbeat_count     INT UNSIGNED NOT NULL DEFAULT 0,
    -- Feature usage flags
    has_rule_created         BOOLEAN NOT NULL DEFAULT FALSE,
    has_channel_configured   BOOLEAN NOT NULL DEFAULT FALSE,
    has_chat_sent            BOOLEAN NOT NULL DEFAULT FALSE,
    chat_message_count       INT UNSIGNED NOT NULL DEFAULT 0,
    has_provider_added       BOOLEAN NOT NULL DEFAULT FALSE,
    has_preset_used          BOOLEAN NOT NULL DEFAULT FALSE,
    has_onboarding_started   BOOLEAN NOT NULL DEFAULT FALSE,
    has_onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    has_channel_added        BOOLEAN NOT NULL DEFAULT FALSE,
    has_cron_created         BOOLEAN NOT NULL DEFAULT FALSE,
    has_skills_installed     BOOLEAN NOT NULL DEFAULT FALSE,
    has_model_switched       BOOLEAN NOT NULL DEFAULT FALSE,
    has_stt_configured       BOOLEAN NOT NULL DEFAULT FALSE,
    -- ETL metadata
    etl_loaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id),
    KEY idx_date (date_key),
    KEY idx_device_date (device_key, date_key),
    KEY idx_user_date (user_key, date_key),
    KEY idx_platform_date (platform_key, date_key),
    KEY idx_version_date (version_key, date_key),
    KEY idx_locale_date (locale_key, date_key)
) ENGINE=InnoDB;

-- fct_daily_events: Multi-dimensional daily event aggregation
-- Replaces: daily_feature_usage, daily_platform_distribution,
--           daily_version_distribution, daily_locale_distribution
-- Grain: (date, event_type, platform, version, locale)
CREATE TABLE IF NOT EXISTS fct_daily_events (
    date_key        DATE     NOT NULL,
    event_type_key  SMALLINT NOT NULL,
    platform_key    SMALLINT NOT NULL,
    version_key     SMALLINT NOT NULL,
    locale_key      SMALLINT NOT NULL,
    -- Measures
    event_count     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    session_count   INT UNSIGNED    NOT NULL DEFAULT 0,
    user_count      INT UNSIGNED    NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key, event_type_key, platform_key, version_key, locale_key),
    KEY idx_date (date_key),
    KEY idx_event_type_date (event_type_key, date_key),
    KEY idx_platform_date (platform_key, date_key),
    KEY idx_version_date (version_key, date_key),
    KEY idx_locale_date (locale_key, date_key)
) ENGINE=InnoDB;

-- fct_daily_active: DAU with dimensional breakdown
-- Grain: (date, platform, version, locale)
CREATE TABLE IF NOT EXISTS fct_daily_active (
    date_key       DATE     NOT NULL,
    platform_key   SMALLINT NOT NULL,
    version_key    SMALLINT NOT NULL,
    locale_key     SMALLINT NOT NULL,
    -- Measures
    dau            INT UNSIGNED    NOT NULL DEFAULT 0,
    dau_users      INT UNSIGNED    NOT NULL DEFAULT 0,
    total_events   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key, platform_key, version_key, locale_key),
    KEY idx_date (date_key),
    KEY idx_platform_date (platform_key, date_key),
    KEY idx_version_date (version_key, date_key),
    KEY idx_locale_date (locale_key, date_key)
) ENGINE=InnoDB;

-- fct_daily_active_summary: Pre-computed DAU/WAU/MAU
-- Replaces: daily_metrics
-- Grain: one row per day
CREATE TABLE IF NOT EXISTS fct_daily_active_summary (
    date_key        DATE         NOT NULL,
    dau             INT UNSIGNED NOT NULL DEFAULT 0,
    wau             INT UNSIGNED NOT NULL DEFAULT 0,
    mau             INT UNSIGNED NOT NULL DEFAULT 0,
    total_events    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_sessions  INT UNSIGNED    NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key)
) ENGINE=InnoDB;

-- fct_retention: Cohort retention analysis (D1/D7/D30)
-- Grain: (cohort_date, period_type, platform)
CREATE TABLE IF NOT EXISTS fct_retention (
    cohort_date    DATE         NOT NULL,
    period_type    VARCHAR(4)   NOT NULL,   -- 'D1', 'D7', 'D30'
    platform_key   SMALLINT     NOT NULL,
    -- Measures
    cohort_size    INT UNSIGNED NOT NULL DEFAULT 0,
    retained_count INT UNSIGNED NOT NULL DEFAULT 0,
    retention_rate DECIMAL(5,4) DEFAULT NULL,
    -- ETL metadata
    etl_loaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cohort_date, period_type, platform_key),
    KEY idx_cohort (cohort_date),
    KEY idx_period_cohort (period_type, cohort_date),
    KEY idx_platform_cohort (platform_key, cohort_date)
) ENGINE=InnoDB;

-- fct_funnel_daily: Conversion funnel step counts
-- Grain: (date, funnel_name, step_number, platform)
CREATE TABLE IF NOT EXISTS fct_funnel_daily (
    date_key        DATE        NOT NULL,
    funnel_name     VARCHAR(32) NOT NULL,
    step_number     TINYINT     NOT NULL,
    step_name       VARCHAR(64) NOT NULL,
    platform_key    SMALLINT    NOT NULL,
    -- Measures
    session_count   INT UNSIGNED NOT NULL DEFAULT 0,
    user_count      INT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key, funnel_name, step_number, platform_key),
    KEY idx_date (date_key),
    KEY idx_funnel_date (funnel_name, date_key),
    KEY idx_funnel_step_date (funnel_name, step_number, date_key),
    KEY idx_platform_date (platform_key, date_key)
) ENGINE=InnoDB;

-- fct_weekly_report: Structured weekly snapshots
-- Replaces: weekly_reports
-- Grain: one row per week
CREATE TABLE IF NOT EXISTS fct_weekly_report (
    week_ending_date    DATE         NOT NULL,
    wau                 INT UNSIGNED NOT NULL DEFAULT 0,
    new_users           INT UNSIGNED NOT NULL DEFAULT 0,
    total_events        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_sessions      INT UNSIGNED    NOT NULL DEFAULT 0,
    app_launches        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    rules_created       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    channels_configured BIGINT UNSIGNED NOT NULL DEFAULT 0,
    chat_messages       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    avg_runtime_minutes DECIMAL(10,2)   DEFAULT NULL,
    error_count         INT UNSIGNED    NOT NULL DEFAULT 0,
    channels_added      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    crons_created       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    skills_installed    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    d1_retention_rate   DECIMAL(5,4)    DEFAULT NULL,
    d7_retention_rate   DECIMAL(5,4)    DEFAULT NULL,
    report_markdown     TEXT,
    -- ETL metadata
    etl_loaded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (week_ending_date)
) ENGINE=InnoDB;

-- fct_device_daily: Pre-aggregated device-day metrics
-- Derived from fct_sessions (no extra ClickHouse query)
-- Grain: (device, date)
CREATE TABLE IF NOT EXISTS fct_device_daily (
    device_key     INT UNSIGNED NOT NULL,
    date_key       DATE         NOT NULL,
    platform_key   SMALLINT     NOT NULL,
    -- Measures
    session_count  INT UNSIGNED    NOT NULL DEFAULT 0,
    runtime_ms     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    event_count    INT UNSIGNED    NOT NULL DEFAULT 0,
    error_count    INT UNSIGNED    NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (device_key, date_key),
    KEY idx_date (date_key)
) ENGINE=InnoDB;

-- fct_user_device_daily: Per-day user↔device intensity
-- Grain: (date, user, device)
-- Populated after mirror_mongo_users (user_key) and discover_dimensions (device_key).
-- Insert-only per DAG run; rebuilds delete by date_key then reload.
CREATE TABLE IF NOT EXISTS fct_user_device_daily (
    date_key       DATE         NOT NULL,
    user_key       INT UNSIGNED NOT NULL,
    device_key     INT UNSIGNED NOT NULL,
    session_count  INT UNSIGNED NOT NULL DEFAULT 0,
    event_count    INT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, device_key, date_key),
    KEY idx_date (date_key),
    KEY idx_user_date (user_key, date_key),
    KEY idx_device_date (device_key, date_key)
) ENGINE=InnoDB;

-- fct_daily_metadata: Metadata-keyed daily event aggregation
-- Stores breakdowns by metadata fields (model, provider, theme, language, channelType)
-- Grain: (date, event_type, meta_key, meta_value)
CREATE TABLE IF NOT EXISTS fct_daily_metadata (
    date_key        DATE         NOT NULL,
    event_type_key  SMALLINT     NOT NULL,
    meta_key        VARCHAR(50)  NOT NULL,
    meta_value      VARCHAR(255) NOT NULL,
    event_count     INT UNSIGNED NOT NULL DEFAULT 0,
    etl_loaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key, event_type_key, meta_key, meta_value),
    KEY idx_date (date_key),
    KEY idx_event_type_date (event_type_key, date_key),
    KEY idx_meta_key_date (meta_key, date_key),
    KEY idx_meta_pair_date (meta_key, meta_value, date_key)
) ENGINE=InnoDB;

-- fct_hourly_events: Hourly event counts for heatmaps
-- Grain: (date, hour, event_type)
CREATE TABLE IF NOT EXISTS fct_hourly_events (
    date_key        DATE         NOT NULL,
    hour_of_day     TINYINT      NOT NULL,   -- 0-23
    event_type_key  SMALLINT     NOT NULL,
    event_count     INT UNSIGNED NOT NULL DEFAULT 0,
    etl_loaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key, hour_of_day, event_type_key),
    KEY idx_date (date_key),
    KEY idx_event_type_date_hour (event_type_key, date_key, hour_of_day)
) ENGINE=InnoDB;

-- fct_llm_usage_daily: Daily LLM proxy usage per user per model
-- Grain: (date, user, model)
CREATE TABLE IF NOT EXISTS fct_llm_usage_daily (
    date_key            DATE         NOT NULL,
    user_key            INT UNSIGNED NOT NULL,
    model_key           SMALLINT     NOT NULL,
    -- Measures
    prompt_tokens       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    request_count       INT UNSIGNED    NOT NULL DEFAULT 0,
    overhead_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    upstream_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    active_minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, model_key, date_key),
    KEY idx_date (date_key),
    KEY idx_user_date (user_key, date_key),
    KEY idx_model_date (model_key, date_key)
) ENGINE=InnoDB;

-- fct_llm_usage_hourly: Hourly LLM proxy usage per user per model
-- Grain: (date, hour, user, model)
CREATE TABLE IF NOT EXISTS fct_llm_usage_hourly (
    date_key            DATE         NOT NULL,
    hour_of_day         TINYINT      NOT NULL,
    user_key            INT UNSIGNED NOT NULL,
    model_key           SMALLINT     NOT NULL,
    -- Measures
    prompt_tokens       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    request_count       INT UNSIGNED    NOT NULL DEFAULT 0,
    overhead_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    upstream_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, model_key, date_key, hour_of_day),
    KEY idx_date (date_key),
    KEY idx_user_date (user_key, date_key),
    KEY idx_model_date (model_key, date_key)
) ENGINE=InnoDB;

-- fct_llm_daily_summary: Pre-computed daily LLM usage summary
-- Grain: one row per day
CREATE TABLE IF NOT EXISTS fct_llm_daily_summary (
    date_key                DATE         NOT NULL,
    -- Measures
    total_prompt_tokens     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_completion_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens            BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_requests          INT UNSIGNED    NOT NULL DEFAULT 0,
    active_users            INT UNSIGNED    NOT NULL DEFAULT 0,
    active_models           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    avg_latency_ms          DECIMAL(10,2)   DEFAULT NULL,
    -- ETL metadata
    etl_loaded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (date_key)
) ENGINE=InnoDB;

-- fct_llm_usage_realtime_5m: legacy 5-minute LLM proxy usage per user per model
-- Grain: (sampled_at, backend_target, user, model)
CREATE TABLE IF NOT EXISTS fct_llm_usage_realtime_5m (
    row_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sampled_at         DATETIME(0)     NOT NULL,
    backend_target     VARCHAR(32)     NOT NULL DEFAULT 'production',
    user_id            VARCHAR(64)     NOT NULL,
    user_key           INT UNSIGNED    DEFAULT NULL,
    model_key          SMALLINT        NOT NULL,
    model_code         VARCHAR(64)     NOT NULL,
    -- Measures
    prompt_tokens      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    request_count      INT UNSIGNED    NOT NULL DEFAULT 0,
    active_minutes     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    overhead_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    upstream_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    latest_call_at     DATETIME(3)     DEFAULT NULL,
    -- ETL metadata
    etl_loaded_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (row_id),
    UNIQUE KEY uk_llm_rt_sample (sampled_at, backend_target, user_id, model_code),
    KEY idx_llm_rt_sampled_at (sampled_at),
    KEY idx_llm_rt_backend_sampled_at (backend_target, sampled_at),
    KEY idx_llm_rt_backend_user_sampled_at (backend_target, user_key, sampled_at),
    KEY idx_llm_rt_backend_model_sampled_at (backend_target, model_key, sampled_at),
    KEY idx_llm_rt_backend_user_latest (backend_target, user_key, latest_call_at)
) ENGINE=InnoDB;

-- bi_pipeline_watermark: source cursors for lightweight incremental BI jobs.
CREATE TABLE IF NOT EXISTS bi_pipeline_watermark (
    backend_target             VARCHAR(32)  NOT NULL DEFAULT 'production',
    pipeline_name              VARCHAR(128) NOT NULL,
    source_system              VARCHAR(64)  NOT NULL,
    source_collection          VARCHAR(128) NOT NULL,
    last_scanned_until_at      DATETIME(3)  DEFAULT NULL,
    updated_at                 TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (backend_target, pipeline_name),
    KEY idx_bi_pipeline_watermark_source (source_system, source_collection, last_scanned_until_at)
) ENGINE=InnoDB;

-- fct_llm_usage_realtime_minute: minute-grain LLM proxy usage.
-- Grain: (minute_at, backend_target, user, model)
CREATE TABLE IF NOT EXISTS fct_llm_usage_realtime_minute (
    minute_at          DATETIME(0)     NOT NULL,
    backend_target     VARCHAR(32)     NOT NULL DEFAULT 'production',
    user_id            VARCHAR(64)     NOT NULL,
    user_key           INT UNSIGNED    DEFAULT NULL,
    model_key          SMALLINT        NOT NULL,
    model_code         VARCHAR(64)     NOT NULL,
    prompt_tokens      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    request_count      INT UNSIGNED    NOT NULL DEFAULT 0,
    overhead_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    upstream_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    weekly_token_remaining_pct DECIMAL(7,4) DEFAULT NULL,
    weekly_time_remaining_pct DECIMAL(7,4) DEFAULT NULL,
    five_hour_token_remaining_pct DECIMAL(7,4) DEFAULT NULL,
    five_hour_time_remaining_pct DECIMAL(7,4) DEFAULT NULL,
    etl_loaded_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (minute_at, backend_target, user_id, model_code),
    KEY idx_llm_rt_min_backend_minute (backend_target, minute_at),
    KEY idx_llm_rt_min_backend_user_minute_model (backend_target, user_key, minute_at, model_code),
    KEY idx_llm_rt_min_backend_model_minute_user (backend_target, model_code, minute_at, user_key)
) ENGINE=InnoDB;

-- =============================================================================
-- CS / Ecom BI summary fact tables (migration 005)
--
-- Single-TZ (LA) design. Every fact grain uses a single local_date_key
-- (= toDate(ts, 'America/Los_Angeles')). utc_date_key is retained as a
-- diagnostic column (toDate(first_ts, 'UTC')) — indexed for ad-hoc filters,
-- NEVER part of a UNIQUE KEY. See server/telemetry/airflow/docs/ADR/ADR-005-single-tz-bi-layer.md
-- for the decision record and future multi-tz plan.
--
-- True shopless / tenant-level telemetry maps to dim_shop.shop_id='__SHOPLESS__'.
-- Non-empty upstream shopId values must resolve to a real dim_shop row, and
-- CS/Ecom BI fact shop_key columns are NOT NULL.
--
-- Write semantics: all five use ON DUPLICATE KEY UPDATE.
-- =============================================================================

-- fct_cs_conversation_daily: Per-conversation daily roll-up
-- Grain: one row per (local_date_key, shop_key, conversation_id)
CREATE TABLE IF NOT EXISTS fct_cs_conversation_daily (
    row_id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    local_date_key              DATE         NOT NULL,       -- toDate(ts, 'America/Los_Angeles')
    shop_key                    INT UNSIGNED NOT NULL,       -- FK → dim_shop(shop_key); NOT NULL at conversation grain
    conversation_id             VARCHAR(128) NOT NULL,
    utc_date_key                DATE         NOT NULL,       -- diagnostic: toDate(first_ts, 'UTC')
    user_key                    INT UNSIGNED NOT NULL,
    -- Lifecycle flags for this day
    is_new_today                TINYINT(1)   NOT NULL DEFAULT 0,
    is_first_reply_today        TINYINT(1)   NOT NULL DEFAULT 0,
    reopened_today              TINYINT(1)   NOT NULL DEFAULT 0,
    -- Today's counters
    inbound_msgs_today          INT UNSIGNED NOT NULL DEFAULT 0,
    outbound_msgs_today         INT UNSIGNED NOT NULL DEFAULT 0,
    inbound_bytes_today         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    outbound_bytes_today        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    error_count_today           INT UNSIGNED NOT NULL DEFAULT 0,
    tool_call_count_today       INT UNSIGNED NOT NULL DEFAULT 0,
    escalate_count_today        INT UNSIGNED NOT NULL DEFAULT 0,
    has_escalate_today          TINYINT(1)   NOT NULL DEFAULT 0,
    -- Today's token delta (lagInFrame over cs_token_snapshots)
    input_tokens_delta_today    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens_delta_today   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    -- Cumulative to end of LA local day
    cum_inbound_msgs            INT UNSIGNED NOT NULL DEFAULT 0,
    cum_outbound_msgs           INT UNSIGNED NOT NULL DEFAULT 0,
    cum_input_tokens            BIGINT UNSIGNED NOT NULL DEFAULT 0,
    cum_output_tokens           BIGINT UNSIGNED NOT NULL DEFAULT 0,
    cum_escalate_count          INT UNSIGNED NOT NULL DEFAULT 0,
    cum_has_escalate            TINYINT(1)   NOT NULL DEFAULT 0,
    -- Lifecycle metadata
    first_ts                    DATETIME(3)  DEFAULT NULL,
    last_ts                     DATETIME(3)  DEFAULT NULL,
    age_days                    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    -- Model context (last seen today)
    last_model_key              SMALLINT UNSIGNED DEFAULT NULL,
    last_provider               VARCHAR(32)  DEFAULT NULL,
    -- Populated only on is_first_reply_today = 1
    first_response_secs         INT UNSIGNED DEFAULT NULL,
    -- ETL metadata
    etl_loaded_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (row_id),
    UNIQUE KEY uk_conv_daily (local_date_key, shop_key, conversation_id),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation_local_date (conversation_id, local_date_key),
    KEY idx_model_local_date (last_model_key, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_daily_summary: Per-user-per-shop daily CS summary
-- Grain: one row per (local_date_key, user_key, shop_key)
-- shop_key='__SHOPLESS__' holds tenant-level pre-session errors.
CREATE TABLE IF NOT EXISTS fct_cs_daily_summary (
    row_id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    local_date_key             DATE         NOT NULL,        -- toDate(ts, 'America/Los_Angeles')
    user_key                   INT UNSIGNED NOT NULL,
    shop_key                   INT UNSIGNED NOT NULL,
    -- Conversation-lifecycle counts
    active_conversations       INT UNSIGNED NOT NULL DEFAULT 0,
    new_conversations          INT UNSIGNED NOT NULL DEFAULT 0,
    reopened_conversations     INT UNSIGNED NOT NULL DEFAULT 0,
    escalate_conversations     INT UNSIGNED NOT NULL DEFAULT 0,
    -- Volume
    inbound_msgs               INT UNSIGNED NOT NULL DEFAULT 0,
    outbound_msgs              INT UNSIGNED NOT NULL DEFAULT 0,
    inbound_bytes              BIGINT UNSIGNED NOT NULL DEFAULT 0,
    outbound_bytes             BIGINT UNSIGNED NOT NULL DEFAULT 0,
    -- Error breakdown
    error_count                INT UNSIGNED NOT NULL DEFAULT 0,
    escalate_error_count       INT UNSIGNED NOT NULL DEFAULT 0,
    deliver_error_count        INT UNSIGNED NOT NULL DEFAULT 0,
    run_error_count            INT UNSIGNED NOT NULL DEFAULT 0,
    -- Dispatch / lifecycle headline counters
    dispatch_attempts          INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_requested         INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_accepted          INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_failed            INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_skipped           INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_aborted           INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_created         INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_updated         INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_responded       INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_dismissed       INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_resolved        INT UNSIGNED NOT NULL DEFAULT 0,
    session_manual_reply       INT UNSIGNED NOT NULL DEFAULT 0,
    session_end_session        INT UNSIGNED NOT NULL DEFAULT 0,
    session_summary_generate   INT UNSIGNED NOT NULL DEFAULT 0,
    session_backend_session    INT UNSIGNED NOT NULL DEFAULT 0,
    -- Tokens
    input_tokens               BIGINT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens              BIGINT UNSIGNED NOT NULL DEFAULT 0,
    -- Latency
    avg_first_response_secs    INT UNSIGNED DEFAULT NULL,
    -- ETL metadata
    etl_loaded_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (row_id),
    UNIQUE KEY uk_cs_daily_summary (local_date_key, user_key, shop_key),
    KEY idx_local_date (local_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_hourly_summary: Per-user-per-shop hourly CS summary (LA-local hour)
-- Grain: (local_date_key, hour_of_day_local, user_key, shop_key)
-- Token columns are DELTA (lagInFrame on cs_token_snapshots), NOT cumulative.
CREATE TABLE IF NOT EXISTS fct_cs_hourly_summary (
    row_id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    local_date_key         DATE         NOT NULL,                 -- toDate(ts, 'America/Los_Angeles')
    hour_of_day_local      TINYINT UNSIGNED NOT NULL,             -- 0..23 in America/Los_Angeles
    user_key               INT UNSIGNED NOT NULL,
    shop_key               INT UNSIGNED NOT NULL,
    -- Volume
    inbound_msgs           INT UNSIGNED NOT NULL DEFAULT 0,
    outbound_msgs          INT UNSIGNED NOT NULL DEFAULT 0,
    error_count            INT UNSIGNED NOT NULL DEFAULT 0,
    escalate_count         INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_attempts      INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_requested     INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_accepted      INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_failed        INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_skipped       INT UNSIGNED NOT NULL DEFAULT 0,
    dispatch_aborted       INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_created     INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_updated     INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_responded   INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_dismissed   INT UNSIGNED NOT NULL DEFAULT 0,
    escalation_resolved    INT UNSIGNED NOT NULL DEFAULT 0,
    session_manual_reply   INT UNSIGNED NOT NULL DEFAULT 0,
    session_end_session    INT UNSIGNED NOT NULL DEFAULT 0,
    session_summary_generate INT UNSIGNED NOT NULL DEFAULT 0,
    session_backend_session INT UNSIGNED NOT NULL DEFAULT 0,
    -- Token DELTAS for the hour
    input_tokens_hourly    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens_hourly   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (row_id),
    UNIQUE KEY uk_cs_hourly_summary (local_date_key, hour_of_day_local, user_key, shop_key),
    KEY idx_local_date (local_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_conversation_real_time: 5-minute current-state counters for CS ops
-- Grain: one row per (sampled_at, backend_target, user_key, shop_key).
-- All metric columns are additive, so Grafana can aggregate from shop to user
-- or region level before calculating ratios/averages.
CREATE TABLE IF NOT EXISTS fct_cs_conversation_real_time (
    row_id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sampled_at                DATETIME(0)     NOT NULL,
    backend_target            VARCHAR(32)     NOT NULL DEFAULT 'production',
    user_key                  INT UNSIGNED    NOT NULL,
    shop_key                  INT UNSIGNED    NOT NULL,
    active_num                INT UNSIGNED    NOT NULL DEFAULT 0,
    pending_num               INT UNSIGNED    NOT NULL DEFAULT 0,
    total_pending_age_secs    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    pending_over_5m_num       INT UNSIGNED    NOT NULL DEFAULT 0,
    pending_over_15m_num      INT UNSIGNED    NOT NULL DEFAULT 0,
    pending_over_30m_num      INT UNSIGNED    NOT NULL DEFAULT 0,
    ai_enabled_active_num     INT UNSIGNED    NOT NULL DEFAULT 0,
    open_escalation_active_num INT UNSIGNED   NOT NULL DEFAULT 0,
    etl_loaded_at             TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (row_id),
    UNIQUE KEY uk_cs_conv_rt_sample (sampled_at, backend_target, user_key, shop_key),
    KEY idx_cs_conv_rt_sampled_at (sampled_at),
    KEY idx_cs_conv_rt_backend_sampled_at (backend_target, sampled_at),
    KEY idx_cs_conv_rt_backend_user_sampled_at (backend_target, user_key, sampled_at),
    KEY idx_cs_conv_rt_backend_user_shop_sampled_at (backend_target, user_key, shop_key, sampled_at)
) ENGINE=InnoDB;

-- ops_cs_active_conversation_current: current open CS conversation set.
-- Rebuilt transactionally by bi.cs.conversation_realtime every 5 minutes.
CREATE TABLE IF NOT EXISTS ops_cs_active_conversation_current (
    backend_target                 VARCHAR(32)  NOT NULL DEFAULT 'production',
    shop_id                        VARCHAR(64)  NOT NULL,
    shop_key                       INT UNSIGNED DEFAULT NULL,
    user_id                        VARCHAR(64)  DEFAULT NULL,
    user_key                       INT UNSIGNED DEFAULT NULL,
    conversation_id                VARCHAR(128) NOT NULL,
    status                         VARCHAR(16)  NOT NULL,
    ai_enabled                     TINYINT(1)   NOT NULL DEFAULT 1,
    platform                       VARCHAR(32)  DEFAULT NULL,
    platform_shop_id               VARCHAR(128) DEFAULT NULL,
    platform_conversation_status   VARCHAR(64)  DEFAULT NULL,
    current_session_id             VARCHAR(128) DEFAULT NULL,
    buyer_user_id                  VARCHAR(128) DEFAULT NULL,
    buyer_im_user_id               VARCHAR(128) DEFAULT NULL,
    order_id                       VARCHAR(128) DEFAULT NULL,
    latest_message_at              DATETIME(3)  DEFAULT NULL,
    latest_sender_role             VARCHAR(32)  DEFAULT NULL,
    last_pending_at                DATETIME(3)  DEFAULT NULL,
    pending_age_secs               BIGINT UNSIGNED NOT NULL DEFAULT 0,
    resolved_at                    DATETIME(3)  DEFAULT NULL,
    open_escalation_count          INT UNSIGNED NOT NULL DEFAULT 0,
    latest_open_escalation_id      VARCHAR(64)  DEFAULT NULL,
    latest_open_escalation_status  VARCHAR(32)  DEFAULT NULL,
    latest_open_escalation_updated_at DATETIME(3) DEFAULT NULL,
    updated_at                     DATETIME(3)  DEFAULT NULL,
    etl_loaded_at                  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (backend_target, shop_id, conversation_id),
    KEY idx_ops_cs_active_backend_status_age (backend_target, status, pending_age_secs),
    KEY idx_ops_cs_active_backend_user_shop_status_age (backend_target, user_key, shop_key, status, pending_age_secs),
    KEY idx_ops_cs_active_backend_updated_at (backend_target, updated_at)
) ENGINE=InnoDB;

-- fct_ecom_tool_daily: Per-tool daily usage across ecom and CS scopes
-- Grain: (local_date_key, user_key, shop_key, tool_key, scenario)
-- scenario: 'cs' (conversationId != '') | 'shop_ops' (otherwise).
CREATE TABLE IF NOT EXISTS fct_ecom_tool_daily (
    row_id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    local_date_key         DATE         NOT NULL,                 -- toDate(ts, 'America/Los_Angeles')
    user_key               INT UNSIGNED NOT NULL,
    shop_key               INT UNSIGNED NOT NULL,
    tool_key               SMALLINT UNSIGNED NOT NULL,
    scenario               VARCHAR(16)  NOT NULL,
    -- Measures
    invocations            INT UNSIGNED NOT NULL DEFAULT 0,
    errors                 INT UNSIGNED NOT NULL DEFAULT 0,
    total_duration_ms      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    p50_ms                 INT UNSIGNED DEFAULT NULL,
    p95_ms                 INT UNSIGNED DEFAULT NULL,
    distinct_conversations INT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (row_id),
    UNIQUE KEY uk_ecom_tool_daily (local_date_key, user_key, shop_key, tool_key, scenario),
    KEY idx_local_date (local_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_tool_local_date (tool_key, local_date_key),
    KEY idx_scenario_local_date (scenario, local_date_key)
) ENGINE=InnoDB;

-- fct_llm_cs_usage_daily: Per-user-per-shop-per-model daily CS LLM usage
-- Grain: (local_date_key, user_key, shop_key, model_key)
-- Delta math is derived via lagInFrame over cs_token_snapshots.
-- total_tokens_delta is a physical column (not GENERATED) to match fct_llm_*.
CREATE TABLE IF NOT EXISTS fct_llm_cs_usage_daily (
    row_id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    local_date_key         DATE         NOT NULL,                 -- toDate(ts, 'America/Los_Angeles')
    user_key               INT UNSIGNED NOT NULL,
    shop_key               INT UNSIGNED NOT NULL,
    model_key              SMALLINT UNSIGNED NOT NULL,
    -- Measures
    input_tokens_delta     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens_delta    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens_delta     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    snapshot_count         INT UNSIGNED NOT NULL DEFAULT 0,
    conversations_touched  INT UNSIGNED NOT NULL DEFAULT 0,
    -- ETL metadata
    etl_loaded_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (row_id),
    UNIQUE KEY uk_llm_cs_usage_daily (local_date_key, user_key, shop_key, model_key),
    KEY idx_local_date (local_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_model_local_date (model_key, local_date_key)
) ENGINE=InnoDB;

-- =============================================================================
-- CS / Ecom event-level raw fact tables (migration 006)
--
-- Append-only event logs. INSERT IGNORE against a natural-key UNIQUE on
-- (ts, conversation_id, run_id [+ event-specific discriminator]).
--
-- Single-TZ (LA) design — every event row carries ts (absolute UTC instant),
-- local_date_key (= toDate(ts, 'America/Los_Angeles')), and utc_date_key
-- (= toDate(ts, 'UTC'), diagnostic only, never in uk_event). See
-- server/telemetry/airflow/docs/ADR/ADR-005-single-tz-bi-layer.md.
--
-- No partitioning / no TTL — sparse tables at current scale. Explicitly
-- deferred; do not add retention DDL without a business trigger.
-- =============================================================================

-- fct_cs_escalate_events: one row per cs_escalate tool call
CREATE TABLE IF NOT EXISTS fct_cs_escalate_events (
    event_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts                   DATETIME(3)  NOT NULL,                   -- absolute UTC instant
    local_date_key       DATE         NOT NULL,                   -- toDate(ts, 'America/Los_Angeles')
    utc_date_key         DATE         NOT NULL,                   -- toDate(ts, 'UTC'); diagnostic only
    user_key             INT UNSIGNED NOT NULL,
    shop_key             INT UNSIGNED NOT NULL,
    conversation_id      VARCHAR(128) NOT NULL DEFAULT '',
    run_id               VARCHAR(64)  NOT NULL DEFAULT '',
    success              TINYINT UNSIGNED NOT NULL DEFAULT 1,
    duration_ms          INT UNSIGNED NOT NULL DEFAULT 0,
    error_message        VARCHAR(500) NOT NULL DEFAULT '',
    order_id             VARCHAR(64)  DEFAULT NULL,
    reason_text          TEXT         DEFAULT NULL,
    context_text         TEXT         DEFAULT NULL,
    etl_loaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_event (ts, conversation_id, run_id),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation_local_date (conversation_id, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_respond_events: one row per cs_respond tool call
CREATE TABLE IF NOT EXISTS fct_cs_respond_events (
    event_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts                   DATETIME(3)  NOT NULL,                   -- absolute UTC instant
    local_date_key       DATE         NOT NULL,                   -- toDate(ts, 'America/Los_Angeles')
    utc_date_key         DATE         NOT NULL,                   -- toDate(ts, 'UTC'); diagnostic only
    user_key             INT UNSIGNED NOT NULL,
    shop_key             INT UNSIGNED NOT NULL,
    conversation_id      VARCHAR(128) NOT NULL DEFAULT '',
    run_id               VARCHAR(64)  NOT NULL DEFAULT '',
    success              TINYINT UNSIGNED NOT NULL DEFAULT 1,
    duration_ms          INT UNSIGNED NOT NULL DEFAULT 0,
    error_message        VARCHAR(500) NOT NULL DEFAULT '',
    escalation_id        VARCHAR(64)  DEFAULT NULL,
    decision_text        TEXT         DEFAULT NULL,
    instructions_text    TEXT         DEFAULT NULL,
    resolved             TINYINT UNSIGNED NOT NULL DEFAULT 0,
    etl_loaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_event (ts, conversation_id, run_id, escalation_id),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation_local_date (conversation_id, local_date_key),
    KEY idx_escalation_local_date (escalation_id, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_error_events: one row per CS pipeline-stage failure
-- Source: cs_errors. shop_key='__SHOPLESS__' marks pre-session failures.
CREATE TABLE IF NOT EXISTS fct_cs_error_events (
    event_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts                   DATETIME(3)  NOT NULL,                   -- absolute UTC instant
    local_date_key       DATE         NOT NULL,                   -- toDate(ts, 'America/Los_Angeles')
    utc_date_key         DATE         NOT NULL,                   -- toDate(ts, 'UTC'); diagnostic only
    user_key             INT UNSIGNED NOT NULL,
    shop_key             INT UNSIGNED NOT NULL,
    conversation_id      VARCHAR(128) NOT NULL DEFAULT '',
    run_id               VARCHAR(64)  NOT NULL DEFAULT '',
    success              TINYINT UNSIGNED NOT NULL DEFAULT 0,
    duration_ms          INT UNSIGNED NOT NULL DEFAULT 0,
    error_message        VARCHAR(500) NOT NULL DEFAULT '',
    platform             VARCHAR(16)  NOT NULL DEFAULT '',
    stage                VARCHAR(32)  NOT NULL,
    reason               VARCHAR(32)  NOT NULL DEFAULT '',
    text_length          INT UNSIGNED NOT NULL DEFAULT 0,
    etl_loaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_event (ts, conversation_id, run_id, stage),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation_local_date (conversation_id, local_date_key),
    KEY idx_stage_local_date (stage, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_dispatch_events: one row per CS dispatch control-plane event
CREATE TABLE IF NOT EXISTS fct_cs_dispatch_events (
    event_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts                   DATETIME(3)  NOT NULL,
    local_date_key       DATE         NOT NULL,
    utc_date_key         DATE         NOT NULL,
    user_key             INT UNSIGNED NOT NULL,
    shop_key             INT UNSIGNED NOT NULL,
    conversation_id      VARCHAR(128) NOT NULL DEFAULT '',
    run_id               VARCHAR(64)  NOT NULL DEFAULT '',
    success              TINYINT UNSIGNED NOT NULL DEFAULT 0,
    duration_ms          INT UNSIGNED NOT NULL DEFAULT 0,
    error_message        VARCHAR(500) NOT NULL DEFAULT '',
    platform             VARCHAR(16)  NOT NULL DEFAULT '',
    platform_shop_id     VARCHAR(128) NOT NULL DEFAULT '',
    buyer_user_id        VARCHAR(128) NOT NULL DEFAULT '',
    im_user_id           VARCHAR(128) NOT NULL DEFAULT '',
    order_id             VARCHAR(64)  NOT NULL DEFAULT '',
    signal_type          VARCHAR(64)  NOT NULL DEFAULT '',
    source               VARCHAR(64)  NOT NULL DEFAULT '',
    dispatch_reason      VARCHAR(64)  NOT NULL DEFAULT '',
    outcome              VARCHAR(32)  NOT NULL,
    reason               VARCHAR(64)  NOT NULL DEFAULT '',
    message_id           VARCHAR(128) NOT NULL DEFAULT '',
    message_index        VARCHAR(64)  NOT NULL DEFAULT '',
    message_type         VARCHAR(32)  NOT NULL DEFAULT '',
    sender_role          VARCHAR(32)  NOT NULL DEFAULT '',
    idempotency_key      VARCHAR(255) NOT NULL DEFAULT '',
    prompt_chars         INT UNSIGNED NOT NULL DEFAULT 0,
    message_chars        INT UNSIGNED NOT NULL DEFAULT 0,
    attachment_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    etl_loaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_event (ts, conversation_id, run_id, outcome, idempotency_key),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation_run (conversation_id, run_id),
    KEY idx_outcome_local_date (outcome, local_date_key),
    KEY idx_reason_local_date (reason, local_date_key),
    KEY idx_source_local_date (source, local_date_key),
    KEY idx_dispatch_reason_local_date (dispatch_reason, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_escalation_lifecycle_events: durable/business escalation lifecycle
CREATE TABLE IF NOT EXISTS fct_cs_escalation_lifecycle_events (
    event_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts                   DATETIME(3)  NOT NULL,
    local_date_key       DATE         NOT NULL,
    utc_date_key         DATE         NOT NULL,
    user_key             INT UNSIGNED NOT NULL,
    shop_key             INT UNSIGNED NOT NULL,
    conversation_id      VARCHAR(128) NOT NULL DEFAULT '',
    run_id               VARCHAR(64)  NOT NULL DEFAULT '',
    success              TINYINT UNSIGNED NOT NULL DEFAULT 0,
    duration_ms          INT UNSIGNED NOT NULL DEFAULT 0,
    error_message        VARCHAR(500) NOT NULL DEFAULT '',
    platform             VARCHAR(16)  NOT NULL DEFAULT '',
    platform_shop_id     VARCHAR(128) NOT NULL DEFAULT '',
    buyer_user_id        VARCHAR(128) NOT NULL DEFAULT '',
    order_id             VARCHAR(64)  NOT NULL DEFAULT '',
    escalation_id        VARCHAR(64)  NOT NULL DEFAULT '',
    action               VARCHAR(64)  NOT NULL,
    source               VARCHAR(64)  NOT NULL DEFAULT '',
    outcome              VARCHAR(32)  NOT NULL,
    reason               VARCHAR(64)  NOT NULL DEFAULT '',
    status               VARCHAR(32)  NOT NULL DEFAULT '',
    resolved             TINYINT UNSIGNED NOT NULL DEFAULT 0,
    version              INT UNSIGNED NOT NULL DEFAULT 0,
    count                INT UNSIGNED NOT NULL DEFAULT 0,
    etl_loaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_event (ts, conversation_id, escalation_id, action, outcome),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation (conversation_id),
    KEY idx_escalation (escalation_id),
    KEY idx_action_local_date (action, local_date_key),
    KEY idx_source_local_date (source, local_date_key),
    KEY idx_status_local_date (status, local_date_key)
) ENGINE=InnoDB;

-- fct_cs_session_events: session/manual/admin operation lifecycle
CREATE TABLE IF NOT EXISTS fct_cs_session_events (
    event_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts                   DATETIME(3)  NOT NULL,
    local_date_key       DATE         NOT NULL,
    utc_date_key         DATE         NOT NULL,
    user_key             INT UNSIGNED NOT NULL,
    shop_key             INT UNSIGNED NOT NULL,
    conversation_id      VARCHAR(128) NOT NULL DEFAULT '',
    run_id               VARCHAR(64)  NOT NULL DEFAULT '',
    success              TINYINT UNSIGNED NOT NULL DEFAULT 0,
    duration_ms          INT UNSIGNED NOT NULL DEFAULT 0,
    error_message        VARCHAR(500) NOT NULL DEFAULT '',
    platform             VARCHAR(16)  NOT NULL DEFAULT '',
    platform_shop_id     VARCHAR(128) NOT NULL DEFAULT '',
    buyer_user_id        VARCHAR(128) NOT NULL DEFAULT '',
    order_id             VARCHAR(64)  NOT NULL DEFAULT '',
    action               VARCHAR(64)  NOT NULL,
    source               VARCHAR(64)  NOT NULL DEFAULT '',
    outcome              VARCHAR(32)  NOT NULL,
    reason               VARCHAR(64)  NOT NULL DEFAULT '',
    message_id           VARCHAR(128) NOT NULL DEFAULT '',
    text_length          INT UNSIGNED NOT NULL DEFAULT 0,
    message_count        INT UNSIGNED NOT NULL DEFAULT 0,
    etl_loaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_event (ts, conversation_id, action, outcome, run_id, message_id),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation (conversation_id),
    KEY idx_action_local_date (action, local_date_key),
    KEY idx_source_local_date (source, local_date_key)
) ENGINE=InnoDB;

-- fct_ecom_write_events: one row per mutating ecom tool call
-- Source: ecom_tool_calls WHERE toolName matches dim_tool.tool_category='write'.
CREATE TABLE IF NOT EXISTS fct_ecom_write_events (
    event_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts                   DATETIME(3)  NOT NULL,                   -- absolute UTC instant
    local_date_key       DATE         NOT NULL,                   -- toDate(ts, 'America/Los_Angeles')
    utc_date_key         DATE         NOT NULL,                   -- toDate(ts, 'UTC'); diagnostic only
    user_key             INT UNSIGNED NOT NULL,
    shop_key             INT UNSIGNED NOT NULL,
    conversation_id      VARCHAR(128) NOT NULL DEFAULT '',
    run_id               VARCHAR(64)  NOT NULL DEFAULT '',
    success              TINYINT UNSIGNED NOT NULL DEFAULT 1,
    duration_ms          INT UNSIGNED NOT NULL DEFAULT 0,
    error_message        VARCHAR(500) NOT NULL DEFAULT '',
    tool_key             SMALLINT UNSIGNED NOT NULL,
    return_id            VARCHAR(64)  DEFAULT NULL,
    reject_reason_code   VARCHAR(32)  DEFAULT NULL,
    order_id             VARCHAR(64)  DEFAULT NULL,
    comment_text         TEXT         DEFAULT NULL,
    etl_loaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_event (ts, conversation_id, run_id, tool_key),
    KEY idx_local_date (local_date_key),
    KEY idx_utc_date (utc_date_key),
    KEY idx_user_local_date (user_key, local_date_key),
    KEY idx_shop_local_date (shop_key, local_date_key),
    KEY idx_conversation_local_date (conversation_id, local_date_key),
    KEY idx_tool_local_date (tool_key, local_date_key)
) ENGINE=InnoDB;

-- =============================================================================
-- INVENTORY PHASE 1 — TikTok FBT warehouse facts
-- =============================================================================

CREATE TABLE IF NOT EXISTS dim_warehouse (
    warehouse_key       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_key            INT UNSIGNED    DEFAULT NULL,
    user_id             VARCHAR(64)     DEFAULT NULL,
    source_system       VARCHAR(64)     NOT NULL,
    source_account_id   VARCHAR(128)    NOT NULL,
    source_warehouse_id VARCHAR(128)    NOT NULL,
    warehouse_name      VARCHAR(255)    DEFAULT NULL,
    warehouse_type      VARCHAR(64)     DEFAULT NULL,
    country_code        VARCHAR(16)     DEFAULT NULL,
    state               VARCHAR(128)    DEFAULT NULL,
    city                VARCHAR(128)    DEFAULT NULL,
    is_active           TINYINT(1)      DEFAULT NULL,
    raw_payload         JSON            DEFAULT NULL,
    synced_at           DATETIME        NOT NULL,
    source_deleted_at   DATETIME        DEFAULT NULL,
    PRIMARY KEY (warehouse_key),
    UNIQUE KEY uk_source_warehouse (source_system, source_account_id, source_warehouse_id),
    KEY idx_source_deleted (source_deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dim_shop_warehouse (
    shop_warehouse_key  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_key            INT UNSIGNED    DEFAULT NULL,
    user_id             VARCHAR(64)     DEFAULT NULL,
    source_system       VARCHAR(64)     DEFAULT NULL,
    source_account_id   VARCHAR(128)    DEFAULT NULL,
    source_warehouse_id VARCHAR(128)    DEFAULT NULL,
    warehouse_key       BIGINT UNSIGNED DEFAULT NULL,
    platform            VARCHAR(64)     NOT NULL,
    shop_id             VARCHAR(64)     NOT NULL,
    shop_warehouse_id   VARCHAR(128)    NOT NULL,
    mapping_source      VARCHAR(64)     DEFAULT NULL,
    is_active           TINYINT(1)      DEFAULT NULL,
    raw_payload         JSON            DEFAULT NULL,
    synced_at           DATETIME        NOT NULL,
    source_deleted_at   DATETIME        DEFAULT NULL,
    PRIMARY KEY (shop_warehouse_key),
    UNIQUE KEY uk_shop_warehouse (platform, shop_id, shop_warehouse_id),
    KEY idx_source_warehouse (source_system, source_account_id, source_warehouse_id),
    KEY idx_warehouse_key (warehouse_key),
    KEY idx_source_deleted (source_deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dim_inventory_item (
    inventory_item_key BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_key           INT UNSIGNED    NOT NULL,
    user_id            VARCHAR(64)     NOT NULL,
    source_system      VARCHAR(64)     NOT NULL,
    source_account_id  VARCHAR(128)    NOT NULL,
    source_goods_id    VARCHAR(128)    NOT NULL,
    source_goods_code  VARCHAR(128)    DEFAULT NULL,
    item_name          VARCHAR(512)    DEFAULT NULL,
    barcode            VARCHAR(255)    DEFAULT NULL,
    barcode_type       VARCHAR(64)     DEFAULT NULL,
    raw_payload        JSON            DEFAULT NULL,
    synced_at          DATETIME        NOT NULL,
    source_deleted_at  DATETIME        DEFAULT NULL,
    PRIMARY KEY (inventory_item_key),
    UNIQUE KEY uk_inventory_item_natural
      (source_system, source_account_id, source_goods_id),
    KEY idx_source_deleted (source_deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bridge_inventory_item_sku (
    user_key             INT UNSIGNED NOT NULL,
    user_id              VARCHAR(64)  NOT NULL,
    source_system        VARCHAR(64)  NOT NULL,
    source_account_id    VARCHAR(128) NOT NULL,
    source_goods_id      VARCHAR(128) NOT NULL,
    source_sku_id        VARCHAR(128) NOT NULL,
    inventory_item_key   BIGINT UNSIGNED DEFAULT NULL,
    platform             VARCHAR(64)  DEFAULT NULL,
    shop_id              VARCHAR(64)  DEFAULT NULL,
    platform_product_id  VARCHAR(128) DEFAULT NULL,
    platform_sku_id      VARCHAR(128) DEFAULT NULL,
    platform_sku_name    VARCHAR(512) DEFAULT NULL,
    matched              TINYINT(1)   DEFAULT NULL,
    raw_payload          JSON         DEFAULT NULL,
    synced_at            DATETIME     NOT NULL,
    source_deleted_at    DATETIME     DEFAULT NULL,
    PRIMARY KEY (source_system, source_account_id, source_goods_id, source_sku_id),
    KEY idx_inventory_item (inventory_item_key),
    KEY idx_platform_sku (platform, shop_id, platform_sku_id),
    KEY idx_source_deleted (source_deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dim_inventory_good (
    inventory_good_key      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_key                INT UNSIGNED    DEFAULT NULL,
    user_id                 VARCHAR(64)     NOT NULL,
    inventory_good_id       VARCHAR(64)     NOT NULL,
    sku                     VARCHAR(128)    NOT NULL,
    good_name               VARCHAR(512)    NOT NULL,
    status                  VARCHAR(32)     NOT NULL,
    gtin                    VARCHAR(128)    DEFAULT NULL,
    barcode                 VARCHAR(128)    DEFAULT NULL,
    hs_code                 VARCHAR(64)     DEFAULT NULL,
    country_of_origin       VARCHAR(64)     DEFAULT NULL,
    weight_value            DOUBLE          DEFAULT NULL,
    weight_unit             VARCHAR(16)     DEFAULT NULL,
    length_value            DOUBLE          DEFAULT NULL,
    width_value             DOUBLE          DEFAULT NULL,
    height_value            DOUBLE          DEFAULT NULL,
    dimension_unit          VARCHAR(16)     DEFAULT NULL,
    declared_value          DOUBLE          DEFAULT NULL,
    declared_value_currency VARCHAR(16)     DEFAULT NULL,
    is_battery              TINYINT(1)      DEFAULT NULL,
    is_hazmat               TINYINT(1)      DEFAULT NULL,
    image_uri               VARCHAR(1024)   DEFAULT NULL,
    raw_payload             JSON            DEFAULT NULL,
    synced_at               DATETIME        NOT NULL,
    source_deleted_at       DATETIME        DEFAULT NULL,
    PRIMARY KEY (inventory_good_key),
    UNIQUE KEY uk_inventory_good_mongo_id (inventory_good_id),
    UNIQUE KEY uk_inventory_good_user_sku (user_id, sku),
    KEY idx_inventory_good_user_status (user_id, status, synced_at),
    KEY idx_source_deleted (source_deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dim_inventory_good_mapping (
    inventory_good_mapping_key BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_key                   INT UNSIGNED    DEFAULT NULL,
    user_id                    VARCHAR(64)     NOT NULL,
    inventory_good_mapping_id  VARCHAR(64)     NOT NULL,
    inventory_good_id          VARCHAR(64)     NOT NULL,
    inventory_good_key         BIGINT UNSIGNED DEFAULT NULL,
    source_system              VARCHAR(64)     NOT NULL,
    source_id                  VARCHAR(128)    NOT NULL,
    seller_sku                 VARCHAR(255)    NOT NULL,
    status                     VARCHAR(32)     NOT NULL,
    verification_status        VARCHAR(32)     NOT NULL,
    notes                      VARCHAR(1024)   DEFAULT NULL,
    last_seen_at               DATETIME        DEFAULT NULL,
    raw_payload                JSON            DEFAULT NULL,
    synced_at                  DATETIME        NOT NULL,
    source_deleted_at          DATETIME        DEFAULT NULL,
    PRIMARY KEY (inventory_good_mapping_key),
    UNIQUE KEY uk_inventory_good_mapping_mongo_id (inventory_good_mapping_id),
    UNIQUE KEY uk_inventory_good_mapping_natural (user_id, source_system, source_id, seller_sku),
    KEY idx_inventory_good_mapping_good (inventory_good_key),
    KEY idx_inventory_good_mapping_source (source_system, source_id, seller_sku),
    KEY idx_source_deleted (source_deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fct_inbound_order (
    inbound_order_key       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_key                INT UNSIGNED    DEFAULT NULL,
    user_id                 VARCHAR(64)     DEFAULT NULL,
    source_system           VARCHAR(64)     NOT NULL,
    source_account_id       VARCHAR(128)    NOT NULL,
    source_inbound_order_id VARCHAR(128)    NOT NULL,
    shop_key                INT UNSIGNED    DEFAULT NULL,
    shop_id                 VARCHAR(64)     DEFAULT NULL,
    warehouse_key           BIGINT UNSIGNED DEFAULT NULL,
    source_warehouse_id     VARCHAR(128)    DEFAULT NULL,
    status                  VARCHAR(128)    DEFAULT NULL,
    order_plan_id           VARCHAR(128)    DEFAULT NULL,
    created_at              DATETIME        DEFAULT NULL,
    shipped_at              DATETIME        DEFAULT NULL,
    expected_arrival_at     DATETIME        DEFAULT NULL,
    actual_arrival_at       DATETIME        DEFAULT NULL,
    raw_payload             JSON            DEFAULT NULL,
    ingested_at             DATETIME        NOT NULL,
    PRIMARY KEY (inbound_order_key),
    UNIQUE KEY uk_inbound_order_natural
      (source_system, source_account_id, source_inbound_order_id),
    KEY idx_created (created_at),
    KEY idx_shop_created (shop_key, created_at),
    KEY idx_source_warehouse_created
      (source_system, source_account_id, source_warehouse_id, created_at),
    KEY idx_status_created (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fct_inbound_order_line (
    inbound_order_line_key       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    source_line_id               VARCHAR(255)    NOT NULL,
    inbound_order_key            BIGINT UNSIGNED NOT NULL,
    user_key                     INT UNSIGNED    DEFAULT NULL,
    user_id                      VARCHAR(64)     DEFAULT NULL,
    source_system                VARCHAR(64)     NOT NULL,
    source_account_id            VARCHAR(128)    NOT NULL,
    source_inbound_order_id      VARCHAR(128)    NOT NULL,
    inventory_item_key           BIGINT UNSIGNED DEFAULT NULL,
    source_goods_id              VARCHAR(128)    NOT NULL,
    source_sku_id                VARCHAR(128)    DEFAULT NULL,
    lot_code                     VARCHAR(128)    DEFAULT NULL,
    expiration_at                DATETIME        DEFAULT NULL,
    planned_quantity             INT             DEFAULT NULL,
    normal_received_quantity     INT             DEFAULT NULL,
    defective_received_quantity  INT             DEFAULT NULL,
    total_received_quantity      INT             DEFAULT NULL,
    raw_payload                  JSON            DEFAULT NULL,
    ingested_at                  DATETIME        NOT NULL,
    PRIMARY KEY (inbound_order_line_key),
    UNIQUE KEY uk_inbound_order_line_natural
      (source_system, source_account_id, source_inbound_order_id, source_line_id),
    KEY idx_inbound_order (inbound_order_key),
    KEY idx_inventory_item (inventory_item_key),
    KEY idx_source_goods (source_system, source_account_id, source_goods_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fct_inventory_movement (
    movement_key          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_key              INT UNSIGNED    DEFAULT NULL,
    user_id               VARCHAR(64)     DEFAULT NULL,
    source_system         VARCHAR(64)     NOT NULL,
    source_account_id     VARCHAR(128)    NOT NULL,
    source_event_id       VARCHAR(255)    NOT NULL,
    shop_key              INT UNSIGNED    DEFAULT NULL,
    shop_id               VARCHAR(64)     DEFAULT NULL,
    warehouse_key         BIGINT UNSIGNED DEFAULT NULL,
    source_warehouse_id   VARCHAR(128)    NOT NULL,
    inventory_item_key    BIGINT UNSIGNED DEFAULT NULL,
    source_goods_id       VARCHAR(128)    NOT NULL,
    source_sku_id         VARCHAR(128)    DEFAULT NULL,
    platform_product_id   VARCHAR(128)    DEFAULT NULL,
    platform_sku_id       VARCHAR(128)    DEFAULT NULL,
    movement_type         VARCHAR(64)     DEFAULT NULL,
    source_order_id       VARCHAR(128)    DEFAULT NULL,
    source_order_type     VARCHAR(128)    DEFAULT NULL,
    inventory_goods_type  VARCHAR(64)     DEFAULT NULL,
    occurred_at           DATETIME        NOT NULL,
    quantity_before       INT             DEFAULT NULL,
    quantity_delta        INT             NOT NULL,
    quantity_after        INT             DEFAULT NULL,
    raw_payload           JSON            DEFAULT NULL,
    ingested_at           DATETIME        NOT NULL,
    PRIMARY KEY (movement_key),
    UNIQUE KEY uk_inventory_movement_natural
      (source_system, source_account_id, source_event_id),
    KEY idx_occurred_at (occurred_at),
    KEY idx_shop_occurred (shop_key, occurred_at),
    KEY idx_warehouse_occurred (warehouse_key, occurred_at),
    KEY idx_source_warehouse_occurred
      (source_system, source_account_id, source_warehouse_id, occurred_at),
    KEY idx_goods_occurred
      (source_system, source_account_id, source_goods_id, occurred_at),
    KEY idx_inventory_item_occurred (inventory_item_key, occurred_at),
    KEY idx_source_order (source_order_type, source_order_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ecommerce_etl_watermark (
    source_system                VARCHAR(64)     NOT NULL,
    source_account_id            VARCHAR(128)    NOT NULL,
    dataset                      VARCHAR(64)     NOT NULL,
    shop_key                     INT UNSIGNED    DEFAULT NULL,
    shop_id                      VARCHAR(64)     DEFAULT NULL,
    last_scanned_until_at        DATETIME        DEFAULT NULL,
    updated_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, source_account_id, dataset),
    KEY idx_shop_dataset (shop_key, dataset),
    KEY idx_dataset_scanned (dataset, last_scanned_until_at)
) ENGINE=InnoDB;

-- =============================================================================
-- Grant access to airflow user
-- =============================================================================
GRANT ALL PRIVILEGES ON easyclaw_analytics.* TO 'airflow'@'%';
FLUSH PRIVILEGES;
