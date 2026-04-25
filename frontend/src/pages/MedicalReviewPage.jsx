import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useSetMedicalResult } from "@/hooks/queries/useHITLQueries";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";

// Mock medical result — in production this would come from FOMEMA/clinic API
const MOCK_RESULT = "approve";

export default function MedicalReviewPage() {
	const { workerId } = useParams();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const workerName = searchParams.get("name") || workerId;
	const [confirmed, setConfirmed] = useState(false);

	const mutation = useSetMedicalResult(workerId);

	function handleConfirm() {
		mutation.mutate(MOCK_RESULT, {
			onSuccess: () => {
				setConfirmed(true);
				setTimeout(() => navigate("/hitl"), 1200);
			},
		});
	}

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
			<div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 space-y-6">
				<button onClick={() => navigate("/hitl")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
					<ArrowLeft className="w-4 h-4" /> Back
				</button>

				<div>
					<h1 className="text-xl font-bold text-gray-900">Medical Review</h1>
					<p className="text-sm text-gray-500 mt-1">{workerName}</p>
				</div>

				<div className="rounded-xl border border-gray-200 overflow-hidden">
					<div className="bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
						FOMEMA / Medical Checkup Form
					</div>
					<img
						src="https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg"
						alt="Medical form"
						className="w-full object-contain max-h-56"
					/>
				</div>

				<div className={`rounded-xl p-4 flex items-center gap-3 ${MOCK_RESULT === "approve" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
					{MOCK_RESULT === "approve"
						? <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
						: <XCircle className="w-6 h-6 text-red-600 shrink-0" />
					}
					<div>
						<p className={`font-semibold ${MOCK_RESULT === "approve" ? "text-green-800" : "text-red-800"}`}>
							Result: {MOCK_RESULT === "approve" ? "Approved" : "Rejected"}
						</p>
						<p className="text-xs text-gray-500 mt-0.5">
							{MOCK_RESULT === "approve" ? "Worker is medically fit." : "Worker did not pass medical screening."}
						</p>
					</div>
				</div>

				{confirmed ? (
					<p className="text-center text-sm text-green-600 font-medium">Confirmed. Redirecting...</p>
				) : (
					<button
						onClick={handleConfirm}
						disabled={mutation.isPending}
						className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
					>
						Confirm & Return
					</button>
				)}
			</div>
		</div>
	);
}
