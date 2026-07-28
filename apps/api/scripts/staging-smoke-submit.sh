#!/usr/bin/env bash
set -euo pipefail
cd /opt/projects/intra-platform
API_KEY=$(grep '^NETWORK_APPLICATION_API_KEY=' .env | cut -d= -f2-)
EXT_ID=$(python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
)
VSC=$(python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
)
CPR=$(python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
)
IMM=$(python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
)
QUAL=$(python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
)
TMP=/tmp/intra-staging-fake
mkdir -p "$TMP"
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/intra-staging-fake')
content=(b'%PDF-1.4 fake staging test ' + b'0'*100)[:128]
for name in ['vsc.pdf','cpr.pdf','imm.pdf','qual.pdf']:
    p.joinpath(name).write_bytes(content)
print(len(content))
PY
FILE_SIZE=$(stat -c%s "$TMP/vsc.pdf")
APP_JSON=$(python3 - <<PY
import json
print(json.dumps({
  "metadata": {
    "formId": "join-network-staging-smoke",
    "externalApplicationId": "$EXT_ID",
    "submittedAt": "2026-07-28T20:35:00.000Z",
    "sourcePage": "/join-the-network",
    "sourceUrl": "https://ops-test.intra.ca/join-the-network",
    "consentAccepted": True,
    "consentPolicyVersion": "2026-07-01"
  },
  "role": "ECA",
  "applicant": {
    "firstName": "Staging",
    "middleName": "",
    "lastName": "SmokeTest",
    "email": "staging-smoke-test@example.test",
    "phone": "4165550198",
    "gender": "prefer_not_to_say"
  },
  "eligibility": {"gtaEligible": True, "statusInCanada": "permanent_resident"},
  "experience": {"duration": "1_year"},
  "roleSpecific": {"qualification": {"status": "registered"}},
  "compliance": {
    "vulnerableSectorCheck": {"hasDocument": True, "issueDate": "2026-01-01"},
    "firstAidCpr": {"hasDocument": True, "expiryDate": "2027-01-01"},
    "immunizations": {"hasRequiredImmunizations": True},
    "covid19": {"vaccinated": True, "proofProvided": False}
  },
  "languages": {"englishProficiency": "fluent", "speaksAdditionalLanguages": False},
  "documents": [
    {"id": "$VSC", "category": "vulnerable_sector_check", "originalFilename": "vsc.pdf", "contentType": "application/pdf", "size": $FILE_SIZE},
    {"id": "$CPR", "category": "first_aid_cpr", "originalFilename": "cpr.pdf", "contentType": "application/pdf", "size": $FILE_SIZE},
    {"id": "$IMM", "category": "immunization_records", "originalFilename": "imm.pdf", "contentType": "application/pdf", "size": $FILE_SIZE},
    {"id": "$QUAL", "category": "qualification_certificate", "originalFilename": "qual.pdf", "contentType": "application/pdf", "size": $FILE_SIZE}
  ]
}))
PY
)
HTTP=$(curl -sS -o /tmp/intra-staging-submit.out -w '%{http_code}' \
  -H "Authorization: Bearer ${API_KEY}" \
  -F "application=${APP_JSON}" \
  -F "doc_${VSC}=@${TMP}/vsc.pdf;type=application/pdf" \
  -F "doc_${CPR}=@${TMP}/cpr.pdf;type=application/pdf" \
  -F "doc_${IMM}=@${TMP}/imm.pdf;type=application/pdf" \
  -F "doc_${QUAL}=@${TMP}/qual.pdf;type=application/pdf" \
  https://ops-test.intra.ca/api/v1/public/applications/network)
echo "submit_http=${HTTP}"
cat /tmp/intra-staging-submit.out
echo
APP_ID=$(python3 - <<PY
import json
print(json.load(open('/tmp/intra-staging-submit.out')).get('applicationId',''))
PY
)
docker compose -p intra-ops-test exec -T postgres psql -U intra -d intra -c "SELECT id, status, role, email FROM applications WHERE id = '${APP_ID}';"
docker compose -p intra-ops-test exec -T postgres psql -U intra -d intra -c "SELECT category, original_filename, byte_size, left(storage_key,40) AS storage_key_prefix FROM application_documents WHERE application_id = '${APP_ID}';"
docker compose -p intra-ops-test exec -T postgres psql -U intra -d intra -c "SELECT event_type, actor_type FROM application_activity WHERE application_id = '${APP_ID}';"
echo "external_submission_id=${EXT_ID}"
