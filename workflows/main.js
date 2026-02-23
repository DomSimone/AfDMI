// To run this backend server, you need Node.js and several packages installed.
// Open a terminal in the project root directory and run:
// npm install busboy bcryptjs jsonwebtoken
// node workflows/main.js
// The server will start on http://localhost:3001.

const http = require('http');
const https = require('https');
const { URL } = require('url');
const busboy = require('busboy');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { mockExtractFromDocuments } = require('./mockExtraction');
const path = require('path');

// In-memory storage
const users = {};
const surveys = [];
const chatHistories = {};
const researchChatHistories = {}; 
const sessionFiles = []; 

// --- DeepSeek API Configuration ---
const DEEPSEEK_API_KEY = "sk-3c594d38d93947d8b1b6bf93c161857b";
const DEEPSEEK_MODEL = "deepseek-chat";

// --- Python LangExtract Service Configuration ---
// UPDATED: Changed from localhost to the production Render URL with HTTPS
const PYTHON_SERVICE_URL = `https://afdmi-123.onrender.com/process`; 

const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- API ROUTING ---

    // Root Endpoint
    if (reqUrl.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ADMI Backend Server is Running');
    }

    // 1. Document Ingestion
    else if (reqUrl.pathname === '/api/documents/ingest' && req.method === 'POST') {
        let bb;
        try {
            bb = busboy({ headers: req.headers });
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid upload request.' }));
        }

        const filePromises = [];
        bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                let safeFilename = typeof filename === 'string' ? filename : (filename?.filename || "unknown_file");
                safeFilename = path.basename(safeFilename);

                const buffer = Buffer.concat(chunks);
                const fileData = {
                    filename: safeFilename,
                    mimetype: mimetype,
                    content: buffer.toString('base64'),
                    size: buffer.length
                };
                sessionFiles.push(fileData);
                filePromises.push(fileData);
            });
        });

        bb.on('finish', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                files: filePromises.map(f => ({ filename: f.filename, size: f.size, content: f.content })) 
            }));
        });
        req.pipe(bb);
    }

    // 2. Document Extraction (Connected to Render)
    else if (reqUrl.pathname === '/api/documents/extract' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { documentContent, prompt, outputFormat, filename } = JSON.parse(body);
                let buffer;
                let safeFilename = filename || "document.pdf";

                if (documentContent) {
                    buffer = Buffer.from(documentContent, 'base64');
                } else if (filename) {
                    const found = sessionFiles.find(f => f.filename === filename);
                    if (found) buffer = Buffer.from(found.content, 'base64');
                }

                if (!buffer) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'File not found.' }));
                }

                // Prepare Multi-part form data for the Python Service
                const formData = new FormData();
                const blob = new Blob([buffer], { type: 'application/pdf' });
                formData.append('file', blob, safeFilename);
                formData.append('prompt', prompt || 'Extract data');

                try {
                    const pythonServiceRes = await fetch(PYTHON_SERVICE_URL, {
                        method: 'POST',
                        body: formData,
                    });

                    const pythonResult = await pythonServiceRes.json();

                    if (!pythonServiceRes.ok) throw new Error(pythonResult.error || 'Python service failed');

                    const data = pythonResult.extractions || pythonResult.data || pythonResult;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ data: data, outputFormat: outputFormat }));

                } catch (fetchError) {
                    console.error("Fetch Error:", fetchError.message);
                    // Fallback to Mock
                    const mockRes = mockExtractFromDocuments({
                        files: [{ fileName: safeFilename, buffer: buffer, mimetype: 'application/pdf' }],
                        prompt: prompt,
                        outputFormat: outputFormat || 'json'
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ data: mockRes.data, warning: "Fallback triggered." }));
                }
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Error' }));
            }
        });
    }

    // 3. User Authentication
    else if (reqUrl.pathname === '/api/signup' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            const { name, email, password } = JSON.parse(body);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            users[email] = { name, email, password: hashedPassword };
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'User created.' }));
        });
    }

    else if (reqUrl.pathname === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            const { email, password } = JSON.parse(body);
            const user = users[email];
            if (!user || !await bcrypt.compare(password, user.password)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid login' }));
            }
            const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token, name: user.name }));
        });
    }

    // 4. Research Assistant (DeepSeek)
    else if (reqUrl.pathname === '/api/research-assistant' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            const { message, userId = 'default' } = JSON.parse(body);
            if (!researchChatHistories[userId]) researchChatHistories[userId] = [];
            researchChatHistories[userId].push({ role: 'user', content: message });

            const dsOptions = {
                hostname: 'api.deepseek.com',
                path: '/v1/chat/completions',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }
            };

            const dsReq = https.request(dsOptions, (dsRes) => {
                let data = '';
                dsRes.on('data', d => data += d);
                dsRes.on('end', () => {
                    const reply = JSON.parse(data).choices[0].message.content;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ reply }));
                });
            });
            dsReq.write(JSON.stringify({ model: DEEPSEEK_MODEL, messages: researchChatHistories[userId] }));
            dsReq.end();
        });
    }

    else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});
