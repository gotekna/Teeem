"""
Feature Store for ML Models

Stores processed features in the database for efficient model training and inference.
"""
import psycopg2
import pandas as pd
import logging
from datetime import datetime
from typing import Dict, List, Optional

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
DATABASE_URL = config.DATABASE_URL
FEATURES_TABLE = config.FEATURES_TABLE
PREDICTIONS_TABLE = config.PREDICTIONS_TABLE
import numpy as np
import json

logger = logging.getLogger(__name__)

def clean_nan_for_json(obj):
    """Replace NaN values with None for JSON serialization"""
    if isinstance(obj, dict):
        return {k: clean_nan_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_for_json(v) for v in obj]
    elif isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    else:
        return obj


class FeatureStore:
    """Manage ML features and predictions in PostgreSQL"""

    def __init__(self, database_url: str = DATABASE_URL):
        self.database_url = database_url
        self.conn = None

    def connect(self):
        """Establish database connection"""
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(self.database_url)
        return self.conn

    def close(self):
        """Close database connection"""
        if self.conn and not self.conn.closed:
            self.conn.close()

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def create_tables(self):
        """
        Create feature store tables if they don't exist
        Run this once during setup
        """
        create_features_table = f"""
        CREATE TABLE IF NOT EXISTS {FEATURES_TABLE} (
            id SERIAL PRIMARY KEY,
            feature_type VARCHAR(50) NOT NULL,
            entity_id INTEGER NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            features JSONB NOT NULL,
            computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_features_entity
            ON {FEATURES_TABLE}(entity_type, entity_id);

        CREATE INDEX IF NOT EXISTS idx_features_type
            ON {FEATURES_TABLE}(feature_type);

        CREATE INDEX IF NOT EXISTS idx_features_computed_at
            ON {FEATURES_TABLE}(computed_at);
        """

        create_predictions_table = f"""
        CREATE TABLE IF NOT EXISTS {PREDICTIONS_TABLE} (
            id SERIAL PRIMARY KEY,
            model_name VARCHAR(100) NOT NULL,
            model_version VARCHAR(50) NOT NULL,
            entity_id INTEGER NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            prediction_value JSONB NOT NULL,
            confidence_score FLOAT,
            predicted_at TIMESTAMP NOT NULL DEFAULT NOW(),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_predictions_entity
            ON {PREDICTIONS_TABLE}(entity_type, entity_id);

        CREATE INDEX IF NOT EXISTS idx_predictions_model
            ON {PREDICTIONS_TABLE}(model_name, model_version);

        CREATE INDEX IF NOT EXISTS idx_predictions_predicted_at
            ON {PREDICTIONS_TABLE}(predicted_at);
        """

        conn = self.connect()
        cur = conn.cursor()
        try:
            cur.execute(create_features_table)
            cur.execute(create_predictions_table)
            conn.commit()
            logger.info("Feature store tables created successfully")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating feature store tables: {e}")
            raise
        finally:
            cur.close()

    def store_features(self, feature_type: str, entity_id: int,
                      entity_type: str, features: Dict):
        """
        Store computed features for an entity

        Args:
            feature_type: Type of features (e.g., 'price_features', 'job_features')
            entity_id: ID of the entity (e.g., pricebook_item_id, construction_id)
            entity_type: Type of entity (e.g., 'pricebook_item', 'construction')
            features: Dictionary of computed features
        """
        import json

        query = f"""
        INSERT INTO {FEATURES_TABLE}
        (feature_type, entity_id, entity_type, features, computed_at)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        """

        conn = self.connect()
        cur = conn.cursor()
        try:
            cur.execute(query, (
                feature_type,
                entity_id,
                entity_type,
                json.dumps(clean_nan_for_json(features)),
                datetime.now()
            ))
            conn.commit()
            logger.debug(f"Stored features for {entity_type} {entity_id}")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing features: {e}")
            raise
        finally:
            cur.close()

    def get_features(self, entity_type: str, entity_id: int,
                    feature_type: Optional[str] = None) -> pd.DataFrame:
        """
        Retrieve features for an entity
        """
        where_clause = "entity_type = %s AND entity_id = %s"
        params = [entity_type, entity_id]

        if feature_type:
            where_clause += " AND feature_type = %s"
            params.append(feature_type)

        query = f"""
        SELECT * FROM {FEATURES_TABLE}
        WHERE {where_clause}
        ORDER BY computed_at DESC
        """

        df = pd.read_sql_query(query, self.connect(), params=params)
        return df

    def store_prediction(self, model_name: str, model_version: str,
                        entity_id: int, entity_type: str,
                        prediction_value: Dict, confidence_score: float = None):
        """
        Store model prediction
        """
        import json

        query = f"""
        INSERT INTO {PREDICTIONS_TABLE}
        (model_name, model_version, entity_id, entity_type, prediction_value, confidence_score, predicted_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        conn = self.connect()
        cur = conn.cursor()
        try:
            cur.execute(query, (
                model_name,
                model_version,
                entity_id,
                entity_type,
                json.dumps(prediction_value),
                confidence_score,
                datetime.now()
            ))
            conn.commit()
            logger.debug(f"Stored prediction for {entity_type} {entity_id}")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing prediction: {e}")
            raise
        finally:
            cur.close()

    def get_predictions(self, model_name: str, entity_type: Optional[str] = None,
                       days_back: int = 30) -> pd.DataFrame:
        """
        Retrieve recent predictions from a model
        """
        where_clause = "model_name = %s AND predicted_at >= NOW() - INTERVAL '%s days'"
        params = [model_name, days_back]

        if entity_type:
            where_clause += " AND entity_type = %s"
            params.append(entity_type)

        query = f"""
        SELECT * FROM {PREDICTIONS_TABLE}
        WHERE {where_clause}
        ORDER BY predicted_at DESC
        """

        df = pd.read_sql_query(query, self.connect(), params=params)
        return df


def compute_price_features(po_line_items_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute price-related features from purchase order line items

    Features:
    - mean_price: Average unit price per item
    - std_price: Price standard deviation
    - min_price: Minimum observed price
    - max_price: Maximum observed price
    - price_range: max - min
    - coefficient_variation: std / mean (price volatility)
    - purchase_count: Number of times purchased
    - total_quantity: Total quantity purchased
    - days_since_first_purchase: Age of the item in dataset
    - days_since_last_purchase: Recency
    """
    logger.info("Computing price features")

    features = []

    # Group by pricebook item
    for item_id, group in po_line_items_df.groupby('pricebook_item_id'):
        if pd.isna(item_id):
            continue

        prices = group['unit_price'].dropna()

        if len(prices) == 0:
            continue

        feature = {
            'pricebook_item_id': int(item_id),
            'mean_price': float(prices.mean()),
            'std_price': float(prices.std()) if len(prices) > 1 else 0.0,
            'min_price': float(prices.min()),
            'max_price': float(prices.max()),
            'price_range': float(prices.max() - prices.min()),
            'coefficient_variation': float(prices.std() / prices.mean()) if prices.mean() > 0 else 0.0,
            'purchase_count': len(group),
            'total_quantity': float(group['quantity'].sum()),
            'days_since_first_purchase': (datetime.now() - pd.to_datetime(group['created_at'].min())).days,
            'days_since_last_purchase': (datetime.now() - pd.to_datetime(group['created_at'].max())).days,
        }

        features.append(feature)

    features_df = pd.DataFrame(features)
    logger.info(f"Computed features for {len(features_df)} items")
    return features_df


def compute_supplier_features(suppliers_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute supplier performance features

    Features:
    - total_po_value: Total value of all POs
    - avg_po_value: Average PO value
    - total_purchase_orders: Number of POs
    - response_rate: Supplier response rate
    - rating: Supplier rating
    """
    logger.info("Computing supplier features")

    features = []

    for _, supplier in suppliers_df.iterrows():
        feature = {
            'supplier_id': int(supplier['id']),
            'total_po_value': float(supplier.get('total_po_value', 0)),
            'avg_po_value': float(supplier.get('avg_po_value', 0)),
            'total_purchase_orders': int(supplier.get('total_purchase_orders', 0)),
            'response_rate': float(supplier.get('response_rate', 0)),
            'rating': int(supplier.get('rating', 0)),
            'is_active': bool(supplier.get('is_active', True))
        }

        features.append(feature)

    features_df = pd.DataFrame(features)
    logger.info(f"Computed features for {len(features_df)} suppliers")
    return features_df


def compute_job_features(constructions_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute job/construction features for profitability prediction

    Features:
    - contract_value: Total contract value
    - live_profit: Current profit
    - profit_percentage: Profit margin
    - total_po_value: Total purchase order value
    - purchase_orders_count: Number of POs
    - po_to_contract_ratio: PO value / contract value
    """
    logger.info("Computing job features")

    features = []

    for _, job in constructions_df.iterrows():
        contract_value = float(job.get('contract_value', 0))
        total_po_value = float(job.get('total_po_value', 0))

        feature = {
            'construction_id': int(job['id']),
            'contract_value': contract_value,
            'live_profit': float(job.get('live_profit', 0)),
            'profit_percentage': float(job.get('profit_percentage', 0)),
            'total_po_value': total_po_value,
            'purchase_orders_count': int(job.get('purchase_orders_count', 0)),
            'po_to_contract_ratio': total_po_value / contract_value if contract_value > 0 else 0.0,
            'stage': str(job.get('stage', '')),
            'status': str(job.get('status', ''))
        }

        features.append(feature)

    features_df = pd.DataFrame(features)
    logger.info(f"Computed features for {len(features_df)} jobs")
    return features_df


if __name__ == '__main__':
    # Test feature store setup
    logging.basicConfig(level=logging.INFO)

    with FeatureStore() as fs:
        fs.create_tables()
        print("Feature store tables created successfully!")
