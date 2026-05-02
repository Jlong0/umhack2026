def can_complete_workflow(state: dict) -> bool:
    return (
        state.get("workflow_stage") == "ready_to_complete"
        and not state.get("deadlock_detected")
        and not state.get("hitl_required")
        and not state.get("error_state")
    )
