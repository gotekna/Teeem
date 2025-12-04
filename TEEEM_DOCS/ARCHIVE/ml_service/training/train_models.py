"""
Training Pipeline for All ML Models

This script orchestrates the training of all models:
1. Extract data from Rails database
2. Train price anomaly detector
3. Train supplier price predictor
4. Train job profitability predictor
5. Save all models to disk
6. Log metrics

Run this weekly via cron/scheduler to keep models up-to-date
"""
import logging
import sys
import os
from datetime import datetime
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from data.extractors import extract_all_data, DatabaseExtractor
from data.feature_store import FeatureStore, compute_price_features, compute_supplier_features, compute_job_features
from models.price_anomaly import PriceAnomalyDetector, train_and_save_model as train_price_anomaly
from models.supplier_predictor import SupplierPricePredictor
from models.profit_predictor import ProfitPredictor
from config import MODELS_DIR, MIN_SAMPLES_FOR_TRAINING

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(MODELS_DIR, 'training.log')),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def setup_feature_store():
    """Initialize feature store tables"""
    logger.info("Setting up feature store")
    with FeatureStore() as fs:
        fs.create_tables()
    logger.info("Feature store ready")


def extract_and_store_features(data: dict):
    """
    Extract features and store in feature store

    Args:
        data: Dictionary of DataFrames from extract_all_data()
    """
    logger.info("Computing and storing features")

    with FeatureStore() as fs:
        # Price features
        price_features = compute_price_features(data['po_line_items'])
        logger.info(f"Computed price features for {len(price_features)} items")

        for _, row in price_features.iterrows():
            fs.store_features(
                feature_type='price_features',
                entity_id=int(row['pricebook_item_id']),
                entity_type='pricebook_item',
                features=row.to_dict()
            )

        # Supplier features
        supplier_features = compute_supplier_features(data['suppliers'])
        logger.info(f"Computed supplier features for {len(supplier_features)} suppliers")

        for _, row in supplier_features.iterrows():
            fs.store_features(
                feature_type='supplier_features',
                entity_id=int(row['supplier_id']),
                entity_type='supplier',
                features=row.to_dict()
            )

        # Job features
        job_features = compute_job_features(data['constructions'])
        logger.info(f"Computed job features for {len(job_features)} jobs")

        for _, row in job_features.iterrows():
            fs.store_features(
                feature_type='job_features',
                entity_id=int(row['construction_id']),
                entity_type='construction',
                features=row.to_dict()
            )

    logger.info("Features stored in feature store")


def train_all_models(data: dict) -> dict:
    """
    Train all ML models

    Args:
        data: Dictionary of DataFrames

    Returns:
        Dictionary of training metrics for all models
    """
    all_metrics = {}

    # 1. Price Anomaly Detector
    logger.info("=" * 50)
    logger.info("Training Price Anomaly Detector")
    logger.info("=" * 50)

    try:
        if len(data['po_line_items']) >= MIN_SAMPLES_FOR_TRAINING:
            detector, metrics = train_price_anomaly()
            all_metrics['price_anomaly'] = metrics
            logger.info(f"Price anomaly model saved to {metrics['model_path']}")
        else:
            logger.warning(f"Skipping price anomaly training: insufficient data ({len(data['po_line_items'])} samples)")
            all_metrics['price_anomaly'] = {'status': 'skipped', 'reason': 'insufficient_data'}
    except Exception as e:
        logger.error(f"Failed to train price anomaly detector: {e}")
        all_metrics['price_anomaly'] = {'status': 'failed', 'error': str(e)}

    # 2. Supplier Price Predictor
    logger.info("=" * 50)
    logger.info("Training Supplier Price Predictor")
    logger.info("=" * 50)

    try:
        predictor = SupplierPricePredictor()
        metrics = predictor.train()
        predictor.save()
        all_metrics['supplier_predictor'] = metrics
        logger.info("Supplier predictor trained and saved")
    except Exception as e:
        logger.error(f"Failed to train supplier predictor: {e}")
        all_metrics['supplier_predictor'] = {'status': 'failed', 'error': str(e)}

    # 3. Profit Predictor
    logger.info("=" * 50)
    logger.info("Training Profit Predictor")
    logger.info("=" * 50)

    try:
        if len(data['constructions']) >= MIN_SAMPLES_FOR_TRAINING:
            profit_predictor = ProfitPredictor()
            metrics = profit_predictor.train(data['constructions'])
            profit_predictor.save()
            all_metrics['profit_predictor'] = metrics
            logger.info("Profit predictor trained and saved")
        else:
            logger.warning(f"Skipping profit predictor training: insufficient data ({len(data['constructions'])} samples)")
            all_metrics['profit_predictor'] = {'status': 'skipped', 'reason': 'insufficient_data'}
    except Exception as e:
        logger.error(f"Failed to train profit predictor: {e}")
        all_metrics['profit_predictor'] = {'status': 'failed', 'error': str(e)}

    return all_metrics


def save_training_report(metrics: dict):
    """
    Save training metrics to JSON file

    Args:
        metrics: Dictionary of metrics from all models
    """
    report_path = os.path.join(MODELS_DIR, f"training_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")

    report = {
        'training_completed_at': datetime.now().isoformat(),
        'models': metrics
    }

    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    logger.info(f"Training report saved to {report_path}")


def main():
    """
    Main training pipeline
    """
    logger.info("=" * 60)
    logger.info("STARTING ML TRAINING PIPELINE")
    logger.info("=" * 60)

    start_time = datetime.now()

    try:
        # Step 1: Setup feature store
        setup_feature_store()

        # Step 2: Extract data
        logger.info("Extracting data from database")
        data = extract_all_data()

        logger.info("\nData extraction summary:")
        for name, df in data.items():
            logger.info(f"  {name}: {len(df)} records")

        # Step 3: Compute and store features
        extract_and_store_features(data)

        # Step 4: Train all models
        metrics = train_all_models(data)

        # Step 5: Save training report
        save_training_report(metrics)

        # Summary
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info("=" * 60)
        logger.info("TRAINING PIPELINE COMPLETE")
        logger.info(f"Total time: {elapsed:.1f} seconds")
        logger.info("=" * 60)

        # Print summary
        print("\n" + "=" * 60)
        print("TRAINING SUMMARY")
        print("=" * 60)

        for model_name, model_metrics in metrics.items():
            print(f"\n{model_name.upper()}:")
            if isinstance(model_metrics, dict):
                for key, value in model_metrics.items():
                    if key not in ['feature_importance', 'model_path']:
                        print(f"  {key}: {value}")

        return metrics

    except Exception as e:
        logger.error(f"Training pipeline failed: {e}", exc_info=True)
        raise


if __name__ == '__main__':
    main()
