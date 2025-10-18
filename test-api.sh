#!/bin/bash

# Test script for Toodl API endpoints
# Make sure to update BASE_URL to your actual domain

BASE_URL="http://localhost:3000/api"

echo "Testing Toodl API endpoints..."
echo "================================"

# Test 1: Create a group
echo "1. Creating a group..."
GROUP_RESPONSE=$(curl -s -X POST "$BASE_URL/groups" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Trip",
    "creatorName": "Alice",
    "members": [
      {"firstName": "Bob"},
      {"firstName": "Charlie"}
    ],
    "currency": "USD"
  }')

echo "Response: $GROUP_RESPONSE"

# Extract group ID from response
GROUP_ID=$(echo $GROUP_RESPONSE | grep -o '"groupId":"[^"]*"' | cut -d'"' -f4)
echo "Group ID: $GROUP_ID"

if [ -z "$GROUP_ID" ]; then
  echo "Failed to create group. Exiting."
  exit 1
fi

echo ""
echo "2. Getting group details..."
curl -s -X GET "$BASE_URL/groups/$GROUP_ID" | jq '.'

echo ""
echo "3. Adding an expense..."
curl -s -X POST "$BASE_URL/groups/$GROUP_ID/expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Dinner at restaurant",
    "amount": 75.50,
    "paidBy": "Alice",
    "splits": {
      "member1": 50,
      "member2": 30,
      "member3": 20
    }
  }' | jq '.'

echo ""
echo "4. Getting balances..."
curl -s -X GET "$BASE_URL/groups/$GROUP_ID/balances" | jq '.'

echo ""
echo "5. Adding a member..."
curl -s -X POST "$BASE_URL/groups/$GROUP_ID/members" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "David"
  }' | jq '.'

echo ""
echo "6. Getting updated group details..."
curl -s -X GET "$BASE_URL/groups/$GROUP_ID" | jq '.'

echo ""
echo "API test completed!"
