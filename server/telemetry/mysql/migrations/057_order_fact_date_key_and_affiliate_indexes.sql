-- Migration 057 — Order fact business dates and affiliate lookup indexes
--
-- Keep order header and line facts aligned on the same business-date
-- convention used by the order daily summary facts:
-- DATE(COALESCE(paid_time, create_time)).

USE easyclaw_analytics;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER //
CREATE PROCEDURE add_column_if_missing(
  IN table_name_value VARCHAR(64),
  IN column_name_value VARCHAR(64),
  IN column_ddl_value VARCHAR(512)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND COLUMN_NAME = column_name_value
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE ', table_name_value, ' ADD COLUMN ', column_ddl_value);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS add_index_if_missing;
DELIMITER //
CREATE PROCEDURE add_index_if_missing(
  IN table_name_value VARCHAR(64),
  IN index_name_value VARCHAR(64),
  IN columns_value VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND INDEX_NAME = index_name_value
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE ', table_name_value, ' ADD KEY ', index_name_value, ' ', columns_value);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL add_column_if_missing(
  'fct_order',
  'date_key',
  'date_key DATE GENERATED ALWAYS AS (DATE(COALESCE(paid_time, create_time))) STORED AFTER paid_time'
);
CALL add_index_if_missing('fct_order', 'idx_date', '(date_key)');
CALL add_index_if_missing('fct_order', 'idx_shop_date', '(shop_key, date_key)');
CALL add_index_if_missing('fct_order', 'idx_status_date', '(status, date_key)');
CALL add_index_if_missing('fct_order', 'idx_buyer_date', '(buyer_user_id, date_key)');
CALL add_index_if_missing('fct_order', 'idx_user_date', '(user_id, date_key)');
CALL add_index_if_missing('fct_order', 'idx_etl_loaded_at', '(etl_loaded_at)');

CALL add_column_if_missing(
  'fct_order_line',
  'date_key',
  'date_key DATE GENERATED ALWAYS AS (DATE(COALESCE(order_paid_time, order_create_time))) STORED AFTER order_paid_time'
);
CALL add_index_if_missing('fct_order_line', 'idx_date', '(date_key)');
CALL add_index_if_missing('fct_order_line', 'idx_shop_date', '(shop_key, date_key)');
CALL add_index_if_missing('fct_order_line', 'idx_shop_product_date', '(shop_key, product_id, date_key)');
CALL add_index_if_missing('fct_order_line', 'idx_shop_sku_date', '(shop_key, sku_id, date_key)');
CALL add_index_if_missing('fct_order_line', 'idx_user_date', '(user_id, date_key)');
CALL add_index_if_missing('fct_order_line', 'idx_etl_loaded_at', '(etl_loaded_at)');

CALL add_index_if_missing(
  'fct_affiliate_sample_collaboration',
  'idx_affiliate_sample_collaboration_source_shop_product',
  '(source_system, shop_id, product_id)'
);
CALL add_index_if_missing(
  'fct_affiliate_sample_collaboration',
  'idx_affiliate_sample_collaboration_source_shop_sku',
  '(source_system, shop_id, sku_id)'
);

CALL add_index_if_missing(
  'mart_affiliate_collaboration_training_examples',
  'idx_affiliate_training_feature_version',
  '(feature_version)'
);
CALL add_index_if_missing(
  'mart_affiliate_collaboration_training_examples',
  'idx_affiliate_training_user_feature_sample',
  '(user_id, feature_version, sample_collaboration_key)'
);

DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_column_if_missing;
