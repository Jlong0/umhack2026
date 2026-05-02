import { findBlockingDependency, isStatusBlocked, statusLabel } from "@/services/taskAdapter";

function statusPillClass(status) {
	if (status === "completed") {
		return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
	}

	if (status === "in_progress") {
		return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
	}

	if (status === "awaiting_approval") {
		return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
	}

	if (isStatusBlocked(status)) {
		return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
	}

	return "bg-muted text-muted-foreground";
}

export default function TaskList({ tasks }) {
	return (
		<div className="permit-surface overflow-x-auto">
			<table className="min-w-full divide-y divide-border text-left">
				<thead>
					<tr className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
						<th className="px-4 py-3 font-semibold">Task</th>
						<th className="px-4 py-3 font-semibold">Status</th>
						<th className="px-4 py-3 font-semibold">Blocked By</th>
						<th className="px-4 py-3 font-semibold">Due Date</th>
						<th className="px-4 py-3 font-semibold">Authority</th>
					</tr>
				</thead>

				<tbody className="divide-y divide-border text-sm text-foreground">
					{tasks.map((task) => {
						const blockedBy = findBlockingDependency(task, tasks);

						return (
							<tr key={task.id} className={isStatusBlocked(task.status) ? "bg-rose-50/55 dark:bg-rose-950/30" : "bg-card"}>
								<td className="px-4 py-3 align-top">
									<p className="font-medium text-foreground">{task.taskName}</p>
									<p className="text-xs text-muted-foreground">{task.taskType}</p>
								</td>
								<td className="px-4 py-3 align-top">
									<span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusPillClass(task.status)}`}>
										{statusLabel(task.status)}
									</span>
								</td>
								<td className="px-4 py-3 align-top text-xs text-muted-foreground">
									{blockedBy ? <span className="font-medium text-rose-700 dark:text-rose-400">Fails on: {blockedBy}</span> : "-"}
								</td>
								<td className="px-4 py-3 align-top text-xs text-muted-foreground">{task.dueDate || "-"}</td>
								<td className="px-4 py-3 align-top text-xs text-muted-foreground">{task.authority || "-"}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
