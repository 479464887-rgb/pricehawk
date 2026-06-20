// PriceHawk — Background Service Worker
// Price tracking and monitoring

const CHECK_INTERVAL = 3600; // 1 hour

// ExtPay initialization
try {
  const extpay = ExtPay('pricehawk');
  extpay.startBackground();
} catch(e) {
  console.error('pricehawk: ExtPay init failed', e);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('PriceHawk ready');
  chrome.storage.local.get(['tracked'], data => {
    if (!data.tracked) chrome.storage.local.set({ tracked: [] });
  });
});

// Message handlers
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'trackProduct') {
    addTracking(req.product).then(sendResponse);
    return true;
  }
  if (req.action === 'getTracked') {
    chrome.storage.local.get(['tracked'], data => sendResponse(data.tracked || []));
    return true;
  }
  if (req.action === 'removeTracking') {
    removeTracking(req.url).then(sendResponse);
    return true;
  }
  if (req.action === 'checkPrice') {
    checkNow(req.url).then(sendResponse);
    return true;
  }
  if (req.action === 'priceDetected') {
    handlePriceUpdate(req.product).then(sendResponse);
    return true;
  }
});

async function addTracking(product) {
  const data = await chrome.storage.local.get(['tracked']);
  const tracked = data.tracked || [];
  
  // Check if already tracking
  const exists = tracked.find(t => t.url === product.url);
  if (!exists) {
    tracked.push({
      ...product,
      priceHistory: [{ price: product.price, date: Date.now() }],
      addedAt: Date.now(),
      lastChecked: Date.now()
    });
  }
  
  await chrome.storage.local.set({ tracked });
  return { success: true, count: tracked.length };
}

async function removeTracking(url) {
  const data = await chrome.storage.local.get(['tracked']);
  let tracked = data.tracked || [];
  tracked = tracked.filter(t => t.url !== url);
  await chrome.storage.local.set({ tracked });
  return { success: true };
}

async function checkNow(url) {
  // Open product page in background to re-detect price
  try {
    const tabs = await chrome.tabs.query({});
    // Find if already open
    const existing = tabs.find(t => t.url === url);
    if (existing) {
      chrome.tabs.sendMessage(existing.id, { action: 'detectPrice' });
    }
  } catch (e) {
    console.error('Price check failed:', e);
  }
  return { checked: true };
}

async function handlePriceUpdate(product) {
  const data = await chrome.storage.local.get(['tracked']);
  const tracked = data.tracked || [];
  const idx = tracked.findIndex(t => t.url === product.url);
  
  if (idx >= 0) {
    const old = tracked[idx];
    const lastPrice = old.priceHistory?.length ? old.priceHistory[old.priceHistory.length - 1].price : 0;
    
    // Add to price history
    if (!old.priceHistory) old.priceHistory = [];
    old.priceHistory.push({ price: product.price, date: Date.now() });
    old.lastChecked = Date.now();
    old.currentPrice = product.price;
    old.name = product.name || old.name;
    
    // Check for price drop
    if (lastPrice > 0 && product.price < lastPrice) {
      const drop = lastPrice - product.price;
      const dropPercent = ((drop / lastPrice) * 100).toFixed(1);
      const currency = product.currency || old.currency || '$';
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Price Drop! ' + (old.name || 'Product'),
        message: currency + lastPrice + ' → ' + currency + product.price + ' (-' + dropPercent + '%)'
      });
    }
    
    tracked[idx] = old;
    await chrome.storage.local.set({ tracked });
  }
  
  return { success: true };
}

// Auto-check prices periodically
setInterval(async () => {
  const data = await chrome.storage.local.get(['tracked']);
  const tracked = data.tracked || [];
  if (tracked.length > 0) {
    for (const t of tracked) {
      await checkNow(t.url);
    }
  }
}, CHECK_INTERVAL * 1000);
