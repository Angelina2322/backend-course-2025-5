import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';
import superagent from 'superagent';

// --------------------
// 1️⃣ Налаштування CLI (commander)
// --------------------
program
  .requiredOption('-h, --host <string>', 'server host')
  .requiredOption('-p, --port <number>', 'server port')
  .requiredOption('-c, --cache <string>', 'cache directory path');

program.parse(process.argv);
const options = program.opts();

const cacheDir = options.cache;

// Створюємо директорію кешу, якщо її немає
await fs.mkdir(cacheDir, { recursive: true });
console.log(`🗂️ Cache directory ready: ${cacheDir}`);

// --------------------
// 2️⃣ Функція для шляху до файлу в кеші
// --------------------
function getCacheFilePath(code) {
  return path.join(cacheDir, `${code}.jpg`);
}

// --------------------
// 3️⃣ Створення HTTP сервера
// --------------------
const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split('/');
  const code = urlParts[1]; // /200 → "200"

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: missing code');
    return;
  }

  const filePath = getCacheFilePath(code);

  try {
    if (req.method === 'GET') {
      try {
        // 1️⃣ Спробуємо прочитати з кешу
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);
        console.log(`✅ Sent from cache: ${filePath}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          // 2️⃣ Якщо нема у кеші — завантажуємо з http.cat
          try {
            const response = await superagent.get(`https://http.cat/${code}.jpg`).responseType('arraybuffer');
            const buffer = Buffer.from(response.body);
            // Зберігаємо в кеш
            await fs.writeFile(filePath, buffer);
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(buffer);
            console.log(`⬇️ Downloaded and cached: ${filePath}`);
          } catch (downloadErr) {
            console.error(`❌ Failed to fetch from http.cat: ${downloadErr.message}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          }
        } else {
          throw err;
        }
      }

    } else if (req.method === 'PUT') {
      // 3️⃣ Отримуємо картинку з тіла запиту
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(filePath, buffer);
      res.writeHead(201, { 'Content-Type': 'text/plain' });
      res.end('Created');
      console.log(`🆕 File saved: ${filePath}`);

    } else if (req.method === 'DELETE') {
      // 4️⃣ Видаляємо картинку
      await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Deleted');
      console.log(`🗑️ File deleted: ${filePath}`);

    } else {
      // 5️⃣ Будь-які інші методи — 405
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

// --------------------
// 4️⃣ Запуск сервера
// --------------------
server.listen(options.port, options.host, () => {
  console.log(`🚀 Server running at http://${options.host}:${options.port}/`);
});
