from app.firebase_config import db


def create_task(worker_id: str, task_data: dict):
    doc_ref = db.collection("workers").document(worker_id).collection("tasks").add(task_data)
    return doc_ref[1].id


def list_tasks(worker_id: str):
    docs = db.collection("workers").document(worker_id).collection("tasks").stream()
    tasks = []

    for doc in docs:
        task = doc.to_dict()
        task["id"] = doc.id
        tasks.append(task)

    return tasks


def update_task_status(worker_id: str, task_id: str, status: str):
    task_ref = db.collection("workers").document(worker_id).collection("tasks").document(task_id)

    task_doc = task_ref.get()
    if not task_doc.exists:
        raise ValueError("Task not found")

    task_data = task_doc.to_dict()
    depends_on = task_data.get("depends_on", [])

    if status in ["in_progress", "completed"]:
        if not dependencies_completed(worker_id, depends_on):
            raise ValueError("Dependencies not completed")

    task_ref.update({"status": status})

    if status == "failed":
        block_dependent_tasks(worker_id, task_data["task_type"], True)


# def create_default_tasks(worker_id: str):
#     default_tasks = [
#         {"task_type": "FOMEMA", "status": "pending", "depends_on": []},
#         {"task_type": "PERMIT_RENEWAL", "status": "pending", "depends_on": ["FOMEMA"]},
#         {"task_type": "SOCSO_REGISTRATION", "status": "pending", "depends_on": []},
#         {"task_type": "LEVY_PAYMENT", "status": "pending", "depends_on": ["PERMIT_RENEWAL"]}
#     ]
#
#     tasks_ref = db.collection("workers").document(worker_id).collection("tasks")
#     for task in default_tasks:
#         tasks_ref.add(task)


def create_tasks_from_obligations(worker_id: str, obligations: list[dict]):
    tasks_ref = db.collection("workers").document(worker_id).collection("tasks")

    for obligation in obligations:
        tasks_ref.add(obligation)


def get_task_by_type(worker_id: str, task_type: str):
    docs = db.collection("workers").document(worker_id).collection("tasks").where("task_type", "==", task_type).stream()

    for doc in docs:
        task = doc.to_dict()
        task["id"] = doc.id
        return task

    return None


def dependencies_completed(worker_id: str, depends_on: list[str]) -> bool:
    for dependency_type in depends_on:
        dependency_task = get_task_by_type(worker_id, dependency_type)

        if not dependency_task:
            return False

        if dependency_task.get("status") != "completed":
            return False

    return True


def block_dependent_tasks(worker_id: str, completed_task_type: str, failed: bool = False):
    tasks_ref = db.collection("workers").document(worker_id).collection("tasks").stream()

    for doc in tasks_ref:
        task_data = doc.to_dict()
        depends_on = task_data.get("depends_on", [])

        if completed_task_type in depends_on:
            if failed:
                doc.reference.update({"status": "blocked"})