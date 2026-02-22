from flask import Flask, render_template, request, jsonify, send_file
import pdfplumber
from pdf2image import convert_from_path
from pdf2docx import Converter
import re
import csv
import io
import os
import json
from datetime import datetime
from pathlib import Path
import requests
import time

try:
    # Optional: Unstract API deployments client
    from unstract.api_deployments.client import (
        APIDeploymentsClient,
        APIDeploymentsClientException,
    )
except Exception:
    APIDeploymentsClient = None
    APIDeploymentsClientException = Exception

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Create necessary directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['OUTPUT_FOLDER'], 'images'), exist_ok=True)
os.makedirs(os.path.join(app.config['OUTPUT_FOLDER'], 'documents'), exist_ok=True)


# --- AI-assisted parsing configuration ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_API_BASE = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

# --- Unstract configuration ---
# UNSTRACT_API_URL should be the full Execution API URL for your deployment
# e.g. https://us-central.unstract.com/deployment/api/{org_id}/{deployment_id}/
UNSTRACT_API_URL = os.environ.get("UNSTRACT_API_URL")
UNSTRACT_API_DEPLOYMENT_KEY = os.environ.get("UNSTRACT_API_DEPLOYMENT_KEY")
UNSTRACT_TIMEOUT_SECONDS = int(os.environ.get("UNSTRACT_TIMEOUT_SECONDS", "300"))
UNSTRACT_POLL_INTERVAL_SECONDS = float(os.environ.get("UNSTRACT_POLL_INTERVAL_SECONDS", "2.5"))
UNSTRACT_INCLUDE_METADATA = os.environ.get("UNSTRACT_INCLUDE_METADATA", "false").lower() == "true"


def ai_parsing_enabled() -> bool:
    """Return True if AI parsing is configured (API key present)."""
    return bool(OPENAI_API_KEY)


def unstract_enabled() -> bool:
    """Return True if Unstract parsing is configured (env + package present)."""
    return bool(UNSTRACT_API_URL and UNSTRACT_API_DEPLOYMENT_KEY and APIDeploymentsClient is not None)

def extract_text_from_pdf(pdf_path):
    """Extract all text from PDF"""
    pdf_text = ''
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                pdf_text += page_text + '\n'
    return pdf_text

def extract_section_by_prompt(pdf_text, section_prompt):
    """Extract a specific section from PDF text based on user prompt"""
    if not section_prompt or not section_prompt.strip():
        return pdf_text  # Return full text if no prompt
    
    prompt_lower = section_prompt.lower().strip()
    
    # Create pattern from prompt (case insensitive)
    # Escape special regex characters but allow flexibility
    prompt_pattern = re.escape(prompt_lower)
    # Allow variations like "references", "reference", "bibliography"
    prompt_pattern = prompt_pattern.replace(r'\ ', r'\s+')
    
    # Try exact match first
    pattern = rf'(?i)(?:{prompt_pattern})'
    match = re.search(pattern, pdf_text)
    
    if not match:
        # Try partial match - look for keywords
        keywords = prompt_lower.split()
        if len(keywords) > 0:
            # Try to find section starting with any keyword
            for keyword in keywords:
                pattern = rf'(?i)\b{re.escape(keyword)}\b'
                match = re.search(pattern, pdf_text)
                if match:
                    break
    
    if match:
        start_pos = match.end()
        section_text = pdf_text[start_pos:].strip()
        
        # Try to find where section ends
        end_patterns = [
            r'(?i)(?:appendix|appendices|index|acknowledgements|acknowledgments)',
            r'(?i)(?:notes|footnotes|abstract|introduction)',
            r'(?i)(?:chapter\s+\d+|section\s+\d+)'
        ]
        
        end_pos = len(section_text)
        for pattern in end_patterns:
            match = re.search(pattern, section_text)
            if match and match.start() > 100:  # Only if it's not too close to start
                end_pos = min(end_pos, match.start())
        
        return section_text[:end_pos].strip()
    
    return None

def parse_data_by_columns(text, column_prompts):
    """Parse text into columns based on user-defined prompts"""
    if not column_prompts or len(column_prompts) == 0:
        return []
    
    # Split text into lines/items
    lines = re.split(r'\n+', text)
    
    parsed_data = []
    current_item = ''
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Determine if this is a new item (heuristic)
        is_new_item = (
            re.match(r'^\d+[\.\)]\s+', line) or  # Numbered item
            re.match(r'^[A-Z][a-z]+', line) or  # Starts with capital
            (current_item and len(current_item) > 150)  # Previous item seems complete
        )
        
        if is_new_item and current_item:
            # Parse the previous item
            parsed = parse_item_by_columns(current_item, column_prompts)
            if parsed:
                parsed_data.append(parsed)
            current_item = line
        else:
            if current_item:
                current_item += ' ' + line
            else:
                current_item = line
    
    # Parse the last item
    if current_item:
        parsed = parse_item_by_columns(current_item, column_prompts)
        if parsed:
            parsed_data.append(parsed)
    
    return parsed_data


def ai_parse_data(section_text, column_prompts, ai_instructions: str | None = None):
    """
    Use an LLM to parse section_text into structured rows based on column_prompts.

    This assumes an OpenAI-compatible chat API. To use a fine-tuned model,
    set OPENAI_MODEL (and optionally OPENAI_API_BASE) to point to it.
    """
    if not ai_parsing_enabled():
        return None


def _normalize_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").strip().lower())


def _coerce_unstract_output_to_rows(output_obj):
    """
    Unstract tool outputs can vary by workflow/tool. Try to coerce to:
      - list[dict] rows
      - or dict with 'rows'
      - or dict (single row) -> [dict]
    """
    if output_obj is None:
        return None

    if isinstance(output_obj, str):
        try:
            output_obj = json.loads(output_obj)
        except Exception:
            return None

    if isinstance(output_obj, list):
        # keep only dict-like rows
        rows = [r for r in output_obj if isinstance(r, dict)]
        return rows or None

    if isinstance(output_obj, dict):
        if isinstance(output_obj.get("rows"), list):
            rows = [r for r in output_obj["rows"] if isinstance(r, dict)]
            return rows or None
        # common alternative key names
        for k in ("data", "items", "records", "results"):
            if isinstance(output_obj.get(k), list):
                rows = [r for r in output_obj[k] if isinstance(r, dict)]
                if rows:
                    return rows
        # treat the dict itself as a single row
        return [output_obj]

    return None


def _extract_unstract_output(extraction_result):
    """
    extraction_result is whatever unstract-client returns as `extraction_result`.
    We try to locate the structured output payload.
    """
    if extraction_result is None:
        return None

    # extraction_result is usually a list of file objects
    if isinstance(extraction_result, list) and extraction_result:
        file_obj = extraction_result[0]  # single-file upload path
        if isinstance(file_obj, dict):
            res = file_obj.get("result")
            if isinstance(res, str):
                try:
                    res = json.loads(res)
                except Exception:
                    res = None
            if isinstance(res, dict):
                # Prefer output locations documented by Unstract
                if "output" in res:
                    return res.get("output")
                md = res.get("metadata")
                if isinstance(md, dict) and "output" in md:
                    return md.get("output")
                # Some tools might return `result` directly
                if "result" in res:
                    return res.get("result")
                return res
            # sometimes the payload is directly under file_obj
            if "output" in file_obj:
                return file_obj.get("output")
        return None

    # Sometimes we get a dict directly
    if isinstance(extraction_result, dict):
        # try typical keys
        for k in ("output", "result"):
            if k in extraction_result:
                return extraction_result.get(k)
        return extraction_result

    # Or a string JSON
    if isinstance(extraction_result, str):
        try:
            return json.loads(extraction_result)
        except Exception:
            return None

    return None


def unstract_parse_file_to_rows(file_path: str, column_prompts, custom_data: dict | None = None):
    """
    Send the file to Unstract API Deployment and return parsed rows mapped to column_prompts.

    This expects you have created an Unstract API Deployment (Prompt Studio exported tool)
    that returns structured JSON.
    """
    if not unstract_enabled():
        return None, "Unstract is not configured. Set UNSTRACT_API_URL and UNSTRACT_API_DEPLOYMENT_KEY and install unstract-client."

    try:
        adc = APIDeploymentsClient(
            api_url=UNSTRACT_API_URL,
            api_key=UNSTRACT_API_DEPLOYMENT_KEY,
            api_timeout=UNSTRACT_TIMEOUT_SECONDS,
            logging_level=os.getenv("UNSTRACT_API_CLIENT_LOGGING_LEVEL", "INFO"),
            include_metadata=UNSTRACT_INCLUDE_METADATA,
        )

        # Note: unstract-client currently supports files upload via paths.
        resp = adc.structure_file([file_path])
        if resp.get("error"):
            return None, f"Unstract error: {resp.get('error')}"

        # Poll if async
        while resp.get("pending"):
            status_ep = resp.get("status_check_api_endpoint")
            if not status_ep:
                break
            time.sleep(UNSTRACT_POLL_INTERVAL_SECONDS)
            resp = adc.check_execution_status(status_ep)
            if resp.get("error"):
                return None, f"Unstract error: {resp.get('error')}"

        extraction_result = resp.get("extraction_result")
        output_obj = _extract_unstract_output(extraction_result)
        rows = _coerce_unstract_output_to_rows(output_obj)
        if not rows:
            return None, "Unstract returned no structured rows. Ensure your Unstract tool outputs JSON rows."

        # Map Unstract row keys to requested column names (case-insensitive/normalized)
        expected_cols = [c.get("name", "") for c in (column_prompts or []) if c.get("name", "")]
        if not expected_cols:
            return rows, None  # return raw rows if no schema requested

        expected_norm = {_normalize_key(c): c for c in expected_cols}

        mapped_rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            row_norm_map = {_normalize_key(k): k for k in row.keys()}
            mapped = {}
            for norm_key, col_name in expected_norm.items():
                src_key = row_norm_map.get(norm_key)
                mapped[col_name] = row.get(src_key, "") if src_key else ""
            if any(str(v).strip() for v in mapped.values()):
                mapped_rows.append(mapped)

        return (mapped_rows or rows), None
    except APIDeploymentsClientException as e:
        return None, f"Unstract client exception: {getattr(e, 'error_message', lambda: str(e))()}"
    except Exception as e:
        return None, f"Unstract integration failed: {str(e)}"

    # Build a compact schema description for the model
    columns_desc = []
    for col in column_prompts:
        name = col.get("name", "")
        col_type = col.get("type", "text")
        pattern = col.get("pattern", "")
        desc_parts = [f"name: {name}", f"type: {col_type}"]
        if pattern:
            desc_parts.append(f"regex_hint: {pattern}")
        columns_desc.append(" - " + ", ".join(desc_parts))

    system_prompt = (
        "You are an expert document parsing engine. "
        "Given raw text from a PDF section and a list of target columns, "
        "you extract a list of rows as strict JSON. "
        "Each row MUST be a JSON object with exactly the specified column names as keys. "
        "Return ONLY a JSON array or an object with a 'rows' array, with no extra text."
    )

    user_prompt_parts = [
        "Parse the following text into rows.",
        "",
        "Columns schema:",
        *columns_desc,
        "",
        "Text to parse:",
        section_text[:8000],  # safeguard: truncate very long text
    ]

    if ai_instructions:
        user_prompt_parts.insert(
            1,
            f"Additional instructions from the user: {ai_instructions}",
        )

    user_prompt = "\n".join(user_prompt_parts)

    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            f"{OPENAI_API_BASE}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # Expect either a list or an object with a "rows" field
        parsed = json.loads(content)
        if isinstance(parsed, list):
            rows = parsed
        elif isinstance(parsed, dict) and isinstance(parsed.get("rows"), list):
            rows = parsed["rows"]
        else:
            return None

        # Ensure rows are dicts with the expected keys
        normalized_rows = []
        col_names = [c.get("name", "") for c in column_prompts]
        for row in rows:
            if not isinstance(row, dict):
                continue
            normalized = {name: (row.get(name) or "") for name in col_names if name}
            if any(normalized.values()):
                normalized_rows.append(normalized)

        return normalized_rows or None
    except Exception:
        # On any failure, fall back to rule-based parsing
        return None

def parse_item_by_columns(item_text, column_prompts):
    """Parse a single item into columns based on prompts"""
    result = {}
    
    for prompt in column_prompts:
        column_name = prompt.get('name', '').strip()
        search_pattern = prompt.get('pattern', '').strip()
        extraction_type = prompt.get('type', 'text').lower()
        
        if not column_name:
            continue
        
        value = ''
        
        if search_pattern:
            # Use custom pattern
            try:
                match = re.search(search_pattern, item_text, re.IGNORECASE | re.MULTILINE)
                if match:
                    value = match.group(1) if match.groups() else match.group(0)
            except:
                # If pattern is invalid, try as literal search
                if search_pattern.lower() in item_text.lower():
                    # Extract surrounding text
                    idx = item_text.lower().find(search_pattern.lower())
                    # Try to extract a reasonable chunk
                    start = max(0, idx - 50)
                    end = min(len(item_text), idx + len(search_pattern) + 100)
                    value = item_text[start:end].strip()
        else:
            # Use intelligent extraction based on column name
            value = extract_by_column_name(item_text, column_name, extraction_type)
        
        result[column_name] = value.strip()
    
    return result if any(result.values()) else None

def extract_by_column_name(text, column_name, extraction_type):
    """Extract value based on column name and type"""
    name_lower = column_name.lower()
    
    if extraction_type == 'date' or 'date' in name_lower or 'year' in name_lower:
        # Extract year (4 digits)
        year_match = re.search(r'\((\d{4})\)|(\d{4})', text)
        if year_match:
            return year_match.group(1) or year_match.group(2)
    
    elif extraction_type == 'name' or 'author' in name_lower or 'name' in name_lower:
        # Extract name (usually at beginning, before year)
        year_match = re.search(r'\((\d{4})\)|(\d{4})', text)
        if year_match:
            name_text = text[:year_match.start()].strip()
        else:
            name_text = re.split(r'[.,]', text, 1)[0].strip()
        
        # Clean up name
        name_text = re.sub(r'^and\s+', '', name_text, flags=re.IGNORECASE)
        name_text = re.sub(r'\s+&\s+.*$', '', name_text)
        name_text = re.sub(r',\s*[A-Z]\.?\s*$', '', name_text)
        return name_text
    
    elif extraction_type == 'title' or 'title' in name_lower:
        # Extract title (usually between author/year and publisher)
        year_match = re.search(r'\((\d{4})\)|(\d{4})', text)
        if year_match:
            after_year = text[year_match.end():].strip()
            after_year = re.sub(r'^[.,]\s*', '', after_year)
            title_match = re.match(r'^([^.,]+(?:\.[^.,]+)*)', after_year)
            if title_match:
                return title_match.group(1).strip()
            parts = re.split(r'[.,]\s+', after_year, 2)
            if len(parts) >= 2:
                return parts[0].strip()
        else:
            parts = re.split(r'[.,]\s+', text, 2)
            if len(parts) >= 2:
                return parts[1].strip()
    
    elif 'institution' in name_lower or 'publisher' in name_lower or 'organization' in name_lower:
        # Extract institution/publisher
        inst_match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:University|Institute|College|Press|Journal|Publisher))?)', text)
        if inst_match:
            return inst_match.group(1).strip()
        # Fallback: take last significant part
        parts = re.split(r'[.,]\s+', text)
        if len(parts) > 1:
            return parts[-1].strip()
    
    elif 'origin' in name_lower or 'country' in name_lower:
        # Check for country names or origin indicators
        # This is a placeholder - can be enhanced with country detection
        return ''
    
    # Default: return empty or try to extract based on context
    return ''

def convert_pdf_to_images(pdf_path, output_dir):
    """Convert PDF pages to images"""
    try:
        images = convert_from_path(pdf_path, dpi=200)
        image_paths = []
        
        for i, image in enumerate(images):
            image_path = os.path.join(output_dir, f'page_{i+1}.png')
            image.save(image_path, 'PNG')
            image_paths.append(image_path)
        
        return image_paths
    except Exception as e:
        raise Exception(f"Error converting PDF to images: {str(e)}")

def convert_pdf_to_docx(pdf_path, output_path):
    """Convert PDF to DOCX format"""
    try:
        cv = Converter(pdf_path)
        cv.convert(output_path)
        cv.close()
        return output_path
    except Exception as e:
        raise Exception(f"Error converting PDF to DOCX: {str(e)}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Please upload a PDF file'}), 400
    
    try:
        # Get parsing configuration from request
        section_prompt = request.form.get('section_prompt', '').strip()
        column_prompts_json = request.form.get('column_prompts', '[]')
        use_ai = request.form.get('use_ai', 'false').lower() == 'true'
        ai_instructions = request.form.get('ai_instructions', '').strip()
        engine = request.form.get('engine', '').strip().lower()  # optional: rule | ai | unstract
        
        try:
            column_prompts = json.loads(column_prompts_json)
        except:
            column_prompts = []
        
        # Save uploaded file temporarily
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        
        # Choose engine:
        # - unstract: send PDF to Unstract API deployment and use its structured JSON
        # - ai/rule: extract text locally and parse
        if engine == "unstract":
            if not column_prompts:
                os.remove(filepath)
                return jsonify({'error': 'Unstract parsing requires at least one column definition (schema)'}), 400

            parsed_data, err = unstract_parse_file_to_rows(filepath, column_prompts)
            if err:
                os.remove(filepath)
                return jsonify({'error': err}), 400

            section_text = ""  # not applicable for Unstract path
        else:
            # Extract text from PDF
            pdf_text = extract_text_from_pdf(filepath)

            if not pdf_text:
                os.remove(filepath)
                return jsonify({'error': 'Could not extract text from PDF'}), 400

            # Extract section based on prompt
            if section_prompt:
                section_text = extract_section_by_prompt(pdf_text, section_prompt)
                if not section_text:
                    os.remove(filepath)
                    return jsonify({'error': f'Could not find section matching "{section_prompt}"'}), 400
            else:
                section_text = pdf_text

            # Parse data into columns
            if column_prompts:
                parsed_data = None

                # Try AI-assisted parsing first if enabled and configured
                if (engine == "ai" or use_ai) and ai_parsing_enabled():
                    parsed_data = ai_parse_data(section_text, column_prompts, ai_instructions)

                # Fallback to rule-based parsing
                if not parsed_data:
                    parsed_data = parse_data_by_columns(section_text, column_prompts)
            else:
                # Default: return raw text split by lines
                parsed_data = [{'Text': line.strip()} for line in section_text.split('\n') if line.strip()]
        
        if not parsed_data:
            os.remove(filepath)
            return jsonify({'error': 'Could not parse any data from the PDF'}), 400
        
        # Clean up temporary file
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'data': parsed_data,
            'count': len(parsed_data),
            'preview_text': section_text[:500] + '...' if len(section_text) > 500 else section_text
        })
    
    except Exception as e:
        return jsonify({'error': f'Error processing PDF: {str(e)}'}), 500

@app.route('/convert', methods=['POST'])
def convert_pdf():
    """Convert PDF to images or DOCX"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    convert_type = request.form.get('type', 'images')  # 'images' or 'docx'
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Please upload a PDF file'}), 400
    
    try:
        # Save uploaded file temporarily
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        
        if convert_type == 'images':
            output_dir = os.path.join(app.config['OUTPUT_FOLDER'], 'images')
            image_paths = convert_pdf_to_images(filepath, output_dir)
            
            # Create zip or return paths
            return jsonify({
                'success': True,
                'type': 'images',
                'count': len(image_paths),
                'message': f'Successfully converted {len(image_paths)} pages to images'
            })
        
        elif convert_type == 'docx':
            output_filename = Path(file.filename).stem + '.docx'
            output_path = os.path.join(app.config['OUTPUT_FOLDER'], 'documents', output_filename)
            convert_pdf_to_docx(filepath, output_path)
            
            return jsonify({
                'success': True,
                'type': 'docx',
                'filename': output_filename,
                'message': 'Successfully converted PDF to DOCX'
            })
        
        else:
            os.remove(filepath)
            return jsonify({'error': 'Invalid conversion type'}), 400
        
        # Clean up temporary file
        os.remove(filepath)
    
    except Exception as e:
        return jsonify({'error': f'Error converting PDF: {str(e)}'}), 500

@app.route('/download_csv', methods=['POST'])
def download_csv():
    data = request.json
    parsed_data = data.get('data', [])
    column_names = data.get('columns', [])
    
    if not parsed_data:
        return jsonify({'error': 'No data to export'}), 400
    
    # Determine column names
    if column_names:
        fieldnames = column_names
    else:
        # Extract column names from first data item
        if parsed_data:
            fieldnames = list(parsed_data[0].keys())
        else:
            fieldnames = ['Data']
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    
    writer.writeheader()
    for item in parsed_data:
        row = {}
        for field in fieldnames:
            row[field] = item.get(field, '')
        writer.writerow(row)
    
    output.seek(0)
    
    # Create response with CSV file
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='parsed_data.csv'
    )

@app.route('/download_docx/<filename>')
def download_docx(filename):
    """Download converted DOCX file"""
    filepath = os.path.join(app.config['OUTPUT_FOLDER'], 'documents', filename)
    if os.path.exists(filepath):
        return send_file(filepath, as_attachment=True, download_name=filename)
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)
