#!/bin/bash

# Upload Task #2236 files to production
# Run after deploying the task2236_upload endpoint

FOLDER="/Users/robertharder/Downloads/task2236"
API_URL="https://teeem-production-121159e1ff9d.herokuapp.com/api/v1/admin/task2236_upload"

# Get the admin key from Heroku
echo "Getting admin key from Heroku..."
ADMIN_KEY=$(heroku run --app teeem-production "puts Rails.application.secret_key_base[0..15]" 2>/dev/null | tail -1)
ADMIN_KEY="task2236_upload_${ADMIN_KEY}"
echo "Admin key generated (first 20 chars): ${ADMIN_KEY:0:20}..."

# File mappings: doc_id -> filename
declare -A FILES
FILES[19934]="Standard Balance Sheet 2019 HFT.pdf"
FILES[19974]="Deed of Gift - Rachel - 15.03.21.pdf"
FILES[19975]="Deed of Gift - Sophie - 15.03.21.pdf"
FILES[19976]="Deed of Gift - Jared - 15.03.21.pdf"
FILES[19977]="Walan Settlement.pdf"
FILES[19978]="Deed of Gift - Grace - 15.03.21.pdf"
FILES[19980]="24fy Rachel Paying Loan and Interest.pdf"
FILES[19981]="FY 25 Rachel Paying Interest and Loan.pdf"
FILES[19982]="Rachel Receiving Gen2612.pdf"

echo ""
echo "=========================================="
echo "Uploading Task #2236 files"
echo "=========================================="
echo ""

for doc_id in "${!FILES[@]}"; do
  filename="${FILES[$doc_id]}"
  filepath="$FOLDER/$filename"

  if [ -f "$filepath" ]; then
    echo "Uploading: $filename (doc_id: $doc_id)..."
    response=$(curl -s -X POST "$API_URL" \
      -H "X-Admin-Key: $ADMIN_KEY" \
      -F "doc_id=$doc_id" \
      -F "file=@$filepath")
    echo "  Response: $response"
    echo ""
  else
    echo "SKIP: $filename - file not found"
  fi
done

echo "=========================================="
echo "Done!"
echo "=========================================="
