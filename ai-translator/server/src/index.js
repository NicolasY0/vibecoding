/**
 * AI Translator 自建服务器
 *
 * 功能:
 * - POST /v1/translate      翻译代理 + 共享缓存
 * - GET  /v1/health          健康检查
 * - POST /v1/flashcards      创建闪卡
 * - GET  /v1/flashcards      获取闪卡列表
 * - DELETE /v1/flashcards/:id 删除闪卡
 * - GET  /v1/flashcards/export/csv  CSV 导出
 */

import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ==================== 数据库 ====================

const db = new Database('.data/translator.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    original TEXT NOT NULL,
    translation TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    synced INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS translate_cache (
    cache_key TEXT PRIMARY KEY,
    translations TEXT NOT NULL,
    hit_count INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    ttl INTEGER NOT NULL
  );
`);

// ==================== 缓存 ====================

const CACHE_TTL = 3600000;  // 1 小时

// 定期清理过期缓存
setInterval(() => {
  db.prepare('DELETE FROM translate_cache WHERE created_at + ttl < ?').run(Date.now());
}, 600000);  // 每 10 分钟

function getCached(key) {
  const row = db.prepare(
    'SELECT translations, hit_count FROM translate_cache WHERE cache_key = ? AND created_at + ttl > ?'
  ).get(key, Date.now());
  if (row) {
    db.prepare('UPDATE translate_cache SET hit_count = hit_count + 1 WHERE cache_key = ?').run(key);
    return JSON.parse(row.translations);
  }
  return null;
}

function setCache(key, translations) {
  db.prepare(
    'INSERT OR REPLACE INTO translate_cache (cache_key, translations, hit_count, created_at, ttl) VALUES (?, ?, 1, ?, ?)'
  ).run(key, JSON.stringify(translations), Date.now(), CACHE_TTL);
}

// ==================== 简单认证 ====================

function authMiddleware(req, res, next) {
  const token = process.env.SERVER_TOKEN;
  if (!token) return next();  // 未配置 token 则跳过认证

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ==================== 路由 ====================

// 健康检查
app.get('/v1/health', (req, res) => {
  const cacheCount = db.prepare('SELECT COUNT(*) as count FROM translate_cache').get();
  const flashcardCount = db.prepare('SELECT COUNT(*) as count FROM flashcards').get();
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    cache: { entries: cacheCount.count },
    flashcards: { count: flashcardCount.count }
  });
});

// 翻译代理（带缓存）
app.post('/v1/translate', authMiddleware, (req, res) => {
  const { text, sourceLang, targetLang, engineId, style } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  // 生成缓存 key
  const cacheKey = crypto.createHash('md5')
    .update(`${sourceLang || 'auto'}:${targetLang || 'zh-CN'}:${engineId || ''}:${style || 'literal'}:${text}`)
    .digest('hex');

  // 检查缓存
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ cached: true, data: cached });
  }

  // 缓存未命中 → 客户端自行调用翻译引擎
  // 此端点主要用于共享缓存，实际翻译由浏览器插件直接调用引擎 API
  res.json({
    cached: false,
    cacheKey,
    message: 'Cache miss. Client should call translation engine directly and optionally cache the result here.'
  });
});

// 闪卡 CRUD
app.post('/v1/flashcards', authMiddleware, (req, res) => {
  const { id, original, translation, createdAt } = req.body;
  if (!original) return res.status(400).json({ error: 'original text is required' });

  const cardId = id || crypto.randomUUID();
  const ts = createdAt || Date.now();

  try {
    db.prepare(
      'INSERT OR REPLACE INTO flashcards (id, original, translation, created_at, synced) VALUES (?, ?, ?, ?, 1)'
    ).run(cardId, original, translation || '', ts);
    res.json({ success: true, id: cardId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/v1/flashcards', authMiddleware, (req, res) => {
  const { limit = 500, offset = 0 } = req.query;
  const cards = db.prepare(
    'SELECT id, original, translation, created_at as createdAt, synced FROM flashcards ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(Number(limit), Number(offset));
  res.json({ success: true, data: cards });
});

app.delete('/v1/flashcards/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM flashcards WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// CSV 导出
app.get('/v1/flashcards/export/csv', authMiddleware, (req, res) => {
  const cards = db.prepare(
    'SELECT original, translation, created_at FROM flashcards ORDER BY created_at DESC'
  ).all();

  let csv = '﻿原文,译文,时间\n';  // BOM for Excel
  for (const c of cards) {
    csv += `"${c.original.replace(/"/g, '""')}","${c.translation.replace(/"/g, '""')}","${new Date(c.created_at).toLocaleString('zh-CN')}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="flashcards_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// ==================== 启动 ====================

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`[SmartTranslate Server] Running on http://localhost:${PORT}`);
  console.log(`[SmartTranslate Server] Health: http://localhost:${PORT}/v1/health`);
});
