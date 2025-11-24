#!/usr/bin/env python3
"""
Tekna Homes Price Book Cleanup Script for Trapid Migration
Transforms Rapid Platform export into clean, Trapid-ready format

Usage: python cleanup_pricebook.py input.csv output.csv
"""

import csv
import re
import sys
from datetime import datetime
from collections import defaultdict

def clean_text(text):
    """Clean and standardize text fields"""
    if not text or text.strip() == '':
        return ''
    
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    # Remove trailing commas and periods
    text = text.rstrip('.,')
    
    return text

def standardize_unit(unit):
    """Standardize unit of measure"""
    if not unit or unit.strip() == '':
        return 'Each'  # Default unit
    
    unit = unit.strip().lower()
    
    # Unit standardization mapping
    unit_map = {
        'each': 'Each',
        'ea': 'Each',
        'pcs': 'Each',
        'piece': 'Each',
        'lm': 'm',
        'linear metre': 'm',
        'linear meters': 'm',
        'lin m': 'm',
        'metres': 'm',
        'meter': 'm',
        'm3': 'm³',
        'cubic metre': 'm³',
        'cubic meter': 'm³',
        'cum': 'm³',
        'sqm': 'm²',
        'square metre': 'm²',
        'square meter': 'm²',
        'sq m': 'm²',
        'hours': 'Hours',
        'hrs': 'Hours',
        'hour': 'Hours',
        'poa': 'POA',  # Price on Application
        'kg': 'kg',
        'kilogram': 'kg',
        'tonne': 't',
        'ton': 't',
        'litre': 'L',
        'liter': 'L',
        'l': 'L'
    }
    
    return unit_map.get(unit, unit.title())

def clean_price(price):
    """Clean and validate price data"""
    if not price or price.strip() == '':
        return ''
    
    # Remove currency symbols and extra characters
    price_clean = re.sub(r'[^\d.]', '', str(price))
    
    # Handle empty result
    if not price_clean:
        return ''
    
    try:
        # Convert to float and format to 2 decimal places
        price_val = float(price_clean)
        return f"{price_val:.2f}"
    except ValueError:
        return ''

def standardize_supplier(supplier):
    """Clean and standardize supplier names"""
    if not supplier or supplier.strip() == '':
        return ''
    
    supplier = clean_text(supplier)
    
    # Common supplier name standardizations
    supplier_map = {
        'TL Electrical': 'TL Electrical',
        'Logan Concrete Sawing and Drilling': 'Logan Concrete Sawing & Drilling',
        'Harvey\'s Mechanical & Welding Services Pty Ltd': 'Harvey\'s Mechanical & Welding',
        'Fluid Building Approvals': 'Fluid Building Approvals',
        'Pre Hung Doors (PHD)': 'Pre Hung Doors',
        'Wayke Waterproofing. Ware': 'Wayke Waterproofing',
        'Dinkum Dunnies': 'Dinkum Dunnies',
        'Jopa Queensland': 'Jopa Queensland',
        'ReadyMix Concrete (Was Excel Concrete Pty Ltd)': 'ReadyMix Concrete',
        'GMA Certification Group': 'GMA Certification Group',
        'Logan City Council': 'Logan City Council',
        'Keeler Hardware': 'Keeler Hardware',
        'Austral Insulation': 'Austral Insulation',
        'Accelerate Sustainability Assessments': 'Accelerate Sustainability Assessments',
        'Spot On Plumbing and Drainage': 'Spot On Plumbing & Drainage'
    }
    
    return supplier_map.get(supplier, supplier)

def determine_category(range_name, description, code):
    """Determine appropriate category based on available data"""
    # Use range as primary category
    if range_name and range_name.strip():
        range_clean = clean_text(range_name)
        
        # Category mapping for common ranges
        category_map = {
            'Honeycomb - Corinthian': 'Doors',
            'PMAD7 - Corinthian': 'Doors',
            'Geostone - Excel': 'Concrete',
            'Hafele - Hafele': 'Hardware',
            'NDIS - Paco Jaanson': 'Accessibility'
        }
        
        if range_clean in category_map:
            return category_map[range_clean]
        else:
            return range_clean
    
    # Fallback to description-based categorization
    description_lower = description.lower() if description else ''
    code_lower = code.lower() if code else ''
    
    # Category keywords
    if any(word in description_lower for word in ['electrical', 'wiring', 'power point', 'switch', 'light']):
        return 'Electrical'
    elif any(word in description_lower for word in ['plumbing', 'drainage', 'pipe', 'tap']):
        return 'Plumbing'
    elif any(word in description_lower for word in ['concrete', 'cement', 'slab']):
        return 'Concrete'
    elif any(word in description_lower for word in ['timber', 'pine', 'wood', 'frame']):
        return 'Timber'
    elif any(word in description_lower for word in ['steel', 'beam', 'post', 'weld']):
        return 'Steel'
    elif any(word in description_lower for word in ['door', 'window']):
        return 'Doors & Windows'
    elif any(word in description_lower for word in ['roof', 'gutter', 'flashing']):
        return 'Roofing'
    elif any(word in description_lower for word in ['tile', 'floor', 'carpet']):
        return 'Flooring'
    elif any(word in description_lower for word in ['paint', 'render', 'plaster']):
        return 'Finishes'
    elif any(word in description_lower for word in ['approval', 'permit', 'council', 'registration']):
        return 'Approvals'
    elif any(word in description_lower for word in ['site', 'excavat', 'cut', 'fill']):
        return 'Site Works'
    elif any(word in description_lower for word in ['scaffold', 'safety', 'hire']):
        return 'Site Services'
    elif any(word in description_lower for word in ['insulation', 'batt']):
        return 'Insulation'
    elif any(word in description_lower for word in ['waterproof', 'membrane']):
        return 'Waterproofing'
    elif any(word in description_lower for word in ['pool', 'spa']):
        return 'Pool'
    else:
        return 'General'

def generate_notes(row):
    """Generate helpful notes from original data"""
    notes = []
    
    # Add price status
    if not row['price'] or row['price'].strip() == '':
        notes.append('NEEDS PRICING')
    
    # Add brand if available
    if row.get('brand_linked') and row['brand_linked'].strip():
        notes.append(f"Brand: {clean_text(row['brand_linked'])}")
    
    # Add budget zone if available
    if row.get('budget_zone') and row['budget_zone'].strip():
        notes.append(f"Budget Zone: {clean_text(row['budget_zone'])}")
    
    # Add model information if available
    if row.get('tedmodel') and row['tedmodel'].strip():
        notes.append(f"Model: {clean_text(row['tedmodel'])}")
    
    # Add colour spec if available
    if row.get('colour_spec') and row['colour_spec'].strip():
        notes.append(f"Colour: {clean_text(row['colour_spec'])}")
    
    return ' | '.join(notes)

def process_pricebook(input_file, output_file):
    """Main processing function"""
    
    stats = {
        'total_rows': 0,
        'processed_rows': 0,
        'missing_prices': 0,
        'missing_descriptions': 0,
        'categories_created': set(),
        'suppliers_found': set()
    }
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = [
                'item_code', 'item_name', 'category', 'unit_of_measure', 
                'current_price', 'supplier_name', 'brand', 'notes', 'last_updated'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                stats['total_rows'] += 1
                
                # Skip deleted items
                if row.get('deleted') and row['deleted'].strip():
                    continue
                
                # Extract and clean core fields
                item_code = clean_text(row.get('code', ''))
                item_name = clean_text(row.get('description', ''))
                
                # Skip rows without essential data
                if not item_code and not item_name:
                    continue
                
                # Generate code if missing
                if not item_code:
                    item_code = f"ITEM_{stats['processed_rows'] + 1:04d}"
                
                # Ensure name is present
                if not item_name:
                    item_name = f"Item {item_code}"
                    stats['missing_descriptions'] += 1
                
                # Process other fields
                category = determine_category(
                    row.get('range', ''), 
                    item_name, 
                    item_code
                )
                unit = standardize_unit(row.get('unit', ''))
                price = clean_price(row.get('price', ''))
                supplier = standardize_supplier(row.get('default_supplier', ''))
                brand = clean_text(row.get('brand_linked', ''))
                notes = generate_notes(row)
                
                # Track statistics
                if not price:
                    stats['missing_prices'] += 1
                stats['categories_created'].add(category)
                if supplier:
                    stats['suppliers_found'].add(supplier)
                
                # Write cleaned row
                cleaned_row = {
                    'item_code': item_code,
                    'item_name': item_name,
                    'category': category,
                    'unit_of_measure': unit,
                    'current_price': price,
                    'supplier_name': supplier,
                    'brand': brand,
                    'notes': notes,
                    'last_updated': datetime.now().strftime('%Y-%m-%d')
                }
                
                writer.writerow(cleaned_row)
                stats['processed_rows'] += 1
    
    return stats

def print_summary(stats):
    """Print processing summary"""
    print(f"\n📊 PRICE BOOK CLEANUP SUMMARY")
    print(f"{'='*50}")
    print(f"Total rows processed: {stats['total_rows']:,}")
    print(f"Clean rows output: {stats['processed_rows']:,}")
    print(f"Missing prices: {stats['missing_prices']:,} ({stats['missing_prices']/stats['processed_rows']*100:.1f}%)")
    print(f"Missing descriptions: {stats['missing_descriptions']:,}")
    print(f"Categories created: {len(stats['categories_created'])}")
    print(f"Suppliers found: {len(stats['suppliers_found'])}")
    
    print(f"\n📋 CATEGORIES IDENTIFIED:")
    for category in sorted(stats['categories_created']):
        print(f"  • {category}")
    
    print(f"\n🏢 TOP SUPPLIERS:")
    supplier_list = sorted(stats['suppliers_found'])[:10]
    for supplier in supplier_list:
        print(f"  • {supplier}")
    
    if len(stats['suppliers_found']) > 10:
        print(f"  ... and {len(stats['suppliers_found']) - 10} more")
    
    print(f"\n✅ Ready for Trapid import!")
    if stats['missing_prices'] > 0:
        print(f"⚠️  Note: {stats['missing_prices']} items need pricing review")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python cleanup_pricebook.py input.csv output.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"🔄 Processing price book: {input_file}")
    print(f"📝 Output file: {output_file}")
    print("⏳ This may take a few minutes for large files...")
    
    try:
        stats = process_pricebook(input_file, output_file)
        print_summary(stats)
    except Exception as e:
        print(f"❌ Error processing file: {e}")
        sys.exit(1)
