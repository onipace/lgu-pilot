#!/bin/bash
BASE=http://localhost:3070

# Login
RESP=$(curl -s -D /tmp/hdrs.txt -X POST $BASE/api/auth/user/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"xander.mendoza@q101.ai","password":"Demo@2026"}')
echo "LOGIN: $RESP"

TOKEN=$(grep 'esangguni_user_session' /tmp/hdrs.txt | sed 's/.*esangguni_user_session=//' | sed 's/;.*//' | tr -d '[:space:]')
echo "TOKEN_LEN: ${#TOKEN}"

if [ -z "$TOKEN" ] || [ ${#TOKEN} -lt 10 ]; then
  echo "FAILED: No valid token"
  exit 1
fi

test_mode() {
  local MODULE=$1
  local MODE=$2
  local MSG=$3
  local EXPECTED_CAP=$4
  echo ""
  echo "=== $MODULE / $MODE (cap=$EXPECTED_CAP words) ==="
  RESULT=$(curl -s -N "$BASE/api/chat" \
    -H 'Content-Type: application/json' \
    -H "Cookie: esangguni_user_session=$TOKEN" \
    -d "{\"module\":\"$MODULE\",\"message\":\"$MSG\",\"history\":[],\"sessionId\":\"test-cal-$MODE\",\"responseMode\":\"$MODE\"}" 2>/dev/null)
  # Extract _meta line
  META=$(echo "$RESULT" | grep -o '{.*}' | grep '_meta' | tail -1)
  if [ -n "$META" ]; then
    echo "$META" | python3 -c "
import sys,json
d = json.load(sys.stdin)
m = d['_meta']
print(f\"  actualWords: {m['actualWords']}\")
print(f\"  wordCap: {m['wordCap']}\")
print(f\"  graceRatio: {m['graceRatio']}\")
print(f\"  softStopTriggered: {m['softStopTriggered']}\")
print(f\"  completion_tokens: {m.get('maxTokensUsed', 'unknown')}\")
print(f\"  PASS: {m['actualWords'] <= int(m['wordCap'] * m['graceRatio']) + 5}\")"
  else
    echo "  NO _meta FOUND - raw tail:"
    echo "$RESULT" | tail -3
  fi
}

test_mode "ella" "brief" "What is an ordinance?" 150
test_mode "ella" "standard" "Explain the powers of the Sangguniang Bayan under RA 7160" 300
test_mode "yala" "detailed" "What are the requirements for a barangay budget ordinance?" 500

echo ""
echo "=== DONE ==="
