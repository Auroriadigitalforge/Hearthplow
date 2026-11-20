import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';

const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  try {
    const data = await readFile(p);
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(8099, () => console.log('serving on 8099'));
