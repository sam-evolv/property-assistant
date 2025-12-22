#!/bin/bash
set -e

echo "========================================="
echo "OpenHouse AI - Smoke Test Suite"
echo "========================================="

BASE_URL="${1:-http://localhost:5000}"
PASS=0
FAIL=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing: $name ... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 2>/dev/null || echo "000")
    
    if [ "$status" = "$expected_status" ]; then
        echo "PASS ($status)"
        ((PASS++))
    else
        echo "FAIL (got $status, expected $expected_status)"
        ((FAIL++))
    fi
}

test_post_endpoint() {
    local name="$1"
    local url="$2"
    local body="$3"
    local expected_status="${4:-200}"
    
    echo -n "Testing: $name ... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$body" --max-time 10 2>/dev/null || echo "000")
    
    if [ "$status" = "$expected_status" ]; then
        echo "PASS ($status)"
        ((PASS++))
    else
        echo "FAIL (got $status, expected $expected_status)"
        ((FAIL++))
    fi
}

echo ""
echo "--- Health Checks ---"
test_endpoint "Health endpoint" "$BASE_URL/api/health"
test_endpoint "DB Health" "$BASE_URL/api/health/db"

echo ""
echo "--- Public Endpoints ---"
test_endpoint "Homepage" "$BASE_URL/"
test_endpoint "Login page" "$BASE_URL/login"

echo ""
echo "--- API Endpoints ---"
test_endpoint "Auth me (no session)" "$BASE_URL/api/auth/me" "401"
test_post_endpoint "Unit resolve (no body)" "$BASE_URL/api/houses/resolve" "{}" "400"
test_post_endpoint "Unit resolve (sample unit)" "$BASE_URL/api/houses/resolve" '{"token":"0dd0ba83-bea2-40e3-93c9-c86893202df6"}'

echo ""
echo "========================================="
echo "Results: $PASS passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
    exit 1
fi

echo "All smoke tests passed!"
exit 0
