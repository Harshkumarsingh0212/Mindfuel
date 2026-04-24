/* =====================================================
   MindFuel — script.js
   Features: Auth, per-user data, insights, predictions
   ===================================================== */

// ── Helpers ──────────────────────────────────────────
function hashPass(str) {
  // Simple deterministic hash (no server, no crypto needed for demo)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function getUsers() {
  return JSON.parse(localStorage.getItem('mf_users') || '{}');
}
function saveUsers(u) {
  localStorage.setItem('mf_users', JSON.stringify(u));
}

function getUserEntries(username) {
  return JSON.parse(localStorage.getItem('mf_entries_' + username) || '[]');
}
function saveUserEntries(username, entries) {
  localStorage.setItem('mf_entries_' + username, JSON.stringify(entries));
}

let currentUser = null; // { username, name }

// ── AUTH ─────────────────────────────────────────────
const authScreen = document.getElementById('auth-screen');
const appScreen  = document.getElementById('app-screen');

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-form').classList.add('active');
  });
});

// Sign Up
document.getElementById('signupBtn').addEventListener('click', () => {
  const name     = document.getElementById('signup-name').value.trim();
  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('signup-error');

  if (!name || !username || !password) { errEl.textContent = 'All fields are required.'; return; }
  if (username.length < 3)             { errEl.textContent = 'Username must be 3+ characters.'; return; }
  if (password.length < 6)             { errEl.textContent = 'Password must be 6+ characters.'; return; }

  const users = getUsers();
  if (users[username]) { errEl.textContent = 'Username already taken.'; return; }

  users[username] = { name, passwordHash: hashPass(password) };
  saveUsers(users);

  errEl.textContent = '';
  loginUser(username, name);
});

// Sign In
document.getElementById('loginBtn').addEventListener('click', () => {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');

  if (!username || !password) { errEl.textContent = 'Enter username and password.'; return; }

  const users = getUsers();
  const user  = users[username];
  if (!user || user.passwordHash !== hashPass(password)) {
    errEl.textContent = 'Incorrect username or password.';
    return;
  }

  errEl.textContent = '';
  loginUser(username, user.name);
});

// Allow Enter key on auth fields
['login-username','login-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
});
['signup-name','signup-username','signup-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('signupBtn').click();
  });
});

function loginUser(username, name) {
  currentUser = { username, name };
  sessionStorage.setItem('mf_session', JSON.stringify(currentUser));

  // Update UI names
  const initial = name.charAt(0).toUpperCase();
  document.getElementById('user-display-name').textContent = name;
  document.getElementById('user-display-handle').textContent = '@' + username;
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('mobile-avatar').textContent = initial;
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  authScreen.classList.remove('active');
  appScreen.classList.add('active');

  renderAll();
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('mf_session');
  currentUser = null;
  appScreen.classList.remove('active');
  authScreen.classList.add('active');
  // Reset inputs
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
});

// Restore session
const savedSession = sessionStorage.getItem('mf_session');
if (savedSession) {
  const s = JSON.parse(savedSession);
  const users = getUsers();
  if (users[s.username]) loginUser(s.username, s.name);
}

// ── NAVIGATION ────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('view-' + item.dataset.view).classList.add('active');
    closeSidebar();
  });
});

// Mobile sidebar
const sidebar  = document.getElementById('sidebar');
const overlay  = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

document.getElementById('hamburger').addEventListener('click', () => {
  sidebar.classList.add('open');
  overlay.classList.add('active');
});
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}
overlay.addEventListener('click', closeSidebar);

// ── CHECK-IN STATE ────────────────────────────────────
let focusValue  = null;
let energyValue = null;
let moodValue   = null;

function createScale(containerId, setter) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = i;
    btn.addEventListener('click', () => {
      [...container.children].forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      setter(i);
    });
    container.appendChild(btn);
  }
}

createScale('focus-scale',  v => focusValue  = v);
createScale('energy-scale', v => energyValue = v);

document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    moodValue = btn.dataset.mood;
  });
});

// ── SAVE ENTRY ────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', () => {
  if (!currentUser) return;

  const reflection = document.getElementById('reflection').value.trim();
  const statusEl   = document.getElementById('status');

  if (focusValue === null || energyValue === null || moodValue === null || !reflection) {
    statusEl.style.color = 'var(--rose)';
    statusEl.textContent = 'Please fill in all fields 🙂';
    return;
  }

  const entries = getUserEntries(currentUser.username);

  // Prevent duplicate entries for today
  const todayStr = new Date().toDateString();
  const existingIdx = entries.findIndex(e => e.date === todayStr);

  const entry = {
    date: todayStr,
    timestamp: Date.now(),
    focus:      focusValue,
    energy:     energyValue,
    mood:       moodValue,
    reflection
  };

  if (existingIdx >= 0) {
    entries[existingIdx] = entry; // overwrite today
  } else {
    entries.push(entry);
  }

  saveUserEntries(currentUser.username, entries);

  statusEl.style.color = 'var(--green)';
  statusEl.textContent = existingIdx >= 0 ? 'Updated for today ✦' : 'Saved for today ✦';

  // Reset
  document.getElementById('reflection').value = '';
  document.querySelectorAll('.scale-group button, .mood-btn').forEach(b => b.classList.remove('selected'));
  focusValue = energyValue = moodValue = null;

  renderAll();
});

// ── CLEAR HISTORY ─────────────────────────────────────
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (!currentUser) return;
  if (!confirm('Delete all your entries? This cannot be undone.')) return;
  saveUserEntries(currentUser.username, []);
  renderAll();
});

// ── RENDER ALL ────────────────────────────────────────
function renderAll() {
  if (!currentUser) return;
  const entries = getUserEntries(currentUser.username);
  renderStreak(entries);
  renderHistory(entries);
  renderInsights(entries);
  renderPredict(entries);
}

// ── STREAK ────────────────────────────────────────────
function renderStreak(entries) {
  let streak = 0;
  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
  let check = new Date();
  check.setHours(0,0,0,0);

  for (const e of sorted) {
    const d = new Date(e.date);
    d.setHours(0,0,0,0);
    const diff = (check - d) / 86400000;
    if (diff <= 1) {
      streak++;
      check = d;
      check.setDate(check.getDate() - 1);
    } else break;
  }
  document.getElementById('streak-num').textContent = streak;
}

// ── HISTORY ───────────────────────────────────────────
function renderHistory(entries) {
  const el = document.getElementById('history-list');
  if (entries.length === 0) {
    el.innerHTML = '<p class="history-empty">No entries yet. Start your first check-in! 🌱</p>';
    return;
  }

  el.innerHTML = '';
  [...entries].reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const focusDots  = dotsHTML(item.focus);
    const energyDots = dotsHTML(item.energy);

    div.innerHTML = `
      <div class="history-top">
        <span class="history-date">${item.date}</span>
        <span class="history-mood">${item.mood}</span>
      </div>
      <div class="history-metrics">
        <div class="metric-pill">
          <span class="metric-label">Focus</span>
          <div class="metric-bar">${focusDots}</div>
          <span>${item.focus}/5</span>
        </div>
        <div class="metric-pill">
          <span class="metric-label">Energy</span>
          <div class="metric-bar">${energyDots}</div>
          <span>${item.energy}/5</span>
        </div>
      </div>
      <div class="history-note">${item.reflection}</div>
    `;
    el.appendChild(div);
  });
}

function dotsHTML(val) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<div class="metric-bar-dot${i <= val ? ' fill' : ''}"></div>`;
  }
  return html;
}

// ── INSIGHTS ──────────────────────────────────────────
function renderInsights(entries) {
  const el = document.getElementById('insights-content');

  if (entries.length < 2) {
    el.innerHTML = `
      <div class="card" style="text-align:center;padding:3rem 1rem;">
        <div style="font-size:2rem;margin-bottom:1rem;">🌱</div>
        <div style="font-family:var(--font-display);font-size:1.3rem;color:var(--text2);margin-bottom:0.5rem;">Keep going!</div>
        <div style="font-size:0.88rem;color:var(--text3);font-style:italic;">Patterns appear after a few check-ins.</div>
      </div>`;
    return;
  }

  const avgFocus  = avg(entries.map(e => e.focus));
  const avgEnergy = avg(entries.map(e => e.energy));
  const bestDay   = findBestDay(entries);
  const moodFreq  = topMood(entries);

  // Stats grid
  let html = `<div class="insights-grid">
    <div class="stat-card">
      <div class="stat-label">Avg Focus</div>
      <div class="stat-value">${avgFocus.toFixed(1)}</div>
      <div class="stat-sub">${avgFocus >= 4 ? 'Sharp 🎯' : avgFocus >= 3 ? 'Steady' : 'Could sharpen 🌫'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Energy</div>
      <div class="stat-value">${avgEnergy.toFixed(1)}</div>
      <div class="stat-sub">${avgEnergy >= 4 ? 'Fuelled 🔋' : avgEnergy >= 3 ? 'Balanced' : 'Running low 🪫'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Best Day</div>
      <div class="stat-value" style="font-size:1.6rem;">${bestDay || '—'}</div>
      <div class="stat-sub">highest avg scores</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Top Mood</div>
      <div class="stat-value" style="font-size:2rem;">${moodFreq || '—'}</div>
      <div class="stat-sub">most frequent</div>
    </div>
  </div>`;

  // Insight cards
  html += generateInsightCards(entries, avgFocus, avgEnergy);

  // Mini bar chart — last 7 entries
  html += miniChart(entries);

  el.innerHTML = html;

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(bar => {
      const w = bar.dataset.width;
      bar.style.width = w + '%';
    });
  }, 50);
}

function generateInsightCards(entries, avgFocus, avgEnergy) {
  let cards = '';

  // Focus insight
  const recentFocus = entries.slice(-3).map(e => e.focus);
  const recentAvg   = avg(recentFocus);
  const trend = recentAvg > avgFocus ? 'rising' : recentAvg < avgFocus - 0.5 ? 'dipping' : 'stable';

  const focusTag   = trend === 'rising' ? 'tag-green' : trend === 'dipping' ? 'tag-rose' : 'tag-blue';
  const focusLabel = trend === 'rising' ? 'Focus Rising' : trend === 'dipping' ? 'Focus Dipping' : 'Focus Stable';
  const focusText  = trend === 'rising'
    ? `Your focus has been climbing lately (${recentAvg.toFixed(1)} avg recently). Whatever you're doing — keep it up.`
    : trend === 'dipping'
    ? `Focus has been lower recently (${recentAvg.toFixed(1)} avg). Consider lighter goals or more recovery time.`
    : `Focus is holding steady around ${recentAvg.toFixed(1)}. Consistent effort is worth more than peaks.`;

  cards += insightCard(focusTag, focusLabel, focusText);

  // Energy vs Focus gap
  const gap = Math.abs(avgFocus - avgEnergy);
  if (gap >= 1) {
    const higher = avgFocus > avgEnergy ? 'focus' : 'energy';
    cards += insightCard('tag-amber', 'Imbalance Detected',
      `Your ${higher} consistently scores ~${gap.toFixed(1)} points higher than the other. A big gap can cause burnout. Consider balancing rest and mental effort.`);
  }

  // Consistency
  if (entries.length >= 5) {
    const focusScores = entries.map(e => e.focus);
    const stddev = Math.sqrt(avg(focusScores.map(v => Math.pow(v - avgFocus, 2))));
    const tag  = stddev < 0.8 ? 'tag-green' : 'tag-amber';
    const text = stddev < 0.8
      ? `You're very consistent (σ ${stddev.toFixed(2)}). Consistent mental energy is a superpower.`
      : `Your focus varies quite a bit (σ ${stddev.toFixed(2)}). Look at what changes between high and low days.`;
    cards += insightCard(tag, 'Consistency', text);
  }

  // Total entries
  cards += insightCard('tag-blue', 'Check-in Streak',
    `${entries.length} total ${entries.length === 1 ? 'entry' : 'entries'} logged. Every data point makes your insights sharper.`);

  return cards;
}

function insightCard(tagClass, label, text) {
  return `<div class="insight-card">
    <span class="insight-tag ${tagClass}">${label}</span>
    <div class="insight-text">${text}</div>
  </div>`;
}

function miniChart(entries) {
  const last7 = entries.slice(-7);
  const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let rows = '';
  last7.forEach(e => {
    const d   = new Date(e.date);
    const day = days[d.getDay()];
    const val = ((e.focus + e.energy) / 2);
    const pct = (val / 5) * 100;
    const color = val >= 4 ? '#34d399' : val >= 3 ? '#7c6af7' : '#f87171';
    rows += `
      <div class="bar-row">
        <span class="bar-day">${day}</span>
        <div class="bar-track"><div class="bar-fill" style="background:${color};width:0%" data-width="${pct.toFixed(0)}"></div></div>
        <span class="bar-val">${val.toFixed(1)}</span>
      </div>`;
  });

  return `<div class="card mini-chart">
    <div class="mini-chart-label">Last ${last7.length} days — avg score</div>
    ${rows}
  </div>`;
}

// ── PREDICT ───────────────────────────────────────────
function renderPredict(entries) {
  const el = document.getElementById('predict-content');

  if (entries.length < 3) {
    el.innerHTML = `<div class="predict-card">
      <div class="predict-empty">
        <span class="predict-empty-icon">🔮</span>
        <div class="predict-empty-title">Not enough data yet</div>
        <div class="predict-empty-sub">Log at least 3 days to unlock predictions.</div>
      </div>
    </div>`;
    return;
  }

  const { focus, energy, tips, confidence } = predictTomorrow(entries);

  const focusPct  = (focus / 5) * 100;
  const energyPct = (energy / 5) * 100;

  let tipsHTML = tips.map(t =>
    `<div class="predict-tip"><span class="tip-icon">${t.icon}</span><span>${t.text}</span></div>`
  ).join('');

  el.innerHTML = `
    <div class="predict-card">
      <div class="predict-header">
        <div class="predict-title">Tomorrow's Forecast</div>
        <div class="predict-conf">Confidence<br><strong>${confidence}%</strong></div>
      </div>
      <div class="predict-scores">
        <div class="predict-score-block">
          <div class="predict-score-label">Predicted Focus</div>
          <div class="predict-score-val">${focus.toFixed(1)}<span style="font-size:1rem;color:var(--text3)">/5</span></div>
          <div class="predict-score-bar"><div class="predict-score-fill" style="width:0%" data-w="${focusPct.toFixed(0)}"></div></div>
        </div>
        <div class="predict-score-block">
          <div class="predict-score-label">Predicted Energy</div>
          <div class="predict-score-val">${energy.toFixed(1)}<span style="font-size:1rem;color:var(--text3)">/5</span></div>
          <div class="predict-score-bar"><div class="predict-score-fill" style="width:0%" data-w="${energyPct.toFixed(0)}"></div></div>
        </div>
      </div>
      <div class="predict-tips">${tipsHTML}</div>
    </div>
    <div class="insight-card" style="margin-top:0.5rem;">
      <span class="insight-tag tag-blue">How this works</span>
      <div class="insight-text">Predictions use your recent trend, day-of-week patterns, and mood correlations from your own data. More entries = better accuracy.</div>
    </div>
  `;

  setTimeout(() => {
    document.querySelectorAll('.predict-score-fill').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  }, 50);
}

function predictTomorrow(entries) {
  const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = days[tomorrow.getDay()];

  // 1. Overall average
  const allFocusAvg  = avg(entries.map(e => e.focus));
  const allEnergyAvg = avg(entries.map(e => e.energy));

  // 2. Recent trend (last 3)
  const recent = entries.slice(-3);
  const recentFocusAvg  = avg(recent.map(e => e.focus));
  const recentEnergyAvg = avg(recent.map(e => e.energy));

  // 3. Same day-of-week average
  const sameDay = entries.filter(e => {
    const d = new Date(e.date);
    return days[d.getDay()] === tomorrowDay;
  });

  let dayFocusAvg  = allFocusAvg;
  let dayEnergyAvg = allEnergyAvg;
  if (sameDay.length > 0) {
    dayFocusAvg  = avg(sameDay.map(e => e.focus));
    dayEnergyAvg = avg(sameDay.map(e => e.energy));
  }

  // Weighted blend: 40% recent, 35% day-of-week, 25% overall
  let predFocus  = recentFocusAvg * 0.40 + dayFocusAvg * 0.35 + allFocusAvg * 0.25;
  let predEnergy = recentEnergyAvg * 0.40 + dayEnergyAvg * 0.35 + allEnergyAvg * 0.25;

  predFocus  = Math.min(5, Math.max(1, predFocus));
  predEnergy = Math.min(5, Math.max(1, predEnergy));

  const confidence = Math.min(92, 45 + entries.length * 5 + (sameDay.length >= 2 ? 15 : 0));

  const tips = buildTips(predFocus, predEnergy, tomorrowDay, recentFocusAvg, recentEnergyAvg);

  return { focus: predFocus, energy: predEnergy, confidence, tips };
}

function buildTips(focus, energy, dayName, recentFocus, recentEnergy) {
  const tips = [];
  const isWeekend = dayName === 'Sat' || dayName === 'Sun';

  if (focus < 3) {
    tips.push({ icon: '🎯', text: 'Focus is predicted low — schedule only your single most important task. Protect your cognitive load.' });
  } else if (focus >= 4) {
    tips.push({ icon: '⚡', text: 'High focus predicted! Great day to tackle your hardest problem or do deep work.' });
  } else {
    tips.push({ icon: '📋', text: 'Moderate focus predicted. Mix focused blocks with lighter admin tasks.' });
  }

  if (energy < 3) {
    tips.push({ icon: '🛌', text: 'Energy dip expected. Prioritise sleep tonight, hydration, and a short walk tomorrow morning.' });
  } else if (energy >= 4) {
    tips.push({ icon: '🔋', text: 'Energy looks good! Good day for social tasks, creative work, or physical activity.' });
  }

  if (recentFocus < recentEnergy - 1) {
    tips.push({ icon: '🧘', text: 'Your energy outpaces your focus lately. Try a 5-min mindfulness reset before work.' });
  }

  if (isWeekend) {
    tips.push({ icon: '🌿', text: `It's a ${dayName} — even a light rest day improves Monday's mental energy significantly.` });
  }

  return tips.slice(0, 3);
}

// ── UTILS ─────────────────────────────────────────────
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function findBestDay(entries) {
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const byDay = {};
  entries.forEach(e => {
    const d = dayNames[new Date(e.date).getDay()];
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push((e.focus + e.energy) / 2);
  });
  let best = null, bestAvg = 0;
  for (const [day, scores] of Object.entries(byDay)) {
    const a = avg(scores);
    if (a > bestAvg) { bestAvg = a; best = day; }
  }
  return best;
}

function topMood(entries) {
  const freq = {};
  entries.forEach(e => { freq[e.mood] = (freq[e.mood] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
