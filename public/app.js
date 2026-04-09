/* ─── Fred and Amanda's Kitchen — SPA ──────────────────────────────── */
'use strict';

// ── Category colour map ────────────────────────────────────────────────
const CAT_COLORS = {
  'appetizer':  '#3a5c3f',
  'mains':      '#7a4520',
  'main':       '#7a4520',
  'desserts':   '#7a3050',
  'dessert':    '#7a3050',
  'sides':      '#2a4a70',
  'side':       '#2a4a70',
  'breakfast':  '#6a5820',
  'drinks':     '#1e6060',
  'drink':      '#1e6060',
};
function catColor(category = '') {
  return CAT_COLORS[category.toLowerCase()] ?? '#3a5c3f';
}

// ── Step ordinal words ─────────────────────────────────────────────────
const ORDINALS = ['one','two','three','four','five','six','seven','eight','nine','ten'];

// ── HTML escape ────────────────────────────────────────────────────────
function e(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── DOM refs ───────────────────────────────────────────────────────────
const viewIndex  = document.getElementById('view-index');
const viewRecipe = document.getElementById('view-recipe');
const filterBar  = document.getElementById('filterBar');
const recipeGrid = document.getElementById('recipeGrid');

// ── State ──────────────────────────────────────────────────────────────
let allRecipes    = [];
let activeFilter  = 'all';
let currentSlug   = null;

// ══════════════════════════════════════════════════════════════════════
// BOOT — decide which view to render based on current URL
// ══════════════════════════════════════════════════════════════════════
(async function boot() {
  allRecipes = await fetchJSON('/api/recipes');

  const slug = slugFromPath(location.pathname);
  if (slug) {
    renderIndex(allRecipes);  // build the grid in the background
    await openRecipe(slug, false); // false = no pushState (already in URL)
  } else {
    renderIndex(allRecipes);
  }
})();

// ══════════════════════════════════════════════════════════════════════
// ROUTING
// ══════════════════════════════════════════════════════════════════════
function slugFromPath(pathname) {
  const m = pathname.match(/^\/recipe\/([^/]+)/);
  return m ? m[1] : null;
}

window.addEventListener('popstate', async (ev) => {
  const slug = slugFromPath(location.pathname);
  if (slug) {
    await openRecipe(slug, false);
  } else {
    closeRecipe(false);
  }
});

// ══════════════════════════════════════════════════════════════════════
// INDEX — render the card grid
// ══════════════════════════════════════════════════════════════════════
function renderIndex(recipes) {
  // Filter bar
  const categories = [...new Set(recipes.map(r => r.category).filter(Boolean))];
  filterBar.innerHTML = [
    `<button class="filter-btn active" data-filter="all">All</button>`,
    ...categories.map(c =>
      `<button class="filter-btn" data-filter="${e(c)}">${e(c.endsWith('s') ? c : c + 's')}</button>`
    )
  ].join('');

  filterBar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderCards();
    });
  });

  renderCards();
}

function renderCards() {
  const visible = activeFilter === 'all'
    ? allRecipes
    : allRecipes.filter(r => r.category === activeFilter);

  if (visible.length === 0) {
    recipeGrid.innerHTML = `<p class="grid-loading">No recipes in this category yet.</p>`;
    return;
  }

  recipeGrid.innerHTML = visible.map((r, i) => cardHTML(r, i === 0)).join('');

  // Attach click handlers
  recipeGrid.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', (ev) => {
      ev.preventDefault();
      openRecipe(card.dataset.slug, true);
    });
  });
}

function cardHTML(r, featured) {
  const color  = catColor(r.category);
  const photo  = `/uploads/${e(r.slug)}/step3.jpg`;
  const stats  = [
    r.stats?.prep     ? `<span class="card-stat">${e(r.stats.prep)} min prep</span>`   : '',
    r.stats?.cook     ? `<span class="card-stat">${e(r.stats.cook)} min cook</span>`   : '',
    r.stats?.servings ? `<span class="card-stat">Serves ${e(r.stats.servings)}</span>` : '',
  ].join('');

  return `
  <div class="recipe-card${featured ? ' is-featured' : ''}" data-slug="${e(r.slug)}" role="button" tabindex="0">
    <div class="card-photo">
      <div class="card-photo-placeholder">${e(r.title)}</div>
      <img src="${photo}" alt="${e(r.title)}" loading="lazy" onerror="this.style.opacity='0'">
      <span class="card-cat-badge" style="--cat-badge-color:${color}">${e(r.category || '')}</span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-cuisine">${e(r.cuisine || '')}</span>
      </div>
      <h2 class="card-title">${e(r.title)}</h2>
      <p class="card-sub">${e(r.subhead || '')}</p>
      <div class="card-footer">
        <div class="card-stats">${stats}</div>
        <div class="card-arrow">
          <svg viewBox="0 0 16 16"><polyline points="3,8 13,8"/><polyline points="9,4 13,8 9,12"/></svg>
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
// RECIPE — open / close
// ══════════════════════════════════════════════════════════════════════
async function openRecipe(slug, pushState) {
  if (pushState) {
    history.pushState({ slug }, '', `/recipe/${slug}`);
  }
  currentSlug = slug;

  // Show loading state immediately so slide-up has content
  viewRecipe.innerHTML = `
    <div class="recipe-back-bar">
      ${backBtnHTML()}
      <span class="back-bar-title"></span>
    </div>
    <div class="recipe-loading">Loading…</div>`;

  attachBackBtn();

  // Trigger slide-up on next frame
  requestAnimationFrame(() => {
    viewRecipe.setAttribute('aria-hidden', 'false');
    viewRecipe.classList.add('is-open');
    viewRecipe.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  });

  // Fetch recipe data
  const recipe = await fetchJSON(`/api/recipes/${slug}`);

  if (!recipe || recipe.error) {
    viewRecipe.querySelector('.recipe-loading').textContent = 'Recipe not found.';
    return;
  }

  // Render full recipe into the sliding panel
  viewRecipe.innerHTML = renderRecipeHTML(recipe);
  attachBackBtn();
}

function closeRecipe(pushState) {
  if (pushState) {
    history.pushState({}, '', '/');
  }
  currentSlug = null;

  viewRecipe.classList.remove('is-open');
  viewRecipe.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Scroll index back to top if coming from direct URL
  window.scrollTo({ top: 0 });
}

function backBtnHTML() {
  return `
  <button class="back-btn" aria-label="Back to all recipes">
    <svg viewBox="0 0 16 16"><polyline points="10,3 4,8 10,13"/><line x1="4" y1="8" x2="13" y2="8"/></svg>
    All Recipes
  </button>`;
}

function attachBackBtn() {
  viewRecipe.querySelector('.back-btn')?.addEventListener('click', () => {
    closeRecipe(true);
  });
}

// ══════════════════════════════════════════════════════════════════════
// RECIPE — HTML renderer
// ══════════════════════════════════════════════════════════════════════
function renderRecipeHTML(r) {
  const categoryTag = [r.category, r.cuisine].filter(Boolean).join(' · ');

  // Hero title
  const titleLines = r.heroTitle || [r.title];
  const heroH1 = titleLines.map(line =>
    line === r.heroItalicWord
      ? `<span class="italic-green">${e(line)}</span>`
      : e(line)
  ).join('<br>');

  // Intro — optional red-highlighted sentence
  let introHTML = e(r.intro || '');
  if (r.introHighlight) {
    introHTML = introHTML.replace(e(r.introHighlight), `<span class="spicy">${e(r.introHighlight)}</span>`);
  }

  // Ingredients
  const ingredientsHTML = (r.ingredientGroups || []).map(g => `
    <div class="ingredient-group">
      <p class="group-label">${e(g.name)}</p>
      <table class="ingredient-table"><tbody>
        ${(g.ingredients || []).map(ing => `
        <tr>
          <td class="amount">${e(ing.amount)}</td>
          <td class="item">${e(ing.item)}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`).join('');

  // Steps
  const stepsHTML = (r.steps || []).map((step, i) => {
    const delay = (0.05 + i * 0.14).toFixed(2);
    const word  = ORDINALS[i] || String(i + 1);
    const photo = `/uploads/${e(r.slug)}/${e(step.photo)}.jpg`;
    return `
    <div class="step-card" style="animation-delay:${delay}s">
      <span class="step-number">${word}.</span>
      <h3 class="step-title">${e(step.title)}</h3>
      <p class="step-desc">${e(step.description)}</p>
      <div class="step-photo">
        <div class="step-placeholder">Step ${i + 1} Photo</div>
        <img src="${photo}" alt="${e(step.title)}" loading="lazy" onerror="this.style.opacity='0'">
      </div>
    </div>`;
  }).join('');

  // Optional banner
  const bannerHTML = r.banner ? `
  <div class="spicy-banner">
    <div class="spicy-banner-inner">
      <h2 class="spicy-banner-title">${r.banner.emoji ? r.banner.emoji + ' ' : ''}${e(r.banner.title)}</h2>
      <p class="spicy-banner-body">${e(r.banner.text)}</p>
    </div>
  </div>` : '';

  // Optional variations
  const variationsHTML = r.variations?.length ? `
  <section class="variations">
    <div class="variations-inner">
      <h2 class="variations-title">Ways to Mix It Up</h2>
      <div class="variations-grid">
        ${r.variations.map(v => `
        <div class="variation-card">
          <h3 class="variation-card-title">${e(v.title)}</h3>
          <p class="variation-card-body">${e(v.text)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>` : '';

  return `
  <div class="recipe-back-bar">
    ${backBtnHTML()}
    <span class="back-bar-title">${e(r.title)}</span>
  </div>

  <section class="hero">
    <div class="hero-text">
      <div class="hero-tag"><span>${e(categoryTag)}</span></div>
      <h1 class="hero-title">${heroH1}</h1>
      <p class="hero-subhead">${e(r.subhead || '')}</p>
      <div class="hero-stats">
        ${r.stats?.prep     ? `<span class="stat-pill">${e(r.stats.prep)} Prep min</span>`     : ''}
        ${r.stats?.cook     ? `<span class="stat-pill">${e(r.stats.cook)} Cook min</span>`     : ''}
        ${r.stats?.servings ? `<span class="stat-pill">${e(r.stats.servings)} Servings</span>` : ''}
      </div>
    </div>
    <div class="hero-image">
      <div class="hero-placeholder">Finished Dish Photo</div>
      <img src="/uploads/${e(r.slug)}/step3.jpg" alt="${e(r.title)}" onerror="this.style.opacity='0'">
      ${r.badge ? `<div class="hero-badge">${e(r.badge)}</div>` : ''}
    </div>
  </section>

  <div class="recipe-divider"><span>🌿</span></div>

  <p class="intro">${introHTML}</p>

  <div class="main-grid">
    <aside class="sidebar">
      <h2 class="sidebar-title">Ingredients</h2>
      <p class="sidebar-subtitle">What You'll Need</p>
      ${ingredientsHTML}
      ${r.tip ? `
      <div class="tip-box">
        <p class="tip-label">💡 Tip</p>
        <p class="tip-text">${e(r.tip)}</p>
      </div>` : ''}
    </aside>
    <div class="steps">${stepsHTML}</div>
  </div>

  ${bannerHTML}
  ${variationsHTML}

  <footer class="recipe-footer">
    Made with <span class="heart">♥</span> by Amanda &amp; Fred &nbsp;·&nbsp; The Blog Hub &nbsp;·&nbsp; All rights reserved
  </footer>`;
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
