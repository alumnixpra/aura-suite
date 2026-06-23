const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'aura-suite-dev-secret-change-me';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Ese email ya está registrado' });

  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, email, name, hash, new Date().toISOString());

  const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, email, name } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Documents CRUD
app.get('/api/documents', authMiddleware, (req, res) => {
  const { type } = req.query;
  let rows;
  if (type) {
    rows = db.prepare('SELECT id, type, title, created_at, updated_at FROM documents WHERE owner_id = ? AND type = ? ORDER BY updated_at DESC')
      .all(req.user.id, type);
  } else {
    rows = db.prepare('SELECT id, type, title, created_at, updated_at FROM documents WHERE owner_id = ? ORDER BY updated_at DESC')
      .all(req.user.id);
  }
  res.json({ documents: rows });
});

app.get('/api/documents/:id', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
  res.json({ document: { ...doc, content: JSON.parse(doc.content) } });
});

const DEFAULT_CONTENT = {
  doc: { html: '<h1>Documento sin título</h1><p></p>' },
  sheet: { cells: {}, rows: 50, cols: 26 },
  slide: { slides: [{ id: 'slide-1', elements: [] }] },
  pdf: { mode: 'create', pages: [{ text: '' }], sourceFile: null },
};

app.post('/api/documents', authMiddleware, (req, res) => {
  const { type, title } = req.body || {};
  if (!['doc', 'sheet', 'slide', 'pdf'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de documento inválido' });
  }
  const id = nanoid();
  const now = new Date().toISOString();
  const content = JSON.stringify(DEFAULT_CONTENT[type]);
  const docTitle = title || `${{ doc: 'Documento', sheet: 'Hoja de cálculo', slide: 'Presentación', pdf: 'PDF' }[type]} sin título`;

  db.prepare('INSERT INTO documents (id, owner_id, type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, type, docTitle, content, now, now);

  res.json({ document: { id, owner_id: req.user.id, type, title: docTitle, content: DEFAULT_CONTENT[type], created_at: now, updated_at: now } });
});

app.put('/api/documents/:id', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

  const { title, content } = req.body || {};
  const newTitle = title !== undefined ? title : doc.title;
  const newContent = content !== undefined ? JSON.stringify(content) : doc.content;
  const now = new Date().toISOString();

  db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?')
    .run(newTitle, newContent, now, req.params.id);

  res.json({ document: { ...doc, title: newTitle, content: JSON.parse(newContent), updated_at: now } });
});

app.delete('/api/documents/:id', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Aura Suite API escuchando en http://localhost:${PORT}`);
});
