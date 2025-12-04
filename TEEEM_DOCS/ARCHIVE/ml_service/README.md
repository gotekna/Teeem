# TEEEM ML Service

**Silent ML Infrastructure** - Runs in the background for 3 months collecting data and training models before exposing any user-facing features.

## Overview

This Python microservice provides machine learning capabilities for the TEEEM construction management platform:

1. **Price Anomaly Detection** - Identifies unusual prices in purchase orders (Isolation Forest)
2. **Supplier Price Predictions** - Forecasts which suppliers are likely to increase prices (Time Series Analysis)
3. **Job Profitability Predictions** - Estimates final job profit based on current metrics (Random Forest)

## Architecture

```
ml_service/
├── config.py                    # Configuration and database connection
├── requirements.txt             # Python dependencies
├── data/
│   ├── extractors.py           # Extract data from Rails PostgreSQL
│   └── feature_store.py        # Store computed features in DB
├── models/
│   ├── price_anomaly.py        # Isolation Forest for price detection
│   ├── supplier_predictor.py   # Time series for supplier analysis
│   └── profit_predictor.py     # Random Forest for job profitability
├── training/
│   └── train_models.py         # Weekly retraining pipeline
└── trained_models/             # Saved model files (auto-created)
```

## Key Features

### 1. Data Extraction
- Connects directly to existing Rails PostgreSQL database
- Extracts historical purchase orders, suppliers, and construction data
- No duplicate data storage - uses same database as Rails app

### 2. Feature Engineering
- Computes price statistics (mean, std, trends)
- Analyzes supplier performance metrics
- Calculates job profitability indicators
- Stores features in `ml_features` table for efficient training

### 3. Model Training
- **Price Anomaly Detection**: Isolation Forest learns normal price distributions
- **Supplier Predictor**: Analyzes historical price changes to identify high-risk suppliers
- **Profit Predictor**: Random Forest predicts final job profitability from current metrics

### 4. Silent Operation
- No user-facing features initially
- Runs background training jobs
- Collects data for 3 months
- Validates model performance before exposing predictions

## Setup

### Prerequisites

- Python 3.9+
- Access to TEEEM PostgreSQL database (same as Rails)
- (Optional) Redis for background job scheduling

### Installation

```bash
# Navigate to ML service directory
cd /Users/jakebaird/teeem/backend/ml_service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# venv\Scripts\activate   # On Windows

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the `ml_service` directory:

```bash
# Database (same as Rails DATABASE_URL)
DATABASE_URL=postgresql://user:password@localhost:5432/teeem_development

# Redis (optional, for Celery)
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=INFO
```

**Production (Heroku):**
The service will automatically use the existing `DATABASE_URL` from Heroku environment.

### Initialize Feature Store

Before first training, create the feature store tables:

```bash
python -c "from data.feature_store import FeatureStore; FeatureStore().create_tables()"
```

This creates two tables:
- `ml_features` - Stores computed features
- `ml_predictions` - Stores model predictions

## Usage

### 1. Test Data Extraction

Verify database connection and data availability:

```bash
python data/extractors.py
```

Expected output:
```
=== Data Extraction Summary ===
po_line_items: 1234 records
  Columns: ['id', 'purchase_order_id', 'unit_price', ...]

constructions: 56 records
  Columns: ['id', 'title', 'contract_value', 'profit_percentage', ...]

suppliers: 78 records
  Columns: ['id', 'name', 'rating', 'total_po_value', ...]
```

### 2. Train Individual Models

**Price Anomaly Detector:**
```bash
python models/price_anomaly.py
```

Output:
```
=== Training Results ===
model_version: v1
trained_at: 2025-11-05T12:30:00
num_samples: 450
num_anomalies_detected: 45
anomaly_rate: 0.10
model_path: /path/to/price_anomaly_detector_v1_20251105.pkl
```

**Supplier Price Predictor:**
```bash
python models/supplier_predictor.py
```

Output:
```
=== Supplier Price Predictor ===
Analyzed 78 suppliers
High risk suppliers: 12

Top 5 High-Risk Suppliers:
  supplier_id  risk_score  avg_price_increase_pct  trend_direction
  15          0.85         8.5                     increasing
  23          0.78         6.2                     increasing
  ...
```

**Profit Predictor:**
```bash
python models/profit_predictor.py
```

Output:
```
=== Profit Predictor Training ===
num_samples: 56
test_score: 0.823
mae: 2.34
rmse: 3.12

Feature Importance:
  po_to_contract_ratio: 0.452
  contract_value: 0.298
  ...
```

### 3. Run Full Training Pipeline

Train all models at once:

```bash
python training/train_models.py
```

This will:
1. Extract all data from database
2. Compute features and store in feature store
3. Train all three models
4. Save models to `trained_models/` directory
5. Generate training report JSON

Expected output:
```
============================================================
STARTING ML TRAINING PIPELINE
============================================================

Extracting data from database...
Data extraction summary:
  po_line_items: 1234 records
  constructions: 56 records
  suppliers: 78 records
  pricebook_items: 890 records
  price_history: 345 records

Computing and storing features...
Stored features for 890 items

==================================================
Training Price Anomaly Detector
==================================================
Training on 450 items with 6 features
Training complete. Detected 45 anomalies (10.00%)
Model saved to trained_models/price_anomaly_detector_v1_20251105.pkl

...

============================================================
TRAINING PIPELINE COMPLETE
Total time: 23.4 seconds
============================================================
```

## Model Details

### Price Anomaly Detector (Isolation Forest)

**Purpose**: Detect unusual prices that may indicate errors or fraud

**Algorithm**: Isolation Forest (unsupervised)
- Contamination: 10% (expects 10% of prices to be anomalous)
- 100 trees

**Features Used**:
- Mean price per item
- Price standard deviation
- Price range (max - min)
- Coefficient of variation (volatility)
- Purchase count
- Days since last purchase

**Output**:
- `is_anomaly`: Binary flag (1 = anomaly, 0 = normal)
- `anomaly_score`: Continuous score (lower = more anomalous)
- `confidence`: 0-1 scale (higher = more confident)

**Use Cases**:
- Flag PO line items with unusual prices before approval
- Identify data entry errors
- Detect supplier pricing issues

### Supplier Price Predictor (Time Series)

**Purpose**: Identify suppliers likely to increase prices soon

**Algorithm**: Trend analysis on historical price changes

**Features**:
- Average price increase percentage
- Frequency of price increases
- Days since last price change
- Trend direction (increasing/stable/decreasing)

**Output**:
- `risk_score`: 0-1 (higher = more likely to increase prices)
- Suppliers with score > 0.6 are "high risk"

**Use Cases**:
- Proactive negotiation with suppliers
- Strategic purchasing timing
- Budget forecasting

### Profit Predictor (Random Forest)

**Purpose**: Predict final job profitability from current metrics

**Algorithm**: Random Forest Regression
- 100 trees
- Max depth: 10

**Features**:
- Contract value
- Total PO value to date
- Number of purchase orders
- PO-to-contract ratio

**Output**:
- `predicted_profit_pct`: Estimated final profit percentage
- `prediction_error`: Difference from actual (for completed jobs)

**Use Cases**:
- Early warning for underperforming jobs
- Resource reallocation
- Pricing strategy improvement

## Data Flow

```
┌─────────────────────┐
│  Rails PostgreSQL   │
│   (Production DB)   │
└──────────┬──────────┘
           │
           │ Extract (read-only)
           │
┌──────────▼──────────┐
│   ML Service        │
│  - extractors.py    │
│  - feature_store.py │
└──────────┬──────────┘
           │
           │ Compute & Store
           │
┌──────────▼──────────┐
│  ml_features table  │
│  ml_predictions     │
└──────────┬──────────┘
           │
           │ Train
           │
┌──────────▼──────────┐
│  Trained Models     │
│  (.pkl files)       │
└─────────────────────┘
```

## Deployment

### Local Development

1. Run training manually:
   ```bash
   python training/train_models.py
   ```

2. Schedule weekly retraining (cron):
   ```bash
   # Add to crontab (runs every Sunday at 2 AM)
   0 2 * * 0 cd /path/to/ml_service && venv/bin/python training/train_models.py
   ```

### Heroku Deployment

**Option 1: Separate Python Dyno**

1. Add Python buildpack:
   ```bash
   heroku buildpacks:add heroku/python
   ```

2. Create `Procfile` entry:
   ```
   ml_worker: python backend/ml_service/training/train_models.py
   ```

3. Use Heroku Scheduler addon:
   ```bash
   heroku addons:create scheduler:standard
   heroku addons:open scheduler
   ```

   Add task: `python backend/ml_service/training/train_models.py`
   Frequency: Weekly

**Option 2: Use Existing Rails Dyno**

Run training via Rails rake task:

```ruby
# lib/tasks/ml.rake
namespace :ml do
  desc "Train ML models"
  task train: :environment do
    system("cd #{Rails.root}/ml_service && python training/train_models.py")
  end
end
```

Then schedule with Heroku Scheduler:
```bash
bundle exec rake ml:train
```

### Production Considerations

- **Database Load**: Extractors use read-only queries with indexes
- **Memory**: Models require ~500MB RAM during training
- **Runtime**: Full training takes 30-60 seconds
- **Storage**: Model files are ~10-50MB each
- **Frequency**: Weekly retraining is sufficient

## Performance Metrics to Track

During 3-month silent phase, monitor:

### Price Anomaly Detector
- [ ] Anomaly detection rate (should be ~10%)
- [ ] False positive rate (manual verification)
- [ ] Coverage (% of items with enough historical data)

### Supplier Predictor
- [ ] High-risk supplier accuracy (do they actually increase prices?)
- [ ] Lead time (how far in advance can we predict?)
- [ ] Coverage (% of active suppliers analyzed)

### Profit Predictor
- [ ] R² score (target: > 0.7)
- [ ] MAE (Mean Absolute Error) - target: < 5%
- [ ] Predictions vs actuals on completed jobs

## Testing Locally

### 1. With Sample Data

If production database has limited data, create test data:

```ruby
# In Rails console
100.times do |i|
  po = PurchaseOrder.create!(
    purchase_order_number: "PO-TEST-#{i}",
    construction_id: Construction.first.id,
    supplier_id: Supplier.all.sample.id,
    status: 'approved'
  )

  5.times do
    PurchaseOrderLineItem.create!(
      purchase_order_id: po.id,
      pricebook_item_id: PricebookItem.all.sample.id,
      description: "Test item",
      quantity: rand(1..10),
      unit_price: rand(10.0..1000.0).round(2)
    )
  end
end
```

### 2. Test Individual Components

**Test database connection:**
```python
from data.extractors import DatabaseExtractor

with DatabaseExtractor() as db:
    print("Database connected!")
    po_items = db.extract_purchase_order_line_items()
    print(f"Extracted {len(po_items)} items")
```

**Test feature computation:**
```python
from data.extractors import extract_all_data
from data.feature_store import compute_price_features

data = extract_all_data()
features = compute_price_features(data['po_line_items'])
print(features.head())
```

**Test model training:**
```python
from models.price_anomaly import train_and_save_model

detector, metrics = train_and_save_model()
print(metrics)
```

## Roadmap

### Phase 1: Silent Collection (Months 1-3) ✅
- [x] Set up ML service infrastructure
- [x] Extract data from Rails database
- [x] Build feature store
- [x] Train initial models
- [x] Validate model performance

### Phase 2: Internal Testing (Month 4)
- [ ] Create simple API endpoints for predictions
- [ ] Internal dashboard showing model outputs
- [ ] Manually verify predictions against reality
- [ ] Tune model hyperparameters

### Phase 3: User-Facing Features (Month 5+)
- [ ] Price anomaly warnings in PO creation UI
- [ ] Supplier risk alerts in purchasing dashboard
- [ ] Job profitability predictions in construction view
- [ ] Model explainability (why is this flagged?)

### Phase 4: Advanced Features (Future)
- [ ] Real-time predictions via API
- [ ] Automated retraining on new data
- [ ] A/B testing of model versions
- [ ] Custom model fine-tuning per user

## Troubleshooting

### "No module named 'psycopg2'"
```bash
pip install psycopg2-binary
```

### "Insufficient data for training"
Models require minimum 50 samples. Check:
```python
from data.extractors import extract_all_data
data = extract_all_data()
for name, df in data.items():
    print(f"{name}: {len(df)} records")
```

### "Database connection failed"
Verify `DATABASE_URL` environment variable:
```bash
echo $DATABASE_URL
```

For Heroku:
```bash
heroku config:get DATABASE_URL
```

### Models not improving
- Need more historical data (3+ months)
- Check data quality (missing values, outliers)
- Review feature engineering logic
- Consider different algorithms

## Contributing

This ML service is part of the TEEEM project. When modifying:

1. **Maintain backward compatibility** - Don't break existing model files
2. **Version models** - Use `model_version` parameter
3. **Log everything** - Training pipeline logs to `trained_models/training.log`
4. **Document changes** - Update this README

## License

Part of TEEEM project - MIT License

---

## Quick Reference

**Train all models:**
```bash
python training/train_models.py
```

**Check what data is available:**
```bash
python data/extractors.py
```

**Setup feature store (first time only):**
```bash
python data/feature_store.py
```

**Test individual model:**
```bash
python models/price_anomaly.py
python models/supplier_predictor.py
python models/profit_predictor.py
```

---

**Last Updated**: November 5, 2025
**Version**: 0.1.0
**Status**: Phase 1 - Silent Collection
