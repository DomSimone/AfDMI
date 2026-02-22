/**
 * Docs with Umbuzo - Frontend Application
 */

const API = '/api';

// ---- Tab Navigation ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ---- Document Ingestion ----
let ingestedFiles = [];
let selectedDocContent = null;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const fileList = document.getElementById('fileList');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files || []));

function handleFileSelect(files) {
  const allowed = [...files].filter(f => /\.(pdf|csv)$/i.test(f.name));
  if (allowed.length > 30) {
    alert('Maximum 30 files allowed');
    return;
  }
  const formData = new FormData();
  allowed.forEach(f => formData.append('files', f));
  
  fetch(`${API}/documents/ingest`, {
    method: 'POST',
    body: formData
  })
  .then(r => r.json())
  .then(res => {
    if (res.error) throw new Error(res.error);
    ingestedFiles = res.files;
    fileCount.textContent = `${ingestedFiles.length} file(s) ready`;
    fileList.innerHTML = ingestedFiles.map(f => `<div>${f.filename}</div>`).join('');
    selectedDocContent = ingestedFiles[0]?.content;
    const sel = document.getElementById('docSelect');
    const docSel = document.getElementById('docSelector');
    sel.innerHTML = ingestedFiles.map((f, i) => `<option value="${i}">${f.filename}</option>`).join('');
    docSel.classList.toggle('hidden', ingestedFiles.length <= 1);
  })
  .catch(err => alert('Upload failed: ' + err.message));
}

// ---- Extraction ----
const extractPrompt = document.getElementById('extractPrompt');
const outputFormat = document.getElementById('outputFormat');
const extractBtn = document.getElementById('extractBtn');
const extractOutput = document.getElementById('extractOutput');
const copyOutput = document.getElementById('copyOutput');
const downloadOutput = document.getElementById('downloadOutput');

document.getElementById('docSelect')?.addEventListener('change', (e) => {
  const i = parseInt(e.target.value, 10);
  selectedDocContent = ingestedFiles[i]?.content;
});

extractBtn.addEventListener('click', () => {
  const prompt = extractPrompt.value.trim();
  if (!prompt) { alert('Enter an extraction prompt'); return; }
  if (!selectedDocContent && ingestedFiles.length === 0) { alert('Upload documents first'); return; }
  const docIdx = document.getElementById('docSelect')?.value;
  const content = docIdx != null ? ingestedFiles[parseInt(docIdx, 10)]?.content : selectedDocContent || ingestedFiles[0]?.content;
  if (!content) return;

  fetch(`${API}/documents/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentContent: content, prompt, outputFormat: outputFormat.value })
  })
  .then(r => r.json())
  .then(res => {
    if (res.error) throw new Error(res.error);
    const data = res.outputFormat === 'csv' ? res.data : JSON.stringify(res.data, null, 2);
    extractOutput.innerHTML = '';
    extractOutput.appendChild(document.createTextNode(data));
  })
  .catch(err => alert('Extraction failed: ' + err.message));
});

copyOutput.addEventListener('click', () => {
  const text = extractOutput.textContent;
  if (text && !text.includes('Extracted data will appear here')) {
    navigator.clipboard.writeText(text);
    copyOutput.textContent = 'Copied!';
    setTimeout(() => copyOutput.textContent = 'Copy to Clipboard', 1500);
  }
});

downloadOutput.addEventListener('click', () => {
  const text = extractOutput.textContent;
  if (!text || text.includes('Extracted data will appear here')) return;
  const ext = outputFormat.value === 'csv' ? 'csv' : 'json';
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  a.download = `extracted.${ext}`;
  a.click();
});

// ---- Analog Metadata ----
const analogDropzone = document.getElementById('analogDropzone');
const analogFileInput = document.getElementById('analogFileInput');
const analogFileCount = document.getElementById('analogFileCount');
const analogStatus = document.getElementById('analogStatus');

analogDropzone.addEventListener('click', () => analogFileInput.click());
analogDropzone.addEventListener('dragover', (e) => { e.preventDefault(); analogDropzone.classList.add('dragover'); });
analogDropzone.addEventListener('dragleave', () => analogDropzone.classList.remove('dragover'));
analogDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  analogDropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) uploadAnalogMetadata(e.dataTransfer.files);
});
analogFileInput.addEventListener('change', (e) => uploadAnalogMetadata(e.target.files || []));

function uploadAnalogMetadata(files) {
  const allowed = [...files].filter(f => /\.(pdf|csv)$/i.test(f.name)).slice(0, 30);
  const formData = new FormData();
  allowed.forEach(f => formData.append('files', f));
  fetch(`${API}/documents/analog-metadata`, { method: 'POST', body: formData })
    .then(r => r.json())
    .then(res => {
      if (res.error) throw new Error(res.error);
      analogFileCount.textContent = `${res.files.length} file(s)`;
      analogStatus.innerHTML = res.files.map(f => `<div>${f.filename}: ${f.summary}</div>`).join('');
    })
    .catch(err => alert('Upload failed: ' + err.message));
}

// ---- Data Terminal ----
const csvInput = document.getElementById('csvInput');
const csvFileInput = document.getElementById('csvFileInput');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const commandInput = document.getElementById('commandInput');
const executeBtn = document.getElementById('executeBtn');
const terminalOutput = document.getElementById('terminalOutput');
const chartContainer = document.getElementById('chartContainer');
const chartCanvas = document.getElementById('chartCanvas');
const outputTabs = document.querySelectorAll('.output-tab');

let chartInstance = null;

uploadCsvBtn.addEventListener('click', () => csvFileInput.click());
csvFileInput.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { csvInput.value = r.result; };
  r.readAsText(f);
});

outputTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    outputTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const showChart = tab.dataset.output === 'chart';
    chartContainer.classList.toggle('hidden', !showChart);
    terminalOutput.classList.toggle('hidden', showChart);
  });
});

executeBtn.addEventListener('click', executeCommand);
commandInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') executeCommand(); });

function executeCommand() {
  const csvData = csvInput.value.trim();
  const command = commandInput.value.trim();
  if (!csvData) { alert('Paste or upload CSV data first'); return; }
  if (!command) { alert('Enter a command'); return; }

  fetch(`${API}/terminal/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvData, command })
  })
  .then(r => r.json())
  .then(res => {
    if (res.error) throw new Error(res.error);
    terminalOutput.innerHTML = '';
    terminalOutput.appendChild(document.createTextNode(res.textOutput || 'No output'));
    terminalOutput.classList.remove('hidden');
    chartContainer.classList.add('hidden');
    outputTabs.forEach(t => t.classList.remove('active'));
    outputTabs[0].classList.add('active');

    if (res.chartData) {
      if (res.command === 'linear_regression') renderRegressionChart(res.chartData);
      else if (res.command === 'histogram') renderHistogramChart(res.chartData);
    }
  })
  .catch(err => {
    terminalOutput.innerHTML = '';
    terminalOutput.appendChild(document.createTextNode('Error: ' + err.message));
    terminalOutput.classList.remove('hidden');
    chartContainer.classList.add('hidden');
  });
}

function renderRegressionChart(data) {
  if (chartInstance) chartInstance.destroy();
  const ctx = chartCanvas.getContext('2d');
  const { x, y, slope, intercept } = data;
  const minX = Math.min(...x), maxX = Math.max(...x);
  const padding = (maxX - minX) * 0.1 || 1;
  const lineX = [minX - padding, maxX + padding];
  const lineY = lineX.map(xi => slope * xi + intercept);

  chartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Actual data',
          data: x.map((xi, i) => ({ x: xi, y: y[i] })),
          backgroundColor: 'rgba(88, 166, 255, 0.6)',
          borderColor: 'rgba(88, 166, 255, 1)',
          pointRadius: 6
        },
        {
          label: 'Regression line',
          data: lineX.map((xi, i) => ({ x: xi, y: lineY[i] })),
          type: 'line',
          borderColor: 'rgba(63, 185, 80, 1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e6edf3' } } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#2d3a4d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#2d3a4d' } }
      }
    }
  });
}

function renderHistogramChart(data) {
  if (chartInstance) chartInstance.destroy();
  const ctx = chartCanvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: data.column || 'Count',
        data: data.values,
        backgroundColor: 'rgba(88, 166, 255, 0.5)',
        borderColor: 'rgba(88, 166, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e6edf3' } } },
      scales: {
        x: { ticks: { color: '#8b949e', maxRotation: 45 }, grid: { color: '#2d3a4d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#2d3a4d' } }
      }
    }
  });
}
