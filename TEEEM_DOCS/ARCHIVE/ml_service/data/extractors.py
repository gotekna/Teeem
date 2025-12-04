"""
Data extraction from Rails PostgreSQL database
"""
import psycopg2
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import Optional, Dict, List

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
DATABASE_URL = config.DATABASE_URL
LOOKBACK_DAYS = config.LOOKBACK_DAYS

logger = logging.getLogger(__name__)


class DatabaseExtractor:
    """Extract data from Rails database for ML processing"""

    def __init__(self, database_url: str = DATABASE_URL):
        self.database_url = database_url
        self.conn = None

    def connect(self):
        """Establish database connection"""
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(self.database_url)
            logger.info("Database connection established")
        return self.conn

    def close(self):
        """Close database connection"""
        if self.conn and not self.conn.closed:
            self.conn.close()
            logger.info("Database connection closed")

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def extract_purchase_order_line_items(self,
                                          days_back: int = LOOKBACK_DAYS) -> pd.DataFrame:
        """
        Extract purchase order line items for price analysis

        Returns DataFrame with columns:
        - id, purchase_order_id, pricebook_item_id
        - description, quantity, unit_price, total_amount
        - supplier_id (from PO), created_at
        """
        query = """
        SELECT
            poli.id,
            poli.purchase_order_id,
            poli.pricebook_item_id,
            poli.description,
            poli.quantity,
            poli.unit_price,
            poli.total_amount,
            poli.created_at,
            po.supplier_id,
            po.construction_id,
            s.name as supplier_name,
            pb.item_code,
            pb.item_name,
            pb.category
        FROM purchase_order_line_items poli
        INNER JOIN purchase_orders po ON poli.purchase_order_id = po.id
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN pricebook_items pb ON poli.pricebook_item_id = pb.id
        WHERE poli.created_at >= NOW() - INTERVAL '%s days'
        ORDER BY poli.created_at DESC
        """

        logger.info(f"Extracting PO line items from last {days_back} days")
        df = pd.read_sql_query(query, self.connect(), params=(days_back,))
        logger.info(f"Extracted {len(df)} purchase order line items")
        return df

    def extract_constructions(self, days_back: int = LOOKBACK_DAYS) -> pd.DataFrame:
        """
        Extract construction/job data for profitability prediction

        Returns DataFrame with:
        - id, title, contract_value, live_profit, profit_percentage
        - stage, status, start_date, created_at
        """
        query = """
        SELECT
            c.id,
            c.title,
            c.contract_value,
            c.live_profit,
            c.profit_percentage,
            c.stage,
            c.status,
            c.start_date,
            c.created_at,
            COUNT(DISTINCT po.id) as purchase_orders_count,
            COALESCE(SUM(po.total), 0) as total_po_value
        FROM constructions c
        LEFT JOIN purchase_orders po ON c.id = po.construction_id
        WHERE c.created_at >= NOW() - INTERVAL '%s days'
        GROUP BY c.id
        ORDER BY c.created_at DESC
        """

        logger.info(f"Extracting constructions from last {days_back} days")
        df = pd.read_sql_query(query, self.connect(), params=(days_back,))
        logger.info(f"Extracted {len(df)} constructions")
        return df

    def extract_suppliers(self) -> pd.DataFrame:
        """
        Extract supplier data for performance tracking

        Returns DataFrame with:
        - id, name, rating, response_rate, avg_response_time
        - is_active, created_at
        """
        query = """
        SELECT
            s.id,
            s.name,
            s.rating,
            s.response_rate,
            s.avg_response_time,
            s.is_active,
            s.created_at,
            COUNT(DISTINCT po.id) as total_purchase_orders,
            COALESCE(SUM(po.total), 0) as total_po_value,
            COALESCE(AVG(po.total), 0) as avg_po_value
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id
        GROUP BY s.id
        ORDER BY total_purchase_orders DESC
        """

        logger.info("Extracting suppliers")
        df = pd.read_sql_query(query, self.connect())
        logger.info(f"Extracted {len(df)} suppliers")
        return df

    def extract_pricebook_items(self) -> pd.DataFrame:
        """
        Extract pricebook items for price trend analysis

        Returns DataFrame with:
        - id, item_code, item_name, category, current_price
        - supplier_id, is_active, price_last_updated_at
        """
        query = """
        SELECT
            id,
            item_code,
            item_name,
            category,
            current_price,
            supplier_id,
            is_active,
            price_last_updated_at,
            created_at
        FROM pricebook_items
        WHERE is_active = TRUE
        ORDER BY category, item_name
        """

        logger.info("Extracting pricebook items")
        df = pd.read_sql_query(query, self.connect())
        logger.info(f"Extracted {len(df)} pricebook items")
        return df

    def extract_price_history(self, days_back: int = LOOKBACK_DAYS) -> pd.DataFrame:
        """
        Extract price history for trend analysis

        Returns DataFrame with:
        - pricebook_item_id, old_price, new_price
        - supplier_id, created_at, change_reason
        """
        query = """
        SELECT
            ph.id,
            ph.pricebook_item_id,
            ph.old_price,
            ph.new_price,
            ph.supplier_id,
            ph.created_at,
            ph.change_reason,
            ph.date_effective,
            pb.item_code,
            pb.item_name,
            pb.category
        FROM price_histories ph
        INNER JOIN pricebook_items pb ON ph.pricebook_item_id = pb.id
        WHERE ph.created_at >= NOW() - INTERVAL '%s days'
        ORDER BY ph.created_at DESC
        """

        logger.info(f"Extracting price history from last {days_back} days")
        df = pd.read_sql_query(query, self.connect(), params=(days_back,))
        logger.info(f"Extracted {len(df)} price history records")
        return df

    def get_item_purchase_history(self, item_code: str = None,
                                   pricebook_item_id: int = None) -> pd.DataFrame:
        """
        Get complete purchase history for a specific item
        Used for price anomaly detection
        """
        if not item_code and not pricebook_item_id:
            raise ValueError("Must provide either item_code or pricebook_item_id")

        where_clause = "pb.item_code = %s" if item_code else "poli.pricebook_item_id = %s"
        param = item_code if item_code else pricebook_item_id

        query = f"""
        SELECT
            poli.id,
            poli.unit_price,
            poli.quantity,
            poli.created_at,
            po.supplier_id,
            s.name as supplier_name,
            pb.item_code,
            pb.item_name
        FROM purchase_order_line_items poli
        INNER JOIN purchase_orders po ON poli.purchase_order_id = po.id
        INNER JOIN pricebook_items pb ON poli.pricebook_item_id = pb.id
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE {where_clause}
        ORDER BY poli.created_at DESC
        """

        df = pd.read_sql_query(query, self.connect(), params=(param,))
        return df


def extract_all_data() -> Dict[str, pd.DataFrame]:
    """
    Extract all data needed for ML training
    Returns dictionary of DataFrames
    """
    logger.info("Starting full data extraction")

    with DatabaseExtractor() as extractor:
        data = {
            'po_line_items': extractor.extract_purchase_order_line_items(),
            'constructions': extractor.extract_constructions(),
            'suppliers': extractor.extract_suppliers(),
            'pricebook_items': extractor.extract_pricebook_items(),
            'price_history': extractor.extract_price_history()
        }

    logger.info("Data extraction complete")
    return data


if __name__ == '__main__':
    # Test extraction
    logging.basicConfig(level=logging.INFO)
    data = extract_all_data()

    print("\n=== Data Extraction Summary ===")
    for name, df in data.items():
        print(f"{name}: {len(df)} records")
        if len(df) > 0:
            print(f"  Columns: {list(df.columns)}")
            print()
