"""
GLM-4V/5 integration service for Z.AI multimodal document processing.
Handles document parsing, reasoning, and justification letter generation.

TEMPORARY: Using Gemini API with key rotation for testing/optimization.
Will switch back to GLM for production.
"""
import os
from typing import Dict, Optional, List
from datetime import datetime
import httpx
try:
    from zhipuai import ZhipuAI
except Exception:
    ZhipuAI = None
try:
    from app.services.gemini_key_rotation_service import gemini_rotation_service
except Exception:
    gemini_rotation_service = None
import json
import base64

try:
    from app.services.gemini_key_rotation_service import gemini_rotation_service
except Exception:
    gemini_rotation_service = None


class GLMService:
    """
    Service for interacting with Z.AI's GLM-4V and GLM-5 models.
    TEMPORARY: Using Gemini API for testing/optimization phase.
    """

    def __init__(self):
        self.api_key = os.getenv("ZHIPU_API_KEY", "")
        self.use_gemini = os.getenv("USE_GEMINI_FOR_TESTING", "true").lower() == "true"
        self.gemini_vision_model = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
        self.gemini_reasoning_model = os.getenv("GEMINI_REASONING_MODEL", "gemini-2.5-pro")

        if self.use_gemini and gemini_rotation_service is None:
            self.use_gemini = False
            print("WARNING: Gemini rotation service missing - falling back to GLM/mock mode")

        if self.use_gemini:
            print("INFO: Using Gemini API with key rotation for testing/optimization")
            self.client = None  # Not using ZhipuAI client
        elif self.api_key:
            if ZhipuAI is None:
                self.client = None
                print("WARNING: zhipuai package unavailable - falling back to mock responses")
            else:
                self.client = ZhipuAI(api_key=self.api_key)
                print("INFO: Using GLM API for production")
        else:
            self.client = None
            print("WARNING: No API keys configured - GLM service will use mock responses")

    def parse_document_with_glm4v(
        self,
        image_url: str,
        document_type: str,
        prompt_override: Optional[str] = None
    ) -> Dict:
        """
        Parse a document image using GLM-4V multimodal capabilities.
        TEMPORARY: Routes to Gemini if USE_GEMINI_FOR_TESTING=true

        Args:
            image_url: URL or base64 encoded image
            document_type: Type of document (passport, fomema_report, permit, etc.)
            prompt_override: Optional custom prompt

        Returns:
            Dict with extracted data and confidence score
        """
        if self.use_gemini:
            return self._parse_with_gemini(image_url, document_type, prompt_override)

        if not self.client:
            return self._mock_glm4v_response(document_type)

        # Document-specific prompts
        prompts = {
            "passport": """
            Analyze this passport document and extract the following information in JSON format:
            - passport_number
            - full_name
            - nationality
            - date_of_birth
            - issue_date
            - expiry_date
            - issuing_country

            Check if the passport has less than 12 months validity remaining.
            If yes, flag it as "renewal_required": true.

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
            """
        }

        prompt = prompt_override or prompts.get(document_type, "Extract all relevant information from this document in JSON format.")

        try:
            response = self.client.chat.completions.create(
                model="glm-4v-plus",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                }
                            }
                        ]
                    }
                ],
                temperature=0.1,  # Low temperature for factual extraction
                max_tokens=1000
            )

            extracted_text = response.choices[0].message.content

            # Parse JSON from response
            import json
            try:
                extracted_data = json.loads(extracted_text)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code blocks
                if "```json" in extracted_text:
                    json_str = extracted_text.split("```json")[1].split("```")[0].strip()
                    extracted_data = json.loads(json_str)
                else:
                    extracted_data = {"raw_text": extracted_text}

            return {
                "success": True,
                "document_type": document_type,
                "extracted_data": extracted_data,
                "confidence": 0.85,  # Placeholder - GLM doesn't return confidence
                "model": "glm-4v-plus",
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "document_type": document_type,
                "timestamp": datetime.now().isoformat()
            }

    def generate_justification_letter_with_glm5(
        self,
        worker_data: Dict,
        application_type: str,
        context: Dict
    ) -> Dict:
        """
        Generate a detailed justification letter using GLM-5's reasoning capabilities.
        TEMPORARY: Routes to Gemini if USE_GEMINI_FOR_TESTING=true

        Args:
            worker_data: Worker information
            application_type: Type of application (quota, renewal, appeal)
            context: Additional context (sector, local hiring attempts, etc.)

        Returns:
            Dict with generated letter and reasoning trace
        """
        if self.use_gemini:
            return self._generate_letter_with_gemini(worker_data, application_type, context)

        if not self.client:
            return self._mock_justification_letter(application_type)

        prompts = {
            "quota_application": f"""
            You are drafting a justification letter to the Ministry of Home Affairs (KDN)
            for a foreign worker quota application.

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
            "fomema_appeal": f"""
            You are drafting a FOMEMA medical appeal letter.

            Worker Details:
            - Name: {worker_data.get('full_name')}
            - Passport: {worker_data.get('passport_number')}
            - Medical Condition: {context.get('medical_condition')}

            The worker was flagged as "Unsuitable" for: {context.get('medical_condition')}

            This is a Category 2 NCD (Non-Communicable Disease) eligible for monitoring.

            Draft a formal appeal letter to FOMEMA requesting enrollment in the NCD Monitoring Programme.
            Include:
            1. Acknowledgment of the medical finding
            2. Request for 6-month monitoring period
            3. Commitment to employer-funded treatment
            4. Reference to WellXS app tracking

            Use formal medical appeal language.
            """,
            "special_pass": f"""
            You are drafting a Special Pass application to Immigration (JIM).

            Worker Details:
            - Name: {worker_data.get('full_name')}
            - Passport: {worker_data.get('passport_number')}
            - Current Permit Expiry: {worker_data.get('permit_expiry_date')}

            Reason for Special Pass:
            {context.get('reason', 'FOMEMA appeal pending while permit expires')}

            Draft a formal letter requesting a Special Pass to bridge the compliance gap.
            Explain the administrative deadlock and proposed resolution timeline.
            """,
            "com_request_letter": f"""
            You are drafting a formal cover letter from an employer to the Malaysian Immigration
            Department (Jabatan Imigresen Malaysia / JIM) requesting the issuance of a Check Out
            Memo (COM) for a foreign worker who has been declared medically unfit.

            Company / Employer:
            - Company Name: {context.get('employer_name', 'N/A')}
            - Company Registration: {context.get('company_registration', 'N/A')}

            Worker Details:
            - Full Name: {worker_data.get('full_name', 'N/A')}
            - Passport Number: {worker_data.get('passport_number', 'N/A')}
            - Nationality: {worker_data.get('nationality', 'N/A')}
            - Sector: {worker_data.get('sector', 'N/A')}

            Reason for Repatriation:
            - The above-named worker has undergone the mandatory FOMEMA medical examination
              and has been declared UNFIT (Tidak Layak).
            - FOMEMA Result Date: {context.get('fomema_result_date', 'N/A')}
            - Medical Condition Category: {context.get('condition_category', 'Category 1 — Communicable Disease')}

            Draft a formal letter that:
            1. Is addressed to "Pengarah, Jabatan Imigresen Malaysia" (Director, Immigration Dept).
            2. States the company is hereby notifying JIM of the FOMEMA UNFIT result.
            3. Formally requests the issuance of a Check Out Memo (COM) to facilitate
               the lawful repatriation of the worker.
            4. Confirms the employer will bear repatriation costs (flight ticket, etc.).
            5. Requests cancellation of any pending visa/permit application for this worker.
            6. Includes a polite closing with space for company stamp and authorized signature.

            Use formal Malaysian government correspondence style in English.
            Include "Ref:" and "Date:" headers at the top.
            """
        }

        prompt = prompts.get(application_type, "Draft a formal compliance letter.")

        try:
            response = self.client.chat.completions.create(
                model="glm-4-plus",  # Use GLM-4-Plus for reasoning (GLM-5 equivalent)
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in Malaysian foreign worker compliance regulations and formal government correspondence."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=2000
            )

            generated_letter = response.choices[0].message.content

            return {
                "success": True,
                "application_type": application_type,
                "letter": generated_letter,
                "model": "glm-4-plus",
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "application_type": application_type,
                "timestamp": datetime.now().isoformat()
            }

    def _mock_glm4v_response(self, document_type: str) -> Dict:
        """Mock response for testing without API key"""
        mock_data = {
            "passport": {
                "passport_number": "A12345678",
                "full_name": "Ahmad Bin Abdullah",
                "nationality": "Bangladesh",
                "date_of_birth": "1990-05-15",
                "issue_date": "2020-01-10",
                "expiry_date": "2027-01-10",
                "issuing_country": "Bangladesh",
                "renewal_required": False
            },
            "fomema_report": {
                "worker_name": "Ahmad Bin Abdullah",
                "passport_number": "A12345678",
                "examination_date": "2026-04-15",
                "medical_status": "Suitable",
                "conditions_detected": [],
                "clinic_name": "Klinik Kesihatan Putrajaya",
                "doctor_name": "Dr. Lee"
            },
            "permit": {
                "permit_number": "PLKS2024001234",
                "worker_name": "Ahmad Bin Abdullah",
                "passport_number": "A12345678",
                "permit_class": "PLKS",
                "sector": "Manufacturing",
                "employer_name": "ABC Manufacturing Sdn Bhd",
                "issue_date": "2024-01-15",
                "expiry_date": "2026-07-15",
                "days_until_expiry": 83
            }
        }

        return {
            "success": True,
            "document_type": document_type,
            "extracted_data": mock_data.get(document_type, {}),
            "confidence": 0.90,
            "model": "mock",
            "timestamp": datetime.now().isoformat()
        }

    def _mock_justification_letter(self, application_type: str) -> Dict:
        """Mock justification letter for testing"""
        return {
            "success": True,
            "application_type": application_type,
            "letter": f"[MOCK] Formal justification letter for {application_type} would be generated here using GLM-5 reasoning.",
            "model": "mock",
            "timestamp": datetime.now().isoformat()
        }

    def _parse_with_gemini(
        self,
        image_url: str,
        document_type: str,
        prompt_override: Optional[str] = None
    ) -> Dict:
        """Parse document using Gemini with key rotation."""
        if gemini_rotation_service is None:
            return self._mock_glm4v_response(document_type)

        prompts = {
            "passport": """
            Analyze this passport document and extract the following information in JSON format:
            - passport_number
            - full_name
            - nationality
            - date_of_birth
            - issue_date
            - expiry_date
            - issuing_country

            Check if the passport has less than 12 months validity remaining.
            If yes, flag it as "renewal_required": true.

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
            """
        }

        prompt = prompt_override or prompts.get(document_type, "Extract all relevant information from this document in JSON format.")

        try:
            # Handle image URL or base64
            if image_url.startswith("http"):
                # Download image
                response = httpx.get(image_url)
                image_data = response.content
            elif image_url.startswith("data:image"):
                # Extract base64 data
                image_data = base64.b64decode(image_url.split(",")[1])
            else:
                # Assume it's a file path
                with open(image_url, "rb") as f:
                    image_data = f.read()

            # Use Gemini with rotation
            result = gemini_rotation_service.generate_content_with_image(
                model_name=self.gemini_vision_model,
                prompt=prompt,
                image_data=image_data,
                mime_type="image/jpeg"
            )

            if not result["success"]:
                return {
                    "success": False,
                    "error": result.get("error", "Gemini API failed"),
                    "document_type": document_type,
                    "timestamp": datetime.now().isoformat()
                }

            extracted_text = result["text"]

            # Parse JSON from response
            try:
                extracted_data = json.loads(extracted_text)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code blocks
                if "```json" in extracted_text:
                    json_str = extracted_text.split("```json")[1].split("```")[0].strip()
                    extracted_data = json.loads(json_str)
                else:
                    extracted_data = {"raw_text": extracted_text}

            return {
                "success": True,
                "document_type": document_type,
                "extracted_data": extracted_data,
                "confidence": 0.85,
                "model": result.get("model", self.gemini_vision_model),
                "key_index": result.get("key_index", 0),
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "document_type": document_type,
                "timestamp": datetime.now().isoformat()
            }

    def _generate_letter_with_gemini(
        self,
        worker_data: Dict,
        application_type: str,
        context: Dict
    ) -> Dict:
        """Generate justification letter using Gemini with key rotation."""
        if gemini_rotation_service is None:
            return self._mock_justification_letter(application_type)

        prompts = {
            "quota_application": f"""
            You are drafting a justification letter to the Ministry of Home Affairs (KDN)
            for a foreign worker quota application.

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
            "fomema_appeal": f"""
            You are drafting a FOMEMA medical appeal letter.

            Worker Details:
            - Name: {worker_data.get('full_name')}
            - Passport: {worker_data.get('passport_number')}
            - Medical Condition: {context.get('medical_condition')}

            The worker was flagged as "Unsuitable" for: {context.get('medical_condition')}

            This is a Category 2 NCD (Non-Communicable Disease) eligible for monitoring.

            Draft a formal appeal letter to FOMEMA requesting enrollment in the NCD Monitoring Programme.
            Include:
            1. Acknowledgment of the medical finding
            2. Request for 6-month monitoring period
            3. Commitment to employer-funded treatment
            4. Reference to WellXS app tracking

            Use formal medical appeal language.
            """,
            "special_pass": f"""
            You are drafting a Special Pass application to Immigration (JIM).

            Worker Details:
            - Name: {worker_data.get('full_name')}
            - Passport: {worker_data.get('passport_number')}
            - Current Permit Expiry: {worker_data.get('permit_expiry_date')}

            Reason for Special Pass:
            {context.get('reason', 'FOMEMA appeal pending while permit expires')}

            Draft a formal letter requesting a Special Pass to bridge the compliance gap.
            Explain the administrative deadlock and proposed resolution timeline.
            """,
            "com_request_letter": f"""
            You are drafting a formal cover letter from an employer to the Malaysian Immigration
            Department (Jabatan Imigresen Malaysia / JIM) requesting the issuance of a Check Out
            Memo (COM) for a foreign worker who has been declared medically unfit.

            Company / Employer:
            - Company Name: {context.get('employer_name', 'N/A')}
            - Company Registration: {context.get('company_registration', 'N/A')}

            Worker Details:
            - Full Name: {worker_data.get('full_name', 'N/A')}
            - Passport Number: {worker_data.get('passport_number', 'N/A')}
            - Nationality: {worker_data.get('nationality', 'N/A')}
            - Sector: {worker_data.get('sector', 'N/A')}

            Reason for Repatriation:
            - The above-named worker has undergone the mandatory FOMEMA medical examination
              and has been declared UNFIT (Tidak Layak).
            - FOMEMA Result Date: {context.get('fomema_result_date', 'N/A')}
            - Medical Condition Category: {context.get('condition_category', 'Category 1 — Communicable Disease')}

            Draft a formal letter that:
            1. Is addressed to "Pengarah, Jabatan Imigresen Malaysia" (Director, Immigration Dept).
            2. States the company is hereby notifying JIM of the FOMEMA UNFIT result.
            3. Formally requests the issuance of a Check Out Memo (COM) to facilitate
               the lawful repatriation of the worker.
            4. Confirms the employer will bear repatriation costs (flight ticket, etc.).
            5. Requests cancellation of any pending visa/permit application for this worker.
            6. Includes a polite closing with space for company stamp and authorized signature.

            Use formal Malaysian government correspondence style in English.
            Include "Ref:" and "Date:" headers at the top.
            """
        }

        prompt = prompts.get(application_type, "Draft a formal compliance letter.")
        system_prompt = "You are an expert in Malaysian foreign worker compliance regulations and formal government correspondence."

        full_prompt = f"{system_prompt}\n\n{prompt}"

        try:
            result = gemini_rotation_service.generate_content(
                model_name=self.gemini_reasoning_model,
                prompt=full_prompt,
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 2000
                }
            )

            if not result["success"]:
                return {
                    "success": False,
                    "error": result.get("error", "Gemini API failed"),
                    "application_type": application_type,
                    "timestamp": datetime.now().isoformat()
                }

            return {
                "success": True,
                "application_type": application_type,
                "letter": result["text"],
                "model": result.get("model", self.gemini_reasoning_model),
                "key_index": result.get("key_index", 0),
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "application_type": application_type,
                "timestamp": datetime.now().isoformat()
            }


# Global service instance
glm_service = GLMService()
