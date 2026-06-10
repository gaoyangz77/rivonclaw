"""Order-derived ecommerce daily summaries.

This module stays separate from ecommerce.platform.orders_sync because it is a
local warehouse aggregation, not a backend-mediated platform fetch.
"""
from __future__ import annotations

import datetime as dt
import os
from typing import Any

import pandas as pd

from utils.bi_frames import upsert_dataframe
from utils.mysql_client import get_connection


ORDER_SUMMARY_AFFECTED_LOOKBACK_HOURS = max(1, int(os.getenv('ORDER_SUMMARY_AFFECTED_LOOKBACK_HOURS', '48')))
ORDER_SUMMARY_RECENT_REBUILD_DAYS = max(0, int(os.getenv('ORDER_SUMMARY_RECENT_REBUILD_DAYS', '3')))


def _load_order_summary_dates(conn) -> list[dt.date]:
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM fct_order_sku_daily')
        should_full_rebuild = int(cur.fetchone()[0]) == 0

    if should_full_rebuild:
        sql = """
            SELECT DISTINCT date_key
            FROM fct_order_line
            WHERE date_key IS NOT NULL
            ORDER BY date_key
        """
        params: tuple[Any, ...] = ()
    else:
        selects = [
            """
            SELECT DISTINCT date_key
            FROM fct_order_line
            WHERE date_key IS NOT NULL
              AND etl_loaded_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL %s HOUR)
            """
        ]
        params_list: list[Any] = [ORDER_SUMMARY_AFFECTED_LOOKBACK_HOURS]
        if ORDER_SUMMARY_RECENT_REBUILD_DAYS > 0:
            selects.append(
                """
                SELECT DISTINCT date_key
                FROM fct_order_line
                WHERE date_key >= DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL %s DAY))
                """
            )
            params_list.append(ORDER_SUMMARY_RECENT_REBUILD_DAYS)
        sql = f"""
            SELECT DISTINCT date_key
            FROM (
              {' UNION ALL '.join(selects)}
            ) affected
            ORDER BY date_key
        """
        params = tuple(params_list)

    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [row[0] for row in cur.fetchall() if row[0] is not None]


def _load_order_lines_for_dates(conn, dates: list[dt.date]) -> pd.DataFrame:
    if not dates:
        return pd.DataFrame()

    placeholders = ','.join(['%s'] * len(dates))
    sql = f"""
        SELECT
          date_key,
          shop_key,
          user_id,
          shop_id,
          order_id,
          product_id,
          product_name,
          sku_id,
          sku_name,
          seller_sku,
          display_status,
          order_status,
          quantity,
          sale_price,
          line_sale_amount,
          currency
        FROM fct_order_line
        WHERE date_key IN ({placeholders})
    """
    with conn.cursor() as cur:
        cur.execute(sql, dates)
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
    return pd.DataFrame(rows, columns=columns)


def _prepare_order_summary_source(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    out = df.copy()
    out['date_key'] = pd.to_datetime(out['date_key']).dt.date
    out['quantity'] = pd.to_numeric(out['quantity'], errors='coerce').fillna(1).astype('int64')
    out['line_sale_amount'] = pd.to_numeric(out['line_sale_amount'], errors='coerce')

    status_text = (
        out['order_status'].fillna('').astype(str).str.upper()
        + '|'
        + out['display_status'].fillna('').astype(str).str.upper()
    )
    out['is_cancelled'] = status_text.str.contains('CANCEL', regex=False)
    out['is_completed'] = status_text.str.contains('COMPLETED', regex=False)
    out['is_effective'] = ~out['is_cancelled']

    out['gross_units_value'] = out['quantity']
    out['cancelled_units_value'] = out['quantity'].where(out['is_cancelled'], 0)
    out['effective_units_value'] = out['quantity'].where(out['is_effective'], 0)
    out['completed_units_value'] = out['quantity'].where(out['is_completed'], 0)
    out['cancelled_amount_value'] = out['line_sale_amount'].where(out['is_cancelled'])
    out['effective_amount_value'] = out['line_sale_amount'].where(out['is_effective'])
    out['completed_amount_value'] = out['line_sale_amount'].where(out['is_completed'])
    out['cancelled_order_id'] = out['order_id'].where(out['is_cancelled'])
    out['effective_order_id'] = out['order_id'].where(out['is_effective'])
    out['completed_order_id'] = out['order_id'].where(out['is_completed'])
    return out


def _aggregate_order_summary(
    df: pd.DataFrame,
    grain_cols: list[str],
    attr_cols: list[str],
) -> pd.DataFrame:
    if df.empty:
        return df

    agg_spec: dict[str, Any] = {
        **{attr: (attr, 'first') for attr in attr_cols},
        'gross_order_count': ('order_id', 'nunique'),
        'gross_units': ('gross_units_value', 'sum'),
        'gross_gmv': ('line_sale_amount', 'sum'),
        'cancelled_order_count': ('cancelled_order_id', 'nunique'),
        'cancelled_units': ('cancelled_units_value', 'sum'),
        'cancelled_gmv': ('cancelled_amount_value', 'sum'),
        'effective_order_count': ('effective_order_id', 'nunique'),
        'effective_units': ('effective_units_value', 'sum'),
        'effective_gmv': ('effective_amount_value', 'sum'),
        'completed_order_count': ('completed_order_id', 'nunique'),
        'completed_units': ('completed_units_value', 'sum'),
        'completed_gmv': ('completed_amount_value', 'sum'),
    }
    return df.groupby(grain_cols, dropna=False, as_index=False).agg(**agg_spec)


def _summary_table_columns(grain_cols: list[str], attr_cols: list[str]) -> list[str]:
    return [
        *grain_cols,
        *attr_cols,
        'gross_order_count',
        'gross_units',
        'gross_gmv',
        'cancelled_order_count',
        'cancelled_units',
        'cancelled_gmv',
        'effective_order_count',
        'effective_units',
        'effective_gmv',
        'completed_order_count',
        'completed_units',
        'completed_gmv',
    ]


def _write_order_summary(
    conn,
    table: str,
    df: pd.DataFrame,
    dates: list[dt.date],
    columns: list[str],
    key_cols: set[str],
) -> int:
    placeholders = ','.join(['%s'] * len(dates))
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {table} WHERE date_key IN ({placeholders})", dates)

    if df.empty:
        return 0

    out = df[columns].copy()
    update_cols = [col for col in columns if col not in key_cols]
    return upsert_dataframe(conn, out, table, update_cols=update_cols)


def compute_order_daily_summaries(**_context) -> dict[str, int]:
    with get_connection() as conn:
        dates = _load_order_summary_dates(conn)
        if not dates:
            print("ecommerce.platform.order_daily_summaries: no affected dates")
            return {'dates': 0, 'shop_rows': 0, 'product_rows': 0, 'sku_rows': 0}

        source = _prepare_order_summary_source(_load_order_lines_for_dates(conn, dates))
        if source.empty:
            print(f"ecommerce.platform.order_daily_summaries: no line rows for dates={len(dates)}")
            return {'dates': len(dates), 'shop_rows': 0, 'product_rows': 0, 'sku_rows': 0}

        shop_attrs = ['user_id', 'shop_id', 'currency']
        product_attrs = ['user_id', 'shop_id', 'product_name', 'currency']
        sku_attrs = ['user_id', 'shop_id', 'product_id', 'product_name', 'sku_name', 'seller_sku', 'currency']

        shop_summary = _aggregate_order_summary(source, ['date_key', 'shop_key'], shop_attrs)
        product_source = source[source['product_id'].notna() & (source['product_id'].astype(str) != '')]
        product_summary = _aggregate_order_summary(product_source, ['date_key', 'shop_key', 'product_id'], product_attrs)
        sku_source = source[source['sku_id'].notna() & (source['sku_id'].astype(str) != '')]
        sku_summary = _aggregate_order_summary(sku_source, ['date_key', 'shop_key', 'sku_id'], sku_attrs)

        shop_rows = _write_order_summary(
            conn,
            'fct_order_shop_daily',
            shop_summary,
            dates,
            _summary_table_columns(['date_key', 'shop_key'], shop_attrs),
            {'date_key', 'shop_key'},
        )
        product_rows = _write_order_summary(
            conn,
            'fct_order_product_daily',
            product_summary,
            dates,
            _summary_table_columns(['date_key', 'shop_key', 'product_id'], product_attrs),
            {'date_key', 'shop_key', 'product_id'},
        )
        sku_rows = _write_order_summary(
            conn,
            'fct_order_sku_daily',
            sku_summary,
            dates,
            _summary_table_columns(['date_key', 'shop_key', 'sku_id'], sku_attrs),
            {'date_key', 'shop_key', 'sku_id'},
        )

    print(
        f"ecommerce.platform.order_daily_summaries: dates={len(dates)} "
        f"shop_rows={len(shop_summary)} product_rows={len(product_summary)} "
        f"sku_rows={len(sku_summary)}"
    )
    return {
        'dates': len(dates),
        'shop_rows': shop_rows,
        'product_rows': product_rows,
        'sku_rows': sku_rows,
    }
