import os
import json
import base64
from datetime import datetime
from typing import Dict, Optional

from dotenv import load_dotenv
load_dotenv()

from google.genai import types

from app.services.gemini_client import get_client, call_with_rotation

VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
REASONING_MODEL = os.getenv("GEMINI_REASONING_MODEL", "gemini-2.5-flash")

DOCUMENT_PROMPTS = {
    "passport": """
Analyze this passport document and extract the following information in JSON format:
- passport_number
- full_name
- nationality
- sex
- date_of_birth
- issue_date
- expiry_date
- issuing_country

Check if the passport has less than 12 months validity remaining.
If yes, flag it as "renewal_required": true.

any date should be in this format (YYYY-MM-DD)

Return only valid JSON.
""",
    "fomema_report": """
Analyze this FOMEMA medical report and extract:
- worker_name
- passport_number
- examination_date
- medical_status (Suitable/Unsuitable)
- conditions_detected (list of medical conditions)
- clinic_name
- doctor_name

If status is "Unsuitable", identify if the condition is:
- Category 1 (Communicable - TB, HIV, Hepatitis B, Malaria)
- Category 2 (NCD - Diabetes, Hypertension)
- Category 3 (Other - Psychiatric, Pregnancy)

Return only valid JSON.
""",
    "permit": """
Analyze this work permit (PLKS/EP) and extract:
- permit_number
- worker_name
- passport_number
- permit_class (PLKS, EP Category I/II/III)
- sector
- employer_name
- issue_date
- expiry_date
- salary_rm (if Employment Pass)

Calculate days until expiry from today's date.

Return only valid JSON.
""",
    "tenancy_agreement": """
Analyze this tenancy agreement for Act 446 housing compliance:
- property_address
- landlord_name
- tenant_name (employer)
- lease_start_date
- lease_end_date
- monthly_rent_rm
- number_of_rooms
- estimated_bed_capacity

Return only valid JSON.
""",
    "ssm_profile": """
Analyze this SSM company profile document and extract:
- company_name
- roc_number
- nature_of_business

Return only valid JSON.
""",
    "act446_certificate": """
Analyze this Act 446 certificate and extract:
- cert_number
- max_capacity (integer number of beds)

Return only valid JSON.
""",
    "epf_socso_statement": """
Analyze this EPF/SOCSO statement and extract:
- local_employee_count (integer)
- foreign_employee_count (integer)

Return only valid JSON.
""",
    "biomedical_slip": """
Analyze this biomedical slip and extract:
- reference_number (10-12 digit string)

Return only valid JSON.
""",
    "borang100": """
Analyze this Borang 100 document and extract:
- home_country_address
- parents_names (list of two strings)

Return only valid JSON.
""",
}

LETTER_PROMPTS = {
    "quota_application": lambda worker_data, context: f"""
You are an expert in Malaysian foreign worker compliance regulations and formal government correspondence.

Draft a justification letter to the Ministry of Home Affairs (KDN) for a foreign worker quota application.

Worker Details:
- Nationality: {worker_data.get('nationality')}
- Sector: {worker_data.get('sector')}
- Position: {worker_data.get('position', 'General Worker')}

Context:
- Company has advertised on MYFutureJobs for {context.get('myfuturejobs_days', 30)} days
- Number of local applicants: {context.get('local_applicants', 0)}
- Reason for rejection of local candidates: {context.get('rejection_reason', 'Insufficient experience')}

Draft a formal, detailed justification letter explaining:
1. Why the company needs this foreign worker
2. Evidence of local hiring attempts
3. Specific skills or experience required
4. How this aligns with 13MP automation goals

Use formal Malaysian government correspondence style.
""",
    "fomema_appeal": lambda worker_data, context: f"""
You are an expert in Malaysian foreign worker compliance regulations and formal government correspondence.

Draft a FOMEMA medical appeal letter.

Worker Details:
- Name: {worker_data.get('full_name')}
- Passport: {worker_data.get('passport_number')}
- Medical Condition: {context.get('medical_condition')}

The worker was flagged as "Unsuitable" for: {context.get('medical_condition')}
This is a Category 2 NCD (Non-Communicable Disease) eligible for monitoring.

Draft a formal appeal letter to FOMEMA requesting enrollment in the NCD Monitoring Programme. Include:
1. Acknowledgment of the medical finding
2. Request for 6-month monitoring period
3. Commitment to employer-funded treatment
4. Reference to WellXS app tracking

Use formal medical appeal language.
""",
    "special_pass": lambda worker_data, context: f"""
You are an expert in Malaysian foreign worker compliance regulations and formal government correspondence.

Draft a Special Pass application to Immigration (JIM).

Worker Details:
- Name: {worker_data.get('full_name')}
- Passport: {worker_data.get('passport_number')}
- Current Permit Expiry: {worker_data.get('permit_expiry_date')}

Reason for Special Pass:
{context.get('reason', 'FOMEMA appeal pending while permit expires')}

Draft a formal letter requesting a Special Pass to bridge the compliance gap.
Explain the administrative deadlock and proposed resolution timeline.
""",
    "com_request_letter": lambda worker_data, context: f"""
You are an expert in Malaysian foreign worker compliance regulations and formal government correspondence.

Draft a formal cover letter from an employer to the Malaysian Immigration Department (Jabatan Imigresen Malaysia / JIM)
requesting the issuance of a Check Out Memo (COM) for a foreign worker declared medically unfit.

Company / Employer:
- Company Name: {context.get('employer_name', 'N/A')}
- Company Registration: {context.get('company_registration', 'N/A')}

Worker Details:
- Full Name: {worker_data.get('full_name', 'N/A')}
- Passport Number: {worker_data.get('passport_number', 'N/A')}
- Nationality: {worker_data.get('nationality', 'N/A')}
- Sector: {worker_data.get('sector', 'N/A')}

Reason for Repatriation:
- The worker has undergone mandatory FOMEMA examination and been declared UNFIT (Tidak Layak).
- FOMEMA Result Date: {context.get('fomema_result_date', 'N/A')}
- Medical Condition Category: {context.get('condition_category', 'Category 1 — Communicable Disease')}

Draft a formal letter that:
1. Is addressed to "Pengarah, Jabatan Imigresen Malaysia"
2. States the company is notifying JIM of the FOMEMA UNFIT result
3. Formally requests issuance of a Check Out Memo (COM) for lawful repatriation
4. Confirms the employer will bear repatriation costs
5. Requests cancellation of any pending visa/permit application
6. Includes a polite closing with space for company stamp and authorized signature

Use formal Malaysian government correspondence style in English.
Include "Ref:" and "Date:" headers at the top.
""",
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

        def _call(client):
            return client.models.generate_content(model=VISION_MODEL, contents=[prompt, part])

        response = call_with_rotation(_call)
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

        def _call(client):
            return client.models.generate_content(
                model=REASONING_MODEL,
                contents=full_prompt,
                config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=2000),
            )

        response = call_with_rotation(_call)
        return {"success": True, "text": response.text, "model": REASONING_MODEL,
                "timestamp": datetime.now().isoformat()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_justification_letter(worker_data: Dict, application_type: str, context: Dict) -> Dict:
    prompt_fn = LETTER_PROMPTS.get(application_type)
    if not prompt_fn:
        prompt = "Draft a formal compliance letter."
    else:
        prompt = prompt_fn(worker_data, context)

    try:

        def _call(client):
            return client.models.generate_content(
                model=REASONING_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.3, max_output_tokens=2000),
            )

        response = call_with_rotation(_call)
        return {
            "success": True,
            "application_type": application_type,
            "letter": response.text,
            "model": REASONING_MODEL,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "application_type": application_type,
                "timestamp": datetime.now().isoformat()}
