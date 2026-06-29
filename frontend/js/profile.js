/* =====================================================================
   Study Sphere AI  -  profile.js  (2026 Premium Settings)
   ---------------------------------------------------------------------
   Powers the expanded settings page: Profile, Security, Privacy,
   Appearance, Dashboard, Notifications, AI Preferences, Accessibility.

   • Persists the four backend categories (appearance / dashboard /
     notifications / ai_settings) exactly as before — no backend changes.
     Extended fields are nested inside these blobs.
   • Extra device-only preferences (bio, education, accent, font, density,
     contrast, motion, etc.) are mirrored to localStorage and applied
     globally & instantly via window.SSMotion.
   ===================================================================== */

let currentSettings = {};

const LS = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  getJSON: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  setJSON: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!SS.requireAuth()) return;

  setupNavigation();
  setupSegmented();
  setupToggleSwitches();
  setupEventListeners();
  loadDeviceInfo();
  loadLocalPreferences();

  await loadUserProfile();
  await loadSettings();
});

/* =====================================================================
   NAVIGATION  (vertical sticky nav -> panels)
   ===================================================================== */
function setupNavigation() {
  const btns = document.querySelectorAll('.snav-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.set-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`${tab}-tab`);
      if (panel) panel.classList.add('active');
      // Refresh reveal/ripple for the newly shown panel
      if (window.SSMotion) SSMotion.refresh();
      if (window.innerWidth <= 920) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Deep-link support: #appearance etc.
  const hash = (location.hash || '').replace('#', '');
  if (hash) {
    const target = document.querySelector(`.snav-btn[data-tab="${hash}"]`);
    if (target) target.click();
  }
}

/* =====================================================================
   SEGMENTED CONTROLS  (single-select pill groups)
   ===================================================================== */
function setupSegmented() {
  document.querySelectorAll('.segmented').forEach(group => {
    group.querySelectorAll('.seg').forEach(seg => {
      seg.addEventListener('click', () => {
        group.querySelectorAll('.seg').forEach(s => s.classList.remove('active'));
        seg.classList.add('active');
        group.dispatchEvent(new CustomEvent('seg:change', { detail: { value: seg.dataset.value } }));
      });
    });
  });
}
function segValue(id, fallback) {
  const el = document.getElementById(id);
  const active = el?.querySelector('.seg.active');
  return active?.dataset.value || fallback;
}
function setSeg(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelectorAll('.seg').forEach(s => s.classList.toggle('active', s.dataset.value === value));
}

/* =====================================================================
   TOGGLES
   ===================================================================== */
function setupToggleSwitches() {
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', () => toggle.classList.toggle('active'));
  });
}
const isOn = id => !!document.getElementById(id)?.classList.contains('active');
const setOn = (id, on) => document.getElementById(id)?.classList.toggle('active', !!on);

/* =====================================================================
   LOAD PROFILE  (backend /api/auth/me + local extras)
   ===================================================================== */
async function loadUserProfile() {
  try {
    const data = await SS.api('/api/auth/me');
    const user = data.user || {};
    setVal('fullName', user.name || '');
    setVal('username', user.username || user.email || '');
    setVal('email', user.email || '');

    const initial = (user.name || user.email || 'S').trim().charAt(0).toUpperCase();
    const av = document.getElementById('avatarPreview');
    if (av) {
      const stored = LS.get('ss_avatar', '');
      if (stored) av.style.backgroundImage = `url(${stored})`, av.textContent = '';
      else av.textContent = initial || 'S';
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
    SS.toast('Failed to load profile', 'error');
  }
}

/* =====================================================================
   LOAD SETTINGS  (backend categories)
   ===================================================================== */
async function loadSettings() {
  try {
    const data = await SS.api('/api/auth/settings');
    currentSettings = data || {};

    // ---- Appearance ----
    const ap = data.appearance || {};
    const theme = ap.theme || LS.get('ss_theme', 'dark');
    setActiveOpt('themeOpts', 'theme', theme);

    const accent = ap.accent || LS.get('ss_accent', 'violet');
    setActiveSwatch(accent);

    setSeg('fontSeg', ap.font || LS.get('ss_font', 'md'));
    setSeg('densitySeg', ap.density || LS.get('ss_density', 'comfortable'));

    // ---- Dashboard ----
    const db = data.dashboard || {};
    setOn('compactSidebar', !!db.compactSidebar);
    setOn('showWelcome', db.showWelcome !== false);
    setOn('showStreak', db.showStreak !== false);
    setOn('showChart', db.showChart !== false);
    setOn('showAchievements', db.showAchievements !== false);
    setVal('defaultPage', (db.defaultPage || 'dashboard').replace('.html', ''));

    // ---- Notifications ----
    const nt = data.notifications || {};
    setOn('emailNotifications', nt.email !== false);
    setOn('pushNotifications', !!nt.push);
    setOn('aiAlerts', nt.aiAlerts !== false);
    setOn('studyReminders', nt.reminders !== false);
    setOn('dailyGoalReminders', nt.dailyGoal !== false);
    setOn('weeklySummary', nt.weeklySummary !== false);

    // ---- AI ----
    const ai = data.ai_settings || {};
    let model = (ai.model || 'auto').toLowerCase();
    if (!['auto', 'kimi', 'gemini', 'groq'].includes(model)) model = 'auto';
    setVal('aiModel', model);
    setSeg('lengthSeg', ai.length || 'medium');
    setSeg('creativitySeg', ai.creativity || 'balanced');
    setVal('studyDifficulty', ai.difficulty || 'intermediate');
    setVal('aiLanguage', ai.language || 'en');

    // ---- Privacy (stored within appearance blob's privacy key + local) ----
    const pv = (data.appearance && data.appearance.privacy) || LS.getJSON('ss_privacy', {});
    setActiveSeg('visibilitySeg', pv.visibility || 'private');
    setOn('showActivity', !!pv.showActivity);
    setOn('usageAnalytics', pv.usageAnalytics !== false);

  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  loadProviderStatus();
}

/* =====================================================================
   LOCAL-ONLY PREFERENCES  (profile extras + accessibility)
   ===================================================================== */
function loadLocalPreferences() {
  const profile = LS.getJSON('ss_profile_extra', {});
  setVal('bio', profile.bio || '');
  setVal('educationLevel', profile.education || '');
  setVal('studyGoal', profile.goal || '');

  // Accessibility (motion / contrast managed by SSMotion data-attrs)
  setOn('reduceMotion', LS.get('ss_motion', 'auto') === 'reduced');
  setOn('highContrast', LS.get('ss_contrast', 'normal') === 'high');
  setOn('keyboardNav', LS.get('ss_keyboardnav', 'on') !== 'off');
  setOn('screenReader', LS.get('ss_screenreader', 'off') === 'on');

  // Security UI-only toggles
  setOn('twoFactor', LS.get('ss_2fa', 'off') === 'on');
}

/* =====================================================================
   PROVIDER STATUS
   ===================================================================== */
async function loadProviderStatus() {
  const box = document.getElementById('aiProviderStatus');
  if (!box) return;
  try {
    const data = await SS.api('/api/ai/status', { auth: false });
    box.innerHTML = (data.providers || []).map(p =>
      `<span class="model-badge" title="${p.label}">` +
      `<span class="model-dot ${p.configured ? '' : 'off'}"></span>` +
      `${p.label} ${p.configured ? '' : '(offline)'}</span>`
    ).join(' ');
    if (!box.innerHTML) box.innerHTML = '<span class="model-badge">No providers</span>';
  } catch {
    box.innerHTML = '<span class="model-badge"><span class="model-dot off"></span> Status unavailable</span>';
  }
}

/* =====================================================================
   DEVICE / SESSION INFO  (client-derived)
   ===================================================================== */
function loadDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Browser', os = 'Unknown OS';
  if (/Edg/.test(ua)) browser = 'Edge';
  else if (/Chrome/.test(ua)) browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua)) browser = 'Safari';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const meta = document.getElementById('thisDeviceMeta');
  if (meta) meta.textContent = `${browser} on ${os} · Active now`;

  const last = document.getElementById('lastLoginMeta');
  if (last) last.textContent = `${browser} on ${os} · ${new Date().toLocaleString()}`;
}

/* =====================================================================
   EVENT WIRING
   ===================================================================== */
function setupEventListeners() {
  // ---- Profile ----
  on('saveProfileBtn', saveProfile);
  on('changeAvatarBtn', pickAvatar);

  // ---- Security ----
  on('changePasswordBtn', changePassword);
  on('deleteAccountBtn', deleteAccount);
  on('signOutAllBtn', signOutAll);
  document.getElementById('twoFactor')?.addEventListener('click', () => {
    LS.set('ss_2fa', isOn('twoFactor') ? 'on' : 'off');
    SS.toast(isOn('twoFactor') ? '2FA enabled (demo)' : '2FA disabled');
  });

  // ---- Privacy ----
  on('savePrivacyBtn', savePrivacy);
  on('downloadDataBtn', downloadData);
  on('clearHistoryBtn', clearHistory);

  // ---- Appearance (instant apply + persist) ----
  document.querySelectorAll('#themeOpts .opt-card').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveOpt('themeOpts', 'theme', btn.dataset.theme);
      applyTheme(btn.dataset.theme);
      saveAppearance();
    });
  });
  document.querySelectorAll('#accentSwatches .swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveSwatch(btn.dataset.accent);
      SSMotion.setPreference('accent', btn.dataset.accent);
      saveAppearance();
    });
  });
  document.getElementById('fontSeg')?.addEventListener('seg:change', e => {
    SSMotion.setPreference('font', e.detail.value);
    saveAppearance();
  });
  document.getElementById('densitySeg')?.addEventListener('seg:change', e => {
    SSMotion.setPreference('density', e.detail.value);
    saveAppearance();
  });

  // ---- Dashboard ----
  on('saveDashboardBtn', saveDashboardSettings);

  // ---- Notifications ----
  on('saveNotificationsBtn', saveNotificationSettings);

  // ---- AI ----
  on('saveAiBtn', saveAiSettings);

  // ---- Accessibility (instant) ----
  document.getElementById('reduceMotion')?.addEventListener('click', () => {
    SSMotion.setPreference('motion', isOn('reduceMotion') ? 'reduced' : 'auto');
    SS.toast('Motion preference updated');
  });
  document.getElementById('highContrast')?.addEventListener('click', () => {
    SSMotion.setPreference('contrast', isOn('highContrast') ? 'high' : 'normal');
    SS.toast('Contrast preference updated');
  });
  document.getElementById('keyboardNav')?.addEventListener('click', () => {
    LS.set('ss_keyboardnav', isOn('keyboardNav') ? 'on' : 'off');
    document.documentElement.classList.toggle('kb-nav-off', !isOn('keyboardNav'));
  });
  document.getElementById('screenReader')?.addEventListener('click', () => {
    LS.set('ss_screenreader', isOn('screenReader') ? 'on' : 'off');
  });

  // Bio / education / goal — save with profile button, but persist locally on change
  ['bio', 'educationLevel', 'studyGoal'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', persistProfileExtra);
  });
}

/* =====================================================================
   SAVE HANDLERS
   ===================================================================== */
function persistProfileExtra() {
  LS.setJSON('ss_profile_extra', {
    bio: getVal('bio'),
    education: getVal('educationLevel'),
    goal: getVal('studyGoal'),
  });
}

async function saveProfile() {
  const name = getVal('fullName').trim();
  if (!name) return showGlobalMsg('Please enter your name.', 'error');

  persistProfileExtra();

  const btn = document.getElementById('saveProfileBtn');
  busy(btn, 'Saving...');
  try {
    await SS.api('/api/auth/profile', { method: 'PUT', body: { name } });
    showGlobalMsg('Profile updated successfully!', 'success');
    SS.toast('Profile updated!');
    // Refresh sidebar profile name if present
    document.querySelectorAll('.side-user-name, [data-user-name]').forEach(el => el.textContent = name);
  } catch (err) {
    showGlobalMsg(err.message, 'error');
  } finally {
    done(btn, '<i class="fas fa-save"></i> Save Profile');
  }
}

function pickAvatar() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) return SS.toast('Image too large (max 1.5MB)', 'error');
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target.result;
      LS.set('ss_avatar', url);
      const av = document.getElementById('avatarPreview');
      if (av) { av.style.backgroundImage = `url(${url})`; av.style.backgroundSize = 'cover'; av.textContent = ''; }
      document.querySelectorAll('.side-user-card .avatar').forEach(el => {
        el.style.backgroundImage = `url(${url})`; el.style.backgroundSize = 'cover'; el.textContent = '';
      });
      SS.toast('Profile photo updated');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function changePassword() {
  const newPw = getVal('newPassword');
  const confirmPw = getVal('confirmPassword');
  if (!newPw || !confirmPw) return showGlobalMsg('Please fill in all password fields.', 'error');
  if (newPw.length < 6) return showGlobalMsg('New password must be at least 6 characters.', 'error');
  if (newPw !== confirmPw) return showGlobalMsg('New passwords do not match.', 'error');

  const btn = document.getElementById('changePasswordBtn');
  busy(btn, 'Updating...');
  try {
    await SS.api('/api/auth/change-password', { method: 'PUT', body: { new_password: newPw } });
    showGlobalMsg('Password changed successfully!', 'success');
    setVal('newPassword', ''); setVal('confirmPassword', '');
    SS.toast('Password updated!');
  } catch (err) {
    showGlobalMsg(err.message, 'error');
  } finally {
    done(btn, '<i class="fas fa-rotate"></i> Update Password');
  }
}

async function deleteAccount() {
  if (!confirm('Are you sure? This will permanently delete your account and all data. This cannot be undone.')) return;
  const btn = document.getElementById('deleteAccountBtn');
  busy(btn, 'Deleting...');
  try {
    await SS.api('/api/auth/account', { method: 'DELETE' });
    SS.toast('Account deleted. Redirecting...');
    setTimeout(() => { SS.clearSession(); window.location.href = '/'; }, 1500);
  } catch (err) {
    SS.toast(err.message, 'error');
    done(btn, '<i class="fas fa-trash"></i> Delete Account');
  }
}

function signOutAll() {
  if (!confirm('Sign out of all devices including this one?')) return;
  SS.clearSession();
  SS.toast('Signed out everywhere');
  setTimeout(() => { window.location.href = '/login'; }, 900);
}

async function savePrivacy() {
  const privacy = {
    visibility: activeSeg('visibilitySeg', 'private'),
    showActivity: isOn('showActivity'),
    usageAnalytics: isOn('usageAnalytics'),
  };
  LS.setJSON('ss_privacy', privacy);
  const btn = document.getElementById('savePrivacyBtn');
  busy(btn, 'Saving...');
  try {
    // Nest privacy inside the appearance blob (no schema change needed)
    const ap = { ...(currentSettings.appearance || {}), privacy };
    await SS.api('/api/auth/settings', { method: 'PUT', body: { category: 'appearance', data: ap } });
    currentSettings.appearance = ap;
    showGlobalMsg('Privacy settings saved!', 'success');
    SS.toast('Privacy updated!');
  } catch (err) {
    showGlobalMsg(err.message, 'error');
  } finally {
    done(btn, '<i class="fas fa-save"></i> Save Privacy Settings');
  }
}

function downloadData() {
  const payload = {
    profile: LS.getJSON('ss_profile_extra', {}),
    settings: currentSettings,
    privacy: LS.getJSON('ss_privacy', {}),
    preferences: {
      theme: LS.get('ss_theme', 'dark'),
      accent: LS.get('ss_accent', 'violet'),
      font: LS.get('ss_font', 'md'),
      density: LS.get('ss_density', 'comfortable'),
      motion: LS.get('ss_motion', 'auto'),
      contrast: LS.get('ss_contrast', 'normal'),
    },
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'study-sphere-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
  SS.toast('Your data was downloaded');
}

function clearHistory() {
  if (!confirm('Clear local history and cached preferences on this device?')) return;
  ['ss_recent_searches', 'ss_profile_extra', 'ss_avatar'].forEach(k => localStorage.removeItem(k));
  SS.toast('Local history cleared');
}

async function saveAppearance() {
  const data = {
    ...(currentSettings.appearance || {}),
    theme: document.querySelector('#themeOpts .opt-card.active')?.dataset.theme || 'dark',
    accent: document.querySelector('#accentSwatches .swatch.active')?.dataset.accent || 'violet',
    font: segValue('fontSeg', 'md'),
    density: segValue('densitySeg', 'comfortable'),
  };
  try {
    await SS.api('/api/auth/settings', { method: 'PUT', body: { category: 'appearance', data } });
    currentSettings.appearance = data;
    SS.toast('Appearance saved!');
  } catch (err) {
    SS.toast(err.message, 'error');
  }
}

async function saveDashboardSettings() {
  const data = {
    compactSidebar: isOn('compactSidebar'),
    showWelcome: isOn('showWelcome'),
    showStreak: isOn('showStreak'),
    showChart: isOn('showChart'),
    showAchievements: isOn('showAchievements'),
    defaultPage: getVal('defaultPage'),
  };
  LS.setJSON('ss_dashboard_prefs', data);
  // honor compact sidebar immediately
  LS.set('ainb_sidebar_collapsed', data.compactSidebar ? '1' : '0');

  const btn = document.getElementById('saveDashboardBtn');
  busy(btn, 'Saving...');
  try {
    await SS.api('/api/auth/settings', { method: 'PUT', body: { category: 'dashboard', data } });
    currentSettings.dashboard = data;
    showGlobalMsg('Dashboard settings saved!', 'success');
    SS.toast('Dashboard updated!');
  } catch (err) {
    showGlobalMsg(err.message, 'error');
  } finally {
    done(btn, '<i class="fas fa-save"></i> Save Dashboard Settings');
  }
}

async function saveNotificationSettings() {
  const data = {
    email: isOn('emailNotifications'),
    push: isOn('pushNotifications'),
    aiAlerts: isOn('aiAlerts'),
    reminders: isOn('studyReminders'),
    dailyGoal: isOn('dailyGoalReminders'),
    weeklySummary: isOn('weeklySummary'),
  };
  const btn = document.getElementById('saveNotificationsBtn');
  busy(btn, 'Saving...');
  try {
    await SS.api('/api/auth/settings', { method: 'PUT', body: { category: 'notifications', data } });
    currentSettings.notifications = data;
    showGlobalMsg('Notification settings saved!', 'success');
    SS.toast('Notifications updated!');
  } catch (err) {
    showGlobalMsg(err.message, 'error');
  } finally {
    done(btn, '<i class="fas fa-save"></i> Save Notifications');
  }
}

async function saveAiSettings() {
  const data = {
    model: getVal('aiModel'),
    length: segValue('lengthSeg', 'medium'),
    creativity: segValue('creativitySeg', 'balanced'),
    difficulty: getVal('studyDifficulty'),
    language: getVal('aiLanguage'),
  };
  const btn = document.getElementById('saveAiBtn');
  busy(btn, 'Saving...');
  try {
    await SS.api('/api/auth/settings', { method: 'PUT', body: { category: 'ai_settings', data } });
    currentSettings.ai_settings = data;
    showGlobalMsg('AI preferences saved!', 'success');
    SS.toast('AI preferences updated!');
  } catch (err) {
    showGlobalMsg(err.message, 'error');
  } finally {
    done(btn, '<i class="fas fa-save"></i> Save AI Preferences');
  }
}

/* =====================================================================
   THEME helper (system aware)
   ===================================================================== */
function applyTheme(theme) {
  LS.set('ss_theme', theme);
  if (theme === 'system') {
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', sys);
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  if (window.SS && SS.applyTheme && theme !== 'system') SS.applyTheme(theme);
}

/* =====================================================================
   SMALL DOM HELPERS
   ===================================================================== */
function on(id, fn) { document.getElementById(id)?.addEventListener('click', fn); }
function getVal(id) { return document.getElementById(id)?.value || ''; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function busy(btn, txt) { if (!btn) return; btn.disabled = true; btn.dataset._html = btn.innerHTML; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${txt}`; }
function done(btn, html) { if (!btn) return; btn.disabled = false; btn.innerHTML = html || btn.dataset._html || btn.innerHTML; }

function setActiveOpt(groupId, attr, value) {
  document.querySelectorAll(`#${groupId} .opt-card`).forEach(b =>
    b.classList.toggle('active', b.dataset[attr] === value));
}
function setActiveSwatch(accent) {
  document.querySelectorAll('#accentSwatches .swatch').forEach(b =>
    b.classList.toggle('active', b.dataset.accent === accent));
}
function activeSeg(id, fallback) {
  return document.querySelector(`#${id} .seg.active`)?.dataset.value || fallback;
}
function setActiveSeg(id, value) {
  document.querySelectorAll(`#${id} .seg`).forEach(s =>
    s.classList.toggle('active', s.dataset.value === value));
}

function showGlobalMsg(text, type = 'error') {
  const box = document.getElementById('settingsMsg');
  if (!box) return;
  box.textContent = text;
  box.className = `settings-msg show ${type}`;
  setTimeout(() => { box.className = 'settings-msg'; }, 5000);
}
