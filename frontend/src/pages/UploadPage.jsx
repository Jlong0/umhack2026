import { useState, useEffect } from "react";

function UploadPage() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [formData, setFormData] = useState({});

  // 🚀 Step 3 — Polling logic
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      const res = await fetch(
        `http://127.0.0.1:8000/documents/jobs/${jobId}`
      );
      const data = await res.json();

      console.log("Polling:", data);

      if (data.status === "completed") {
        clearInterval(interval);
        setParsedData(data.result.fields);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  // 🚀 Step 2 — Upload
  const handleUpload = async () => {
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("document_type", "passport");

    const res = await fetch("http://127.0.0.1:8000/documents/upload", {
      method: "POST",
      body: formDataUpload,
    });

    const data = await res.json();
    console.log("Upload:", data);

    setJobId(data.job_id);
    setDocumentId(data.document_id);
  };

  // 🚀 Step 5 — Initialize form
  useEffect(() => {
    if (parsedData) {
      const initial = {};
      for (const key in parsedData) {
        initial[key] = parsedData[key].value;
      }
      setFormData(initial);
    }
  }, [parsedData]);

  // 🚀 Step 6 — Confirm
  const handleConfirm = async () => {
    const res = await fetch(
      `http://127.0.0.1:8000/documents/${documentId}/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }
    );

    const data = await res.json();
    console.log("Worker created:", data);
  };

  return (
    <div>
      <h2>Upload Document</h2>

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload</button>

      {jobId && <p>Job ID: {jobId}</p>}

      {/* 🚀 Step 4 — Show parsed data */}
      {parsedData && (
        <div>
          <h3>Parsed Data</h3>
          {Object.entries(parsedData).map(([key, value]) => (
            <div key={key}>
              {key}: {value.value} (confidence: {value.confidence})
            </div>
          ))}
        </div>
      )}

      {/* 🚀 Step 5 — Editable form */}
      {formData &&
        Object.keys(formData).map((key) => (
          <div key={key}>
            <label>{key}</label>
            <input
              value={formData[key]}
              onChange={(e) =>
                setFormData({ ...formData, [key]: e.target.value })
              }
            />
          </div>
        ))}

      {/* 🚀 Step 6 — Confirm */}
      {parsedData && (
        <button onClick={handleConfirm}>Confirm</button>
      )}
    </div>
  );
}

export default UploadPage;