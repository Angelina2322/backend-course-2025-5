import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';
import superagent from 'superagent';

// --------------------
// 1️⃣ Commander для CLI
// --------------------
program
  .requiredOption('-h, --host <string>', 'server host')
  .requiredOption('-p, --port <number>', 'server port')
  .requiredOption('-c, --cache <string>', 'cache directory path');

program.parse(process.argv);
const options = program.opts();

const cacheDir = options.cache;

// Створюємо кеш директорію, якщо її нема
await fs.mkdir(cacheDir, { recursive: true });
console.log(`Cache directory ready: ${cacheDir}`);

// --------------------
// 2️⃣ Функція для шляху до картинки
// --------------------
function getCacheFilePath(code) {
  return path.join(cacheDir, `${code}.jpg`);
}

// --------------------
// 3️⃣ HTTP сервер
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
        // Спробуємо прочитати з кешу
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);
      } catch (err) {
        if (err.code === 'ENOENT') {
          // Якщо немає у кеші, запитуємо з http.cat
          try {
            const response = await superagent.get(`https://http.cat/${code}`).responseType('blob');
            const buffer = Buffer.from(await response.body.arrayBuffer ? await response.body.arrayBuffer() : response.body);
            // Зберігаємо у кеш
            await fs.writeFile(filePath, buffer);
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(buffer);
          } catch {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          }
        } else {
          throw err;
        }
      }

    } else if (req.method === 'PUT') {
      // Записуємо картинку з тіла запиту
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(filePath, buffer);
      res.writeHead(201, { 'Content-Type': 'text/plain' });
      res.end('Created');

    } else if (req.method === 'DELETE') {
      // Видаляємо картинку
      await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Deleted');

    } else {
      // Інші методи
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
  console.log(`Server running at http://${options.host}:${options.port}/`);
});

