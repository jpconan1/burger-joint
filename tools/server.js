import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'src', 'data', 'items.json');
const EDITOR_DIR = path.join(ROOT_DIR, 'tools', 'editor');

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // API: Save items
    if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                // Verify it's valid JSON before saving
                const json = JSON.parse(body);
                fs.writeFileSync(DATA_FILE, JSON.stringify(json, null, 4));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                console.log('Saved items.json');
            } catch (e) {
                console.error('Save failed:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // API: Get items (or just serve the file)
    if (req.method === 'GET' && req.url === '/items.json') {
        fs.readFile(DATA_FILE, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error reading items.json');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    // Serve static files from tools/editor
    let filePath = req.url === '/' ? 'index.html' : req.url;
    // Remove leading slash
    if (filePath.startsWith('/')) filePath = filePath.slice(1);

    // Simple sanitization
    if (filePath.includes('..')) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const absPath = path.join(EDITOR_DIR, filePath);

    // simple check to prevent directory traversal
    if (!absPath.startsWith(EDITOR_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(absPath, (err, data) => {
        if (err) {
            // Try 404
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        let contentType = 'text/plain';
        if (filePath.endsWith('.html')) contentType = 'text/html';
        if (filePath.endsWith('.js')) contentType = 'text/javascript';
        if (filePath.endsWith('.css')) contentType = 'text/css';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Editor server running at http://localhost:${PORT}`);
});
