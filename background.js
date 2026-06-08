// ExtPay initialization
try {
  const extpay = ExtPay('pricehawk');
  extpay.startBackground();
} catch(e) {
  console.error('pricehawk: ExtPay init failed', e);
}

chrome.runtime.onInstalled.addListener(()=>console.log('pricehawk ready'));
