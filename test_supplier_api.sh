#!/bin/bash

# Test script for Supplier-Contact Matching API
API_URL="https://teeem-backend-447058022b51.herokuapp.com/api/v1"

echo "=================================="
echo "TESTING SUPPLIER-CONTACT API"
echo "=================================="
echo ""

# Test 1: Get all suppliers
echo "Test 1: GET /suppliers"
curl -s "${API_URL}/suppliers" | jq '.suppliers | length'
echo ""

# Test 2: Get unmatched suppliers
echo "Test 2: GET /suppliers/unmatched"
curl -s "${API_URL}/suppliers/unmatched" | jq '{count: .count, suppliers: .suppliers[0:3] | map(.name)}'
echo ""

# Test 3: Get suppliers needing review
echo "Test 3: GET /suppliers/needs_review"
curl -s "${API_URL}/suppliers/needs_review" | jq '{count: .count, examples: .suppliers[0:3] | map({name: .name, contact: .contact.full_name, confidence: .match_confidence_label})}'
echo ""

# Test 4: Get all contacts
echo "Test 4: GET /contacts"
curl -s "${API_URL}/contacts" | jq '.contacts | length'
echo ""

# Test 5: Get matched suppliers
echo "Test 5: GET /suppliers?match_status=matched"
curl -s "${API_URL}/suppliers?match_status=matched" | jq '.suppliers | length'
echo ""

# Test 6: Get verified suppliers
echo "Test 6: GET /suppliers?match_status=verified"
curl -s "${API_URL}/suppliers?match_status=verified" | jq '.suppliers | length'
echo ""

# Test 7: Search suppliers
echo "Test 7: GET /suppliers?search=harvey"
curl -s "${API_URL}/suppliers?search=harvey" | jq '.suppliers | map({name: .name, matched: (.contact != null)})'
echo ""

echo "=================================="
echo "✓ API Tests Complete"
echo "=================================="
