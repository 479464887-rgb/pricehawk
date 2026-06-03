// PriceHawk - Popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  await loadAlerts();

  document.getElementById('clear-alerts').addEventListener('click', async (e) => {
    e.preventDefault();
    await chrome.runtime.sendMessage({ type: 'CLEAR_ALERTS' });
    document.getElementById('alert-list').innerHTML = '';
  });

  document.getElementById('btn-settings').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

async function loadProducts() {
  const resp = await chrome.runtime.sendMessage({ type: 'GET_WATCHED' });
  const products = resp.products || [];
  const container = document.getElementById('product-list');

  if (!products.length) {
    container.innerHTML = `<div class="empty"><div class="emoji">🛒</div><p>暂无监控商品</p><p style="font-size:11px;color:#484f58">浏览电商网站自动添加</p></div>`;
    return;
  }

  container.innerHTML = products.map(p => {
    const { history = [] } = p;
    let changeHtml = '';
    if (history.length >= 2) {
      const prev = history[history.length - 2].price;
      const curr = p.price;
      const diff = curr - prev;
      const pct = ((diff / prev) * 100).toFixed(1);
      if (diff !== 0) {
        const dir = diff > 0 ? 'up' : 'down';
        const sign = diff > 0 ? '+' : '';
        changeHtml = `<div class="price-change ${dir}">${sign}${pct}%</div>`;
      }
    }

    return `
    <div class="product">
      ${p.image ? `<img class="product-img" src="${p.image}" onerror="this.style.display='none'">` : ''}
      <div class="product-info">
        <div class="product-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="product-platform">${p.platform}</div>
      </div>
      <div class="product-price">
        <div class="current-price">${p.currency || '¥'}${p.price}</div>
        ${changeHtml}
      </div>
      <div class="product-actions">
        <button class="product-btn" data-action="remove" data-id="${p.id}">✕</button>
      </div>
    </div>`;
  }).join('');

  // Remove handlers
  container.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ type: 'REMOVE_PRODUCT', productId: btn.dataset.id });
      await loadProducts();
    });
  });
}

async function loadAlerts() {
  const { alerts = [] } = await chrome.storage.local.get('alerts');
  const container = document.getElementById('alert-list');

  if (!alerts.length) {
    container.innerHTML = '<div style="font-size:12px;color:#484f58;padding:8px 0">暂无降价提醒</div>';
    return;
  }

  container.innerHTML = alerts.slice(0, 5).map(a => `
    <div class="alert-item">
      <strong>${a.title}</strong>
      <p>${a.message}</p>
      <div class="alert-time">${formatTime(a.time)}</div>
    </div>
  `).join('');
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
