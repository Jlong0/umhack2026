from datetime import datetime, timedelta


def call_glm(worker_data: dict):
    #MOCK, plug in glm later
    permit_expiry = worker_data.get("permit_expiry_date")
    passport_expiry = worker_data.get("passport_expiry_date")
    sector = worker_data.get("sector", "Manufacturing")
    permit_class = worker_data.get("permit_class", "PLKS")

    # mock dates for now
    today = datetime.today()
    fomema_due = (today + timedelta(days=14)).date().isoformat()
    permit_due = (today + timedelta(days=30)).date().isoformat()
    socso_due = today.date().isoformat()
    levy_due = (today + timedelta(days=21)).date().isoformat()

    obligations = [
        {
            "task_type": "FOMEMA",
            "task_name": "FOMEMA Health Screening",
            "status": "pending",
            "depends_on": [],
            "due_date": fomema_due,
            "authority": "FOMEMA / KKM",
            "estimated_cost": 190,
        },
        {
            "task_type": "PERMIT_RENEWAL",
            "task_name": "Work Permit Renewal",
            "status": "blocked",
            "depends_on": ["FOMEMA"],
            "due_date": permit_due,
            "authority": "JTK / Immigration",
            "estimated_cost": 60,
        },
        {
            "task_type": "SOCSO_REGISTRATION",
            "task_name": "SOCSO Registration",
            "status": "pending",
            "depends_on": [],
            "due_date": socso_due,
            "authority": "PERKESO",
            "estimated_cost": 0,
        },
        {
            "task_type": "LEVY_PAYMENT",
            "task_name": f"{sector} Foreign Worker Levy",
            "status": "blocked" if permit_class == "PLKS" else "pending",
            "depends_on": ["PERMIT_RENEWAL"] if permit_class == "PLKS" else [],
            "due_date": levy_due,
            "authority": "JTK / Treasury",
            "estimated_cost": 590 if sector.lower() == "manufacturing" else 0,
        },
        {
            "task_type": "PASSPORT_VALIDITY_CHECK",
            "task_name": "Passport Validity Check",
            "status": "pending",
            "depends_on": [],
            "due_date": permit_due,
            "authority": "Employer",
            "estimated_cost": 0,
        },
    ]

    return {"obligations": obligations}