"""
Enhanced document triage and parsing pipeline with L0/L1/L2 routing.
"""
from typing import Dict
from datetime import datetime
import base64
from app.services.glm_service import glm_service
from app.firebase_config import bucket


class DocumentTriageService:
    """
    Multi-level document triage system:
    - L0: Digital documents (MyEG ePASS) - direct JSON parsing
    - L1: Clean scans - Standard OCR (Tesseract)
    - L2: Complex documents - GLM-4V multimodal processing
    """

    def __init__(self):
        self.glm = glm_service

    async def triage_and_parse(
        self,
        document_id: str,
        storage_path: str,
        document_type: str,
        content_type: str
    ) -> Dict:
        """
        Triage document and route to appropriate parsing method.
        """
        # Determine triage level
        triage_level = self._determine_triage_level(document_type, content_type)

        if triage_level == "L0":
            return await self._parse_digital_document(document_id, storage_path)
        elif triage_level == "L1":
            return await self._parse_with_ocr(document_id, storage_path, document_type)
        else:  # L2
            return await self._parse_with_glm4v(document_id, storage_path, document_type)

    def _determine_triage_level(self, document_type: str, content_type: str) -> str:
        """
        Determine which triage level to use based on document characteristics.
        """
        # L0: Digital documents
        if content_type == "application/json" or document_type == "myeg_epass":
            return "L0"

        # L1: Clean PDFs and high-quality scans
        if content_type == "application/pdf" and document_type in ["permit", "certificate"]:
            return "L1"

        # L2: Everything else (handwritten, multi-language, complex layouts)
        return "L2"

    async def _parse_digital_document(self, document_id: str, storage_path: str) -> Dict:
        """
        L0: Parse digital documents (JSON format).
        """
        try:
            blob = bucket.blob(storage_path)
            content = blob.download_as_text()

            import json
            data = json.loads(content)

            return {
                "success": True,
                "triage_level": "L0",
                "method": "digital_parse",
                "extracted_data": data,
                "confidence": 1.0,
                "cost_rm": 0,  # No API cost
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "success": False,
                "triage_level": "L0",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def _parse_with_ocr(
        self,
        document_id: str,
        storage_path: str,
        document_type: str
    ) -> Dict:
        """
        L1: Parse with standard OCR (Tesseract).
        Falls back to L2 if confidence is low.
        """
        try:
            # Download image
            blob = bucket.blob(storage_path)
            image_bytes = blob.download_as_bytes()

            # OCR processing (placeholder - would use pytesseract)
            # For now, route to GLM-4V
            return await self._parse_with_glm4v(document_id, storage_path, document_type)

        except Exception as e:
            return {
                "success": False,
                "triage_level": "L1",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def _parse_with_glm4v(
        self,
        document_id: str,
        storage_path: str,
        document_type: str
    ) -> Dict:
        """
        L2: Parse with GLM-4V multimodal model.
        Handles complex documents, handwriting, multiple languages.
        """
        try:
            # Get signed URL for GLM-4V
            blob = bucket.blob(storage_path)

            # Download and convert to base64 for GLM-4V
            image_bytes = blob.download_as_bytes()
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            image_url = f"data:image/jpeg;base64,{base64_image}"

            # Call GLM-4V
            result = self.glm.parse_document_with_glm4v(
                image_url=image_url,
                document_type=document_type
            )

            if result["success"]:
                return {
                    "success": True,
                    "triage_level": "L2",
                    "method": "glm4v",
                    "extracted_data": result["extracted_data"],
                    "confidence": result["confidence"],
                    "cost_rm": 0.05,  # Estimated GLM-4V cost
                    "model": result["model"],
                    "timestamp": result["timestamp"]
                }
            else:
                return {
                    "success": False,
                    "triage_level": "L2",
                    "error": result.get("error"),
                    "timestamp": datetime.now().isoformat()
                }

        except Exception as e:
            return {
                "success": False,
                "triage_level": "L2",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }


# Global service instance
document_triage_service = DocumentTriageService()
