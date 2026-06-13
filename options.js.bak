// PriceHawk - Options
const DEFAULTS = { alertThreshold: 5, refreshHours: 6, notifyOnDrop: true };

document.addEventListener('DOMContentLoaded', async () => {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = settings || DEFAULTS;

  document.getElementById('alert-threshold').value = s.alertThreshold || 5;
  document.getElementById('refresh-hours').value = s.refreshHours || 6;
  document.getElementById('notify-on-drop').checked = s.notifyOnDrop !== false;

  document.getElementById('save').addEventListener('click', async () => {
    const btn = document.getElementById('save');
    btn.disabled = true;
    btn.textContent = '保存中...';

    const settings = {
      alertThreshold: parseInt(document.getElementById('alert-threshold').value) || 5,
      refreshHours: parseInt(document.getElementById('refresh-hours').value) || 6,
      notifyOnDrop: document.getElementById('notify-on-drop').checked
    };

    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });

    btn.disabled = false;
    btn.textContent = '保存设置';
    const el = document.getElementById('status');
    el.textContent = '✓ 已保存!';
    el.style.display = 'inline';
    setTimeout(() => el.style.display = 'none', 2000);
  });
});
