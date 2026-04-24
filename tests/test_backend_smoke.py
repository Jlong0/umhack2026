"""
PermitIQ Backend Smoke Test
============================
用法:
  1. 先启动后端:  python -m uvicorn app.main:app --reload
  2. 再运行测试:  python tests/test_backend_smoke.py
"""
import httpx
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000"

TEST_COMPANY_ID = "smoke_test_company_001"
TEST_WORKER_ID = None  # Will be set from /workers response
TEST_VDR_ID = None
TEST_PLKS_ID = None

results = []


def log(name, passed, detail=""):
    icon = "[OK]" if passed else "[XX]"
    results.append((name, passed, detail))
    line = f"  {icon}  {name}"
    if detail:
        line += f"  ({detail[:90]})"
    print(line)


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def run_all():
    global TEST_WORKER_ID, TEST_VDR_ID, TEST_PLKS_ID

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # ── 0. Health Check ──────────────────────────────
    section("0. Health Check")
    try:
        r = client.get("/")
        log("GET /", r.status_code == 200, f"status={r.status_code}")
    except Exception as e:
        log("GET /", False, f"Connection failed: {e}")
        print("\n  Backend not running!")
        print("  Start with: python -m uvicorn app.main:app --reload")
        sys.exit(1)

    r = client.get("/health")
    log("GET /health", r.status_code == 200)

    # ── 1. Company (JTKSM Gate) ──────────────────────
    section("1. Company (JTKSM Gate)")
    r = client.post("/companies", json={
        "company_id": TEST_COMPANY_ID,
        "name": "Smoke Test Sdn Bhd",
        "sector": "Manufacturing",
        "ssm_number": "SSM-SMOKE-001",
        "jtksm_60k_status": "approved",
        "act_446_expiry_date": "2027-12-31T00:00:00",
        "quota_balance": {"Manufacturing": 10, "Construction": 5},
    })
    log("POST /companies (upsert)", r.status_code == 200)

    r = client.get(f"/companies/{TEST_COMPANY_ID}/quota-balance")
    log("GET /companies/id/quota-balance", r.status_code == 200)
    if r.status_code == 200:
        data = r.json()
        log("  quota data present", "quota_balance" in data, str(data.get("quota_balance")))

    # ── 2. Worker Creation ───────────────────────────
    section("2. Worker Creation")
    r = client.post("/workers", json={
        "name": "Ahmad Smoke Test",
        "passport_number": "BM-SMOKE-001",
        "nationality": "Bangladesh",
    })
    log("POST /workers (create)", r.status_code == 200, r.text[:80])
    if r.status_code == 200:
        TEST_WORKER_ID = r.json().get("worker_id")
        log(f"  worker_id={TEST_WORKER_ID}", TEST_WORKER_ID is not None)

    if not TEST_WORKER_ID:
        print("\n  Cannot continue without worker_id!")
        sys.exit(1)

    # ── 3. Agent Workflow (run early to seed state) ──
    section("3. Agent Workflow")
    r = client.post("/agents/workflows/start", json={
        "worker_id": TEST_WORKER_ID,
        "worker_data": {
            "full_name": "Ahmad Smoke Test",
            "passport_number": "BM-SMOKE-001",
            "nationality": "Bangladesh",
            "sector": "Manufacturing",
            "company_id": TEST_COMPANY_ID,
            "permit_class": "PLKS",
        },
    })
    log("POST /agents/workflows/start", r.status_code == 200, r.text[:100])

    r = client.get(f"/agents/workflows/{TEST_WORKER_ID}/status")
    log("GET /agents/workflows/id/status", r.status_code == 200)

    r = client.get(f"/agents/workflows/{TEST_WORKER_ID}/graph")
    log("GET /agents/workflows/id/graph", r.status_code == 200)
    if r.status_code == 200:
        data = r.json()
        nc = len(data.get("nodes", []))
        ec = len(data.get("edges", []))
        log(f"  {nc} nodes, {ec} edges", nc >= 7)

    # ── 4. Compliance Gate Check ─────────────────────
    section("4. Compliance Gate Check")
    for gate in ["jtksm", "vdr", "fomema", "plks"]:
        r = client.post(f"/compliance/check-gate/{gate}", json={
            "worker_id": TEST_WORKER_ID,
        })
        log(f"POST /compliance/check-gate/{gate}", r.status_code == 200)
        if r.status_code == 200:
            data = r.json()
            blockers = data.get("blockers", [])
            log(f"  ready={data.get('ready')}, blockers={blockers}", True)

    # ── 5. VDR Stage ─────────────────────────────────
    section("5. VDR Stage")
    r = client.post("/vdr/applications", json={
        "worker_id": TEST_WORKER_ID,
        "company_id": TEST_COMPANY_ID,
    })
    log("POST /vdr/applications", r.status_code == 200)
    if r.status_code == 200:
        TEST_VDR_ID = r.json().get("vdr_id")
        log(f"  vdr_id={TEST_VDR_ID}", TEST_VDR_ID is not None)

    if TEST_VDR_ID:
        r = client.get(f"/vdr/{TEST_VDR_ID}/checklist")
        log("GET /vdr/id/checklist", r.status_code == 200)

        r = client.get(f"/vdr/{TEST_VDR_ID}/status")
        log("GET /vdr/id/status", r.status_code == 200)

        r = client.post(f"/vdr/{TEST_VDR_ID}/verify-biomedical", json={
            "biomedical_ref_number": "BM-2026-SMOKE001",
            "passport_no": "BM-SMOKE-001",
        })
        log("POST /vdr/id/verify-biomedical", r.status_code == 200)

        r = client.post(f"/vdr/{TEST_VDR_ID}/generate-imm47")
        log("POST /vdr/id/generate-imm47", r.status_code in (200, 400))

        r = client.post(f"/vdr/{TEST_VDR_ID}/prepare-filing")
        log("POST /vdr/id/prepare-filing", r.status_code in (200, 400))

    # ── 6. PLKS Stage ────────────────────────────────
    section("6. PLKS Stage")
    r = client.post("/plks/applications", json={
        "worker_id": TEST_WORKER_ID,
        "vdr_id": TEST_VDR_ID,
    })
    log("POST /plks/applications", r.status_code == 200)
    if r.status_code == 200:
        TEST_PLKS_ID = r.json().get("plks_id")
        log(f"  plks_id={TEST_PLKS_ID}", TEST_PLKS_ID is not None)

    if TEST_PLKS_ID:
        r = client.post(f"/plks/{TEST_PLKS_ID}/verify-mdac", json={
            "worker_id": TEST_WORKER_ID,
            "arrival_date": "2026-04-15T10:00:00",
        })
        log("POST /plks/id/verify-mdac", r.status_code == 200)

        r = client.post(f"/plks/{TEST_PLKS_ID}/register-fomema", json={
            "clinic_code": "KK-PUTRAJAYA-01",
        })
        log("POST /plks/id/register-fomema", r.status_code == 200)

        r = client.patch(f"/plks/{TEST_PLKS_ID}/fomema-result", json={
            "result": "fit",
        })
        log("PATCH /plks/id/fomema-result", r.status_code == 200)
        if r.status_code == 200:
            data = r.json()
            log(f"  next_action={data.get('next_action')}", True)

        r = client.post(f"/plks/{TEST_PLKS_ID}/confirm-biometrics")
        log("POST /plks/id/confirm-biometrics", r.status_code == 200)

        r = client.get(f"/plks/{TEST_PLKS_ID}/status")
        log("GET /plks/id/status", r.status_code == 200)

    # ── 7. Medical ───────────────────────────────────
    section("7. Medical")
    r = client.post(f"/workers/{TEST_WORKER_ID}/verify-medical", json={
        "biomedical_ref_number": "BM-2026-SMOKE001",
    })
    log("POST /workers/id/verify-medical", r.status_code == 200)

    r = client.get(f"/workers/{TEST_WORKER_ID}/fomema-timeline")
    log("GET /workers/id/fomema-timeline", r.status_code == 200)

    # ── 8. Analytics ─────────────────────────────────
    section("8. Analytics")
    r = client.get("/analytics/levy-forecast")
    log("GET /analytics/levy-forecast", r.status_code == 200)

    r = client.get("/analytics/gate-bottlenecks")
    log("GET /analytics/gate-bottlenecks", r.status_code == 200)

    r = client.get("/analytics/repatriation-risk")
    log("GET /analytics/repatriation-risk", r.status_code == 200)

    # ── 9. OpenAPI ───────────────────────────────────
    section("9. Docs & OpenAPI")
    r = client.get("/openapi.json")
    log("GET /openapi.json", r.status_code == 200)
    if r.status_code == 200:
        paths = r.json().get("paths", {})
        log(f"  {len(paths)} API paths registered", len(paths) > 20)

    # ── Summary ──────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")
    passed = sum(1 for _, p, _ in results if p)
    failed = sum(1 for _, p, _ in results if not p)
    total = len(results)
    print(f"\n  Total: {total}  |  Passed: {passed}  |  Failed: {failed}")

    if failed > 0:
        print(f"\n  Failed tests:")
        for name, p, detail in results:
            if not p:
                print(f"    [XX] {name}  -- {detail}")
    else:
        print("\n  ALL TESTS PASSED!")

    print()
    return failed == 0


if __name__ == "__main__":
    print()
    print("=" * 48)
    print("  PermitIQ Backend Smoke Test")
    print("  Target: http://localhost:8000")
    print("=" * 48)

    success = run_all()
    sys.exit(0 if success else 1)
