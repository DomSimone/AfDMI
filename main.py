from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.schemas import ExtractionResponse, ErrorResponse
from app.pipeline import pipeline_instance

app = FastAPI(
    title="AfDMI Ingestion Microservice",
    description="High-throughput document extraction and structured data processing API.",
    version="1.0.0"
)

@app.get("/health", tags=["Utility"])
async def health_check():
    return {"status": "healthy", "service": "afdmi-ingestion"}

@app.post(
    "/v1/parse",
    response_model=ExtractionResponse,
    responses={500: {"model": ErrorResponse}},
    tags=["Extraction"]
)
async def parse_document(file: UploadFile = File(...)):
    """Upload a document to extract structured data."""
    try:
        content = await file.read()
        extracted = await pipeline_instance.process_document(content, file.filename)
        return ExtractionResponse(
            status="success",
            document_name=file.filename,
            extracted_fields=extracted,
            row_count=len(extracted.get("parsed_records", []))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/export/excel", tags=["Extraction"])
async def parse_and_export_excel(file: UploadFile = File(...)):
    """Upload a document and receive a styled `.xlsx` download directly."""
    try:
        content = await file.read()
        extracted = await pipeline_instance.process_document(content, file.filename)
        excel_stream = pipeline_instance.generate_excel(extracted)
        
        headers = {
            'Content-Disposition': f'attachment; filename="{file.filename}_parsed.xlsx"'
        }
        return StreamingResponse(
            excel_stream,
            headers=headers,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))