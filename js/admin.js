// Zenter Admin Platform — Phase 2: Security + User Management + Feedback Moderation.
// All admin mutations go through Supabase SECURITY DEFINER functions — they verify
// admin role server-side, so even a crafted anon-key request is blocked.

import { requireAdmin, logout, getCurrentUser } from './auth.js';
import { formatPhonePretty } from './utils.js';

const ROUTES = ['dashboard', 'users', 'feedback', 'reports', 'exams', 'analytics', 'settings'];
const loaded     = new Set();
let allUsers     = [];  // in-memory list for instant filter/search
let allFeedbacks = []; // in-memory list for instant filter/search
let adminPhone   = '';  // set on init, passed to all mutation functions

// ─── Bootstrap ───────────────────────────────────────────────────────────────

(async function init() {
  const user = await requireAdmin();
  if (!user) return;

  adminPhone = user.phoneNumber || '';
  document.getElementById('adm-shell').hidden = false;
  document.getElementById('adm-gate')?.classList.add('is-hidden');
  setTimeout(() => document.getElementById('adm-gate')?.remove(), 400);

  // Topbar
  document.getElementById('adm-user-phone').textContent = formatPhonePretty(adminPhone) || adminPhone;
  document.getElementById('adm-user-avatar').textContent = (adminPhone.slice(-2) || 'A').toUpperCase();

  // Global handlers
  document.addEventListener('click', (e) => {
    if (e.target?.dataset?.action === 'logout') logout('/login.html');
  });

  wireRouter();
  wireConfirmDialog();
  wireToast();
  activateRoute(getRouteFromHash());
})();

// ─── Router ───────────────────────────────────────────────────────────────────

function getRouteFromHash() {
  const h = (location.hash || '').slice(1).toLowerCase();
  return ROUTES.includes(h) ? h : 'dashboard';
}

function wireRouter() {
  window.addEventListener('hashchange', () => activateRoute(getRouteFromHash()));
}

function activateRoute(route) {
  document.querySelectorAll('.adm-nav a').forEach(a => a.classList.toggle('is-active', a.dataset.route === route));
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.toggle('is-active', p.dataset.route === route));
  const titleEl = document.getElementById('adm-page-title');
  if (titleEl) titleEl.textContent = capitalize(route);

  if (!loaded.has(route)) {
    loaded.add(route);
    LOADERS[route]?.();
  }
}

// ─── Section loaders ──────────────────────────────────────────────────────────

const LOADERS = {
  dashboard: loadDashboard,
  users:     loadUsers,
  feedback:  loadFeedback,
  reports:   loadReports,
};

async function loadDashboard() {
  const { getAdminStats, getRecentUsers } = await import('./supabase.js');
  const [statsRes, usersRes] = await Promise.all([getAdminStats(), getRecentUsers(8)]);

  if (statsRes.data) {
    setStat('stat-total-users',  statsRes.data.totalUsers);
    setStat('stat-active-users', statsRes.data.activeUsers);
    setStat('stat-connections',  statsRes.data.connections);
    setStat('stat-feedback',     statsRes.data.feedback);
    setStat('stat-reports',      statsRes.data.reports);
  }

  const el = document.getElementById('adm-latest-users');
  el.innerHTML = usersRes.data?.length
    ? renderUsersTable(usersRes.data.slice(0, 8), false)
    : emptyState('🌱', 'No users yet.');
}

async function loadUsers() {
  const { getRecentUsers } = await import('./supabase.js');
  const { data, error } = await getRecentUsers(200);
  const el = document.getElementById('adm-users-list');

  if (error || !data) {
    el.innerHTML = emptyState('⚠️', 'Could not load users.');
    return;
  }
  allUsers = data;
  renderFilteredUsers();

  // Wire search + filters — debounced
  const rerender = debounce(renderFilteredUsers, 180);
  ['adm-user-search','adm-user-filter-exam','adm-user-filter-gender','adm-user-filter-status']
    .forEach(id => document.getElementById(id)?.addEventListener('input', rerender));
}

function renderFilteredUsers() {
  const search = (document.getElementById('adm-user-search')?.value || '').toLowerCase();
  const exam   = document.getElementById('adm-user-filter-exam')?.value   || '';
  const gender = document.getElementById('adm-user-filter-gender')?.value || '';
  const status = document.getElementById('adm-user-filter-status')?.value || '';

  const filtered = allUsers.filter(u => {
    if (search && !`${u.full_name} ${u.phone}`.toLowerCase().includes(search)) return false;
    if (exam   && u.exam_type      !== exam)   return false;
    if (gender && u.gender         !== gender) return false;
    if (status && (u.account_status || 'active') !== status) return false;
    return true;
  });

  const el = document.getElementById('adm-users-list');
  el.innerHTML = filtered.length
    ? renderUsersTable(filtered, true)
    : emptyState('🔍', 'No users match filters.');
}

async function loadFeedback() {
  const { getRecentFeedbacks } = await import('./supabase.js');
  const { data, error } = await getRecentFeedbacks(200);
  const el = document.getElementById('adm-feedback-list');

  if (error || !data) { el.innerHTML = emptyState('⚠️', 'Could not load feedback.'); return; }
  allFeedbacks = data;
  renderFilteredFeedback();

  const rerender = debounce(renderFilteredFeedback, 180);
  ['adm-fb-search', 'adm-fb-filter-status']
    .forEach(id => document.getElementById(id)?.addEventListener('input', rerender));
}

function renderFilteredFeedback() {
  const search = (document.getElementById('adm-fb-search')?.value || '').toLowerCase();
  const status = document.getElementById('adm-fb-filter-status')?.value || '';

  const filtered = allFeedbacks.filter(f => {
    if (search && !`${f.user_name} ${f.feedback_message}`.toLowerCase().includes(search)) return false;
    if (status === 'resolved' && !f.is_resolved) return false;
    if (status === 'pending'  &&  f.is_resolved) return false;
    return true;
  });

  const el = document.getElementById('adm-feedback-list');
  el.innerHTML = filtered.length
    ? renderFeedbackTable(filtered)
    : emptyState('💬', 'No feedback matches filters.');
}

async function loadReports() {
  const { getRecentReports } = await import('./supabase.js');
  const { data, error } = await getRecentReports(100);
  const el = document.getElementById('adm-reports-list');
  if (error || !data?.length) { el.innerHTML = emptyState('🚩', error ? 'Could not load.' : 'No reports.'); return; }
  el.innerHTML = `
    <table class="adm-table">
      <thead><tr><th>Date</th><th>Reporter</th><th>Reported</th><th>Reason</th></tr></thead>
      <tbody>${data.map(r => `
        <tr>
          <td>${esc(fmtDate(r.created_at))}</td>
          <td><code>${esc((r.blocker_user_id||'').slice(0,8))}…</code></td>
          <td><code>${esc((r.blocked_user_id||'').slice(0,8))}…</code></td>
          <td>${esc(r.reason || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderUsersTable(users, withActions = false) {
  const rows = users.map(u => {
    const status = u.account_status || 'active';
    const paused = u.is_profile_paused ? ' paused' : '';
    const display = paused ? 'paused' : status;
    const actionsHtml = withActions ? `
      <td>
        <div class="adm-actions">
          ${status === 'active'    ? `<button class="adm-btn adm-btn--ghost adm-btn--sm"  data-action="pause"    data-id="${esc(u.id)}" data-paused="${u.is_profile_paused ? '1':'0'}">${u.is_profile_paused ? 'Unpause' : 'Pause'}</button>` : ''}
          ${status === 'active'    ? `<button class="adm-btn adm-btn--warn  adm-btn--sm"  data-action="suspend"  data-id="${esc(u.id)}">Suspend</button>` : ''}
          ${status !== 'banned'   ? `<button class="adm-btn adm-btn--danger adm-btn--sm" data-action="ban"      data-id="${esc(u.id)}">Ban</button>` : ''}
          ${status !== 'active'   ? `<button class="adm-btn adm-btn--ok    adm-btn--sm"  data-action="reactivate" data-id="${esc(u.id)}">Reactivate</button>` : ''}
        </div>
      </td>` : '';
    return `<tr data-user-id="${esc(u.id)}">
      <td>${esc(u.full_name || '—')}</td>
      <td>${esc(formatPhonePretty(u.phone) || u.phone || '—')}</td>
      <td>${esc(u.gender || '—')}</td>
      <td>${esc(u.exam_type || '—')}</td>
      <td>${esc([u.district, u.state].filter(Boolean).join(', ') || '—')}</td>
      <td><span class="adm-pill adm-pill--${esc(u.role || 'user')}">${esc(u.role || 'user')}</span></td>
      <td><span class="adm-pill adm-pill--${esc(display)}">${esc(display)}</span></td>
      ${actionsHtml}
    </tr>`;
  }).join('');
  const actionHeader = withActions ? '<th>Actions</th>' : '';
  return `<table class="adm-table">
    <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Exam</th><th>Location</th><th>Role</th><th>Status</th>${actionHeader}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderFeedbackTable(items) {
  const rows = items.map(f => `
    <tr class="${f.is_resolved ? 'is-resolved' : ''}" data-fb-id="${esc(f.id)}">
      <td>${esc(fmtDate(f.created_at))}</td>
      <td>${esc(f.user_name || '—')}</td>
      <td>${esc(f.exam_type || '—')}</td>
      <td>${esc(f.feedback_message || '')}</td>
      <td><span class="adm-pill adm-pill--${f.is_resolved ? 'resolved' : 'pending'}">${f.is_resolved ? 'Resolved' : 'Pending'}</span></td>
      <td>
        <div class="adm-actions">
          ${!f.is_resolved ? `<button class="adm-btn adm-btn--ok    adm-btn--sm" data-action="resolve-fb" data-id="${esc(f.id)}">Resolve</button>` : ''}
          <button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete-fb" data-id="${esc(f.id)}">Delete</button>
        </div>
      </td>
    </tr>`).join('');
  return `<table class="adm-table">
    <thead><tr><th>Date</th><th>User</th><th>Exam</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── User action handlers (delegated) ─────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;

  const action   = btn.dataset.action;
  const targetId = btn.dataset.id;

  // Feedback actions
  if (action === 'resolve-fb') {
    confirm_({ title: 'Mark as resolved?', msg: 'This marks the feedback resolved — you can still see it.' }, async () => {
      btn.disabled = true;
      const { adminResolveFeedback } = await import('./supabase.js');
      const { error } = await adminResolveFeedback(targetId, adminPhone);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const fb = allFeedbacks.find(f => f.id === targetId);
      if (fb) { fb.is_resolved = true; fb.resolved_at = new Date().toISOString(); }
      renderFilteredFeedback();
      toast('Marked as resolved ✓', 'success');
    });
    return;
  }
  if (action === 'delete-fb') {
    confirm_({ title: 'Delete feedback?', msg: 'This permanently removes the feedback entry.', danger: true }, async () => {
      btn.disabled = true;
      const { adminDeleteFeedback } = await import('./supabase.js');
      const { error } = await adminDeleteFeedback(targetId, adminPhone);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      allFeedbacks = allFeedbacks.filter(f => f.id !== targetId);
      renderFilteredFeedback();
      toast('Feedback deleted', 'info');
    });
    return;
  }

  // User actions
  const USER_ACTIONS = ['pause', 'suspend', 'ban', 'reactivate'];
  if (!USER_ACTIONS.includes(action)) return;

  const CONFIGS = {
    pause:      { title: 'Pause this user?',      msg: 'Their profile will be hidden from Find Mates.', danger: false },
    suspend:    { title: 'Suspend this user?',     msg: 'They won\'t appear in Find Mates and can\'t connect.', danger: true  },
    ban:        { title: 'Ban this user?',         msg: 'This permanently restricts their account.', danger: true  },
    reactivate: { title: 'Reactivate this user?', msg: 'Their account will be restored to active.', danger: false },
  };

  confirm_(CONFIGS[action], async () => {
    btn.disabled = true;
    const { adminSetUserStatus, adminSetUserPaused } = await import('./supabase.js');
    let error = null;

    if (action === 'pause') {
      const paused = btn.dataset.paused === '1';
      ({ error } = await adminSetUserPaused(targetId, adminPhone, !paused));
      if (!error) {
        const u = allUsers.find(u => u.id === targetId);
        if (u) u.is_profile_paused = !paused;
      }
    } else {
      const statusMap = { suspend: 'suspended', ban: 'banned', reactivate: 'active' };
      ({ error } = await adminSetUserStatus(targetId, adminPhone, statusMap[action]));
      if (!error) {
        const u = allUsers.find(u => u.id === targetId);
        if (u) u.account_status = statusMap[action];
      }
    }

    if (error) {
      toast('Error: ' + error.message, 'error');
      btn.disabled = false;
    } else {
      renderFilteredUsers();
      toast(`User ${action}d ✓`, 'success');
    }
  });
});

// ─── Confirmation dialog ─────────────────────────────────────────────────────

let _confirmResolver = null;
function wireConfirmDialog() {
  document.getElementById('adm-confirm-cancel')?.addEventListener('click', () => {
    document.getElementById('adm-confirm-overlay').hidden = true;
    _confirmResolver?.(false);
  });
  document.getElementById('adm-confirm-ok')?.addEventListener('click', () => {
    document.getElementById('adm-confirm-overlay').hidden = true;
    _confirmResolver?.(true);
  });
}

function confirm_({ title, msg, danger = false }, onConfirm) {
  document.getElementById('adm-confirm-title').textContent = title;
  document.getElementById('adm-confirm-msg').textContent   = msg;
  const okBtn = document.getElementById('adm-confirm-ok');
  okBtn.className = `adm-btn ${danger ? 'adm-btn--danger' : 'adm-btn--ok'}`;
  okBtn.textContent = 'Confirm';
  document.getElementById('adm-confirm-overlay').hidden = false;
  _confirmResolver = (confirmed) => { if (confirmed) onConfirm(); };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer;
function wireToast() { /* no setup needed — toast() does everything */ }
function toast(msg, type = 'info') {
  const el = document.getElementById('adm-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `adm-toast adm-toast--${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('is-hidden'), 3000);
}

// ─── Small utilities ──────────────────────────────────────────────────────────

function emptyState(icon, text) {
  return `<div class="adm-empty"><div class="adm-empty__icon">${icon}</div>${esc(text)}</div>`;
}
function setStat(id, value) { const el = document.getElementById(id); if (el) el.textContent = String(value); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
