// ExtPay - Payment integration
importScripts('ExtPay.js');
const extpay = ExtPay('pricehawk');
extpay.startBackground();

// PriceHawk - Background Service Worker
const DEFAULTS = {
  alertThreshold: 5,    // 降价5%提醒
  refreshHours: 6,      // 每6小时查价
  notifyOnDrop: true    // 降价通知
};

// ===== Init =====
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) await chrome.storage.sync.set({ settings: DEFAULTS });
  await chrome.storage.local.set({
    priceHistory: {},
    watchedProducts: [],
    alerts: []
  });
  startPriceCheck();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'price-check') checkWatchedPrices();
});

async function startPriceCheck() {
  const { settings } = await chrome.storage.sync.get('settings');
  const hours = (settings || DEFAULTS).refreshHours || 6;
  await chrome.alarms.clear('price-check');
  chrome.alarms.create('price-check', { periodInMinutes: hours * 60 });
}

// ===== Message Routing =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'SAVE_PRODUCT':
      saveProduct(request.product).then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'REMOVE_PRODUCT':
      removeProduct(request.productId).then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'GET_WATCHED':
      getWatched().then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'GET_PRICE_HISTORY':
      getPriceHistory(request.productId).then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'GET_ALERTS':
      chrome.storage.local.get('alerts').then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'CLEAR_ALERTS':
      chrome.storage.local.set({ alerts: [] }).then(() => sendResponse({ success: true }));
      return true;
    case 'GET_SETTINGS':
      chrome.storage.sync.get('settings').then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'SAVE_SETTINGS':
      chrome.storage.sync.set({ settings: request.settings }).then(() => {
        startPriceCheck();
        sendResponse({ success: true });
      });
      return true;
  }
});

// ===== Core Functions =====
async function saveProduct(product) {
  const { watchedProducts = [] } = await chrome.storage.local.get('watchedProducts');

  // Update existing or add new
  const existing = watchedProducts.findIndex(p => p.id === product.id);
  const entry = {
    ...product,
    lastChecked: Date.now(),
    addedAt: existing >= 0 ? watchedProducts[existing].addedAt : Date.now()
  };

  let updated;
  if (existing >= 0) {
    updated = [...watchedProducts];
    updated[existing] = entry;
  } else {
    updated = [entry, ...watchedProducts].slice(0, 50);
  }

  await chrome.storage.local.set({ watchedProducts: updated });

  // Record price history
  await recordPrice(product.id, product.price, product.currency);

  return { success: true, product: entry };
}

async function removeProduct(productId) {
  const { watchedProducts = [] } = await chrome.storage.local.get('watchedProducts');
  await chrome.storage.local.set({
    watchedProducts: watchedProducts.filter(p => p.id !== productId)
  });
  return { success: true };
}

async function getWatched() {
  const { watchedProducts = [] } = await chrome.storage.local.get('watchedProducts');
  return { products: watchedProducts };
}

async function recordPrice(productId, price, currency = '¥') {
  const { priceHistory = {} } = await chrome.storage.local.get('priceHistory');
  const history = priceHistory[productId] || [];

  // Don't record duplicate consecutive prices
  const last = history[history.length - 1];
  if (last && last.price === price && (Date.now() - last.time) < 3600000) return;

  history.push({ price, currency, time: Date.now() });
  // Keep last 100 entries
  const trimmed = history.slice(-100);
  priceHistory[productId] = trimmed;
  await chrome.storage.local.set({ priceHistory });
}

async function getPriceHistory(productId) {
  const { priceHistory = {} } = await chrome.storage.local.get('priceHistory');
  return { history: priceHistory[productId] || [] };
}

// ===== Price Checking =====
async function checkWatchedPrices() {
  const { watchedProducts = [], settings } = await chrome.storage.sync.get(['watchedProducts', 'settings']);
  const s = settings || DEFAULTS;
  if (!s.notifyOnDrop) return;

  // Note: Actual price checking would need individual page fetches
  // For MVP, we detect and alert based on historical comparison

  for (const product of watchedProducts) {
    const { priceHistory = {} } = await chrome.storage.local.get('priceHistory');
    const history = priceHistory[product.id] || [];
    if (history.length < 2) continue;

    // Check for price drops based on recorded history
    const current = product.price;
    const recent = history[history.length - 2].price; // previous recording

    if (current < recent) {
      const dropPercent = ((recent - current) / recent) * 100;
      if (dropPercent >= (s.alertThreshold || 5)) {
        const alert = {
          id: Date.now(),
          productId: product.id,
          title: `📉 ${product.name} 降价了！`,
          message: `¥${recent} → ¥${current} (降 ${dropPercent.toFixed(1)}%)`,
          time: Date.now()
        };

        const { alerts = [] } = await chrome.storage.local.get('alerts');
        await chrome.storage.local.set({ alerts: [alert, ...alerts].slice(0, 50) });

        chrome.notifications.create(`alert-${alert.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: alert.title,
          message: alert.message,
          priority: 2
        });

        // Check if we need to open product page for fresh price
        try {
          const resp = await fetch(product.url);
          if (resp.ok) {
            const text = await resp.text();
            const newPrice = extractPrice(text, product.platform);
            if (newPrice && newPrice !== product.price) {
              await saveProduct({ ...product, price: newPrice });
            }
          }
        } catch (e) {
          // Silently fail - page might not be accessible
        }
      }
    }
  }
}

// ===== Price Extraction (basic regex patterns) =====
function extractPrice(html, platform) {
  const patterns = {
    amazon: /"price"\s*:\s*"(\d+\.?\d*)"/i,
    jd: /"price"\s*:\s*"(\d+\.?\d*)"/i,
    taobao: /"price"\s*:\s*"(\d+\.?\d*)"/i,
    tmall: /"price"\s*:\s*"(\d+\.?\d*)"/i
  };
  const pattern = patterns[platform];
  if (!pattern) return null;

  const match = html.match(pattern);
  return match ? parseFloat(match[1]) : null;
}
