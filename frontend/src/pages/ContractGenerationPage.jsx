import { useState, useRef } from "react";
import { FileText, Upload, Download, CheckCircle, Clock } from "lucide-react";
import { useContracts, useGenerateContracts, useUploadSigned } from "@/hooks/queries/useContractQueries";
import { getContractPdfUrl } from "@/services/api";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_VARIANT = {
  generated: "neutral",
  signed: "warning",
  reviewed: "success",
};

function UploadSignedButton({ contractId }) {
  const inputRef = useRef();
  const { mutate, isPending } = useUploadSigned(contractId);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => e.target.files[0] && mutate(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current.click()}
        disabled={isPending}
        className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload Signed"}
      </button>
    </>
  );
}

export default function ContractGenerationPage() {
  const [templateFile, setTemplateFile] = useState(null);
  const fileInputRef = useRef();
  const { data, isLoading } = useContracts();
  const generateMutation = useGenerateContracts();

  const contracts = data?.contracts || [];

  function handleGenerate() {
    if (!templateFile) return;
    generateMutation.mutate(templateFile, {
      onSuccess: () => setTemplateFile(null),
    });
  }

  async function handleDownload(contractId, workerName) {
    const { url } = await getContractPdfUrl(contractId);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract_${workerName}.pdf`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Generation"
        description="Upload a PDF template to generate employment contracts for all workers"
      />

      {/* Upload Template */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground mb-4">Upload Contract Template</h2>
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setTemplateFile(e.target.files[0] || null)}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border px-6 py-3 text-sm text-muted-foreground hover:border-indigo-400 hover:text-indigo-700 transition"
          >
            <Upload className="h-4 w-4" />
            {templateFile ? templateFile.name : "Choose PDF template"}
          </button>
          <Button
            onClick={handleGenerate}
            disabled={!templateFile || generateMutation.isPending}
          >
            <FileText className="h-4 w-4" />
            {generateMutation.isPending ? "Generating..." : "Generate All Contracts"}
          </Button>
        </div>
        {generateMutation.isSuccess && (
          <p className="mt-3 text-sm text-emerald-600">
            Contract generation started. Contracts will appear below shortly.
          </p>
        )}
      </div>

      {/* Contracts Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Generated Contracts</h2>
          <span className="text-xs text-muted-foreground">{contracts.length} total</span>
        </div>

        {isLoading ? (
          <div className="p-8"><PageSkeleton variant="table" /></div>
        ) : contracts.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title="No contracts yet"
              description="Upload a template to get started."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {contracts.map((c) => (
              <div key={c.contract_id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.worker_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge variant={STATUS_VARIANT[c.status] || "neutral"}>
                    {c.status}
                  </StatusBadge>
                  <button
                    onClick={() => handleDownload(c.contract_id, c.worker_name)}
                    className="text-xs text-muted-foreground hover:text-indigo-600 flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  {c.status === "generated" && <UploadSignedButton contractId={c.contract_id} />}
                  {c.status === "reviewed" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                  {c.status === "signed" && <Clock className="h-4 w-4 text-amber-500" title="Pending admin review" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
