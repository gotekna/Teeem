"""
Price Anomaly Detection using Isolation Forest

Detects unusual prices in purchase order line items that may indicate:
- Data entry errors
- Supplier pricing issues
- Market fluctuations
- Fraud attempts
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import os

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
MODELS_DIR = config.MODELS_DIR
ISOLATION_FOREST_PARAMS = config.ISOLATION_FOREST_PARAMS
MIN_SAMPLES_FOR_TRAINING = config.MIN_SAMPLES_FOR_TRAINING
from data.extractors import DatabaseExtractor
from data.feature_store import compute_price_features, FeatureStore

logger = logging.getLogger(__name__)


class PriceAnomalyDetector:
    """
    Isolation Forest model for detecting price anomalies

    The model learns the normal distribution of prices for each item
    and flags purchases that fall outside this distribution.
    """

    def __init__(self, model_version: str = "v1"):
        self.model_version = model_version
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'mean_price',
            'std_price',
            'price_range',
            'coefficient_variation',
            'purchase_count',
            'days_since_last_purchase'
        ]

    def prepare_features(self, features_df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare features for training/prediction

        Args:
            features_df: DataFrame with computed price features

        Returns:
            DataFrame with selected and cleaned features
        """
        # Select relevant features
        X = features_df[self.feature_names].copy()

        # Handle missing values
        X = X.fillna(0)

        # Remove rows with all zeros (no variance to detect anomalies)
        X = X[(X != 0).any(axis=1)]

        return X

    def train(self, po_line_items_df: pd.DataFrame) -> Dict:
        """
        Train Isolation Forest on historical purchase data

        Args:
            po_line_items_df: DataFrame of purchase order line items

        Returns:
            Dictionary with training metrics
        """
        logger.info("Starting price anomaly model training")

        # Compute features
        features_df = compute_price_features(po_line_items_df)

        if len(features_df) < MIN_SAMPLES_FOR_TRAINING:
            raise ValueError(
                f"Insufficient data for training. "
                f"Need at least {MIN_SAMPLES_FOR_TRAINING} samples, got {len(features_df)}"
            )

        # Prepare features
        X = self.prepare_features(features_df)

        logger.info(f"Training on {len(X)} items with {len(self.feature_names)} features")

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Train Isolation Forest
        self.model = IsolationForest(**ISOLATION_FOREST_PARAMS)
        self.model.fit(X_scaled)

        # Compute training metrics
        predictions = self.model.predict(X_scaled)
        anomaly_scores = self.model.score_samples(X_scaled)

        num_anomalies = (predictions == -1).sum()
        anomaly_rate = num_anomalies / len(predictions)

        metrics = {
            'model_version': self.model_version,
            'trained_at': datetime.now().isoformat(),
            'num_samples': len(X),
            'num_features': len(self.feature_names),
            'num_anomalies_detected': int(num_anomalies),
            'anomaly_rate': float(anomaly_rate),
            'mean_anomaly_score': float(anomaly_scores.mean()),
            'std_anomaly_score': float(anomaly_scores.std())
        }

        logger.info(f"Training complete. Detected {num_anomalies} anomalies ({anomaly_rate:.2%})")
        return metrics

    def predict(self, po_line_items_df: pd.DataFrame) -> pd.DataFrame:
        """
        Predict anomalies in new purchase data

        Args:
            po_line_items_df: DataFrame of purchase order line items

        Returns:
            DataFrame with predictions:
            - pricebook_item_id
            - is_anomaly (1 = anomaly, 0 = normal)
            - anomaly_score (lower = more anomalous)
            - confidence (0-1, higher = more confident)
        """
        if self.model is None:
            raise ValueError("Model not trained. Call train() first or load a trained model.")

        logger.info("Predicting price anomalies")

        # Compute features
        features_df = compute_price_features(po_line_items_df)

        # Prepare features
        X = self.prepare_features(features_df)

        # Scale features
        X_scaled = self.scaler.transform(X)

        # Predict
        predictions = self.model.predict(X_scaled)
        anomaly_scores = self.model.score_samples(X_scaled)

        # Convert predictions to binary (1 = anomaly, 0 = normal)
        is_anomaly = (predictions == -1).astype(int)

        # Compute confidence (normalize anomaly scores to 0-1)
        # Lower scores = more anomalous, so invert for confidence
        min_score = anomaly_scores.min()
        max_score = anomaly_scores.max()
        confidence = 1 - (anomaly_scores - min_score) / (max_score - min_score)

        results_df = pd.DataFrame({
            'pricebook_item_id': features_df['pricebook_item_id'].values,
            'is_anomaly': is_anomaly,
            'anomaly_score': anomaly_scores,
            'confidence': confidence
        })

        num_anomalies = is_anomaly.sum()
        logger.info(f"Detected {num_anomalies} anomalies out of {len(results_df)} items")

        return results_df

    def detect_single_price(self, item_id: int, new_price: float) -> Dict:
        """
        Check if a single price is anomalous for a given item

        Args:
            item_id: Pricebook item ID
            new_price: Price to check

        Returns:
            Dictionary with:
            - is_anomaly (bool)
            - anomaly_score (float)
            - confidence (float)
            - mean_price (float)
            - std_price (float)
        """
        # Extract historical data for this item
        with DatabaseExtractor() as extractor:
            history = extractor.get_item_purchase_history(pricebook_item_id=item_id)

        if len(history) == 0:
            logger.warning(f"No historical data for item {item_id}")
            return {
                'is_anomaly': False,
                'anomaly_score': 0.0,
                'confidence': 0.0,
                'mean_price': None,
                'std_price': None,
                'message': 'No historical data available'
            }

        # Compute simple statistical check
        prices = history['unit_price'].dropna()
        mean_price = prices.mean()
        std_price = prices.std()

        # Z-score based anomaly detection (simple heuristic)
        if std_price > 0:
            z_score = abs((new_price - mean_price) / std_price)
            is_anomaly = z_score > 3  # 3 sigma rule
            confidence = min(z_score / 3, 1.0)
        else:
            is_anomaly = abs(new_price - mean_price) > 0
            confidence = 1.0 if is_anomaly else 0.0

        return {
            'is_anomaly': bool(is_anomaly),
            'z_score': float(z_score) if std_price > 0 else 0.0,
            'confidence': float(confidence),
            'mean_price': float(mean_price),
            'std_price': float(std_price),
            'num_historical_prices': len(prices),
            'price_deviation': float(new_price - mean_price),
            'price_deviation_pct': float((new_price - mean_price) / mean_price * 100) if mean_price > 0 else 0.0
        }

    def save(self, filename: Optional[str] = None):
        """Save trained model to disk"""
        if self.model is None:
            raise ValueError("No model to save. Train the model first.")

        if filename is None:
            filename = f"price_anomaly_detector_{self.model_version}_{datetime.now().strftime('%Y%m%d')}.pkl"

        filepath = os.path.join(MODELS_DIR, filename)

        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'model_version': self.model_version,
            'saved_at': datetime.now().isoformat()
        }

        joblib.dump(model_data, filepath)
        logger.info(f"Model saved to {filepath}")
        return filepath

    def load(self, filepath: str):
        """Load trained model from disk"""
        model_data = joblib.load(filepath)

        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.model_version = model_data['model_version']

        logger.info(f"Model loaded from {filepath}")
        logger.info(f"Model version: {self.model_version}")


def train_and_save_model() -> Tuple[PriceAnomalyDetector, Dict]:
    """
    Complete training pipeline: extract data, train model, save to disk

    Returns:
        Tuple of (trained_model, metrics)
    """
    logger.info("Starting price anomaly model training pipeline")

    # Extract data
    with DatabaseExtractor() as extractor:
        po_line_items = extractor.extract_purchase_order_line_items()

    logger.info(f"Extracted {len(po_line_items)} purchase order line items")

    if len(po_line_items) < MIN_SAMPLES_FOR_TRAINING:
        raise ValueError(
            f"Insufficient data for training. "
            f"Need at least {MIN_SAMPLES_FOR_TRAINING} PO line items, got {len(po_line_items)}"
        )

    # Train model
    detector = PriceAnomalyDetector()
    metrics = detector.train(po_line_items)

    # Save model
    filepath = detector.save()
    metrics['model_path'] = filepath

    logger.info("Training pipeline complete")
    return detector, metrics


if __name__ == '__main__':
    # Test training
    logging.basicConfig(level=logging.INFO)

    try:
        detector, metrics = train_and_save_model()

        print("\n=== Training Results ===")
        for key, value in metrics.items():
            print(f"{key}: {value}")

        print("\nModel trained and saved successfully!")

    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise
