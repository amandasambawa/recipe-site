'use strict';

const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

const dataDir    = path.join(__dirname, 'data');
const publicDir  = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

// ── Recipe cache ───────────────────────────────────────────────────────
const recipeMap = new Map(); // slug → recipe object

function loadRecipes() {
  recipeMap.clear();
  for (const file of fs.readdirSync(dataDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const recipe = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
      recipeMap.set(recipe.slug, recipe);
    } catch (err) {
      console.warn(`Could not load ${file}:`, err.message);
    }
  }
}

loadRecipes();
console.log(`Loaded ${recipeMap.size} recipe(s): ${[...recipeMap.keys()].join(', ')}`);

// ── Static files ───────────────────────────────────────────────────────
app.use(express.static(publicDir));

// ── API ────────────────────────────────────────────────────────────────
app.get('/api/recipes', (_req, res) => {
  res.json([...recipeMap.values()]);
});

app.get('/api/recipes/:slug', (req, res) => {
  const recipe = recipeMap.get(req.params.slug);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  res.json(recipe);
});

// ── SPA fallback — /recipe/:slug serves index.html, JS handles routing ─
app.get('/recipe/:slug', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Image upload ───────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okMime = ['image/jpeg','image/png','image/heic','image/heif','image/webp'];
    const okExt  = /\.(jpe?g|png|heic|heif|webp)$/i;
    if (okMime.includes(file.mimetype.toLowerCase()) || okExt.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted (JPEG, PNG, HEIC, WEBP)'));
    }
  },
});

app.post('/upload/:slug/:step', upload.single('photo'), async (req, res) => {
  const { slug } = req.params;
  const step = parseInt(req.params.step, 10);

  if (!recipeMap.has(slug))
    return res.status(404).json({ error: `Recipe "${slug}" not found` });
  if (!Number.isInteger(step) || step < 1)
    return res.status(400).json({ error: 'step must be a positive integer' });
  if (!req.file)
    return res.status(400).json({ error: 'No file provided' });

  const slugDir    = path.join(uploadsDir, slug);
  const outputPath = path.join(slugDir, `step${step}.jpg`);
  fs.mkdirSync(slugDir, { recursive: true });

  try {
    await sharp(req.file.buffer)
      .rotate()
      .jpeg({ quality: 88, progressive: true })
      .toFile(outputPath);

    res.json({
      success: true,
      path:    `/uploads/${slug}/step${step}.jpg`,
      message: `Step ${step} photo saved for "${slug}"`,
    });
  } catch (err) {
    console.error('Image processing error:', err);
    res.status(500).json({ error: 'Failed to process image: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Recipe site running at http://localhost:${PORT}`);
});
