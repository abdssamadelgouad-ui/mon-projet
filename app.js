// ============================================================
//  GroceryPro — app.js
//  All data is stored in localStorage so it persists across
//  browser sessions — no server or database required.
// ============================================================
/* ─── DATA LAYER ─────────────────────────────────────────── */

function loadProducts() {
  return JSON.parse(localStorage.getItem('gp_products') || '[]');
}

function saveProducts(products) {
  localStorage.setItem('gp_products', JSON.stringify(products));
}

function loadSales() {
  return JSON.parse(localStorage.getItem('gp_sales') || '[]');
}

function saveSales(sales) {
  localStorage.setItem('gp_sales', JSON.stringify(sales));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ─── NAVIGATION ─────────────────────────────────────────── */

const navBtns  = document.querySelectorAll('.nav-btn');
const pages    = document.querySelectorAll('.page');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    // Refresh page content whenever we switch to it
    if (btn.dataset.page === 'dashboard') renderDashboard();
    if (btn.dataset.page === 'products')  renderProducts();
    if (btn.dataset.page === 'sell')      renderSellPage();
    if (btn.dataset.page === 'history')   renderHistory();
  });
});

/* ─── DASHBOARD ──────────────────────────────────────────── */

function renderDashboard() {
  const products = loadProducts();
  const sales    = loadSales();

  // Date badge
  const now = new Date();
  document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Monthly profit & sales count (current month)
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlySales = sales.filter(s => s.date.startsWith(monthKey));
  const monthlyProfit = monthlySales.reduce((sum, s) => sum + s.profit, 0);
  const monthlyCount  = monthlySales.reduce((sum, s) => sum + s.qty, 0);

  document.getElementById('stat-profit').textContent   = '$' + monthlyProfit.toFixed(2);
  document.getElementById('stat-sales').textContent    = monthlyCount;
  document.getElementById('stat-products').textContent = products.length;

  // Low stock (qty <= 5)
  const lowStock = products.filter(p => p.qty <= 5);
  document.getElementById('stat-lowstock').textContent = lowStock.length;

  // Low stock alerts
  const alertList = document.getElementById('low-stock-list');
  if (lowStock.length === 0) {
    alertList.innerHTML = '<p class="empty-msg">✅ All products are well stocked!</p>';
  } else {
    alertList.innerHTML = lowStock.map(p => `
      <div class="alert-item">
        <span><strong>${escHtml(p.name)}</strong> is running low</span>
        <span class="stock-badge ${p.qty === 0 ? 'out' : 'low'}">
          ${p.qty === 0 ? 'Out of stock' : p.qty + ' left'}
        </span>
      </div>
    `).join('');
  }

  // Recent sales (last 5)
  const recentList = document.getElementById('recent-sales-list');
  const recent = [...sales].reverse().slice(0, 5);
  if (recent.length === 0) {
    recentList.innerHTML = '<p class="empty-msg">No sales recorded yet.</p>';
  } else {
    recentList.innerHTML = recent.map(s => `
      <div class="recent-sale-item">
        <span>
          <strong>${escHtml(s.productName)}</strong>
          &nbsp;×${s.qty}
        </span>
        <span class="sale-profit">+$${s.profit.toFixed(2)}</span>
        <span style="color:var(--muted);font-size:0.8rem">${formatDate(s.date)}</span>
      </div>
    `).join('');
  }
}

/* ─── PRODUCTS PAGE ──────────────────────────────────────── */

const productGrid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');

searchInput.addEventListener('input', renderProducts);

function renderProducts(searchTerm = searchInput.value) {
  const products = loadProducts();
  const query = searchTerm.toString().toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    productGrid.innerHTML = `<p class="empty-msg">${
      query ? 'No products match your search.' : 'No products added yet. Click "Add Product" to start.'
    }</p>`;
    return;
  }

  productGrid.innerHTML = filtered.map(p => {
    const profit = p.sellPrice - p.buyPrice;
    const stockClass = p.qty === 0 ? 'out' : p.qty <= 5 ? 'low' : 'ok';
    const stockLabel = p.qty === 0 ? 'Out of stock' : p.qty <= 5 ? `Low: ${p.qty} left` : `${p.qty} in stock`;

    return `
      <div class="product-card">
        <div class="product-card-img">
          ${p.image
            ? `<img src="${p.image}" alt="${escHtml(p.name)}"/>`
            : `<span>🛒</span>`
          }
        </div>
        <div class="product-card-body">
          <div class="product-card-name">${escHtml(p.name)}</div>
          <div class="product-card-meta">
            <span>Buy: <strong>$${p.buyPrice.toFixed(2)}</strong></span>
            <span>Sell: <strong>$${p.sellPrice.toFixed(2)}</strong></span>
            <span>Profit/unit: <strong style="color:var(--green)">$${profit.toFixed(2)}</strong></span>
          </div>
          <span class="stock-badge ${stockClass}">${stockLabel}${p.unit ? ' ' + p.unit : ''}</span>
        </div>
        <div class="product-card-actions">
          <button class="btn-icon" onclick="openEditModal('${p.id}')">✏️ Edit</button>
          <button class="btn-icon danger" onclick="deleteProduct('${p.id}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const products = loadProducts().filter(p => p.id !== id);
  saveProducts(products);
  renderProducts();
  renderDashboard();
}

/* ─── ADD / EDIT MODAL ───────────────────────────────────── */

const modal          = document.getElementById('product-modal');
const imgUploadArea  = document.getElementById('img-upload-area');
const imgFileInput   = document.getElementById('img-file-input');
const previewImg     = document.getElementById('preview-img');
const imgPlaceholder = document.getElementById('img-placeholder');
const profitPreview  = document.getElementById('profit-preview');

let editingId   = null;
let currentImage = null;

document.getElementById('open-add-modal').addEventListener('click', () => openAddModal());
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-modal').addEventListener('click', closeModal);

function openAddModal() {
  editingId    = null;
  currentImage = null;
  document.getElementById('modal-title').textContent = 'Add Product';
  clearModalForm();
  modal.classList.add('open');
}

function openEditModal(id) {
  const products = loadProducts();
  const product  = products.find(p => p.id === id);
  if (!product) return;

  editingId    = id;
  currentImage = product.image || null;

  document.getElementById('modal-title').textContent = 'Edit Product';
  document.getElementById('product-name').value       = product.name;
  document.getElementById('product-qty').value        = product.qty;
  document.getElementById('product-unit').value       = product.unit || '';
  document.getElementById('product-buy-price').value  = product.buyPrice;
  document.getElementById('product-sell-price').value = product.sellPrice;

  if (product.image) {
    previewImg.src = product.image;
    previewImg.style.display = 'block';
    imgPlaceholder.style.display = 'none';
  } else {
    previewImg.style.display = 'none';
    imgPlaceholder.style.display = 'flex';
  }

  updateProfitPreview();
  modal.classList.add('open');
}

function closeModal() {
  modal.classList.remove('open');
  clearModalForm();
}

function clearModalForm() {
  document.getElementById('product-name').value       = '';
  document.getElementById('product-qty').value        = '';
  document.getElementById('product-unit').value       = '';
  document.getElementById('product-buy-price').value  = '';
  document.getElementById('product-sell-price').value = '';
  previewImg.style.display   = 'none';
  previewImg.src             = '';
  imgPlaceholder.style.display = 'flex';
  profitPreview.innerHTML = 'Profit per unit: <strong>—</strong>';
}

// Image upload
imgUploadArea.addEventListener('click', () => imgFileInput.click());
imgFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    currentImage = ev.target.result;        // base64 data URL
    previewImg.src = currentImage;
    previewImg.style.display = 'block';
    imgPlaceholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

// Live profit preview while typing prices
['product-buy-price', 'product-sell-price'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateProfitPreview);
});

function updateProfitPreview() {
  const buy  = parseFloat(document.getElementById('product-buy-price').value)  || 0;
  const sell = parseFloat(document.getElementById('product-sell-price').value) || 0;
  const profit = sell - buy;
  profitPreview.innerHTML = `Profit per unit: <strong style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">
    $${profit.toFixed(2)}</strong>`;
}

// Save product
document.getElementById('save-product').addEventListener('click', () => {
  const name      = document.getElementById('product-name').value.trim();
  const qty       = Number.parseInt(document.getElementById('product-qty').value);
  const unit      = document.getElementById('product-unit').value.trim();
  const buyPrice  = parseFloat(document.getElementById('product-buy-price').value);
  const sellPrice = parseFloat(document.getElementById('product-sell-price').value);

  if (!name)              return alert('Please enter a product name.');
  if (isNaN(qty) || qty < 0) return alert('Please enter a valid quantity (0 or more).');
  if (isNaN(buyPrice) || buyPrice < 0)  return alert('Please enter a valid purchase price.');
  if (isNaN(sellPrice) || sellPrice < 0) return alert('Please enter a valid selling price.');

  const products = loadProducts();

  if (editingId) {
    // Update existing
    const idx = products.findIndex(p => p.id === editingId);
    if (idx !== -1) {
      products[idx] = { ...products[idx], name, qty, unit, buyPrice, sellPrice, image: currentImage };
    }
  } else {
    // Add new
    products.push({ id: generateId(), name, qty, unit, buyPrice, sellPrice, image: currentImage });
  }

  saveProducts(products);
  closeModal();
  renderProducts();
  renderDashboard();
});

/* ─── SELL PAGE ──────────────────────────────────────────── */

const sellSelect   = document.getElementById('sell-product-select');
const sellInfo     = document.getElementById('sell-info');
const sellFeedback = document.getElementById('sell-feedback');

function renderSellPage() {
  const products = loadProducts();
  sellSelect.innerHTML = '<option value="">— Choose a product —</option>' +
    products.map(p =>
      `<option value="${p.id}" ${p.qty === 0 ? 'disabled' : ''}>
         ${escHtml(p.name)} ${p.qty === 0 ? '(out of stock)' : `(${p.qty} left)`}
       </option>`
    ).join('');
  sellInfo.style.display = 'none';
  sellFeedback.style.display = 'none';
  sellFeedback.className = 'sell-feedback';
}

sellSelect.addEventListener('change', () => {
  const id = sellSelect.value;
  if (!id) { sellInfo.style.display = 'none'; return; }
  const products = loadProducts();
  const product  = products.find(p => p.id === id);
  if (!product) return;

  document.getElementById('sell-price-display').textContent  = '$' + product.sellPrice.toFixed(2);
  document.getElementById('sell-stock-display').textContent  = product.qty + (product.unit ? ' ' + product.unit : ' units');
  document.getElementById('sell-profit-display').textContent = '$' + (product.sellPrice - product.buyPrice).toFixed(2);
  sellInfo.style.display = 'flex';
  sellFeedback.style.display = 'none';
  sellFeedback.className = 'sell-feedback';
});

document.getElementById('confirm-sell').addEventListener('click', () => {
  const id  = sellSelect.value;
  const qty = parseInt(document.getElementById('sell-qty').value) || 0;

  if (!id)     return showFeedback('Please select a product.', 'error');
  if (qty <= 0) return showFeedback('Please enter a quantity of at least 1.', 'error');

  const products = loadProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return showFeedback('Product not found.', 'error');

  const product = products[idx];
  if (qty > product.qty) return showFeedback(`Not enough stock! Only ${product.qty} available.`, 'error');

  // Deduct stock
  products[idx].qty -= qty;
  saveProducts(products);

  // Record sale
  const profit = (product.sellPrice - product.buyPrice) * qty;
  const sales  = loadSales();
  sales.push({
    id: generateId(),
    productId:   product.id,
    productName: product.name,
    qty,
    sellPrice:   product.sellPrice,
    buyPrice:    product.buyPrice,
    profit,
    date:        new Date().toISOString()
  });
  saveSales(sales);

  showFeedback(`✅ Sold ${qty} × ${product.name} for $${(product.sellPrice * qty).toFixed(2)}. Profit: +$${profit.toFixed(2)}`, 'success');

  // Refresh sell dropdown
  renderSellPage();
});

function showFeedback(msg, type) {
  sellFeedback.textContent = msg;
  sellFeedback.className   = `sell-feedback ${type}`;
}

/* ─── HISTORY PAGE ───────────────────────────────────────── */

function renderHistory(filterMonth = null) {
  let sales = loadSales();

  if (filterMonth) {
    sales = sales.filter(s => s.date.startsWith(filterMonth));
  }

  const tbody = document.getElementById('history-tbody');
  const summary = document.getElementById('history-summary');

  if (sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No sales found${filterMonth ? ' for this month' : ''}.</td></tr>`;
    summary.style.display = 'none';
    return;
  }

  // Summary
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const totalUnits  = sales.reduce((sum, s) => sum + s.qty, 0);
  summary.style.display = 'block';
  summary.innerHTML = `📊 <strong>${sales.length}</strong> transactions · 
                       <strong>${totalUnits}</strong> units sold · 
                       Total Profit: <strong>$${totalProfit.toFixed(2)}</strong>`;

  // Table rows (newest first)
  tbody.innerHTML = [...sales].reverse().map(s => `
    <tr>
      <td>${formatDate(s.date)}</td>
      <td><strong>${escHtml(s.productName)}</strong></td>
      <td>${s.qty}</td>
      <td>$${s.sellPrice.toFixed(2)}</td>
      <td>$${s.buyPrice.toFixed(2)}</td>
      <td class="profit-cell">+$${s.profit.toFixed(2)}</td>
    </tr>
  `).join('');
}

document.getElementById('filter-btn').addEventListener('click', () => {
  const val = document.getElementById('month-filter').value;
  if (val) renderHistory(val);
});

document.getElementById('reset-filter-btn').addEventListener('click', () => {
  document.getElementById('month-filter').value = '';
  renderHistory();
});

document.getElementById('clear-history-btn').addEventListener('click', () => {
  if (confirm('Clear ALL sales history? This cannot be undone.')) {
    saveSales([]);
    renderHistory();
    renderDashboard();
  }
});

/* ─── UTILITIES ──────────────────────────────────────────── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ─── INIT ───────────────────────────────────────────────── */

renderDashboard();
