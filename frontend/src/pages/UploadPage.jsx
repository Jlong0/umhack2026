import { useState, useEffect } from "react";

const API_BASE = "http://127.0.0.1:8000";

function UploadPage() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [formData, setFormData] = useState({});

  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);

  // Poll parsing job
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/documents/jobs/${jobId}`);
        if (!res.ok) {
          throw new Error(`Polling failed with status ${res.status}`);
        }

        const data = await res.json();
        console.log("Polling:", data);

        if (data.status === "completed") {
          clearInterval(interval);
          setParsedData(data.result.fields);
        }

        if (data.status === "failed") {
          clearInterval(interval);
          setError("Document parsing failed.");
        }
      } catch (err) {
        clearInterval(interval);
        setError(err.message || "Polling failed.");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  // Initialize editable form from parsed data
  useEffect(() => {
    if (!parsedData) return;

    const initial = {};
    for (const key in parsedData) {
      initial[key] = parsedData[key]?.value ?? "";
    }
    setFormData(initial);
  }, [parsedData]);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setError("");
    setConfirmResult(null);
    setParsedData(null);
    setFormData({});
    setJobId(null);
    setDocumentId(null);
    setLoadingUpload(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("document_type", "passport");

      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: formDataUpload,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("Upload:", data);

      setJobId(data.job_id);
      setDocumentId(data.document_id);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setLoadingUpload(false);
    }
  };

  const cleanedPayload = Object.fromEntries(
    Object.entries(formData).map(([key, value]) => [
      key,
      value === "" ? null : value
    ])
  );

  const handleConfirm = async () => {
    if (!documentId) {
      setError("Missing document ID.");
      return;
    }

    setError("");
    setLoadingConfirm(true);
    setConfirmResult(null);

    try {
      console.log(cleanedPayload);
      const res = await fetch(`${API_BASE}/documents/${documentId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanedPayload),
      });

      const data = await res.json();
      console.log("Confirm result:", data);

      if (!res.ok) {
        throw new Error(data.detail || `Confirm failed with status ${res.status}`);
      }

      setConfirmResult(data);
    } catch (err) {
      setError(err.message || "Confirm failed.");
    } finally {
      setLoadingConfirm(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "700px" }}>
      <h2>Upload Document</h2>

      {error && (
        <div style={{ marginBottom: "16px", color: "red" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={loadingUpload}>
        {loadingUpload ? "Uploading..." : "Upload"}
      </button>

      {jobId && <p>Job ID: {jobId}</p>}
      {documentId && <p>Document ID: {documentId}</p>}

      {parsedData && (
        <div style={{ marginTop: "20px" }}>
          <h3>Parsed Data</h3>
          {Object.entries(parsedData).map(([key, value]) => (
            <div key={key}>
              {key}: {value?.value ?? ""} (confidence: {value?.confidence ?? "N/A"})
            </div>
          ))}
        </div>
      )}

      {Object.keys(formData).length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>Edit Extracted Fields</h3>
          {Object.keys(formData).map((key) => (
            <div key={key} style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>{key}</label>
              <input
                style={{ width: "100%", padding: "8px" }}
                value={formData[key]}
                onChange={(e) =>
                  setFormData({ ...formData, [key]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
      )}

      {parsedData && (
        <button onClick={handleConfirm} disabled={loadingConfirm}>
          {loadingConfirm ? "Confirming..." : "Confirm"}
        </button>
      )}

      {confirmResult && (
        <div style={{ marginTop: "24px", padding: "16px", border: "1px solid #ccc" }}>
          <h3>Confirmation Result</h3>

          {confirmResult.status === "completed" && (
            <>
              <p style={{ color: "green" }}>
                <strong>Worker profile created successfully.</strong>
              </p>
              <p>Worker ID: {confirmResult.worker_id}</p>
              <p>Obligations created: {confirmResult.obligations_created}</p>
            </>
          )}

          {confirmResult.status === "incomplete" && (
            <>
              <p style={{ color: "orange" }}>
                <strong>More information is required before worker creation.</strong>
              </p>
              <p>{confirmResult.message}</p>

              {confirmResult.missing_fields?.length > 0 && (
                <div>
                  <p>Missing fields:</p>
                  <ul>
                    {confirmResult.missing_fields.map((field, index) => (
                      <li key={index}>
                        {typeof field === "string" ? field : field.label || field.field}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!confirmResult.status && (
            <>
              <p><strong>Response received:</strong></p>
              <pre>{JSON.stringify(confirmResult, null, 2)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPage;