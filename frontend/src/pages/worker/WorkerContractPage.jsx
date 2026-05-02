import { useRef, useState } from "react";
import { FileText, Download, Upload, CheckCircle, Clock } from "lucide-react";
import { useContracts, useUploadSigned } from "@/hooks/queries/useContractQueries";
import { getContractPdfUrl } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_LABEL = {
  generated: { label: "Awaiting your signature", color: "text-amber-600 bg-amber-50" },
  signed: { label: "Submitted — pending review", color: "text-blue-600 bg-blue-50" },
  reviewed: { label: "Approved", color: "text-emerald-600 bg-emerald-50" },
};

function ContractRow({ contract }) {
  const inputRef = useRef();
  const uploadMutation = useUploadSigned(contract.contract_id);
  const [downloading, setDownloading] = useState(false);
  const s = STATUS_LABEL[contract.status] || STATUS_LABEL.generated;

  async function handleDownload() {
    setDownloading(true);
    try {
      const { url } = await getContractPdfUrl(contract.contract_id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract_${contract.worker_name}.pdf`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">{contract.worker_name}</p>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
            {s.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50 transition"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? "..." : "Download"}
        </button>

        {contract.status === "generated" && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files[0] && uploadMutation.mutate(e.target.files[0])}
            />
            <button
              onClick={() => inputRef.current.click()}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? "Uploading..." : "Submit Signed"}
            </button>
          </>
        )}

        {contract.status === "signed" && <Clock className="h-4 w-4 text-blue-400" />}
        {contract.status === "reviewed" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
      </div>
    </div>
  );
}

export default function WorkerContractPage() {
  const user = useAuthStore((s) => s.user);
  const workerId = user?.id;
  const workerName = user?.name;
  const { data, isLoading } = useContracts(null, workerId);
  const contracts = data?.contracts || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Contracts</h1>
        {workerName && <p className="text-sm text-muted-foreground mt-0.5">Viewing as: {workerName}</p>}
        <p className="text-sm text-muted-foreground mt-1">
          Download your employment contract, sign it, then upload the signed copy.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No contracts available yet"
          description="Your employer will generate your employment contract once your application is processed."
        />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => <ContractRow key={c.contract_id} contract={c} />)}
        </div>
      )}
    </div>
  );
}
