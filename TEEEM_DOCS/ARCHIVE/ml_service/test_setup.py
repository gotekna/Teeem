"""
Quick test script to verify ML service setup

Run this to check if everything is configured correctly
"""
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_imports():
    """Test if all required packages are installed"""
    print("=" * 60)
    print("Testing Python package imports...")
    print("=" * 60)

    required_packages = [
        'pandas',
        'numpy',
        'sklearn',
        'psycopg2',
        'joblib',
        'dotenv'
    ]

    failed = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"✓ {package}")
        except ImportError as e:
            print(f"✗ {package} - {e}")
            failed.append(package)

    if failed:
        print(f"\nFailed to import: {', '.join(failed)}")
        print("Run: pip install -r requirements.txt")
        return False

    print("\n✓ All required packages installed\n")
    return True


def test_config():
    """Test configuration"""
    print("=" * 60)
    print("Testing configuration...")
    print("=" * 60)

    try:
        from config import DATABASE_URL, MODELS_DIR
        print(f"✓ DATABASE_URL configured")
        print(f"✓ MODELS_DIR: {MODELS_DIR}")
        print()
        return True
    except Exception as e:
        print(f"✗ Configuration error: {e}")
        print("Check .env file and config.py")
        return False


def test_database():
    """Test database connection"""
    print("=" * 60)
    print("Testing database connection...")
    print("=" * 60)

    try:
        import psycopg2
        from config import DATABASE_URL

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"✓ Connected to PostgreSQL")
        print(f"  Version: {version[:50]}...")

        # Check if required tables exist
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN (
                'purchase_order_line_items',
                'purchase_orders',
                'constructions',
                'suppliers',
                'pricebook_items'
            )
            ORDER BY table_name
        """)
        tables = [row[0] for row in cur.fetchall()]

        print(f"\n✓ Found {len(tables)} required tables:")
        for table in tables:
            print(f"  - {table}")

        cur.close()
        conn.close()

        print()
        return len(tables) >= 4  # Need at least 4 tables
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        print("Check DATABASE_URL in .env file")
        return False


def test_data_extraction():
    """Test data extraction"""
    print("=" * 60)
    print("Testing data extraction...")
    print("=" * 60)

    try:
        from data.extractors import DatabaseExtractor

        with DatabaseExtractor() as extractor:
            po_items = extractor.extract_purchase_order_line_items(days_back=365)
            constructions = extractor.extract_constructions(days_back=365)
            suppliers = extractor.extract_suppliers()

        print(f"✓ Extracted {len(po_items)} PO line items")
        print(f"✓ Extracted {len(constructions)} constructions")
        print(f"✓ Extracted {len(suppliers)} suppliers")

        if len(po_items) < 10:
            print("\n⚠ WARNING: Limited PO data available")
            print("  Models may not train well with < 50 samples")

        print()
        return True
    except Exception as e:
        print(f"✗ Data extraction failed: {e}")
        return False


def test_feature_store():
    """Test feature store"""
    print("=" * 60)
    print("Testing feature store...")
    print("=" * 60)

    try:
        from data.feature_store import FeatureStore

        with FeatureStore() as fs:
            # Check if tables exist
            conn = fs.connect()
            cur = conn.cursor()
            cur.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN ('ml_features', 'ml_predictions')
            """)
            tables = [row[0] for row in cur.fetchall()]
            cur.close()

            if len(tables) == 2:
                print(f"✓ Feature store tables exist")
            else:
                print(f"⚠ Feature store tables not found")
                print(f"  Run: python data/feature_store.py")

        print()
        return True
    except Exception as e:
        print(f"✗ Feature store test failed: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("ML SERVICE SETUP VERIFICATION")
    print("=" * 60)
    print()

    results = {
        'Imports': test_imports(),
        'Configuration': test_config(),
        'Database': test_database(),
        'Data Extraction': test_data_extraction(),
        'Feature Store': test_feature_store()
    }

    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)

    all_passed = True
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:20} {status}")
        if not passed:
            all_passed = False

    print()

    if all_passed:
        print("✓ All tests passed! ML service is ready.")
        print()
        print("Next steps:")
        print("1. Run training pipeline:")
        print("   python training/train_models.py")
        print()
        print("2. Test individual models:")
        print("   python models/price_anomaly.py")
        print("   python models/supplier_predictor.py")
        print("   python models/profit_predictor.py")
        return 0
    else:
        print("✗ Some tests failed. Please fix the issues above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
