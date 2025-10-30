// index.js
import { Command } from 'commander';
import http from 'http';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .requiredOption('-h, --host <string>', 'server host (e.g. localhost)')
  .requiredOption('-p, --port <number>', 'server port (e.g. 3000)')
  .requiredOption('-c, --cache <path>', 'cache directory path');

program.parse(process.argv);
const options = program.opts();

// === Перевіряємо наявність директорії для кешу ===
if (!fs.existsSync(options.cache)) {
  console.log(`📁 Директорія "${options.cache}" не існує. Створюю...`);
  fs.mkdirSync(options.cache, { recursive: true });
}

// === Створюємо простий HTTP сервер ===
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Сервер працює успішно! ✅');
});

// === Запускаємо сервер ===
server.listen(options.port, options.host, () => {
  console.log(`🚀 Сервер запущено на http://${options.host}:${options.port}`);
  console.log(`🗂️ Кеш директорія: ${path.resolve(options.cache)}`);
});
