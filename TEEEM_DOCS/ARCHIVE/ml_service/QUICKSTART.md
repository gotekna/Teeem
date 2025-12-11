# ML Service Quick Start

**5-Minute Setup Guide**

## Prerequisites

- Python 3.9+
- Access to TEEEM PostgreSQL database

## Step 1: Setup (2 minutes)

```bash
cd /Users/jakebaird/teeem/backend/ml_service
./setup.sh
```

This automatically:
- Creates virtual environment
- Installs dependencies
- Creates .env file
- Tests database connection
- Initializes feature store

## Step 2: Configure Database (1 minute)

Edit `.env` file:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/teeem_development
```

For Heroku production, get the URL:
```bash
heroku config:get DATABASE_URL --app teeemlive
```

## Step 3: Verify Setup (1 minute)

```bash
python test_setup.py
```

Should show all ✓ green checkmarks.

## Step 4: Train Models (1 minute)

```bash
python training/train_models.py
```

First run takes 30-60 seconds.

## What Just Happened?

1. Connected to your Rails database
2. Extracted purchase orders, jobs, suppliers
3. Computed features (price stats, trends, etc.)
4. Trained 3 ML models:
   - Price anomaly detector (Isolation Forest)
   - Supplier price predictor (Time Series)
   - Job profit predictor (Random Forest)
5. Saved models to `trained_models/` directory

## Check Results

```bash
# See what models were created
ls -lh trained_models/*.pkl

# View training report
cat trained_models/training_report_*.json | python -m json.tool
```

## Use a Model

```python
from models.price_anomaly import PriceAnomalyDetector

# Load model
detector = PriceAnomalyDetector()
detector.load('trained_models/price_anomaly_detector_v1_*.pkl')

# Check if a price is unusual
result = detector.detect_single_price(
    item_id=123,
    new_price=99.99
)

print(result)
# {
#   'is_anomaly': True,
#   'z_score': 3.5,
#   'mean_price': 50.00,
#   'price_deviation_pct': 99.98%
# }
```

## Schedule Weekly Training

**Heroku Scheduler:**
```bash
heroku addons:create scheduler:standard
heroku addons:open scheduler
```

Add job:
```
python backend/ml_service/training/train_models.py
```

Frequency: Weekly (Sunday 2 AM)

**Local Cron:**
```bash
crontab -e
# Add:
0 2 * * 0 cd /path/to/ml_service && venv/bin/python training/train_models.py
```

## Common Commands

```bash
# Test data extraction only
python data/extractors.py

# Train individual models
python models/price_anomaly.py
python models/supplier_predictor.py
python models/profit_predictor.py

# Full pipeline
python training/train_models.py

# Verify setup
python test_setup.py
```

## Directory Layout

```
ml_service/
├── trained_models/          # Saved model files (.pkl)
├── data/                    # Data extraction & features
├── models/                  # ML model implementations
├── training/                # Training pipeline
└── README.md               # Full documentation
```

## Troubleshooting

**"No module named X"**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

**"Database connection failed"**
```bash
# Check .env file
cat .env

# Test connection
python -c "from data.extractors import DatabaseExtractor; DatabaseExtractor().connect()"
```

**"Insufficient data"**
Wait for more historical data or reduce `MIN_SAMPLES_FOR_TRAINING` in `config.py`

## What's Next?

1. **Run weekly** for 3 months (silent data collection)
2. **Monitor** training reports in `trained_models/`
3. **Validate** predictions manually
4. **Build** user-facing features in month 4

## Need Help?

- See full documentation: `README.md`
- Check summary: `/Users/jakebaird/teeem/ML_SERVICE_SUMMARY.md`
- Run tests: `python test_setup.py`

---

**Status**: Ready for silent operation 🚀
