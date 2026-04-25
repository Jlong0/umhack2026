DOCUMENT_FIELDS = {
    "passport": [
        {"key": "master_name",     "label": "Full Name (MRZ)"},
        {"key": "passport_number", "label": "Passport Number"},
        {"key": "expiry_date",     "label": "Expiry Date (YYMMDD)"},
        {"key": "dob",             "label": "Date of Birth (YYMMDD)"},
        {"key": "nationality",     "label": "Nationality"},
    ],
    "ssm_profile": [
        {"key": "company_name",       "label": "Company Name"},
        {"key": "roc_number",         "label": "ROC Number"},
        {"key": "nature_of_business", "label": "Nature of Business"},
    ],
    "act446_certificate": [
        {"key": "cert_number",   "label": "Certificate Number"},
        {"key": "max_capacity",  "label": "Max Capacity (beds)"},
    ],
    "epf_socso_statement": [
        {"key": "local_employee_count",   "label": "Local Employee Count"},
        {"key": "foreign_employee_count", "label": "Foreign Employee Count"},
    ],
    "biomedical_slip": [
        {"key": "reference_number", "label": "Reference Number (10–12 digits)"},
    ],
    "borang100": [
        {"key": "home_country_address", "label": "Home Country Address"},
        {"key": "parents_names",        "label": "Parents' Names"},
    ],
    "fomema_report": [
        {"key": "worker_name",     "label": "Worker Name"},
        {"key": "passport_number", "label": "Passport Number"},
        {"key": "result",          "label": "Result (Fit / Unfit)"},
        {"key": "exam_date",       "label": "Examination Date"},
    ],
}

STAGE_1_PHASES = {
    "gate_1_jtksm": {
        "label": "Gate 1 — JTKSM Approval",
        "fields": [
            {"key": "jtksm_60k_status",       "label": "Section 60K Approval Status",        "required": True},
            {"key": "act446_cert_number",      "label": "Act 446 Certificate No.",            "required": True},
            {"key": "act446_max_capacity",     "label": "Act 446 Licensed Capacity (beds)",   "required": True},
            {"key": "act446_expiry_date",      "label": "Act 446 Certificate Expiry",         "required": True},
            {"key": "myfuturejobs_proof_url",  "label": "MyFutureJobs Local Hiring Proof",    "required": True},
            {"key": "local_employee_count",    "label": "Local Employee Count",               "required": True},
            {"key": "foreign_employee_count",  "label": "Foreign Employee Count",             "required": True},
            {"key": "ssm_registration_valid",  "label": "SSM Registration Valid",             "required": True},
        ],
    },
    "gate_2_kdn": {
        "label": "Gate 2 — KDN Quota Allocation",
        "fields": [
            {"key": "quota_requested",  "label": "Quota Requested",                       "required": True},
            {"key": "quota_approved",   "label": "Quota Approved (One Stop Centre)",      "required": True},
            {"key": "quota_balance",    "label": "Remaining Quota Balance",               "required": True},
            {"key": "osc_approval_ref", "label": "One Stop Centre Approval Reference",    "required": True},
        ],
    },
    "gate_3_jim_vdr": {
        "label": "Gate 3 — JIM/VDR FWCMS Submission",
        "fields": [
            {"key": "master_name",               "label": "Worker Name (MRZ-derived)",              "required": True},
            {"key": "passport_number",           "label": "Passport Number",                        "required": True},
            {"key": "passport_expiry",           "label": "Passport Expiry (≥18 months)",           "required": True},
            {"key": "worker_dob",                "label": "Date of Birth (age ≤45)",                "required": True},
            {"key": "nationality",               "label": "Nationality",                            "required": True},
            {"key": "passport_scan_url",         "label": "Passport Scan",                          "required": True},
            {"key": "passport_photo_url",        "label": "Biometric Photo (35×50mm, white bg)",    "required": True},
            {"key": "photo_biometric_compliant", "label": "Photo Biometric Compliant",              "required": True},
            {"key": "biomedical_ref",            "label": "Bio-Medical Reference No. (10–12 digits)","required": True},
            {"key": "biomedical_status",         "label": "Bio-Medical Status",                     "required": True},
            {"key": "signed_contract_url",       "label": "Signed Employment Contract (M-stamped)", "required": True},
            {"key": "borang100_home_address",    "label": "Borang 100 — Home Country Address",      "required": True},
            {"key": "borang100_parents_names",   "label": "Borang 100 — Parents' Names",            "required": True},
        ],
    },
}

STAGE_2_PHASES = {
    "arrival_verification": {
        "label": "Arrival Verification",
        "fields": [
            {"key": "arrival_date",       "label": "Arrival Date",                          "required": True},
            {"key": "mdac_verified",      "label": "MDAC Verified",                         "required": True},
            {"key": "sev_stamp_verified", "label": "SEV Stamp Verified",                    "required": True},
            {"key": "boarding_pass_url",  "label": "Boarding Pass",                         "required": True},
            {"key": "fomema_deadline",    "label": "FOMEMA Deadline (Day 30 from arrival)", "required": True},
        ],
    },
    "fomema_registration": {
        "label": "FOMEMA Registration",
        "fields": [
            {"key": "fomema_clinic_code",       "label": "FOMEMA Clinic Code",       "required": True},
            {"key": "fomema_registration_date", "label": "FOMEMA Registration Date", "required": True},
        ],
    },
    "fomema_screening": {
        "label": "FOMEMA Screening",
        "fields": [
            {"key": "fomema_attended_date", "label": "Examination Date",               "required": True},
            {"key": "fomema_result",        "label": "Result (fit / unfit / pending)", "required": True},
            {"key": "fomema_result_date",   "label": "Result Date",                    "required": False},
        ],
    },
    "plks_issuance": {
        "label": "PLKS Issuance",
        "fields": [
            {"key": "biometric_date",  "label": "Biometrics Enrollment Date", "required": True},
            {"key": "ikad_number",     "label": "i-Kad Number",               "required": True},
            {"key": "plks_number",     "label": "PLKS Number",                "required": True},
            {"key": "plks_expiry_date","label": "PLKS Expiry Date",           "required": True},
        ],
    },
    "com_repatriation": {
        "label": "COM / Repatriation (FOMEMA Unfit only)",
        "fields": [
            {"key": "com_triggered",            "label": "COM Triggered",           "required": True},
            {"key": "com_request_letter_url",   "label": "COM Request Letter",      "required": True},
            {"key": "repatriation_flight_date", "label": "Repatriation Flight Date","required": False},
            {"key": "departure_confirmed",      "label": "Departure Confirmed",     "required": False},
        ],
    },
}
