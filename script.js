/**
 * ADMI - AI Agent & Data Ingestion Logic
 * Optimized for ai-agent.html
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // 1. CONFIGURATION & CONSTANTS
    // ============================================================
    const PYTHON_API = 'https://afdmi-123.onrender.com';
    
    // Initialize Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Global State for Document Processing
    document.addEventListener('DOMContentLoaded', () => {
    const PYTHON_SERVICE_API = 'https://afdmi-123.onrender.com';
    
    if (window.lucide) { window.lucide.createIcons(); }

        // Ingest to Node.js backend
    const res = await fetch('/api/documents/ingest', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
        window.currentUploadedFile = data.files[0].filename; // Store for extraction
        document.getElementById('fileCount').textContent = `Ready: ${file.name}`;
    }
}

                              // --- Tab Navigation ---
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            if (target) target.classList.add('active');
            if (window.lucide) window.lucide.createIcons();
        });
    });

    // --- Document Ingestion Logic ---
    let ingestedFiles = [];
    const dropZone = document.getElementById('dropzone'); // Match lowercase if that's in your HTML
    const fileInput = document.getElementById('fileInput');
    const extractBtn = document.getElementById('extractBtn');
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    const startIngestionBtn = document.getElementById('startIngestionBtn');
    const processingLogs = document.getElementById('processingLogs');
    const extractOutput = document.getElementById('extractOutput'); // The container for results

    if if (dropZone) {
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        handleIngestion(e.dataTransfer.files[0]);
    };
}
        fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));
    }

    function handleFileSelect(files) {
        const allowed = [...files].filter(f => /\.(pdf|csv)$/i.test(f.name));
        ingestedFiles = Array.from(allowed);
        if (fileCount) fileCount.textContent = `${ingestedFiles.length} file(s) selected`;
        
        if (fileList) {
            fileList.innerHTML = ingestedFiles.map(f => `
                <div class="file-item" style="display:flex; align-items:center; gap:10px; margin-top:5px;">
                    <i data-lucide="file" style="width:16px;"></i>
                    <span>${f.name}</span>
                </div>
            `).join('');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    // --- AI Extraction Execution ---
    if (startIngestionBtn) {
        startIngestionBtn.addEventListener('click', async () => {
            const modelSelect = document.getElementById('modelSelect');
            if (ingestedFiles.length === 0) return alert('Please upload a file first');
            
            processingLogs.innerHTML = '<div class="loading"><i data-lucide="loader-2" class="spin"></i> Processing...</div>';
            startIngestionBtn.disabled = true;
            if (window.lucide) window.lucide.createIcons();

            try {
                const formData = new FormData();
                formData.append('file', ingestedFiles[0]);
                formData.append('prompt', getPromptForModel(modelSelect.value, ""));
                
                const response = await fetch(`${PYTHON_SERVICE_API}/process`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                displayResults(result);
                processingLogs.innerHTML = '<span style="color:green;">Processing complete!</span>';
            } catch (error) {
                processingLogs.innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
            } finally {
                startIngestionBtn.disabled = false;
            }
        });
    }

    function getPromptForModel(modelType, params) {
        const prompts = {
            'ocr_standard': 'Extract all text content',
            'ocr_handwriting': 'Extract handwritten text',
            'data_classification': 'Categorize the data',
            'auto_clean': 'Normalize and clean data structure'
        };
        return prompts[modelType] || 'Extract data';
    }

    function displayResults(result) {
        const target = document.getElementById('extractOutput');
        if (!target) return;
        const data = result.data || result;
        target.innerHTML = `<pre style="background:#f4f4f4; padding:10px; overflow:auto;">${JSON.stringify(data, null, 2)}</pre>`;
    }

    // Health Check
    async function checkHealth() {
        const status = document.getElementById('service-status');
        if (!status) return;
        try {
            const res = await fetch(`${PYTHON_SERVICE_API}/health`);
            status.innerHTML = res.ok ? '<span style="color: green;">● API Online</span>' : '<span style="color: red;">● API Offline</span>';
        } catch (e) {
            status.innerHTML = '<span style="color: red;">● API Connection Error</span>';
        }
    }
    checkHealth();
});
            // UI Feedback: Loading
            extractOutput.innerHTML = '<div class="loading"><i data-lucide="loader-2" class="spin"></i> AI is processing your document...</div>';
            if (window.lucide) window.lucide.createIcons();
            extractBtn.disabled = true;

            const formData = new FormData();
            formData.append('file', currentFile);
            formData.append('prompt', promptValue);

            try {
                const response = await fetch(`${PYTHON_API}/process`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error(`Server Error: ${response.status}`);
                
                const result = await response.json();
                renderResults(result, outputFormat.value);

            } catch (err) {
                extractOutput.innerHTML = `<div class="error-message"><strong>Extraction Failed:</strong> ${err.message}</div>`;
            } finally {
                extractBtn.disabled = false;
            }
        });
    }

    function renderResults(result, format) {
        const data = result.data || result;
        
        if (format === 'json') {
            extractOutput.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        } else {
            // Default to table/pretty view
            if (Array.isArray(data) && data.length > 0) {
                const headers = Object.keys(data[0]);
                let html = `<div style="overflow-x:auto;"><table><thead><tr>`;
                headers.forEach(h => html += `<th>${h}</th>`);
                html += `</tr></thead><tbody>`;
                data.forEach(row => {
                    html += `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`;
                });
                html += `</tbody></table></div>`;
                extractOutput.innerHTML = html;
            } else {
                extractOutput.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
            }
        }
    }

    // ============================================================
    // 5. DATA TERMINAL LOGIC (TAB: Terminal)
    // ============================================================
    const executeBtn = document.getElementById('executeBtn');
    const csvInput = document.getElementById('csvInput');
    const commandInput = document.getElementById('commandInput');
    const terminalOutput = document.getElementById('terminalOutput');

    if (executeBtn) {
        executeBtn.addEventListener('click', () => {
            const rawData = csvInput.value.trim();
            const command = commandInput.value.trim();

            if (!rawData) return alert("Please paste CSV data.");
            
            terminalOutput.textContent = `Executing "${command}" on data...\n\nProcessing...`;
            
            // Simulation of terminal processing
            setTimeout(() => {
                terminalOutput.textContent = `Command: ${command}\nStatus: Success\nRows analyzed: ${rawData.split('\n').length}`;
            }, 800);
        });
    }

    // ============================================================
    // 6. HEALTH CHECK
    // ============================================================
    async function checkHealth() {
        const statusEl = document.getElementById('service-status');
        if (!statusEl) return;

        try {
            const res = await fetch(`${PYTHON_API}/health`);
            if (res.ok) {
                statusEl.innerHTML = '<span style="color: #2e7d32;">● Production API Online</span>';
            } else {
                throw new Error();
            }
        } catch (e) {
            statusEl.innerHTML = '<span style="color: #d32f2f;">● API Offline</span>';
        }
    }

    checkHealth();
    setInterval(checkHealth, 30000); // Check every 30s
});
