import os
import json
import base64
from datetime import datetime
from typing import Dict, Optional

from dotenv import load_dotenv
load_dotenv()

import google.genai as genai
from google.genai import types

VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
REASONING_MODEL = os.getenv("GEMINI_REASONING_MODEL", "gemini-2.5-flash")

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

DOCUMENT_PROMPTS = {
    "passport": (
        "You are a document extraction agent for Malaysian PLKS immigration compliance.\n"
        "Document type: passport\n"
        "MRZ line 1: P<COUNTRY SURNAME<<GIVEN_NAMES\n"
        "MRZ line 2: PASSPORT_NUMBER(1-9) CHECK NATIONALITY(11-13) DOB_YYMMDD(14-19) CHECK SEX(21) EXPIRY_YYMMDD(22-27) CHECK ...\n"
        "Extract:\n"
        "- master_name: from MRZ line 1 only. Replace all '<' with spaces, collapse double spaces. Format: SURNAME GIVEN_NAMES\n"
        "- passport_number: MRZ line 2 chars 1-9\n"
        "- nationality: MRZ line 2 chars 11-13 (3-letter country code)\n"
        "- dob: MRZ line 2 chars 14-19 (YYMMDD)\n"
        "- expiry_date: MRZ line 2 chars 22-27 (YYMMDD)\n"
        "master_name MUST come from MRZ line 1, never the visual name field.\n"
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }'
    ),
    "ssm_profile": (
        "You are a document extraction agent for Malaysian PLKS immigration compliance.\n"
        "Document type: ssm_profile\n"
        "Extract: company_name, roc_number, nature_of_business.\n"
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }'
    ),
    "act446_certificate": (
        "You are a document extraction agent for Malaysian PLKS immigration compliance.\n"
        "Document type: act446_certificate\n"
        "Extract: cert_number, max_capacity (integer number of beds).\n"
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }'
    ),
    "epf_socso_statement": (
        "You are a document extraction agent for Malaysian PLKS immigration compliance.\n"
        "Document type: epf_socso_statement\n"
        "Extract: local_employee_count (integer), foreign_employee_count (integer).\n"
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }'
    ),
    "biomedical_slip": (
        "You are a document extraction agent for Malaysian PLKS immigration compliance.\n"
        "Document type: biomedical_slip\n"
        "Extract: reference_number (10-12 digit string).\n"
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }'
    ),
    "borang100": (
        "You are a document extraction agent for Malaysian PLKS immigration compliance.\n"
        "Document type: borang100\n"
        "Extract: home_country_address, parents_names (list of two strings).\n"
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }'
    ),
    "fomema_report": (
        "You are a document extraction agent for Malaysian PLKS immigration compliance.\n"
        "Document type: fomema_report\n"
        'Extract: worker_name, passport_number, result ("Fit" or "Unfit"), exam_date.\n'
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }'
    ),
}


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        if "```json" in text:
            return json.loads(text.split("```json")[1].split("```")[0].strip())
        if "```" in text:
            return json.loads(text.split("```")[1].split("```")[0].strip())
        return {"raw_text": text}


def parse_document(image_url: str, document_type: str, prompt_override: Optional[str] = None, mime_type: str = "image/jpeg") -> Dict:
    prompt = prompt_override or DOCUMENT_PROMPTS.get(
        document_type,
        f"Extract all relevant fields from this {document_type} document. "
        'Return JSON: { "<field>": { "value": <val>, "confidence": 0.0-1.0 } }',
    )
    try:
        if image_url.startswith("data:"):
            image_data = base64.b64decode(image_url.split(",", 1)[1])
        elif image_url.startswith("http"):
            import httpx
            image_data = httpx.get(image_url).content
        else:
            with open(image_url, "rb") as f:
                image_data = f.read()

        part = types.Part.from_bytes(data=image_data, mime_type=mime_type)
        response = _client.models.generate_content(model=VISION_MODEL, contents=[prompt, part])
        return {
            "success": True,
            "document_type": document_type,
            "extracted_data": _parse_json(response.text),
            "model": VISION_MODEL,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "document_type": document_type}


def generate_text(prompt: str, system_prompt: Optional[str] = None) -> Dict:
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    try:
        response = _client.models.generate_content(
            model=REASONING_MODEL,
            contents=full_prompt,
            config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=2000),
        )
        return {"success": True, "text": response.text, "model": REASONING_MODEL,
                "timestamp": datetime.now().isoformat()}
    except Exception as e:
        return {"success": False, "error": str(e)}
