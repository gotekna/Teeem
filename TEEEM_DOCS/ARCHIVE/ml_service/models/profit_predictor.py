"""
Job Profitability Predictor

Predicts final job profitability based on:
- Contract value
- Current PO spending
- Job stage
- Historical similar jobs
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import logging
from typing import Dict, Tuple
import joblib
import os
from datetime import datetime

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
MODELS_DIR = config.MODELS_DIR
MIN_SAMPLES_FOR_TRAINING = config.MIN_SAMPLES_FOR_TRAINING
from data.extractors import DatabaseExtractor
from data.feature_store import compute_job_features

logger = logging.getLogger(__name__)


class ProfitPredictor:
    """
    Random Forest model to predict job profitability

    Predicts final profit percentage based on current job metrics
    """

    def __init__(self, model_version: str = "v1"):
        self.model_version = model_version
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'contract_value',
            'total_po_value',
            'purchase_orders_count',
            'po_to_contract_ratio'
        ]

    def prepare_features(self, features_df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Prepare features and target for training

        Args:
            features_df: DataFrame with job features

        Returns:
            Tuple of (X, y) - features and target
        """
        # Select features
        X = features_df[self.feature_names].copy()

        # Target: profit_percentage
        y = features_df['profit_percentage'].copy()

        # Remove rows with missing target
        mask = ~y.isna()
        X = X[mask]
        y = y[mask]

        # Fill missing features
        X = X.fillna(0)

        return X, y

    def train(self, constructions_df: pd.DataFrame) -> Dict:
        """
        Train Random Forest model

        Args:
            constructions_df: DataFrame of construction jobs

        Returns:
            Dictionary with training metrics
        """
        logger.info("Starting profit predictor training")

        # Compute features
        features_df = compute_job_features(constructions_df)

        if len(features_df) < MIN_SAMPLES_FOR_TRAINING:
            raise ValueError(
                f"Insufficient data for training. "
                f"Need at least {MIN_SAMPLES_FOR_TRAINING} samples, got {len(features_df)}"
            )

        # Prepare features
        X, y = self.prepare_features(features_df)

        logger.info(f"Training on {len(X)} jobs with {len(self.feature_names)} features")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train model
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train_scaled, y_train)

        # Evaluate
        train_score = self.model.score(X_train_scaled, y_train)
        test_score = self.model.score(X_test_scaled, y_test)

        # Predictions
        y_pred = self.model.predict(X_test_scaled)
        mae = np.mean(np.abs(y_test - y_pred))
        rmse = np.sqrt(np.mean((y_test - y_pred) ** 2))

        # Feature importance
        feature_importance = dict(zip(
            self.feature_names,
            self.model.feature_importances_
        ))

        metrics = {
            'model_version': self.model_version,
            'trained_at': datetime.now().isoformat(),
            'num_samples': len(X),
            'num_features': len(self.feature_names),
            'train_score': float(train_score),
            'test_score': float(test_score),
            'mae': float(mae),
            'rmse': float(rmse),
            'feature_importance': {k: float(v) for k, v in feature_importance.items()}
        }

        logger.info(f"Training complete. Test R2: {test_score:.3f}, MAE: {mae:.2f}%")
        return metrics

    def predict(self, constructions_df: pd.DataFrame) -> pd.DataFrame:
        """
        Predict profit percentages for jobs

        Args:
            constructions_df: DataFrame of construction jobs

        Returns:
            DataFrame with predictions
        """
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")

        logger.info("Predicting job profitability")

        # Compute features
        features_df = compute_job_features(constructions_df)

        # Prepare features
        X, y = self.prepare_features(features_df)

        # Scale and predict
        X_scaled = self.scaler.transform(X)
        predictions = self.model.predict(X_scaled)

        results_df = pd.DataFrame({
            'construction_id': features_df['construction_id'].values,
            'actual_profit_pct': y.values,
            'predicted_profit_pct': predictions,
            'prediction_error': predictions - y.values
        })

        logger.info(f"Generated predictions for {len(results_df)} jobs")
        return results_df

    def save(self, filename: str = None):
        """Save model to disk"""
        if self.model is None:
            raise ValueError("No model to save.")

        if filename is None:
            filename = f"profit_predictor_{self.model_version}_{datetime.now().strftime('%Y%m%d')}.pkl"

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
        """Load model from disk"""
        model_data = joblib.load(filepath)

        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.model_version = model_data['model_version']

        logger.info(f"Model loaded from {filepath}")


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    # Extract data
    with DatabaseExtractor() as extractor:
        constructions = extractor.extract_constructions()

    # Train model
    predictor = ProfitPredictor()
    metrics = predictor.train(constructions)

    print("\n=== Profit Predictor Training ===")
    for key, value in metrics.items():
        if key != 'feature_importance':
            print(f"{key}: {value}")

    print("\nFeature Importance:")
    for feature, importance in metrics['feature_importance'].items():
        print(f"  {feature}: {importance:.3f}")

    # Save model
    predictor.save()
