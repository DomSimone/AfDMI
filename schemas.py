from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class ExtractionResponse(BaseModel):
    status: str = Field(..., example="success")
    document_name: str
    extracted_fields: Dict[str, Any]
    row_count: int

class ErrorResponse(BaseModel):
    status: str = Field(default="error")
    message: str