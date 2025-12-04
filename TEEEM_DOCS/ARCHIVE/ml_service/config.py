"""
Configuration for ML Service
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database Configuration
# Uses the same PostgreSQL database as Rails
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Parse DATABASE_URL for psycopg2 connection
# Heroku uses postgres:// but psycopg2 needs postgresql://
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

# Redis Configuration (for Celery task queue)
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Model Storage
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'trained_models')
os.makedirs(MODELS_DIR, exist_ok=True)

# Feature Store Configuration
FEATURES_TABLE = 'ml_features'
PREDICTIONS_TABLE = 'ml_predictions'

# Training Configuration
ISOLATION_FOREST_PARAMS = {
    'contamination': 0.1,  # Expected proportion of anomalies (10%)
    'random_state': 42,
    'n_estimators': 100
}

# Data Extraction Settings
LOOKBACK_DAYS = 365  # How far back to look for historical data
MIN_SAMPLES_FOR_TRAINING = 50  # Minimum records needed to train

# Logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# Celery Configuration
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
