import { findBlockingDependency, isStatusBlocked, statusLabel } from "@/services/taskAdapter";

function statusPillClass(status) {
	if (status === "completed") {
		return "bg-emerald-100 text-emerald-800";
	}

	if (status === "in_progress") {
		return "bg-indigo-100 text-indigo-800";
	}

	if (status === "awaiting_approval") {
		return "bg-amber-100 text-amber-800";
	}

	if (isStatusBlocked(status)) {
		return "bg-rose-100 text-rose-800";
	}

	return "bg-slate-100 text-slate-700";
}

export default function TaskList({ tasks }) {
	return (
		<div className="permit-surface overflow-x-auto">
			<table className="min-w-full divide-y divide-slate-200 text-left">
				<thead>
					<tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
						<th className="px-4 py-3 font-semibold">Task</th>
						<th className="px-4 py-3 font-semibold">Status</th>
						<th className="px-4 py-3 font-semibold">Blocked By</th>
						<th className="px-4 py-3 font-semibold">Due Date</th>
						<th className="px-4 py-3 font-semibold">Authority</th>
					</tr>
				</thead>

				<tbody className="divide-y divide-slate-100 text-sm text-slate-700">
					{tasks.map((task) => {
						const blockedBy = findBlockingDependency(task, tasks);

						return (
							<tr key={task.id} className={isStatusBlocked(task.status) ? "bg-rose-50/55" : "bg-white"}>
								<td className="px-4 py-3 align-top">
									<p className="font-medium text-slate-900">{task.taskName}</p>
									<p className="text-xs text-slate-500">{task.taskType}</p>
								</td>
								<td className="px-4 py-3 align-top">
									<span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusPillClass(task.status)}`}>
										{statusLabel(task.status)}
									</span>
								</td>
								<td className="px-4 py-3 align-top text-xs text-slate-600">
									{blockedBy ? <span className="font-medium text-rose-700">Fails on: {blockedBy}</span> : "-"}
								</td>
								<td className="px-4 py-3 align-top text-xs text-slate-600">{task.dueDate || "-"}</td>
								<td className="px-4 py-3 align-top text-xs text-slate-600">{task.authority || "-"}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

