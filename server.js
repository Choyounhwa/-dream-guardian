const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.csv': 'text/csv; charset=UTF-8',
    '.txt': 'text/plain; charset=UTF-8',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=UTF-8', 'Allow': 'GET, HEAD' });
        res.end('Method Not Allowed');
        return;
    }

    let reqUrl;
    try {
        reqUrl = decodeURI(req.url.split('?')[0]);
    } catch (_) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('Bad Request');
        return;
    }
    if (reqUrl === '/') reqUrl = '/dream_guardian/index.html';
    else if (reqUrl.endsWith('/')) reqUrl += 'index.html';

    let safePath = path.resolve(ROOT_DIR, `.${reqUrl}`);
    const relativePath = path.relative(ROOT_DIR, safePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    fs.stat(safePath, (err, stats) => {
        if (err || !stats.isFile()) {
            if (stats && stats.isDirectory()) {
                safePath = path.join(safePath, 'index.html');
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
                res.end('404 Not Found: ' + reqUrl);
                return;
            }
        }

        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(safePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(req.method === 'HEAD' ? undefined : content);
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log(`\n==============================================`);
    console.log(`✨ 《꿈의 수호신》 웹 서버 구동 성공!`);
    console.log(`- PC 브라우저 접속: http://localhost:${PORT}/dream_guardian/`);

    if (HOST === '0.0.0.0' || HOST === '::') {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(`- 스마트폰(모바일) 접속: http://${iface.address}:${PORT}/dream_guardian/`);
                }
            }
        }
    }
    console.log(`==============================================\n`);
});
