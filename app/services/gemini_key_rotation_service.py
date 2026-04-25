"""
Gemini API key rotation service for testing and development.
Automatically rotates through multiple API keys when quota limits are hit.
"""
import os
from typing import Optional
from datetime import datetime
import google.generativeai as genai


class GeminiKeyRotationService:
    """
    Manages multiple Gemini API keys with automatic rotation on quota exhaustion.
    """

    def __init__(self, api_keys: list[str]):
        if not api_keys:
            raise ValueError("At least one Gemini API key must be provided")

        self.api_keys = api_keys
        self.current_index = 0
        self.failed_keys = set()

        # Configure with first key
        self._configure_current_key()

    def _configure_current_key(self):
        """Configure genai with the current API key."""
        current_key = self.api_keys[self.current_index]
        genai.configure(api_key=current_key)
        print(f"[GeminiRotation] Using API key index {self.current_index + 1}/{len(self.api_keys)}")

    def _rotate_to_next_key(self) -> bool:
        """
        Rotate to the next available API key.
        Returns True if rotation successful, False if all keys exhausted.
        """
        self.failed_keys.add(self.current_index)

        # Try to find next available key
        for _ in range(len(self.api_keys)):
            self.current_index = (self.current_index + 1) % len(self.api_keys)

            if self.current_index not in self.failed_keys:
                self._configure_current_key()
                return True

        # All keys exhausted
        print("[GeminiRotation] ERROR: All API keys exhausted")
        return False

    def generate_content(self, model_name: str, prompt: str, **kwargs) -> Optional[dict]:
        """
        Generate content with automatic key rotation on quota errors.

        Args:
            model_name: Gemini model name (e.g., "gemini-1.5-flash")
            prompt: Text prompt
            **kwargs: Additional generation config parameters

        Returns:
            Dict with response or None if all keys exhausted
        """
        max_retries = len(self.api_keys)

        for attempt in range(max_retries):
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt, **kwargs)

                return {
                    "success": True,
                    "text": response.text,
                    "model": model_name,
                    "key_index": self.current_index,
                    "timestamp": datetime.now().isoformat()
                }

            except Exception as e:
                error_str = str(e).lower()

                # Check if it's a quota/rate limit error
                if any(keyword in error_str for keyword in ["quota", "rate limit", "resource exhausted", "429"]):
                    print(f"[GeminiRotation] Key {self.current_index + 1} quota exhausted: {e}")

                    if not self._rotate_to_next_key():
                        return {
                            "success": False,
                            "error": "All API keys exhausted",
                            "timestamp": datetime.now().isoformat()
                        }

                    continue  # Retry with next key
                else:
                    # Non-quota error, don't rotate
                    return {
                        "success": False,
                        "error": str(e),
                        "key_index": self.current_index,
                        "timestamp": datetime.now().isoformat()
                    }

        return {
            "success": False,
            "error": "Max retries exceeded",
            "timestamp": datetime.now().isoformat()
        }

    def generate_content_with_image(
        self,
        model_name: str,
        prompt: str,
        image_data: bytes,
        mime_type: str = "image/jpeg",
        **kwargs
    ) -> Optional[dict]:
        """
        Generate content from image with automatic key rotation.

        Args:
            model_name: Gemini model name (e.g., "gemini-1.5-flash")
            prompt: Text prompt
            image_data: Raw image bytes
            mime_type: Image MIME type
            **kwargs: Additional generation config parameters

        Returns:
            Dict with response or None if all keys exhausted
        """
        max_retries = len(self.api_keys)

        for attempt in range(max_retries):
            try:
                model = genai.GenerativeModel(model_name)

                # Create image part
                image_part = {
                    "mime_type": mime_type,
                    "data": image_data
                }

                response = model.generate_content([prompt, image_part], **kwargs)

                return {
                    "success": True,
                    "text": response.text,
                    "model": model_name,
                    "key_index": self.current_index,
                    "timestamp": datetime.now().isoformat()
                }

            except Exception as e:
                error_str = str(e).lower()

                if any(keyword in error_str for keyword in ["quota", "rate limit", "resource exhausted", "429"]):
                    print(f"[GeminiRotation] Key {self.current_index + 1} quota exhausted: {e}")

                    if not self._rotate_to_next_key():
                        return {
                            "success": False,
                            "error": "All API keys exhausted",
                            "timestamp": datetime.now().isoformat()
                        }

                    continue
                else:
                    return {
                        "success": False,
                        "error": str(e),
                        "key_index": self.current_index,
                        "timestamp": datetime.now().isoformat()
                    }

        return {
            "success": False,
            "error": "Max retries exceeded",
            "timestamp": datetime.now().isoformat()
        }

    def reset_failed_keys(self):
        """Reset the failed keys set (useful for periodic retry)."""
        self.failed_keys.clear()
        self.current_index = 0
        self._configure_current_key()


# Global instance with the 10 Gemini API keys
GEMINI_API_KEYS = [
    'AIzaSyBWLkK_OIEZF_ONNyTeo1jRTXUiIAx8wdU',
    'AIzaSyAiGG8sLx9n3C5yODI2-_AaYzo7BFDCO6U',
    'AIzaSyDcyohOtkcP7SCqhusu4dBIhiYz3-GTT6s',
    'AIzaSyD1MJZcTOVYvx_89UJMOYVJF1QRJrbrPQM',
    'AIzaSyDQx6ClDDE3di0dNTdUN3dWbNYgpDLHwS8',
    'AIzaSyCow_VeqicIfr9z-MwfM2HZQieCyqEKE70',
    'AIzaSyDWpPRTDLYe6YgrIbF-s0Cfno1W9RB9psg',
    'AIzaSyDTBQYIsEyX9_z2qb5OEFNLDhF2CGtUdks',
    'AIzaSyCD4svIrskGYBR8-wIWIk8FAWdk7bZmiQw',
    'AIzaSyBkW43UO8eEFKtpmS9qD_Lj2SwC66xgbJI',
]

gemini_rotation_service = GeminiKeyRotationService(GEMINI_API_KEYS)
