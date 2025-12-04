"""
Supplier Price Increase Predictor

Predicts which suppliers are likely to increase prices based on:
- Historical price trends
- Time series analysis
- Seasonal patterns
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from typing import Dict, List
import joblib
import os

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
MODELS_DIR = config.MODELS_DIR
from data.extractors import DatabaseExtractor

logger = logging.getLogger(__name__)


class SupplierPricePredictor:
    """
    Simple time series model to predict supplier price increases

    Uses rolling averages and trend analysis to identify suppliers
    likely to increase prices soon.
    """

    def __init__(self, model_version: str = "v1"):
        self.model_version = model_version
        self.supplier_trends = {}

    def analyze_supplier_trends(self, price_history_df: pd.DataFrame) -> pd.DataFrame:
        """
        Analyze price trends for each supplier

        Returns DataFrame with:
        - supplier_id
        - avg_price_increase: Average price change
        - price_increase_frequency: How often prices go up
        - days_since_last_increase: Recency
        - trend_direction: 'increasing', 'stable', 'decreasing'
        - risk_score: 0-1, higher = more likely to increase soon
        """
        logger.info("Analyzing supplier price trends")

        trends = []

        for supplier_id, group in price_history_df.groupby('supplier_id'):
            if pd.isna(supplier_id) or len(group) < 3:
                continue

            # Sort by date
            group = group.sort_values('created_at')

            # Calculate price changes
            price_changes = group['new_price'] - group['old_price']
            pct_changes = (price_changes / group['old_price']) * 100

            # Count increases vs decreases
            num_increases = (price_changes > 0).sum()
            num_decreases = (price_changes < 0).sum()
            total_changes = len(price_changes)

            # Calculate metrics
            avg_price_increase = pct_changes.mean()
            price_increase_frequency = num_increases / total_changes if total_changes > 0 else 0

            # Days since last price change
            last_change_date = pd.to_datetime(group['created_at'].max())
            days_since_last_increase = (datetime.now() - last_change_date).days

            # Determine trend direction
            if avg_price_increase > 2:
                trend_direction = 'increasing'
            elif avg_price_increase < -2:
                trend_direction = 'decreasing'
            else:
                trend_direction = 'stable'

            # Calculate risk score (0-1)
            # Higher if: frequent increases, recent increase, positive trend
            risk_components = [
                price_increase_frequency,  # 0-1
                min(avg_price_increase / 10, 1) if avg_price_increase > 0 else 0,  # 0-1
                max(1 - (days_since_last_increase / 365), 0)  # 0-1, decay over year
            ]
            risk_score = np.mean(risk_components)

            trend = {
                'supplier_id': int(supplier_id),
                'avg_price_increase_pct': float(avg_price_increase),
                'price_increase_frequency': float(price_increase_frequency),
                'num_price_changes': int(total_changes),
                'num_increases': int(num_increases),
                'num_decreases': int(num_decreases),
                'days_since_last_change': int(days_since_last_increase),
                'trend_direction': trend_direction,
                'risk_score': float(risk_score)
            }

            trends.append(trend)

        trends_df = pd.DataFrame(trends)
        trends_df = trends_df.sort_values('risk_score', ascending=False)

        logger.info(f"Analyzed trends for {len(trends_df)} suppliers")
        return trends_df

    def predict_price_increases(self, threshold: float = 0.6) -> List[Dict]:
        """
        Predict which suppliers are likely to increase prices

        Args:
            threshold: Risk score threshold (0-1)

        Returns:
            List of suppliers with risk_score >= threshold
        """
        if not self.supplier_trends:
            raise ValueError("No trends calculated. Run analyze_supplier_trends first.")

        high_risk = self.supplier_trends[
            self.supplier_trends['risk_score'] >= threshold
        ].to_dict('records')

        logger.info(f"Identified {len(high_risk)} high-risk suppliers (threshold={threshold})")
        return high_risk

    def train(self):
        """
        Train the predictor (currently just analyzes trends)
        """
        logger.info("Training supplier price predictor")

        # Extract price history
        with DatabaseExtractor() as extractor:
            price_history = extractor.extract_price_history()

        if len(price_history) == 0:
            logger.warning("No price history data available")
            return {}

        # Analyze trends
        self.supplier_trends = self.analyze_supplier_trends(price_history)

        metrics = {
            'model_version': self.model_version,
            'trained_at': datetime.now().isoformat(),
            'num_suppliers_analyzed': len(self.supplier_trends),
            'high_risk_suppliers': len(self.supplier_trends[self.supplier_trends['risk_score'] >= 0.6])
        }

        return metrics

    def save(self, filename: str = None):
        """Save model to disk"""
        if filename is None:
            filename = f"supplier_predictor_{self.model_version}_{datetime.now().strftime('%Y%m%d')}.pkl"

        filepath = os.path.join(MODELS_DIR, filename)

        model_data = {
            'supplier_trends': self.supplier_trends,
            'model_version': self.model_version,
            'saved_at': datetime.now().isoformat()
        }

        joblib.dump(model_data, filepath)
        logger.info(f"Model saved to {filepath}")
        return filepath

    def load(self, filepath: str):
        """Load model from disk"""
        model_data = joblib.load(filepath)

        self.supplier_trends = model_data['supplier_trends']
        self.model_version = model_data['model_version']

        logger.info(f"Model loaded from {filepath}")


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    predictor = SupplierPricePredictor()
    metrics = predictor.train()

    print("\n=== Supplier Price Predictor ===")
    print(f"Analyzed {metrics['num_suppliers_analyzed']} suppliers")
    print(f"High risk suppliers: {metrics['high_risk_suppliers']}")

    if len(predictor.supplier_trends) > 0:
        print("\nTop 5 High-Risk Suppliers:")
        print(predictor.supplier_trends.head())
