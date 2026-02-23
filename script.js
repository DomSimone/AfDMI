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
    let currentFile = null;

    // ============================================================
    // 2. TAB NAVIGATION LOGIC
    // ============================================================
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            if (target) target.classList.add('active');
            
            if (window.lucide) window.lucide.createIcons();
        });
    });

    // ============================================================
    // 3. DOCUMENT INGESTION (TAB: Documents)
    // ============================================================
    const fileInput = document.getElementById('fileInput');
    const dropzone = document.getElementById('dropzone');
    const fileCount = document.getElementById('fileCount');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        
        // Drag and Drop support
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary-green)';
            dropzone.style.background = '#f0f4f0';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = '#ccc';
            dropzone.style.background = 'transparent';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#ccc';
            if (e.dataTransfer.files.length) {
                handleFileChange(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFileChange(e.target.files[0]);
            }
        });
    }

    function handleFileChange(file) {
        currentFile = file;
        if (fileCount) fileCount.textContent = file.name;
        console.log("File selected:", file.name);
    }

    // ============================================================
    // 4. AI EXTRACTION LOGIC
    // ============================================================
    const extractBtn = document.getElementById('extractBtn');
    const extractPrompt = document.getElementById('extractPrompt');
    const extractOutput = document.getElementById('extractOutput');
    const outputFormat = document.getElementById('outputFormat');

    if (extractBtn) {
        extractBtn.addEventListener('click', async () => {
            const promptValue = extractPrompt.value.trim();
            
            if (!currentFile) return alert('Please upload a PDF or CSV file first.');
            if (!promptValue) return alert('Please enter an extraction prompt.');

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
