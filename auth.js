/* ══════════════════════════════════════════
   auth.js — TraceBack Login / Signup System
   Pure vanilla JS. No Firebase needed.
   Users stored in localStorage: tb_users
   Logged-in user: tb_current_user
══════════════════════════════════════════ */

'use strict';

/* ── State ── */
let pendingOTP      = null;
let pendingUserData = null;
let activeTab       = 'login';   // 'login' | 'signup'
let activeMethod    = 'email';   // 'email' | 'phone'

/* ══════════════════════════════
   BOOT
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  renderNavAuth();
  wireAuthModal();
  wireTabsAndMethods();
  wirePasswordStrength();
  wirePasswordToggles();
  wireOTPBoxes();
  wireResendButtons();
  wireForms();
  initAccessControl();
});

/* ══════════════════════════════
   NAV AUTH AREA
══════════════════════════════ */
function renderNavAuth() {
  const area = document.getElementById('nav-auth-area');
  if (!area) return;
  const user = getCurrentUser();

  if (user) {
    const initial = (user.name || 'U')[0].toUpperCase();
    area.innerHTML = `
      <div class="nav-user-wrap">
        <div class="nav-greeting" tabindex="0" role="button" aria-label="User menu">
          <div class="nav-avatar">${initial}</div>
          <span class="nav-greet-txt">Hi, ${user.name.split(' ')[0]}!</span>
          <span style="font-size:.75rem;color:#94a3b8">▾</span>
        </div>
        <div class="nav-dropdown">
          <button class="nav-dd-item logout" id="logout-btn">🚪 Logout</button>
        </div>
      </div>`;
    document.getElementById('logout-btn')?.addEventListener('click', logout);
  } else {
    area.innerHTML = `
      <button class="btn-auth" style="width:auto;padding:8px 18px;font-size:.83rem;margin:0"
        id="nav-login-btn">Login / Sign Up</button>`;
    document.getElementById('nav-login-btn')?.addEventListener('click', openAuthModal);
  }
}

/* ══════════════════════════════
   MODAL OPEN / CLOSE
══════════════════════════════ */
function openAuthModal() {
  const el = document.getElementById('auth-overlay');
  if (!el) return;
  el.classList.add('open');
  el.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
}
function closeAuthModal() {
  const el = document.getElementById('auth-overlay');
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  resetOTPSteps();
}

function wireAuthModal() {
  document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'auth-overlay') closeAuthModal();
  });
}

/* ══════════════════════════════
   ACCESS CONTROL
   Blocks browsing/reporting unless logged in
══════════════════════════════ */
function initAccessControl() {
  // Sections that require login
  const protectedSections = ['browse', 'report-lost', 'report-found', 'leaderboard', 'dashboard', 'contact'];

  // Intercept ALL nav link clicks and CTA buttons
  document.addEventListener('click', e => {
    // Check if click is on any nav link or button that opens a protected section
    const link = e.target.closest('a[href], button[onclick]');
    if (!link) return;

    // Get the target section from href or onclick
    const href    = link.getAttribute('href') || '';
    const onclick = link.getAttribute('onclick') || '';
    const sectionMatch = href.replace('#','') || onclick.match(/showSection\(['"](\w[\w-]*)['"]/)?.[ 1];

    if (!sectionMatch) return;
    if (!protectedSections.includes(sectionMatch)) return;

    // If not logged in, block and show auth modal
    if (!getCurrentUser()) {
      e.preventDefault();
      e.stopPropagation();
      openAuthModal();
      showAuthToast('Please login or sign up to continue 🔒', 'warning');
    }
  }, true); // useCapture=true so it fires before your existing onclick handlers
}
/* ══════════════════════════════
   TABS & METHODS
══════════════════════════════ */
function wireTabsAndMethods() {
  // Login / Signup tabs
  document.querySelectorAll('.atab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('.atab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      document.getElementById('panel-login')?.classList.toggle('active',  activeTab === 'login');
      document.getElementById('panel-signup')?.classList.toggle('active', activeTab === 'signup');
      resetOTPSteps();
      setMethod('email'); // reset to email on tab switch
    });
  });

  // Email / Phone method buttons
  document.querySelectorAll('.meth').forEach(btn => {
    btn.addEventListener('click', () => setMethod(btn.dataset.method));
  });
}

function setMethod(method) {
  activeMethod = method;
  // Update all method buttons
  document.querySelectorAll('.meth').forEach(b => b.classList.toggle('active', b.dataset.method === method));

  const isLogin = activeTab === 'login';
  const panel   = isLogin ? 'panel-login' : 'panel-signup';

  // Hide all aforms in current panel
  document.querySelectorAll(`#${panel} .aform`).forEach(f => f.classList.remove('active'));
  // Show correct one
  const formId = method === 'email'
    ? (isLogin ? 'login-email-form'  : 'signup-email-form')
    : (isLogin ? 'login-phone-form'  : 'signup-phone-form');
  document.getElementById(formId)?.classList.add('active');
  resetOTPSteps();
}

/* ══════════════════════════════
   PASSWORD STRENGTH CHECKER
══════════════════════════════ */
function wirePasswordStrength() {
  const inp   = document.getElementById('su-pw');
  const fill  = document.getElementById('pw-fill');
  const label = document.getElementById('pw-label');
  if (!inp || !fill || !label) return;

  inp.addEventListener('input', () => {
    const pw    = inp.value;
    let score   = 0;
    if (pw.length >= 6)            score++;
    if (pw.length >= 10)           score++;
    if (/[A-Z]/.test(pw))         score++;
    if (/[0-9]/.test(pw))         score++;
    if (/[^A-Za-z0-9]/.test(pw))  score++;

    const levels = [
      { pct: '20%', color: '#ef4444', text: 'Very Weak' },
      { pct: '40%', color: '#f97316', text: 'Weak'      },
      { pct: '60%', color: '#eab308', text: 'Fair'      },
      { pct: '80%', color: '#22c55e', text: 'Strong'    },
      { pct: '100%',color: '#06b6d4', text: 'Excellent' },
    ];
    const lvl   = pw ? (levels[score - 1] || levels[0]) : null;
    fill.style.width      = lvl ? lvl.pct   : '0';
    fill.style.background = lvl ? lvl.color : '';
    label.textContent     = lvl ? lvl.text  : '—';
    label.style.color     = lvl ? lvl.color : '#94a3b8';
  });
}

/* ══════════════════════════════
   PASSWORD SHOW / HIDE
══════════════════════════════ */
function wirePasswordToggles() {
  document.querySelectorAll('.pw-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      inp.type   = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  });
}

/* ══════════════════════════════
   OTP BOXES
══════════════════════════════ */
function wireOTPBoxes() {
  document.querySelectorAll('.otp-boxes').forEach(wrap => {
    const boxes = wrap.querySelectorAll('.otp-box');
    boxes.forEach((box, i) => {
      box.addEventListener('input', e => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val.slice(-1);
        e.target.classList.toggle('done', !!e.target.value);
        if (val && i < boxes.length - 1) boxes[i + 1].focus();
      });
      box.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
      });
      box.addEventListener('paste', e => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g,'').slice(0, 6);
        pasted.split('').forEach((ch, j) => { if (boxes[j]) { boxes[j].value = ch; boxes[j].classList.add('done'); } });
        if (boxes[pasted.length - 1]) boxes[pasted.length - 1].focus();
      });
    });
  });
}

function getOTP(boxesId) {
  return Array.from(document.querySelectorAll(`#${boxesId} .otp-box`)).map(b => b.value).join('');
}
function clearOTPBoxes(boxesId) {
  document.querySelectorAll(`#${boxesId} .otp-box`).forEach(b => { b.value = ''; b.classList.remove('done'); });
}

/* ══════════════════════════════
   RESEND OTP
══════════════════════════════ */
function wireResendButtons() {
  document.querySelectorAll('.resend-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const otp = generateOTP();
      pendingOTP = otp;
      // In production this would hit an SMS API
      // For demo we show it in a toast
      showAuthToast(`Demo OTP: ${otp}`, 'info', 8000);
      console.info('%c[TraceBack OTP] ' + otp, 'color:#0ea5e9;font-size:1.2rem;font-weight:bold');
      startCountdown(btn, 30);
    });
  });
}

function startCountdown(btn, sec) {
  btn.disabled = true;
  btn.textContent = `Resend in ${sec}s`;
  const iv = setInterval(() => {
    sec--;
    btn.textContent = sec > 0 ? `Resend in ${sec}s` : 'Resend OTP';
    if (sec <= 0) { clearInterval(iv); btn.disabled = false; }
  }, 1000);
}

/* ══════════════════════════════
   FORM HANDLERS
══════════════════════════════ */
function wireForms() {
  document.getElementById('login-email-form')?.addEventListener('submit',  handleEmailLogin);
  document.getElementById('signup-email-form')?.addEventListener('submit', handleEmailSignup);
  document.getElementById('login-phone-form')?.addEventListener('submit',  handlePhoneSend);
  document.getElementById('signup-phone-form')?.addEventListener('submit', handlePhoneSend);
  document.getElementById('verify-login-otp')?.addEventListener('click',   () => handleOTPVerify('login'));
  document.getElementById('verify-signup-otp')?.addEventListener('click',  () => handleOTPVerify('signup'));
}

/* Email Login */
function handleEmailLogin(e) {
  e.preventDefault();
  const email = document.getElementById('li-email').value.trim();
  const pw    = document.getElementById('li-pw').value;
  let ok = true;

  if (!isEmail(email)) { setAerr('err-li-email', 'Enter a valid email'); ok = false; }
  else clearAerr('err-li-email');
  if (pw.length < 6)  { setAerr('err-li-pw', 'Password must be 6+ characters'); ok = false; }
  else clearAerr('err-li-pw');
  if (!ok) return;

  // Look up stored user (or create a session for any valid combo)
  const users = getUsers();
  const found = users.find(u => u.email === email && u.pw === pw);
  const name  = found ? found.name : email.split('@')[0];

  setCurrentUser({ name, email, method: 'email' });
  closeAuthModal();
  renderNavAuth();
  showAuthToast(`Welcome back, ${name}! 👋`, 'success');
}

/* Email Signup */
function handleEmailSignup(e) {
  e.preventDefault();
  const name  = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pw    = document.getElementById('su-pw').value;
  const phone = document.getElementById('su-ph-email').value.replace(/\D/g, '');
  let ok = true;

  if (!name)           { setAerr('err-su-name',     'Name is required');              ok = false; } else clearAerr('err-su-name');
  if (!isEmail(email)) { setAerr('err-su-email',    'Enter a valid email');            ok = false; } else clearAerr('err-su-email');
  if (phone.length !== 10) { setAerr('err-su-ph-email', 'Enter a valid 10-digit number'); ok = false; } else clearAerr('err-su-ph-email');
  if (pw.length < 6)   { setAerr('err-su-pw',       'Password must be 6+ characters'); ok = false; } else clearAerr('err-su-pw');
  if (!ok) return;

  const users = getUsers();
  if (!users.find(u => u.email === email)) users.push({ name, email, pw, phone });
  localStorage.setItem('tb_users', JSON.stringify(users));

  setCurrentUser({ name, email, phone, method: 'email' });
  closeAuthModal();
  renderNavAuth();
  showAuthToast(`Account created! Welcome, ${name}! 🎉`, 'success');
}

  // Save user
  const users = getUsers();
  if (!users.find(u => u.email === email)) users.push({ name, email, pw });
  localStorage.setItem('tb_users', JSON.stringify(users));

  setCurrentUser({ name, email, method: 'email' });
  closeAuthModal();
  renderNavAuth();
  showAuthToast(`Account created! Welcome, ${name}! 🎉`, 'success');


/* Phone — Send OTP */
function handlePhoneSend(e) {
  e.preventDefault();
  const isSignup   = e.target.id === 'signup-phone-form';
  const nameInp    = isSignup ? document.getElementById('su-ph-name') : null;
  const phoneInp   = document.getElementById(isSignup ? 'su-phone' : 'li-phone');
  const nameErrId  = 'err-su-ph-name';
  const phoneErrId = isSignup ? 'err-su-phone' : 'err-li-phone';
  let ok = true;

  if (isSignup && !nameInp?.value.trim()) {
    setAerr(nameErrId, 'Name is required'); ok = false;
  } else clearAerr(nameErrId);

  const phone = phoneInp?.value.replace(/\D/g,'');
  if (!phone || phone.length !== 10) {
    setAerr(phoneErrId, 'Enter a valid 10-digit number'); ok = false;
  } else clearAerr(phoneErrId);
  if (!ok) return;

  // Generate and "send" OTP
  const otp = generateOTP();
  pendingOTP = otp;
  pendingUserData = {
    name:   isSignup ? nameInp.value.trim() : `User${phone.slice(-4)}`,
    phone:  '+91' + phone,
    method: 'phone'
  };

  console.info('%c[TraceBack OTP] ' + otp, 'color:#0ea5e9;font-size:1.3rem;font-weight:bold');
  showAuthToast(`Demo OTP: ${otp} (also in console)`, 'info', 8000);

  const stepId  = isSignup ? 'otp-signup-step' : 'otp-login-step';
  const msgId   = isSignup ? 'otp-signup-msg'  : 'otp-login-msg';
  const formId  = isSignup ? 'signup-phone-form' : 'login-phone-form';

  document.getElementById(formId).style.display = 'none';
  document.getElementById(stepId).style.display  = 'block';
  document.getElementById(msgId).textContent =
    `OTP sent to +91 ${phone.slice(0,5)} ${phone.slice(5)}`;
  clearOTPBoxes(isSignup ? 'otp-signup-boxes' : 'otp-login-boxes');
}

/* OTP Verify */
function handleOTPVerify(mode) {
  const isSignup = mode === 'signup';
  const boxesId  = isSignup ? 'otp-signup-boxes' : 'otp-login-boxes';
  const entered  = getOTP(boxesId);

  if (entered.length < 6) { showAuthToast('Enter all 6 digits', 'error'); return; }
  if (entered !== pendingOTP) {
    // Shake animation
    document.getElementById(boxesId)?.classList.add('shake');
    setTimeout(() => document.getElementById(boxesId)?.classList.remove('shake'), 500);
    showAuthToast('Incorrect OTP. Try again.', 'error');
    return;
  }

  setCurrentUser(pendingUserData);
  pendingOTP      = null;
  pendingUserData = null;
  closeAuthModal();
  renderNavAuth();
  showAuthToast(`${isSignup ? 'Welcome aboard' : 'Welcome back'}, ${getCurrentUser().name}! 👋`, 'success');
}

/* ══════════════════════════════
   OTP STEP RESET
══════════════════════════════ */
function resetOTPSteps() {
  ['otp-login-step','otp-signup-step'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['login-phone-form','signup-phone-form'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  clearOTPBoxes('otp-login-boxes');
  clearOTPBoxes('otp-signup-boxes');
  pendingOTP      = null;
  pendingUserData = null;
}

/* ══════════════════════════════
   USER STORAGE HELPERS
══════════════════════════════ */
function getUsers()       { try { return JSON.parse(localStorage.getItem('tb_users')) || []; } catch { return []; } }
function getCurrentUser() { try { return JSON.parse(localStorage.getItem('tb_current_user')); } catch { return null; } }
function setCurrentUser(u){ localStorage.setItem('tb_current_user', JSON.stringify(u)); }
function logout()         {
  localStorage.removeItem('tb_current_user');
  renderNavAuth();
  showAuthToast('Logged out successfully', 'info');
}

/* ══════════════════════════════
   SHAKE ANIMATION (wrong OTP)
══════════════════════════════ */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%,60%{transform:translateX(-6px)}
    40%,80%{transform:translateX(6px)}
  }
  .shake { animation:shake .4s ease; }`;
document.head.appendChild(shakeStyle);

/* ══════════════════════════════
   UTILITIES
══════════════════════════════ */
function generateOTP() { return String(Math.floor(100000 + Math.random() * 900000)); }
function isEmail(e)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function setAerr(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearAerr(id)    { const el = document.getElementById(id); if (el) el.textContent = ''; }

function showAuthToast(msg, type = 'info', dur = 3500) {
  // Reuse existing toast system if available, else create simple one
  if (typeof showToast === 'function') { showToast(msg, type, dur); return; }
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  const tc = document.getElementById('toast-container');
  if (!tc) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span style="flex:1;font-size:.84rem">${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), dur);
}