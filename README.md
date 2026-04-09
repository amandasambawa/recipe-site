# Fred and Amanda's Kitchen

Personal recipe website. Node.js + Express, no frontend framework.

## Setup

```bash
cd recipe-site
npm install
npm start        # production
npm run dev      # dev mode — auto-restarts on save (Node 18+)
```

Open [http://localhost:3000](http://localhost:3000).

## Adding a new recipe

1. Create a new file in `/data/` named `{slug}.json` (e.g. `crispy-tofu-bowls.json`).
2. Follow the schema below.
3. Restart the server — recipes are loaded once at startup.
4. Upload photos with the curl commands below.

### Recipe JSON schema

```json
{
  "slug":          "your-recipe-slug",
  "title":         "Full Recipe Title",
  "heroTitle":     ["Line One", "ItalicWord", "Line Three"],
  "heroItalicWord":"ItalicWord",
  "category":      "Appetizer",
  "cuisine":       "Japanese-Inspired",
  "subhead":       "Short teaser shown on the card and hero.",
  "intro":         "Full paragraph intro text.",
  "introHighlight":"Sentence to highlight in red.",
  "badge":         "Ready in 15 Minutes",
  "stats": { "prep": "5", "cook": "10", "servings": "2–4" },
  "ingredientGroups": [
    {
      "name": "Group Name",
      "ingredients": [
        { "amount": "1 tbsp", "item": "Ingredient description" }
      ]
    }
  ],
  "tip": "Optional tip shown in the sidebar.",
  "steps": [
    { "title": "Step Title", "description": "Step instructions.", "photo": "step1" }
  ],
  "banner": {
    "emoji": "🌶️",
    "title": "Banner Heading",
    "text":  "Full-width banner body text. Omit this key to hide the banner."
  },
  "variations": [
    { "title": "Variation Name", "text": "Description." }
  ]
}
```

`heroTitle` / `heroItalicWord` are optional — if omitted, the `title` is used as a single heading line.  
`banner` and `variations` are optional sections.

## Uploading photos

```bash
# curl -F "photo=@/path/to/file.jpg" http://localhost:3000/upload/{slug}/{step}
curl -F "photo=@~/Desktop/step1.heic" http://localhost:3000/upload/soy-ginger-shishito-peppers/1
curl -F "photo=@~/Desktop/step2.jpg"  http://localhost:3000/upload/soy-ginger-shishito-peppers/2
curl -F "photo=@~/Desktop/step3.jpg"  http://localhost:3000/upload/soy-ginger-shishito-peppers/3
```

- Accepts JPEG, PNG, HEIC, HEIF, WEBP — all converted to optimised JPEG automatically.
- Saved to `public/uploads/{slug}/step{n}.jpg`.
- The recipe page shows a warm placeholder until a photo is uploaded.
- The index card uses `step3.jpg` (the finished dish) as the card thumbnail.

## Project structure

```
recipe-site/
├── server.js              Express server, routes, upload endpoint
├── package.json
├── data/
│   └── *.json             One file per recipe
├── templates/
│   ├── shared.js          nav, footer, escape helper
│   ├── index.js           Recipe collection page
│   └── recipe.js          Individual recipe page
├── public/
│   ├── style.css          All shared + page styles
│   └── uploads/
│       └── {slug}/        Per-recipe photo directories
└── README.md
```
