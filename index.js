import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';
import superagent from 'superagent';

// ===========================
// 1️⃣ Налаштування CLI
// ===========================
program
  .requiredOption('-h, --host <string>', 'server host')
  .requiredOption('-p, --port <number>', 'server port')
  .requiredOption('-c, --cache <string>', 'cache directory path');

program.parse(process.argv);
const options = program.opts();
const cacheDir = options.cache;

// Створюємо кеш-папку, якщо її ще нема
await fs.mkdir(cacheDir, { recursive: true });
console.log(`🗂️ Cache directory ready: ${cacheDir}`);

// ===========================
// 2️⃣ Функція для побудови шляху до файлу у кеші
// ===========================
function getCacheFilePath(code) {
  return path.join(cacheDir, `${code}.jpg`);
}

// ===========================
// 3️⃣ HTTP сервер
// ===========================
const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split('/');
  const code = urlParts[1]; // Наприклад: /200 → "200"

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: missing code');
    return;
  }

  const filePath = getCacheFilePath(code);
  console.log(`Запит: ${req.method} ${req.url}`);

  try {
    if (req.method === 'GET') {
      try {
        // 🔹 Пробуємо знайти у кеші
        const data = await fs.readFile(filePath);
        console.log(`✅ Взято з кешу: ${filePath}`);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);

      } catch (err) {
        if (err.code === 'ENOENT') {
          // 🔹 Якщо нема у кеші — завантажуємо з http.cat
          console.log(`⬇️ Завантажую з https://http.cat/${code}.jpg ...`);
          try {
            const response = await superagent
              .get(`https://http.cat/${code}.jpg`)
              .responseType('arraybuffer');

            const buffer = Buffer.from(response.body);
            await fs.writeFile(filePath, buffer); // зберігаємо у кеш
            console.log(`💾 Збережено у кеш: ${filePath}`);

            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(buffer);
          } catch (fetchErr) {
            console.error(`❌ Не знайдено на http.cat/${code}.jpg`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          }
        } else {
          throw err;
        }
      }

    } else {
      // Якщо метод не GET
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }

  } catch (err) {
    console.error('⚠️ Помилка:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

// ===========================
// 4️⃣ Запуск сервера
// ===========================
server.listen(options.port, options.host, () => {
  console.log(`🚀 Server running at http://${options.host}:${options.port}/`);
});
