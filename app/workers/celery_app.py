from __future__ import annotations

import os
from celery import Celery


broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
result_backend = os.getenv("CELERY_RESULT_BACKEND", broker_url)

celery = Celery(
    "permitiq_workers",
    broker=broker_url,
    backend=result_backend,
    include=["app.workers.tasks"],
)

celery.conf.update(
    timezone="Asia/Kuala_Lumpur",
    enable_utc=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    beat_schedule={
        "monitor-fomema-deadline-daily": {
            "task": "app.workers.tasks.monitor_fomema_deadline_all",
            "schedule": 60 * 60 * 24,
        },
        "sweep-june-deadline-risk-monthly": {
            "task": "app.workers.tasks.sweep_june_deadline_risk",
            "schedule": 60 * 60 * 24 * 30,
        },
    },
)
