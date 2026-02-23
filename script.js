/**
 * ADMI - AI Agent & Data Ingestion Logic
 * Targets: Node.js Backend & Python Extraction Service
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // 1. CONFIGURATION & CONSTANTS
    // ============================================================
    
    // Note: 'require' is for Node.js. In the browser, CORS is handled by the server headers.
    // Fixed the ReferenceError by ensuring these are globally accessible within the scope.
    const PYTHON_SERVICE_API = 'https://afdmi-123.onrender.com';
    const NODE_API = 'https://afdmi-123.onrender.com'; 
    const API = NODE_API; // Alias used in legacy functions

    // Initialize Lucide Icons if available
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // ============================================================
    // 2. TAB NAVIGATION LOGIC
    // ============================================================
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update Tab States
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const targetPanel = document.getElementById(tab.dataset.tab);
            if (targetPanel) targetPanel.classList.add('active');
            
            // Re-render icons for dynamic content
            if (window.lucide) window.lucide.createIcons();
        });
    });

    // ============================================================
    // 3. DOCUMENT INGESTION & UI STATE
    // ============================================================
    let ingestedFiles = [];
    let lastExtractionResult = null;
    let lastExtractionCSV = '';

    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    const startIngestionBtn = document.getElementById('startIngestionBtn');
    const processingLogs = document.getElementById('processingLogs');
    const resultsTable = document.getElementById('resultsTable');

    // Source Selection Logic
    const sourceFileUpload = document.getElementById('sourceFileUpload');
    const sourceExistingData = document.getElementById('sourceExistingData');
    const fileUploadSection = document.getElementById('fileUploadSection');
    const existingDataSection = document.getElementById('existingDataSection');

    if (sourceFileUpload && sourceExistingData) {
        sourceFileUpload.addEventListener('change', () => {
            fileUploadSection.style.display = 'block';
            existingDataSection.style.display = 'none';
        });
        
        sourceExistingData.addEventListener('change', () => {
            fileUploadSection.style.display = 'none';
            existingDataSection.style.display = 'block';
            loadExistingData();
        });
    }

    // Dropzone Interactivity
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files);
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files || []));
    }

    function handleFileSelect(files) {
        const allowed = [...files].filter(f => /\.(pdf|csv)$/i.test(f.name));
        if (allowed.length > 30) return alert('Maximum 30 files allowed');
        
        ingestedFiles = Array.from(allowed);
        if (fileCount) fileCount.textContent = `${ingestedFiles.length} file(s) ready`;
        
        if (fileList) {
            fileList.innerHTML = ingestedFiles.map(f => `
                <div class="file-item">
                    <i data-lucide="file"></i>
                    <span>${f.name} (${(f.size / 1024).toFixed(1)} KB)</span>
                </div>
            `).join('');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    // ============================================================
    // 4. AI EXTRACTION ENGINE (PORT 0000)
    // ============================================================
    if (startIngestionBtn) {
        startIngestionBtn.addEventListener('click', async () => {
            const dataSource = document.querySelector('input[name="dataSource"]:checked')?.value;
            const modelSelect = document.getElementById('modelSelect');
            const modelType = modelSelect?.value;
            const params = document.getElementById('modelParams')?.value.trim();

            if (!modelType) return alert('Please select a model');
            
            // UI Feedback
            processingLogs.innerHTML = '<div class="loading"><i data-lucide="loader" class="spin"></i> Contacting AI Service...</div>';
            startIngestionBtn.disabled = true;
            if (window.lucide) window.lucide.createIcons();

            try {
                let result;
                if (dataSource === 'file') {
                    if (ingestedFiles.length === 0) throw new Error('Please upload files first');
                    result = await processWithAI(ingestedFiles[0], modelType, params);
                } else {
                    const surveyId = document.getElementById('existingDataSelect')?.value;
                    if (!surveyId) throw new Error('Please select a survey');
                    result = await processExistingData(surveyId, modelType, params);
                }

                displayResults(result);
                addToHistory(dataSource, modelType, 'Completed');
                processingLogs.textContent = 'Processing complete!';
            } catch (error) {
                processingLogs.innerHTML = `<span class="error-text">Error: ${error.message}</span>`;
                addToHistory(dataSource, modelType, 'Failed');
            } finally {
                startIngestionBtn.disabled = false;
            }
        });
    }

    async function processWithAI(file, modelType, params) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('prompt', getPromptForModel(modelType, params));
        
        const response = await fetch(`${PYTHON_SERVICE_API}/process`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        return await response.json();
    }

    function getPromptForModel(modelType, params) {
        const modelPrompts = {
            'ocr_standard': 'Extract all text content from this document',
            'ocr_handwriting': 'Extract handwritten text fields',
            'data_classification': 'Categorize the data found in this document',
            'auto_clean': 'Normalize and clean the data structure',
            'regression': 'Perform regression analysis on the numeric variables'
        };
        return `${modelPrompts[modelType] || 'Extract data'}. ${params ? 'Additional Instructions: ' + params : ''}`;
    }

    // ============================================================
    // 5. RESULT VISUALIZATION & EXPORT
    // ============================================================
    function displayResults(result) {
        const data = result.extractions || result.data || [];
        if (data.length === 0) {
            resultsTable.innerHTML = '<p class="placeholder">No structured data found.</p>';
            return;
        }

        const headers = Object.keys(data[0]);
        let tableHtml = `
            <div class="table-container">
                <table>
                    <thead><tr>${headers.map(h => `<th>${h.replace(/_/g, ' ')}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${data.map(row => `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        
        resultsTable.innerHTML = tableHtml;
        lastExtractionResult = data;
        lastExtractionCSV = generateCSV(data, headers);
    }

    function generateCSV(data, headers) {
        const csvRows = [headers.join(',')];
        for (const row of data) {
            const values = headers.map(header => {
                let cell = String(row[header] || '');
                return cell.includes(',') ? `"${cell.replace(/"/g, '""')}"` : cell;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    }

    // Export Handlers
    document.getElementById('downloadResultsBtn')?.addEventListener('click', () => {
        if (!lastExtractionCSV) return;
        const blob = new Blob([lastExtractionCSV], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ADMI_Extraction_${Date.now()}.csv`;
        a.click();
    });

    // ============================================================
    // 6. HEALTH CHECK (Service Status Card)
    // ============================================================
    async function checkServiceHealth() {
        const statusEl = document.getElementById('service-status');
        if (!statusEl) return;
        
        try {
            const res = await fetch(`${PYTHON_SERVICE_API}/health`);
            if (res.ok) {
                statusEl.innerHTML = '<span class="status-online">● Production Service Connected (Port 0000)</span>';
            } else {
                throw new Error();
            }
        } catch (e) {
            statusEl.innerHTML = '<span class="status-offline">● Production Service Disconnected</span>';
        }
    }

    checkServiceHealth();
    // Re-check health every 60 seconds
    setInterval(checkServiceHealth, 60000);
});
