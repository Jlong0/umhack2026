from typing import Dict
from datetime import datetime
import base64
from app.services.gemini_service import parse_document
from app.firebase_config import bucket


class DocumentTriageService:
    async def triage_and_parse(self, document_id: str, storage_path: str,
                                document_type: str, content_type: str) -> Dict:
        triage_level = self._determine_triage_level(document_type, content_type)
        if triage_level == "L0":
            return await self._parse_digital_document(document_id, storage_path)
        return await self._parse_with_gemini(document_id, storage_path, document_type, triage_level, content_type)

    def _determine_triage_level(self, document_type: str, content_type: str) -> str:
        if content_type == "application/json" or document_type == "myeg_epass":
            return "L0"
        return "L2"

    async def _parse_digital_document(self, document_id: str, storage_path: str) -> Dict:
        try:
            import json
            content = bucket.blob(storage_path).download_as_text()
            return {"success": True, "triage_level": "L0", "method": "digital_parse",
                    "extracted_data": json.loads(content), "confidence": 1.0, "cost_rm": 0,
                    "timestamp": datetime.now().isoformat()}
        except Exception as e:
            return {"success": False, "triage_level": "L0", "error": str(e),
                    "timestamp": datetime.now().isoformat()}

    async def _parse_with_gemini(self, document_id: str, storage_path: str,
                                  document_type: str, triage_level: str, content_type: str = "image/jpeg") -> Dict:
        try:
            image_bytes = bucket.blob(storage_path).download_as_bytes()
            mime = content_type if content_type in ("image/jpeg", "image/png", "application/pdf") else "image/jpeg"
            image_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode()}"
            result = parse_document(image_url, document_type, mime_type=mime)
            if result["success"]:
                return {"success": True, "triage_level": triage_level, "method": "gemini",
                        "extracted_data": result["extracted_data"], "confidence": 0.85,
                        "cost_rm": 0.05, "model": result.get("model"),
                        "timestamp": result["timestamp"]}
            return {"success": False, "triage_level": triage_level,
                    "error": result.get("error"), "timestamp": datetime.now().isoformat()}
        except Exception as e:
            return {"success": False, "triage_level": triage_level, "error": str(e),
                    "timestamp": datetime.now().isoformat()}


document_triage_service = DocumentTriageService()
