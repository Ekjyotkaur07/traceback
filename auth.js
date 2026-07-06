'use strict';

/* ══════════════════════════════════════════
   auth.js — TraceBack Login / Signup System
   Pure vanilla JS. No Firebase needed.
   Users stored in localStorage: tb_users
   Logged-in user: tb_current_user
══════════════════════════════════════════ */
const EMAILJS_KEY      = 'lMVTSQcW_5ej4Gk7Q';
const EMAILJS_SERVICE  = 'service_7cyyqhq';
const EMAILJS_TEMPLATE = 'template_htxwoin';

if (typeof emailjs !== 'undefined') {
  emailjs.init('YOUR_PUBLIC_KEY');
}
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
          <button class="nav-dd-item" onclick="showSection('profile')">👤 My Profile</button>
          <button class="nav-dd-item" onclick="showSection('dashboard')">📊 Dashboard</button>
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
  // Move focus away before hiding
  document.getElementById('nav-auth-area')?.querySelector('button, a')?.focus();
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
const protectedSections = ['browse', 'report-lost', 'report-found', 'leaderboard', 'dashboard', 'contact'];
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href], button[onclick]');
    if (!link) return;

    const href    = link.getAttribute('href') || '';
    const onclick = link.getAttribute('onclick') || '';
    const sectionMatch = href.replace('#','') || onclick.match(/showSection\(['"](\w[\w-]*)['"]/)?.[ 1];

    if (!sectionMatch) return;
    if (!protectedSections.includes(sectionMatch)) return;

    if (!getCurrentUser()) {
      e.preventDefault();
      e.stopPropagation();
      openAuthModal();
      showAuthToast('Please login or sign up to continue 🔒', 'warning');
    }
  }, true);
}

/* ══════════════════════════════
   TABS & METHODS
══════════════════════════════ */
function wireTabsAndMethods() {
  document.querySelectorAll('.atab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('.atab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      document.getElementById('panel-login')?.classList.toggle('active',  activeTab === 'login');
      document.getElementById('panel-signup')?.classList.toggle('active', activeTab === 'signup');
      resetOTPSteps();
      setMethod('email');
    });
  });

  document.querySelectorAll('.meth').forEach(btn => {
    btn.addEventListener('click', () => setMethod(btn.dataset.method));
  });
}

function setMethod(method) {
  activeMethod = method;
  document.querySelectorAll('.meth').forEach(b => b.classList.toggle('active', b.dataset.method === method));

  const isLogin = activeTab === 'login';
  const panel   = isLogin ? 'panel-login' : 'panel-signup';

  document.querySelectorAll(`#${panel} .aform`).forEach(f => f.classList.remove('active'));
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
    const pw  = inp.value;
    let score = 0;
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
      inp.type        = inp.type === 'password' ? 'text' : 'password';
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
        pasted.split('').forEach((ch, j) => {
          if (boxes[j]) { boxes[j].value = ch; boxes[j].classList.add('done'); }
        });
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

/* ── Email Login ── */
function handleEmailLogin(e) {
  e.preventDefault();
  const email = document.getElementById('li-email').value.trim();
  const pw    = document.getElementById('li-pw').value;
  let ok = true;

  if (!isEmail(email)) { setAerr('err-li-email', 'Enter a valid email'); ok = false; }
  else clearAerr('err-li-email');
  if (pw.length < 6)   { setAerr('err-li-pw', 'Password must be 6+ characters'); ok = false; }
  else clearAerr('err-li-pw');
  if (!ok) return;

  // FIX: Reject login if credentials don't match — don't fall back to a derived name
  const users = getUsers();
  const found = users.find(u => u.email === email && u.pw === pw);
  if (!found) {
    setAerr('err-li-pw', 'Incorrect email or password');
    return;
  }

  setCurrentUser({ name: found.name, email: found.email, phone: found.phone || null, method: 'email' });
  closeAuthModal();
  renderNavAuth();
  showAuthToast(`Welcome back, ${found.name}! 👋`, 'success');
}

/* ── Email Signup ── */
function handleEmailSignup(e) {
  e.preventDefault();
  const name  = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pw    = document.getElementById('su-pw').value;
  const phone = document.getElementById('su-ph-email').value.replace(/\D/g, '');
  let ok = true;

  if (!name)                { setAerr('err-su-name',     'Name is required');               ok = false; } else clearAerr('err-su-name');
  if (!isEmail(email))      { setAerr('err-su-email',    'Enter a valid email');             ok = false; } else clearAerr('err-su-email');
  if (phone.length !== 10)  { setAerr('err-su-ph-email', 'Enter a valid 10-digit number');  ok = false; } else clearAerr('err-su-ph-email');
  if (pw.length < 6)        { setAerr('err-su-pw',       'Password must be 6+ characters'); ok = false; } else clearAerr('err-su-pw');
  if (!ok) return;

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    setAerr('err-su-email', 'An account with this email already exists');
    return;
  }

  // FIX: Only one save block — removed the duplicate orphaned code that was outside this function
  users.push({ name, email, pw, phone });
  localStorage.setItem('tb_users', JSON.stringify(users));

  setCurrentUser({ name, email, phone, method: 'email' });
  closeAuthModal();
  renderNavAuth();
  showAuthToast(`Account created! Welcome, ${name}! 🎉`, 'success');
}

/* ── Phone — Send OTP ── */
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

  const otp = generateOTP();
  pendingOTP = otp;
  pendingUserData = {
    name:   isSignup ? nameInp.value.trim() : `User${phone.slice(-4)}`,
    phone:  '+91' + phone,
    method: 'phone'
  };

  // FIX: Use a real email field for signup, fall back to console for phone-only login
  const toEmail = isSignup
    ? (document.getElementById('su-ph-email-addr')?.value.trim() || null)
    : null;

  if (toEmail) {
    emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      to_email: toEmail,
      to_name:  pendingUserData.name,
      otp_code: otp
    }).then(() => {
      showAuthToast('OTP sent to your email inbox!', 'success');
    }).catch(() => {
      showAuthToast(`Email failed — OTP: ${otp} (check console)`, 'warning');
      console.info('%c[OTP] ' + otp, 'color:#0ea5e9;font-size:1.2rem;font-weight:bold');
    });
  } else {
    // Phone-only flow: show OTP in toast/console for demo
    showAuthToast(`Demo OTP: ${otp}`, 'info', 8000);
    console.info('%c[TraceBack OTP] ' + otp, 'color:#0ea5e9;font-size:1.2rem;font-weight:bold');
  }

  const stepId = isSignup ? 'otp-signup-step' : 'otp-login-step';
  const msgId  = isSignup ? 'otp-signup-msg'  : 'otp-login-msg';
  const formId = isSignup ? 'signup-phone-form' : 'login-phone-form';

  document.getElementById(formId).style.display = 'none';
  document.getElementById(stepId).style.display  = 'block';
  document.getElementById(msgId).textContent =
    `OTP sent to +91 ${phone.slice(0,5)} ${phone.slice(5)}`;
  clearOTPBoxes(isSignup ? 'otp-signup-boxes' : 'otp-login-boxes');
}

/* ── OTP Verify ── */
function handleOTPVerify(mode) {
  const isSignup = mode === 'signup';
  const boxesId  = isSignup ? 'otp-signup-boxes' : 'otp-login-boxes';
  const entered  = getOTP(boxesId);

  if (entered.length < 6) { showAuthToast('Enter all 6 digits', 'error'); return; }
  if (entered !== pendingOTP) {
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
function getUsers()        { try { return JSON.parse(localStorage.getItem('tb_users')) || []; } catch { return []; } }
function getCurrentUser()  { try { return JSON.parse(localStorage.getItem('tb_current_user')); } catch { return null; } }
function setCurrentUser(u) { localStorage.setItem('tb_current_user', JSON.stringify(u)); }
function logout() {
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
function generateOTP()        { return String(Math.floor(100000 + Math.random() * 900000)); }
function isEmail(e)           { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function setAerr(id, msg)     { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearAerr(id)        { const el = document.getElementById(id); if (el) el.textContent = ''; }

function showAuthToast(msg, type = 'info', dur = 3500) {
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
/* ══════════════════════════════
   GOOGLE SIGN-IN (FIREBASE)
══════════════════════════════ */
function handleGoogleSignIn() {
  if (!window.firebaseAuth || !window.googleProvider) {
    showAuthToast('Google Sign-In not available.', 'error');
    return;
  }

  window.firebaseAuth.signInWithPopup(window.googleProvider)
    .then((result) => {
      const user = result.user;
      const userData = {
        name:   user.displayName || 'Google User',
        email:  user.email,
        photo:  user.photoURL || null,
        method: 'google',
        uid:    user.uid
      };

      // Save to localStorage to match existing system
      const users = getUsers();
      const existing = users.find(u => u.email === user.email);
      if (!existing) {
        users.push({ ...userData, pw: null });
        localStorage.setItem('tb_users', JSON.stringify(users));
      }

      setCurrentUser(userData);
      closeAuthModal();
      renderNavAuth();
      showAuthToast(`Welcome, ${userData.name}! 🎉`, 'success');
    })
    .catch((error) => {
      console.error('Google Sign-In error:', error);
      if (error.code === 'auth/popup-closed-by-user') return;
      showAuthToast('Google Sign-In failed. Try again.', 'error');
    });
}
/* ══════════════════════════════
   FORGOT PASSWORD
══════════════════════════════ */
function showForgotPassword() {
  document.getElementById('panel-login').style.display = 'none';
  document.getElementById('forgotStep').style.display = 'block';
  document.getElementById('forgot-email').value = '';
  clearAerr('err-forgot-email');
}

function hideForgotPassword() {
  document.getElementById('forgotStep').style.display = 'none';
  document.getElementById('panel-login').style.display = 'block';
}

function sendPasswordReset() {
  const email = document.getElementById('forgot-email').value.trim();

  if (!isEmail(email)) {
    setAerr('err-forgot-email', 'Enter a valid email address');
    return;
  }
  clearAerr('err-forgot-email');

  if (!window.firebaseAuth) {
    showAuthToast('Reset service unavailable.', 'error');
    return;
  }

  window.firebaseAuth.sendPasswordResetEmail(email)
    .then(() => {
      showAuthToast('Reset link sent! Check your inbox 📧', 'success');
      hideForgotPassword();
    })
    .catch((err) => {
      if (err.code === 'auth/user-not-found') {
        setAerr('err-forgot-email', 'No account found with this email');
      } else {
        showAuthToast('Failed to send reset email. Try again.', 'error');
      }
    });
}