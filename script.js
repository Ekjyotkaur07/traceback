// ==========================================================================
// TRACEBACK CORE ENGINE (Dynamic SPA & Leaderboard Implementation)
// ==========================================================================

const DATABASE_KEY = 'traceback_items_v4';
const JSONBIN_ID  = '6a115d9a6610dd3ae8907122';
const JSONBIN_KEY = '$2a$10$UyjgA1CZ0XZtRql8RhKS5.xJvUb645ZQVwE/FTrCXy2bpf9bvta7G';
// Emojis mapping for categories
const CATEGORY_EMOJIS = {
  'ID Card / Documents': '🪪',
  'Wallet / Purse': '👛',
  'Mobile Phone': '📱',
  'Keys': '🔑',
  'Earphones / Headphones': '🎧',
  'Bag / Backpack': '🎒',
  'Laptop / Tablet': '💻',
  'Clothing / Accessories': '👗',
  'Books / Stationery': '📚',
  'Glasses / Sunglasses': '👓',
  'Jewellery / Watch': '💍',
  'Other': '📦'
};

// Avatar generator helper based on reporter name characters
function getAvatarForReporter(name) {
  const avatars = ["👨‍💻", "👩‍🎓", "👨‍🔬", "👩‍🎨", "👨‍💼", "👩‍💻", "👨‍🎓", "👩‍💼", "👤"];
  if (!name) return "👤";
  let charSum = 0;
  for (let i = 0; i < name.length; i++) {
    charSum += name.charCodeAt(i);
  }
  return avatars[charSum % avatars.length];
}

// ==========================================================================
// 1. DYNAMIC RUNTIME DATA STORES (No Hardcoded Lists)
// ==========================================================================

// Holds procedurally generated items in-memory during the session (resets on load)
let runtimeSimulatedItems = [];

// Event logs start empty and fill up dynamically
let eventLogs = [];

// ==========================================================================
// 2. STATE CONTROLLER (LOCAL STORAGE & PROCEDURAL SIMULATION)
// ==========================================================================

function getLocalItems() {
  try {
    return JSON.parse(localStorage.getItem(DATABASE_KEY)) || [];
  } catch (e) {
    console.error("Corruption in store. Resetting.", e);
    return [];
  }
}

function saveLocalItems(items) {
  localStorage.setItem(DATABASE_KEY, JSON.stringify(items));
}

// Combines actual user reports (persistent) and active simulated items (temporary)
function getAllItems() {
  const localItems = getLocalItems();
  return [...localItems, ...runtimeSimulatedItems];
}

// DYNAMIC LEADERBOARD CALCULATION ENGINE
// Scans the active database and aggregates helper stats dynamically
function getDynamicLeaderboard() {
  const allItems = getAllItems();
  const contributors = {};

  allItems.forEach(item => {
    const reporter = item.reporter || "Anonymous";
    
    // Ignore default user placeholder if they haven't resolved anything yet, or keep them
    if (!contributors[reporter]) {
      contributors[reporter] = {
        name: reporter,
        avatar: getAvatarForReporter(reporter),
        points: 0,
        reported: 0,
        returned: 0
      };
    }

    if (item.type === 'found') {
      contributors[reporter].reported += 1;
      contributors[reporter].points += 10; // +10 points for locating/reporting found items
    } else {
      contributors[reporter].reported += 1;
    }

    if (item.status === 'Resolved') {
      contributors[reporter].returned += 1;
      contributors[reporter].points += 50; // +50 points for returning the item to owner
    }
  });

  // Convert mapping object to sorted rank list
  const leaderboardList = Object.values(contributors).sort((a, b) => b.points - a.points);

  // Assign ranks and badges based on dynamic scores
  leaderboardList.forEach((user, idx) => {
    user.rank = idx + 1;
    if (user.points >= 150) user.badge = "Master Finder";
    else if (user.points >= 100) user.badge = "Eagle Eye";
    else if (user.points >= 50) user.badge = "Good Samaritan";
    else if (user.points >= 10) user.badge = "Helpful Hand";
    else user.badge = "Novice Spotter";
  });

  return leaderboardList;
}

// ==========================================================================
// 3. TOAST MESSENGER (STACKABLE FLOATS)
// ==========================================================================
function triggerToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let emoji = '🔔';
  if (type === 'success') emoji = '✅';
  if (type === 'error') emoji = '❌';

  toast.innerHTML = `<span class="toast-emoji">${emoji}</span><span class="toast-text">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('dismissing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// ==========================================================================
// 4. SPA INTERACTION ROUTER
// ==========================================================================
function showSection(sectionId, linkElement = null) {
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    if (activePage.id === sectionId) return; 

    activePage.style.opacity = '0';
    activePage.style.transform = 'translateY(15px)';
    
    setTimeout(() => {
      activePage.classList.remove('active');
      activePage.style.display = 'none';
      
      const targetPage = document.getElementById(sectionId);
      if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.offsetHeight; // Force reflow
        targetPage.classList.add('active');
        targetPage.style.opacity = '1';
        targetPage.style.transform = 'translateY(0)';
      }
    }, 300);
  } else {
    const targetPage = document.getElementById(sectionId);
    if (targetPage) {
      targetPage.classList.add('active');
      targetPage.style.display = 'block';
      targetPage.style.opacity = '1';
      targetPage.style.transform = 'translateY(0)';
    }
  }

  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  
  if (linkElement) {
    linkElement.classList.add('active');
  } else {
    const desktopLink = document.getElementById(`nav-${sectionId}`);
    if (desktopLink) desktopLink.classList.add('active');
  }

  document.getElementById('mobileMenu').classList.remove('open');
  const hmb = document.getElementById('hamburger');
  if (hmb) hmb.classList.remove('open');

  if (sectionId === 'home') renderHomeFeed();
  if (sectionId === 'browse') renderBrowseFeed();
  if (sectionId === 'leaderboard') renderLeaderboard();
  if (sectionId === 'dashboard') renderDashboardFeed();
  if (sectionId === 'contribute') renderContributePage();
  if (sectionId === 'profile') renderProfilePage();
  // Show location banner for relevant sections
if (['browse', 'report-lost', 'report-found'].includes(sectionId)) {
  triggerLocationBanner();
}
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const hmb  = document.getElementById('hamburger');
  if (!menu) return;
  menu.classList.toggle('open');
  hmb?.classList.toggle('open');
  menu.setAttribute('aria-hidden', menu.classList.contains('open') ? 'false' : 'true');
}

// ==========================================================================
// 5. LIGHT/DARK STYLES SWITCHER
// ==========================================================================
function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  
  root.setAttribute('data-theme', next);
  localStorage.setItem('traceback_theme', next);
  
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.textContent = next === 'light' ? '☀️' : '🌙';
  }
  
  triggerToast(`Theme set to ${next} mode`, 'info');
}

// ==========================================================================
// 6. PHOTO DRAG-AND-DROP FILE UPLOADS
// ==========================================================================
let uploadedPhotoLost = null;
let uploadedPhotoFound = null;

function setupDragAndDrop(dropAreaId, fileInputId, previewWrapId, previewImgId, prefix) {
  const dropArea = document.getElementById(dropAreaId);
  const fileInput = document.getElementById(fileInputId);
  
  if (!dropArea || !fileInput) return;

  dropArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    handleSelectedFiles(e.target.files[0], previewWrapId, previewImgId, prefix);
  });

  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });

  ['dragleave', 'drop'].forEach(evName => {
    dropArea.addEventListener(evName, () => {
      dropArea.classList.remove('dragover');
    });
  });

  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      handleSelectedFiles(file, previewWrapId, previewImgId, prefix);
    }
  });
}

function handleSelectedFiles(file, previewWrapId, previewImgId, prefix) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    triggerToast('Unsupported file type. Use PNG, JPG, or WEBP.', 'error');
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    triggerToast('File size exceeds 3MB limit.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataURL = e.target.result;
    if (prefix === 'l') {
      uploadedPhotoLost = dataURL;
    } else {
      uploadedPhotoFound = dataURL;
      document.getElementById('f-photo-err').classList.remove('show');
    }

    const previewImg = document.getElementById(previewImgId);
    const previewWrap = document.getElementById(previewWrapId);
    const instructions = document.getElementById(`${prefix}-drop-instructions`);

    if (previewImg && previewWrap && instructions) {
      previewImg.src = dataURL;
      previewWrap.style.display = 'inline-block';
      instructions.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}

function removePhoto(prefix) {
  if (prefix === 'l') uploadedPhotoLost = null;
  if (prefix === 'f') uploadedPhotoFound = null;

  const fileInput = document.getElementById(`${prefix}-photo`);
  const previewImg = document.getElementById(`${prefix}-preview`);
  const previewWrap = document.getElementById(`${prefix}-preview-wrap`);
  const instructions = document.getElementById(`${prefix}-drop-instructions`);

  if (fileInput) fileInput.value = '';
  if (previewImg) previewImg.src = '';
  if (previewWrap) previewWrap.style.display = 'none';
  if (instructions) instructions.style.display = 'block';
}

// ==========================================================================
// 7. CARD BUILDERS & DETAIL OVERLAYS
// ==========================================================================
function sanitizeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildItemCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.style.setProperty('--d', `${idx * 0.05}s`);
  card.onclick = () => openItemDetailsModal(item.id);

  const imgHtml = item.photo
    ? `<img src="${item.photo}" alt="${sanitizeHTML(item.name)}" loading="lazy" />`
    : `<span>${CATEGORY_EMOJIS[item.category] || '📦'}</span>`;

  const badgeClass = item.type === 'lost' ? 'badge-lost' : 'badge-found';
  const badgeLabel = item.type === 'lost' ? '🔴 Lost' : '🟢 Found';

  const statusClassMap = {
    'Unclaimed': 'status-unclaimed',
    'Claimed': 'status-claimed',
    'Resolved': 'status-resolved'
  };
  const statusClass = statusClassMap[item.status] || 'status-unclaimed';

  let dateText = '';
  if (item.date) {
    const d = new Date(item.date + 'T00:00:00');
    dateText = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }

  card.innerHTML = `
    <div class="item-card-img">
      ${imgHtml}
    </div>
    <div class="item-card-body">
      <div class="item-badges-row">
        <span class="item-badge ${badgeClass}">${badgeLabel}</span>
        <span class="status-badge ${statusClass}">${item.status}</span>
      </div>
      <h3>${sanitizeHTML(item.name)}</h3>
      <div class="item-meta">
        <span>📂 ${sanitizeHTML(item.category)}</span>
        <span>📍 ${sanitizeHTML(item.location)}</span>
        <span>📅 ${dateText}</span>
      </div>
    </div>
  `;

  return card;
}

// ==========================================================================
// 8. HOME SECTION CONTROLLER
// ==========================================================================
function renderHomeFeed() {
  const allItems = getAllItems();
  const displayItems = allItems.slice(0, 6);
  const grid = document.getElementById('homeGrid');
  
  if (!grid) return;
  grid.innerHTML = '';

  if (displayItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🔍</div>
        <h3>No activity records registered</h3>
        <p>Report an item to start tracking updates inside our registry feed!</p>
      </div>
    `;
  } else {
    displayItems.forEach((item, idx) => {
      grid.appendChild(buildItemCard(item, idx));
    });
  }

  // Update animated dashboard numbers
  const total = allItems.length;
  const active = allItems.filter(i => i.status === 'Unclaimed').length;
  const resolved = allItems.filter(i => i.status === 'Resolved').length;

  animateStatRoll('heroTotal', total);
  animateStatRoll('heroActive', active);
  animateStatRoll('heroReunited', resolved);
}

function animateStatRoll(elemId, target) {
  const el = document.getElementById(elemId);
  if (!el) return;

  const current = parseInt(el.textContent, 10) || 0;
  if (current === target) return;

  const duration = 800;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    
    const ease = progress * (2 - progress);
    const value = Math.floor(current + (target - current) * ease);

    el.textContent = value;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(step);
}

// ==========================================================================
// 9. BROWSE REGISTRY SEARCH & FILTER CONTROLLER
// ==========================================================================
function renderBrowseFeed() {
  const searchInput = document.getElementById('browseSearch');
  const filterType = document.getElementById('filterType');
  const filterCategory = document.getElementById('filterCategory');
  const filterStatus = document.getElementById('filterStatus');
  const grid = document.getElementById('browseGrid');
  const browseInfo = document.getElementById('browseInfo');

  if (!grid) return;

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const type = filterType ? filterType.value : '';
  const category = filterCategory ? filterCategory.value : '';
  const status = filterStatus ? filterStatus.value : '';

  const allItems = getAllItems();

  const filtered = allItems.filter(item => {
    if (type && item.type !== type) return false;
    if (category && item.category !== category) return false;
    if (status && item.status !== status) return false;

    if (query) {
      const nameMatch = item.name.toLowerCase().includes(query);
      const descMatch = item.description.toLowerCase().includes(query);
      const locMatch = item.location.toLowerCase().includes(query);
      return nameMatch || descMatch || locMatch;
    }
    return true;
  });

  grid.innerHTML = '';
  if (browseInfo) {
    browseInfo.textContent = `Showing ${filtered.length} item${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🔍</div>
        <h3>No matching registry results</h3>
        <p>Refine your search tags or clear active filters to start fresh.</p>
        <button class="btn btn-primary btn-sm" onclick="resetFilters()" style="margin-top: 1rem;">Clear Filters</button>
      </div>
    `;
    return;
  }

  filtered.forEach((item, idx) => {
    grid.appendChild(buildItemCard(item, idx));
  });
}

function clearSearch() {
  const searchInput = document.getElementById('browseSearch');
  if (searchInput) {
    searchInput.value = '';
    renderBrowseFeed();
  }
}

function resetFilters() {
  const search = document.getElementById('browseSearch');
  const type = document.getElementById('filterType');
  const cat = document.getElementById('filterCategory');
  const stat = document.getElementById('filterStatus');

  if (search) search.value = '';
  if (type) type.value = '';
  if (cat) cat.value = '';
  if (stat) stat.value = '';

  renderBrowseFeed();
  triggerToast('Filters reset successfully', 'info');
}

// ==========================================================================
// 10. LEADERBOARD VOLUNTEER CONTROLLER (FULLY DYNAMIC ENGINE)
// ==========================================================================
function renderLeaderboard() {
  const podiumRow = document.getElementById('leaderPodium');
  const tbody = document.getElementById('leaderboardTbody');

  if (!podiumRow || !tbody) return;

  const dynamicData = getDynamicLeaderboard();

  if (dynamicData.length === 0) {
    podiumRow.innerHTML = `
      <div class="empty-state" style="width: 100%;">
        <div class="es-icon">🏆</div>
        <h3>Leaderboard is currently empty</h3>
        <p>Volunteers who report found items or help resolve claims will appear here!</p>
      </div>
    `;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No helpers registered yet.</td></tr>`;
    return;
  }

  // Render Podium cards (Top 3)
  const podiumData = dynamicData.slice(0, 3);
  podiumRow.innerHTML = podiumData.map((user, idx) => {
    const rankClass = `podium-${idx + 1}`;
    let medal = '🥇';
    if (idx === 1) medal = '🥈';
    if (idx === 2) medal = '🥉';

    return `
      <div class="podium-card ${rankClass}" style="animation-delay: ${idx * 0.1}s">
        <div class="podium-rank">${idx + 1}</div>
        <div class="podium-avatar">${user.avatar}</div>
        <div class="podium-name">${sanitizeHTML(user.name)}</div>
        <div class="podium-score">${user.points} pts</div>
        <div class="podium-stats-sub">
          <span>🛡️ ${user.badge}</span><br/>
          <span>📦 Logged: ${user.reported} | Returned: ${user.returned}</span>
        </div>
      </div>
    `;
  }).join('');

  // Render Rank table for remaining helpers
  const tableData = dynamicData.slice(3);
  if (tableData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">No other contributors ranked yet.</td></tr>`;
  } else {
    tbody.innerHTML = tableData.map((user, index) => {
      const realRank = index + 4;
      return `
        <tr>
          <td><strong>#${realRank}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${user.avatar}</span>
              <strong>${sanitizeHTML(user.name)}</strong>
            </div>
          </td>
          <td><span class="badge resolved" style="font-size: 0.7rem;">${user.badge}</span></td>
          <td>${user.reported} items</td>
          <td>${user.returned} returned</td>
          <td><strong style="color: var(--accent-blue);">${user.points} pts</strong></td>
        </tr>
      `;
    }).join('');
  }
}

// ==========================================================================
// 11. DEVELOPER DASHBOARD CONTROLLER
// ==========================================================================
function renderDashboardFeed() {
  const allItems = getAllItems();
  const total = allItems.length;
  const lost = allItems.filter(i => i.type === 'lost').length;
  const found = allItems.filter(i => i.type === 'found').length;
  const resolved = allItems.filter(i => i.status === 'Resolved').length;

  const statsContainer = document.getElementById('dashStats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="dash-counter-card">
        <div class="ds-icon-circle accent-blue-bg">📋</div>
        <span class="ds-num">${total}</span>
        <span class="ds-label">Total Logs</span>
      </div>
      <div class="dash-counter-card">
        <div class="ds-icon-circle lost-color" style="background: var(--primary-lost-bg); color: var(--primary-lost);">🔴</div>
        <span class="ds-num">${lost}</span>
        <span class="ds-label">Lost Items</span>
      </div>
      <div class="dash-counter-card">
        <div class="ds-icon-circle found-color" style="background: var(--primary-found-bg); color: var(--primary-found);">🟢</div>
        <span class="ds-num">${found}</span>
        <span class="ds-label">Found Items</span>
      </div>
      <div class="dash-counter-card">
        <div class="ds-icon-circle success-color" style="background: rgba(34, 197, 94, 0.08); color: var(--success);">✅</div>
        <span class="ds-num">${resolved}</span>
        <span class="ds-label">Resolved cases</span>
      </div>
    `;
  }

  const tbody = document.getElementById('dashTbody');
  const emptyView = document.getElementById('dashEmpty');

  if (!tbody) return;
  tbody.innerHTML = '';

  if (allItems.length === 0) {
    if (emptyView) emptyView.style.display = 'block';
    return;
  }

  if (emptyView) emptyView.style.display = 'none';

  allItems.forEach(item => {
    const tr = document.createElement('tr');
    
    let dateText = '';
    if (item.date) {
      const d = new Date(item.date + 'T00:00:00');
      dateText = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    }

    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" onclick="openItemDetailsModal('${item.id}')">
          ${item.photo ? `<img src="${item.photo}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px;" />` : `<span>${CATEGORY_EMOJIS[item.category] || '📦'}</span>`}
          <strong>${sanitizeHTML(item.name)}</strong>
        </div>
      </td>
      <td>${sanitizeHTML(item.category)}</td>
      <td>
        <div class="action-select-group">
          <div class="select-wrapper">
            <select onchange="updateItemStatus('${item.id}', this.value)">
              <option value="Unclaimed" ${item.status === 'Unclaimed' ? 'selected' : ''}>Active</option>
              <option value="Claimed" ${item.status === 'Claimed' ? 'selected' : ''}>Claimed</option>
              <option value="Resolved" ${item.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>
          </div>
        </div>
      </td>
      <td>📍 ${sanitizeHTML(item.location)}</td>
      <td>${dateText}</td>
      <td>${sanitizeHTML(item.reporter)}</td>
      <td>
        <button class="btn-delete" onclick="deleteItemRecord('${item.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const activityContainer = document.getElementById('dashActivity');
  if (activityContainer) {
    if (eventLogs.length === 0) {
      activityContainer.innerHTML = '<p class="text-muted" style="font-size: 0.8rem; text-align: center; padding: 1.5rem 0;">No system activities logged yet.</p>';
    } else {
      activityContainer.innerHTML = eventLogs.map(evt => {
        let icon = '📋';
        if (evt.type === 'found') icon = '📦';
        if (evt.type === 'resolved') icon = '✅';

        return `
          <div class="activity-event">
            <span class="event-icon">${icon}</span>
            <div class="event-details">
              <span><strong>${sanitizeHTML(evt.name)}</strong> ${evt.text}</span>
              <span class="event-time">${evt.time}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function updateItemStatus(itemId, newStatus) {
  let matchedName = "";

  // Local check
  if (itemId.startsWith('local-')) {
    const local = getLocalItems();
    const idx = local.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      local[idx].status = newStatus;
      matchedName = local[idx].reporter;
      saveLocalItems(local);
      
      const item = local[idx];
      logSystemEvent(item.type, item.name, `status updated to ${newStatus}`);
    }
  } else {
    // Simulated check
    const idx = runtimeSimulatedItems.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      runtimeSimulatedItems[idx].status = newStatus;
      matchedName = runtimeSimulatedItems[idx].reporter;
      
      const item = runtimeSimulatedItems[idx];
      logSystemEvent(item.type, item.name, `status updated to ${newStatus}`);
    }
  }

  // Points update dynamically inside the leaderboard calculation engine
  if (newStatus === 'Resolved' && matchedName) {
    triggerToast(`Listing resolved! ${matchedName} earned points on the Leaderboard.`, 'success');
  } else {
    triggerToast(`Status changed to ${newStatus}`, 'success');
  }

  renderDashboardFeed();
}

function deleteItemRecord(itemId) {
  if (!confirm("Are you sure you want to permanently delete this listing record?")) return;

  if (itemId.startsWith('local-')) {
    const local = getLocalItems().filter(i => i.id !== itemId);
    saveLocalItems(local);
  } else {
    runtimeSimulatedItems = runtimeSimulatedItems.filter(i => i.id !== itemId);
  }

  triggerToast('Record removed successfully', 'success');
  renderDashboardFeed();
}

function clearAllUserData() {
  if (!confirm("Caution! This will wipe your locally logged items data. Proceed?")) return;
  localStorage.removeItem(DATABASE_KEY);
  runtimeSimulatedItems = [];
  eventLogs = [];
  triggerToast('All registry logs cleared', 'info');
  renderDashboardFeed();
}

function logSystemEvent(type, name, actionText) {
  const newEvt = {
    id: 'evt-' + Date.now(),
    type: type,
    name: name,
    text: actionText,
    time: 'just now'
  };
  eventLogs.unshift(newEvt);
  if (eventLogs.length > 15) eventLogs.pop();
}

// ==========================================================================
// 12. DETAILS MODAL SYSTEM & CLAIM WORKFLOW
// ==========================================================================
function openItemDetailsModal(itemId) {
  const item = getAllItems().find(i => i.id === itemId);
  if (!item) return;

  const content = document.getElementById('item-modal-content');
  if (!content) return;

  const isLost = item.type === 'lost';
  const badgeClass = isLost ? 'badge-lost' : 'badge-found';
  const badgeLabel = isLost ? '🔴 Lost' : '🟢 Found';

  const statusClassMap = {
    'Unclaimed': 'status-unclaimed',
    'Claimed': 'status-claimed',
    'Resolved': 'status-resolved'
  };
  const statusClass = statusClassMap[item.status] || 'status-unclaimed';

  const d = new Date(item.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });

  // Show claim button if the status is active (Unclaimed)
  const claimButtonHtml = item.status === 'Unclaimed'
    ? `<button class="btn btn-found btn-sm" onclick="showClaimForm('${item.id}')">Claim Item 🙋‍♂️</button>`
    : '';

  content.innerHTML = `
    <div class="modal-body-wrap">
      ${item.photo ? `<img class="det-img" src="${item.photo}" alt="${sanitizeHTML(item.name)}" />` : `<div class="det-nophoto">${CATEGORY_EMOJIS[item.category] || '📦'}</div>`}
      
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
        <span class="item-badge ${badgeClass}">${badgeLabel}</span>
        <span class="status-badge ${statusClass}">${item.status}</span>
      </div>

      <h3 class="det-title">${sanitizeHTML(item.name)}</h3>
      
      <div class="det-meta">
        <span><strong>📁 Category:</strong> ${sanitizeHTML(item.category)}</span>
        <span><strong>📍 Location:</strong> ${sanitizeHTML(item.location)}</span>
        <span><strong>📅 Date logged:</strong> ${dateStr}</span>
        <span><strong>👤 Reported by:</strong> ${sanitizeHTML(item.reporter)}</span>
        <span><strong>📧 Contact:</strong> ${sanitizeHTML(item.email)}</span>
        ${item.phone ? `<span><strong>📞 Phone:</strong> ${sanitizeHTML(item.phone)}</span>` : ''}
      </div>

      <p class="det-desc">${sanitizeHTML(item.description)}</p>

      <div class="det-actions">
        ${claimButtonHtml}
        <a class="btn btn-primary btn-sm" href="mailto:${item.email}?subject=TraceBack Match Inquiry: ${encodeURIComponent(item.name)}">Contact Reporter ✉️</a>
        <button class="btn btn-ghost btn-sm" onclick="closeModalDirect()">Close</button>
      </div>
    </div>
  `;

  const overlay = document.getElementById('item-modal');
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function showClaimForm(itemId) {
  const item = getAllItems().find(i => i.id === itemId);
  if (!item) return;

  const content = document.getElementById('item-modal-content');
  if (!content) return;

  content.innerHTML = `
    <div class="modal-body-wrap">
      <h3 class="det-title" style="margin-bottom: 0.5rem;">Claim Ownership</h3>
      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.25rem;">
        Verify ownership for <strong>${sanitizeHTML(item.name)}</strong>. Describe unique attributes so the reporter can confirm it belongs to you.
      </p>

      <form id="claimItemForm" onsubmit="submitItemClaim(event, '${itemId}')" novalidate>
        <div class="form-group">
          <label for="claim-desc">Describe Secret Markings or Details <span class="required">*</span></label>
          <textarea id="claim-desc" placeholder="Describe lockscreen screen wallpapers, serial numbers, case covers, contents or scratches..." required></textarea>
          <span class="field-error" id="claim-desc-err">Verification details are required.</span>
        </div>

        <div class="form-group">
          <label for="claim-email">Your Contact Email <span class="required">*</span></label>
          <input type="email" id="claim-email" placeholder="student@university.edu" required />
          <span class="field-error" id="claim-email-err">Please enter a valid email address.</span>
        </div>

        <div class="det-actions" style="margin-top: 1rem;">
          <button type="submit" class="btn btn-found btn-sm">Submit Claim Request</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openItemDetailsModal('${itemId}')">Cancel</button>
        </div>
      </form>
    </div>
  `;

  // Bind input listeners for validation clears
  const claimDesc = document.getElementById('claim-desc');
  const claimEmail = document.getElementById('claim-email');
  if (claimDesc) claimDesc.addEventListener('input', () => validateField(claimDesc, 'claim-desc-err'));
  if (claimEmail) claimEmail.addEventListener('input', () => validateField(claimEmail, 'claim-email-err', true));
}

function submitItemClaim(e, itemId) {
  e.preventDefault();
  
  const desc = document.getElementById('claim-desc');
  const email = document.getElementById('claim-email');

  let valid = true;
  valid = validateField(desc, 'claim-desc-err') && valid;
  valid = validateField(email, 'claim-email-err', true) && valid;

  if (!valid) {
    triggerToast("Please fill all verification fields correctly", "error");
    return;
  }

  let itemFound = null;

  if (itemId.startsWith('local-')) {
    const local = getLocalItems();
    const idx = local.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      local[idx].status = 'Claimed';
      local[idx].description += `\n\n[Claim request by ${email.value.trim()}: "${desc.value.trim()}"]`;
      itemFound = local[idx];
      saveLocalItems(local);
    }
  } else {
    const idx = runtimeSimulatedItems.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      runtimeSimulatedItems[idx].status = 'Claimed';
      runtimeSimulatedItems[idx].description += `\n\n[Claim request by ${email.value.trim()}: "${desc.value.trim()}"]`;
      itemFound = runtimeSimulatedItems[idx];
    }
  }

  if (itemFound) {
    logSystemEvent(itemFound.type, itemFound.name, `claimed by ${email.value.trim()}`);
    triggerToast("Success! Ownership claim request submitted.", "success");
  } else {
    triggerToast("Error loading item details", "error");
  }

  closeModalDirect();

  // Refresh active views
  const active = document.querySelector('.page.active');
  if (active) {
    if (active.id === 'home') renderHomeFeed();
    if (active.id === 'browse') renderBrowseFeed();
    if (active.id === 'leaderboard') renderLeaderboard();
    if (active.id === 'dashboard') renderDashboardFeed();
  }
}

function closeModal(e) {
  if (e.target.id === 'item-modal') {
    closeModalDirect();
  }
}

function closeModalDirect() {
  const overlay = document.getElementById('item-modal');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ==========================================================================
// 13. PROCEDURAL NETWORK SIMULATION TICKER
// ==========================================================================
function startBackgroundSim() {
  const mockNames = ["Rohan Patel", "Sneha Rao", "Divya Nair", "Samir Sen", "Kabir Roy", "Diya Shah", "Aarav Sharma", "Jessica Taylor", "Vikram Patel"];
  const mockLocations = ["Science Lab Annex", "Block D Seminar Hall", "Grounds Canteen Area", "Admin Office Lobby", "Sports Pavilion Lounge"];
  const categoriesList = Object.keys(CATEGORY_EMOJIS);
  const lostList = ["AirPods Pro Case", "Leather Binder Folder", "Scientific Calculator", "Casio Analog Watch", "Stainless steel Thermos Flask"];
  const foundList = ["House Keyring", "Gold Stud Earring", "Chemistry Lab Manual", "USB Drive 64GB", "Umbrella (Black)"];

  setInterval(() => {
    // 35% chance to trigger simulated network event
    if (Math.random() > 0.65) {
      const isLost = Math.random() > 0.5;
      const reporter = mockNames[Math.floor(Math.random() * mockNames.length)];
      const loc = mockLocations[Math.floor(Math.random() * mockLocations.length)];
      const cat = categoriesList[Math.floor(Math.random() * categoriesList.length)];
      const itemTitle = isLost 
        ? lostList[Math.floor(Math.random() * lostList.length)] 
        : foundList[Math.floor(Math.random() * foundList.length)];

      const type = isLost ? 'lost' : 'found';

      const mock = {
        id: 'sim-' + Date.now(),
        type: type,
        name: itemTitle,
        category: cat,
        description: `Procedurally generated entry logged by volunteer ${reporter} at the ${loc}.`,
        location: loc,
        date: new Date().toISOString().split('T')[0],
        email: `${reporter.toLowerCase().replace(' ', '.')}@example.com`,
        phone: "+91 " + Math.floor(7000000000 + Math.random() * 2999999999),
        photo: "",
        status: "Unclaimed",
        createdAt: new Date().toISOString(),
        reporter: reporter
      };

      runtimeSimulatedItems.unshift(mock);
      if (runtimeSimulatedItems.length > 20) runtimeSimulatedItems.pop();

      logSystemEvent(type, itemTitle, `reported as ${type} by ${reporter} near ${loc}`);

      triggerToast(`Live Update: ${itemTitle} ${type} reported by ${reporter}`, 'info');

      // Refresh currently open section view
      const active = document.querySelector('.page.active');
      if (active) {
        if (active.id === 'home') renderHomeFeed();
        if (active.id === 'browse') renderBrowseFeed();
        if (active.id === 'leaderboard') renderLeaderboard();
        if (active.id === 'dashboard') renderDashboardFeed();
      }
    }
  }, 20000); // Ticks every 20s
}

// Pre-fill a couple of runtime simulated items on first load so the app has content, 
// but fully computed through the dynamic model instead of static hardcoded files
function seedInitialSessionData() {
  const seedItems = [
    {
      id: "sim-seed-1",
      type: "lost",
      name: "MacBook Pro 16\" Space Gray",
      category: "Laptop / Tablet",
      description: "GitHub sticker on the cover. Left in a black leather sleeve.",
      location: "Main Library Study Cabin",
      date: new Date(Date.now() - 2 * 3600000 * 24).toISOString().split('T')[0],
      email: "sarah.c@student.edu",
      phone: "+91 95420 12890",
      photo: "",
      status: "Unclaimed",
      createdAt: new Date(Date.now() - 2 * 3600000 * 24).toISOString(),
      reporter: "Sarah Connor"
    },
    {
      id: "sim-seed-2",
      type: "found",
      name: "Fossil Chronograph Watch",
      category: "Jewellery / Watch",
      description: "Gold strap analog watch found on the lobby couch.",
      location: "Sports Complex",
      date: new Date(Date.now() - 1 * 3600000 * 24).toISOString().split('T')[0],
      email: "jessica.t@helper.in",
      phone: "",
      photo: "",
      status: "Unclaimed",
      createdAt: new Date(Date.now() - 1 * 3600000 * 24).toISOString(),
      reporter: "Jessica Taylor"
    }
  ];

  runtimeSimulatedItems.push(...seedItems);
  logSystemEvent('lost', "MacBook Pro 16\"", "reported as lost by Sarah Connor");
  logSystemEvent('found', "Fossil Chronograph Watch", "reported as found by Jessica Taylor");
}

// ==========================================================================
// 14. FORM VALIDATIONS & SUBMISSIONS
// ==========================================================================
function validateField(inputEl, errorElId, isEmail = false) {
  const val = inputEl.value.trim();
  let valid = val !== "";

  if (isEmail && valid) {
    valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  const errEl = document.getElementById(errorElId);
  if (errEl) {
    if (!valid) {
      inputEl.classList.add('invalid');
      errEl.classList.add('show');
    } else {
      inputEl.classList.remove('invalid');
      errEl.classList.remove('show');
    }
  }

  return valid;
}

function handleLostFormSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('l-name');
  const cat = document.getElementById('l-category');
  const desc = document.getElementById('l-desc');
  const loc = document.getElementById('l-location');
  const date = document.getElementById('l-date');
  const email = document.getElementById('l-email');

  let valid = true;
  valid = validateField(name, 'l-name-err') && valid;
  valid = validateField(cat, 'l-category-err') && valid;
  valid = validateField(desc, 'l-desc-err') && valid;
  valid = validateField(loc, 'l-location-err') && valid;
  valid = validateField(date, 'l-date-err') && valid;
  valid = validateField(email, 'l-email-err', true) && valid;

  if (!valid) {
    triggerToast("Please fill all required fields correctly", "error");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Submitting... <span class="loader-spinner"></span>';

  setTimeout(() => {
    const local = getLocalItems();
    const newReport = {
      id: 'local-' + Date.now(),
      type: 'lost',
      name: name.value.trim(),
      category: cat.value,
      description: desc.value.trim(),
      location: loc.value.trim(),
      date: date.value,
      email: email.value.trim(),
      phone: document.getElementById('l-phone').value.trim(),
      photo: uploadedPhotoLost,
      status: 'Unclaimed',
      createdAt: new Date().toISOString(),
      reporter: 'You (Local Author)'
    };

    local.unshift(newReport);
    saveLocalItems(local);

    logSystemEvent('lost', newReport.name, `reported as lost by You`);

    btn.disabled = false;
    btn.innerHTML = oldText;

    e.target.reset();
    removePhoto('l');

    triggerToast("Success! Lost item reported.", "success");
    showSection('browse');
  }, 1000);
}

function handleFoundFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('f-name');
  const cat = document.getElementById('f-category');
  const desc = document.getElementById('f-desc');
  const loc = document.getElementById('f-location');
  const date = document.getElementById('f-date');
  const email = document.getElementById('f-email');

  let valid = true;
  valid = validateField(name, 'f-name-err') && valid;
  valid = validateField(cat, 'f-category-err') && valid;
  valid = validateField(desc, 'f-desc-err') && valid;
  valid = validateField(loc, 'f-location-err') && valid;
  valid = validateField(date, 'f-date-err') && valid;
  valid = validateField(email, 'f-email-err', true) && valid;

  let photoValid = true;
  if (!uploadedPhotoFound) {
    document.getElementById('f-photo-err').classList.add('show');
    photoValid = false;
  } else {
    document.getElementById('f-photo-err').classList.remove('show');
  }

  if (!valid || !photoValid) {
    triggerToast("Mandatory inputs or photo verification missing", "error");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Submitting... <span class="loader-spinner"></span>';

  setTimeout(() => {
    const local = getLocalItems();
    const newReport = {
      id: 'local-' + Date.now(),
      type: 'found',
      name: name.value.trim(),
      category: cat.value,
      description: desc.value.trim(),
      location: loc.value.trim(),
      date: date.value,
      email: email.value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      photo: uploadedPhotoFound,
      status: 'Unclaimed',
      createdAt: new Date().toISOString(),
      reporter: 'You (Local Author)'
    };

    local.unshift(newReport);
    saveLocalItems(local);

    logSystemEvent('found', newReport.name, `reported as found by You`);

    btn.disabled = false;
    btn.innerHTML = oldText;

    e.target.reset();
    removePhoto('f');

    triggerToast("Success! Found item listed. points awarded.", "success");
    showSection('browse');
  }, 1000);
}

function handleContactFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('c-name');
  const email = document.getElementById('c-email');
  const type = document.getElementById('c-type');
  const msg = document.getElementById('c-message');

  let valid = true;
  valid = validateField(name, 'c-name-err') && valid;
  valid = validateField(email, 'c-email-err', true) && valid;
  valid = validateField(type, 'c-type-err') && valid;
  valid = validateField(msg, 'c-message-err') && valid;

  if (!valid) {
    triggerToast("Please review form input errors", "error");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Sending Ticket... <span class="loader-spinner"></span>';

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = oldText;

    e.target.reset();
    triggerToast("Ticket Submitted! Our team will contact you shortly.", "success");
  }, 1200);
}

// ==========================================================================
// 15. INITIALIZATION BINDINGS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('traceback_theme');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.textContent = '🌙';
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const lDate = document.getElementById('l-date');
  const fDate = document.getElementById('f-date');
  if (lDate) lDate.value = todayStr;
  if (fDate) fDate.value = todayStr;

  const lostForm = document.getElementById('lostForm');
  if (lostForm) lostForm.addEventListener('submit', handleLostFormSubmit);

  const foundForm = document.getElementById('foundForm');
  if (foundForm) foundForm.addEventListener('submit', handleFoundFormSubmit);

  const contactForm = document.getElementById('contactForm');
  if (contactForm) contactForm.addEventListener('submit', handleContactFormSubmit);

  setupDragAndDrop('l-drop', 'l-photo', 'l-preview-wrap', 'l-preview', 'l');
  setupDragAndDrop('f-drop', 'f-photo', 'f-preview-wrap', 'f-preview', 'f');

  const clearChecks = [
    { id: 'l-name', err: 'l-name-err' },
    { id: 'l-category', err: 'l-category-err' },
    { id: 'l-desc', err: 'l-desc-err' },
    { id: 'l-location', err: 'l-location-err' },
    { id: 'l-date', err: 'l-date-err' },
    { id: 'l-email', err: 'l-email-err', email: true },
    { id: 'f-name', err: 'f-name-err' },
    { id: 'f-category', err: 'f-category-err' },
    { id: 'f-desc', err: 'f-desc-err' },
    { id: 'f-location', err: 'f-location-err' },
    { id: 'f-date', err: 'f-date-err' },
    { id: 'f-email', err: 'f-email-err', email: true },
    { id: 'c-name', err: 'c-name-err' },
    { id: 'c-email', err: 'c-email-err', email: true },
    { id: 'c-type', err: 'c-type-err' },
    { id: 'c-message', err: 'c-message-err' }
  ];

  clearChecks.forEach(item => {
    const input = document.getElementById(item.id);
    if (input) {
      input.addEventListener('input', () => {
        validateField(input, item.err, item.email);
      });
    }
  });

  const browseSearch = document.getElementById('browseSearch');
  const filterType = document.getElementById('filterType');
  const filterCategory = document.getElementById('filterCategory');
  const filterStatus = document.getElementById('filterStatus');

  if (browseSearch) browseSearch.addEventListener('input', renderBrowseFeed);
  if (filterType) filterType.addEventListener('change', renderBrowseFeed);
  if (filterCategory) filterCategory.addEventListener('change', renderBrowseFeed);
  if (filterStatus) filterStatus.addEventListener('change', renderBrowseFeed);

  // Seed session mock items (generated dynamically rather than static hardcoded)
  //seedInitialSessionData();

  renderHomeFeed();

  setTimeout(() => {
    const loader = document.getElementById('page-loader');
    if (loader) {
      loader.classList.add('out');
      loader.addEventListener('transitionend', () => loader.remove());
    }
  }, 1000);

  // startBackgroundSim(); // Disabled periodic simulated item generation loop
});
// ===== BACK TO TOP =====
const backToTopBtn = document.getElementById('backToTopBtn');

window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    backToTopBtn.classList.add('visible');
  } else {
    backToTopBtn.classList.remove('visible');
  }
});

backToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
// ===== DYNAMIC HERO FLOAT CARDS =====
function getItemEmoji(category) {
  const map = {
    electronics: '💻', jewelry: '💍', bags: '🎒', clothing: '👕',
    keys: '🗝️', wallet: '👛', books: '📚', sports: '⚽',
    accessories: '🕶️', documents: '📄', pets: '🐾'
  };
  return map[(category || '').toLowerCase()] || '📦';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function renderHeroFloatCards() {
  const all = getAllItems(); // uses your existing function
  if (!all || all.length === 0) return;

  // Sort by date descending, take latest 3
  const latest = [...all]
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    .slice(0, 3);

  const slots = [
    document.querySelector('.float-card.fc1'),
    document.querySelector('.float-card.fc2'),
    document.querySelector('.float-card.fc3')
  ];

  latest.forEach((item, i) => {
    if (!slots[i]) return;
    const status = (item.status || item.type || 'lost').toLowerCase();
    const badgeClass = status === 'found' ? 'found' : status === 'resolved' ? 'resolved' : 'lost';
    const badgeLabel = badgeClass.charAt(0).toUpperCase() + badgeClass.slice(1);

    slots[i].innerHTML = `
      <span class="fc-ico">${getItemEmoji(item.category)}</span>
      <div class="fc-info">
        <b>${item.title || item.name || 'Unknown Item'}</b>
        <span>${item.location || 'Unknown location'} · ${timeAgo(item.date || item.createdAt)}</span>
      </div>
      <span class="badge ${badgeClass}">${badgeLabel}</span>
    `;
  });
}

// Refresh cards on home load and every 20s to stay in sync with sim ticker
renderHeroFloatCards();
setInterval(renderHeroFloatCards, 20000);

// ===== CONTRIBUTE PAGE =====
async function renderContributePage() {
  await Promise.all([fetchOpenIssues(), fetchContributors()]);
}

async function fetchOpenIssues() {
  const container = document.getElementById('openIssuesList');
  const badge = document.getElementById('issuesCountBadge');
  if (!container) return;

  try {
    const res = await fetch('https://api.github.com/repos/Ekjyotkaur07/traceback/issues?state=open&per_page=12');
    const issues = await res.json();

    if (!Array.isArray(issues) || issues.length === 0) {
      container.innerHTML = '<p class="contrib-loading">No open issues right now. Check back soon!</p>';
      if (badge) badge.textContent = '0';
      return;
    }

    if (badge) badge.textContent = issues.length;

    container.innerHTML = issues.map(issue => `
      <a class="issue-card" href="${issue.html_url}" target="_blank" rel="noopener">
        <div class="issue-card-title">#${issue.number} — ${issue.title}</div>
        <div class="issue-labels">
          ${issue.labels.map(l => `
            <span class="issue-label" style="color:#${l.color}; border-color:#${l.color}; background:#${l.color}18">
              ${l.name}
            </span>`).join('')}
        </div>
        <div class="issue-card-meta">Opened by @${issue.user.login} · ${new Date(issue.created_at).toLocaleDateString()}</div>
      </a>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="contrib-loading">Could not load issues. <a href="https://github.com/Ekjyotkaur07/traceback/issues" target="_blank">View on GitHub →</a></p>';
  }
}

async function fetchContributors() {
  const container = document.getElementById('contributorsList');
  if (!container) return;

  try {
    const res = await fetch('https://api.github.com/repos/Ekjyotkaur07/traceback/contributors');
    const contributors = await res.json();

    if (!Array.isArray(contributors) || contributors.length === 0) {
      container.innerHTML = '<p class="contrib-loading">Be the first contributor! 🚀</p>';
      return;
    }

    container.innerHTML = contributors.map(c => `
      <a class="contrib-avatar-card" href="${c.html_url}" target="_blank" rel="noopener">
        <img src="${c.avatar_url}" alt="${c.login}" loading="lazy"/>
        <span>@${c.login}</span>
        <span class="contrib-contributions">${c.contributions} commit${c.contributions > 1 ? 's' : ''}</span>
      </a>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="contrib-loading">Could not load contributors. <a href="https://github.com/Ekjyotkaur07/traceback/contributors" target="_blank">View on GitHub →</a></p>';
  }
}

// Hook into SPA router — call when contribute section becomes active
const _origShowSection = showSection;
window.showSection = function(id) {
  _origShowSection(id);
  if (id === 'contribute') renderContributePage();
};
// ===== TRACEBOT CHATBOT =====
const TRACEBOT_KB = [
  {
    keys: ['what is traceback', 'about traceback', 'what does traceback do'],
    answer: '🔍 <b>TraceBack</b> is a smart Lost & Found web app. You can report lost or found items, browse the registry, claim items, and track reunions — all in one place.'
  },
  {
    keys: ['report lost', 'lost item', 'i lost'],
    answer: '📋 To report a lost item:<br>1. Click <b>Report Lost</b> in the nav.<br>2. Fill in the item details, location, and upload a photo.<br>3. Submit — it gets added to the registry immediately!'
  },
  {
    keys: ['report found', 'found item', 'i found'],
    answer: '🔍 To report a found item:<br>1. Click <b>Report Found</b> in the nav.<br>2. Describe the item and where you found it.<br>3. Submit — someone looking for it will be notified.'
  },
  {
    keys: ['claim', 'how do i claim', 'get my item back'],
    answer: '🙋 To claim an item:<br>1. Go to <b>Browse</b> and find your item.<br>2. Click on it to open the detail view.<br>3. Hit <b>Claim Item</b> and fill in the claim form.<br>4. The finder will be notified to verify.'
  },
  {
    keys: ['leaderboard', 'points', 'score', 'ranking'],
    answer: '🏆 The <b>Leaderboard</b> ranks users by their contribution points. You earn points by reporting found items and successfully reuniting them with owners. Go to <b>Leaderboard</b> in the nav to see the rankings!'
  },
  {
    keys: ['contribute', 'open source', 'github', 'help develop'],
    answer: '🤝 TraceBack is open source! Click the <b>Contribute</b> button in the nav to see how to fork the repo, pick an issue, and submit a pull request. All contributions are welcome!'
  },
  {
    keys: ['login', 'sign up', 'register', 'account', 'signup'],
    answer: '🔐 Click <b>Login / Sign Up</b> in the top right. You can sign up with your email or use phone OTP. An account lets you report items, claim, and track your activity on the dashboard.'
  },
  {
    keys: ['dashboard', 'my items', 'my reports'],
    answer: '📊 The <b>Dashboard</b> shows all your reported items, their status (Lost / Found / Resolved), and your recent activity. You can also delete or update your reports from there.'
  },
  {
    keys: ['contact', 'support', 'help', 'email us'],
    answer: '📞 Go to <b>Contact Us</b> in the nav to send us a message. Fill in your name, email, and your query — our team will get back to you as soon as possible.'
  },
  {
    keys: ['data', 'privacy', 'safe', 'security', 'information'],
    answer: '🔒 Your data is stored securely in your browser\'s local storage. We do not share or sell your personal information. Photos are only used to help identify lost items.'
  },
  {
    keys: ['dark mode', 'theme', 'light mode', 'night mode'],
    answer: '🌙 Click the <b>moon / sun icon</b> in the top right navbar to toggle between light and dark mode. Your preference is saved automatically!'
  },
  {
    keys: ['browse', 'search', 'find item', 'filter'],
    answer: '🔎 Go to <b>Browse</b> in the nav. You can search by keyword, filter by category (electronics, bags, keys...) and status (Lost / Found / Resolved).'
  },
  {
    keys: ['hello', 'hi', 'hey', 'hii', 'good morning', 'good evening'],
    answer: '👋 Hey there! I\'m <b>TraceBot</b>. Ask me anything about TraceBack — reporting items, claiming, leaderboard, contributing, and more!'
  },
  {
    keys: ['thank', 'thanks', 'ty', 'helpful'],
    answer: '😊 You\'re welcome! Let me know if you have any other questions. I\'m always here to help!'
  },
  {
    keys: ['bye', 'goodbye', 'see you', 'close'],
    answer: '👋 Goodbye! Come back anytime you need help. Hope TraceBack helps you find what you\'re looking for! 💙'
  }
];

function toggleChatbot() {
  const win = document.getElementById('chatbot-window');
  const dot = document.querySelector('.chat-notif-dot');
  win.classList.toggle('chatbot-hidden');
  if (dot) dot.style.display = 'none';
}

function askQuestion(q) {
  document.getElementById('quickBtns')?.remove();
  appendChatMsg(q, 'user');
  showTypingThenReply(q);
}

function sendChatMessage() {
  const input = document.getElementById('chatbotInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  document.getElementById('quickBtns')?.remove();
  appendChatMsg(text, 'user');
  showTypingThenReply(text);
}

function appendChatMsg(text, role) {
  const container = document.getElementById('chatbotMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `<span>${text}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTypingThenReply(query) {
  const container = document.getElementById('chatbotMessages');

  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    typing.remove();
    const reply = getBotReply(query);
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.innerHTML = `<span>${reply}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }, 900);
}

function getBotReply(query) {
  const q = query.toLowerCase();
  for (const entry of TRACEBOT_KB) {
    if (entry.keys.some(k => q.includes(k))) {
      return entry.answer;
    }
  }
  return `🤔 I'm not sure about that one. Try asking about:<br>
    <b>reporting items, claiming, leaderboard, login, dashboard, contributing,</b> or <b>contact support</b>. 
    You can also go to <b>Contact Us</b> for direct help!`;
}
// ===== LOCATION ACCESS =====
let userCity = null;
let userCoords = null;

function triggerLocationBanner() {
  const decided = localStorage.getItem('tb_location_decided');
  if (decided === 'granted') {
    const saved = localStorage.getItem('tb_user_city');
    if (saved) applyLocationToSearch(saved);
    return;
  }
  if (decided === 'denied') return;

  // Show banner after short delay so section transition finishes
  setTimeout(() => {
    const banner = document.getElementById('locationBanner');
    if (banner) banner.classList.remove('hidden');
  }, 600);
}

function dismissLocationBanner(silent = false) {
  const banner = document.getElementById('locationBanner');
  if (banner) banner.classList.add('hidden');
  if (!silent) {
    localStorage.setItem('tb_location_decided', 'denied');
  }
}

function requestLocation() {
  dismissLocationBanner(true);
  localStorage.setItem('tb_location_decided', 'granted');

  if (!navigator.geolocation) {
    triggerToast('Geolocation is not supported by your browser.', 'error');
    return;
  }

  triggerToast('Detecting your location...', 'info');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const city = await reverseGeocode(userCoords.lat, userCoords.lng);
      if (city) {
        userCity = city;
        localStorage.setItem('tb_user_city', city);
        applyLocationToSearch(city);
        triggerToast(`📍 Location set to ${city}`, 'success');
      }
    },
    (err) => {
      triggerToast('Could not get your location. Please allow access in browser settings.', 'error');
    }
  );
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      null
    );
  } catch {
    return null;
  }
}

function applyLocationToSearch(city) {
  // Show pill
  const pill = document.getElementById('locationPill');
  const pillText = document.getElementById('locationPillText');
  if (pill && pillText) {
    pillText.textContent = city;
    pill.style.display = 'inline-flex';
  }

  // Update search placeholder
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.placeholder = `Search items near ${city}...`;
  }

  userCity = city;

  // Re-render browse if it's active
  const browseSection = document.getElementById('browse');
  if (browseSection && browseSection.classList.contains('active')) {
    filterAndRenderItems();
  }
}

function clearLocation() {
  userCity = null;
  userCoords = null;
  localStorage.removeItem('tb_user_city');
  localStorage.removeItem('tb_location_decided');

  const pill = document.getElementById('locationPill');
  if (pill) pill.style.display = 'none';

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = 'Search items...';

  triggerToast('Location cleared.', 'info');
}

// Hook into your existing filter function to sort by city match
const _origFilter = window.filterAndRenderItems;
if (typeof filterAndRenderItems === 'function') {
  window.filterAndRenderItems = function () {
    _origFilter && _origFilter();
    if (!userCity) return;
    sortCardsByCity(userCity);
  };
}

function sortCardsByCity(city) {
  const grid = document.querySelector('.items-grid');
  if (!grid) return;
  const cards = Array.from(grid.children);
  cards.sort((a, b) => {
    const aMatch = a.textContent.toLowerCase().includes(city.toLowerCase()) ? 0 : 1;
    const bMatch = b.textContent.toLowerCase().includes(city.toLowerCase()) ? 0 : 1;
    return aMatch - bMatch;
  });
  cards.forEach(c => grid.appendChild(c));
}
function fillLocationField(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  if (userCity) {
    field.value = userCity;
    triggerToast(`📍 Location set to ${userCity}`, 'success');
    return;
  }

  if (!navigator.geolocation) {
    triggerToast('Geolocation not supported by your browser.', 'error');
    return;
  }

  triggerToast('Detecting your location...', 'info');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const city = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (city) {
        userCity = city;
        localStorage.setItem('tb_user_city', city);
        localStorage.setItem('tb_location_decided', 'granted');
        field.value = city;
        applyLocationToSearch(city);
        triggerToast(`📍 Location set to ${city}`, 'success');
      }
    },
    () => triggerToast('Could not get location. Please allow access.', 'error')
  );
}
// ==========================================================================
// PROFILE PAGE
// ==========================================================================
function renderProfilePage() {
  const user = getCurrentUser();
  if (!user) return;

  // Avatar initial
  const avatarBig = document.getElementById('profileAvatarBig');
  if (avatarBig) avatarBig.textContent = (user.name || user.email || 'U')[0].toUpperCase();

  // Name & email
  const nameEl  = document.getElementById('profileDisplayName');
  const emailEl = document.getElementById('profileDisplayEmail');
  if (nameEl)  nameEl.textContent  = user.name  || 'User';
  if (emailEl) emailEl.textContent = user.email || '—';

  // Pre-fill edit fields
  const editName  = document.getElementById('editName');
  const editEmail = document.getElementById('editEmail');
  if (editName)  editName.value  = user.name  || '';
  if (editEmail) editEmail.value = user.email || '';

  // Stats
  renderProfileStats(user);

  // Items
  renderProfileItems('all');
}

function renderProfileStats(user) {
  const allItems = getAllItems();
  const myItems  = allItems.filter(i =>
    i.email === user.email || i.reporter === 'You (Local Author)'
  );

  const points = myItems.reduce((sum, i) => {
    const s = (i.status || '').toLowerCase();
    const t = (i.type   || '').toLowerCase();
    if (s === 'resolved') return sum + 15;
    if (t === 'found')    return sum + 10;
    return sum + 5;
  }, 0);

  const pointsEl = document.getElementById('profilePoints');
  if (pointsEl) pointsEl.textContent = points;

  // Rank
  const allUsers = JSON.parse(localStorage.getItem('tb_users') || '[]');
  const scored = allUsers.map(u => {
    const uItems = allItems.filter(i => i.email === u.email);
    const uPts   = uItems.reduce((s, i) => {
      const st = (i.status || '').toLowerCase();
      const tp = (i.type   || '').toLowerCase();
      if (st === 'resolved') return s + 15;
      if (tp === 'found')    return s + 10;
      return s + 5;
    }, 0);
    return { email: u.email, pts: uPts };
  }).sort((a, b) => b.pts - a.pts);

  const rank    = scored.findIndex(u => u.email === user.email) + 1;
  const rankEl  = document.getElementById('profileRank');
  if (rankEl) rankEl.textContent = rank > 0 ? rank : '—';
}

function renderProfileItems(tab) {
  const user = getCurrentUser();
  const grid = document.getElementById('profileItemsGrid');
  if (!grid || !user) return;

  let items = getAllItems().filter(i =>
    i.email === user.email || i.reporter === 'You (Local Author)'
  );

  if (tab === 'lost')     items = items.filter(i => (i.type   || '').toLowerCase() === 'lost');
  if (tab === 'found')    items = items.filter(i => (i.type   || '').toLowerCase() === 'found');
  if (tab === 'resolved') items = items.filter(i => (i.status || '').toLowerCase() === 'resolved');

  if (items.length === 0) {
    grid.innerHTML = '<p class="profile-empty">No items in this category yet.</p>';
    return;
  }

  grid.innerHTML = items.map(item => {
    const status     = (item.status || item.type || 'lost').toLowerCase();
    const badgeClass = status === 'found' ? 'found' : status === 'resolved' ? 'resolved' : 'lost';
    const label      = badgeClass.charAt(0).toUpperCase() + badgeClass.slice(1);
    const imgHtml    = item.photo
      ? `<img src="${item.photo}" alt="${item.name || ''}" class="profile-item-img" />`
      : `<div class="profile-item-img-placeholder">${getItemEmoji(item.category)}</div>`;

    return `
      <div class="profile-item-card">
        ${imgHtml}
        <div class="profile-item-info">
          <b>${item.title || item.name || 'Unknown Item'}</b>
          <span>${item.location || '—'}</span>
          <span class="badge ${badgeClass}">${label}</span>
        </div>
      </div>`;
  }).join('');
}

function switchProfileTab(tab, el) {
  document.querySelectorAll('.pitab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderProfileItems(tab);
}

function saveProfileInfo() {
  const name  = document.getElementById('editName')?.value.trim();
  const email = document.getElementById('editEmail')?.value.trim();

  if (!name || !email) {
    triggerToast('Name and email cannot be empty.', 'error');
    return;
  }

  const user    = getCurrentUser();
  const users   = JSON.parse(localStorage.getItem('tb_users') || '[]');
  const idx     = users.findIndex(u => u.email === user.email);
  const updated = { ...user, name, email };

  if (idx > -1) users[idx] = { ...users[idx], name, email };
  localStorage.setItem('tb_users', JSON.stringify(users));
  localStorage.setItem('tb_current_user', JSON.stringify(updated));

  renderProfilePage();
  if (typeof renderNavAuth === 'function') renderNavAuth();
  triggerToast('Profile updated successfully! ✅', 'success');
}

function saveNewPassword() {
  const current  = document.getElementById('currentPw')?.value;
  const newPw    = document.getElementById('newPw')?.value;
  const confirm  = document.getElementById('confirmPw')?.value;

  if (!current || !newPw || !confirm) {
    triggerToast('Please fill all password fields.', 'error');
    return;
  }
  if (newPw !== confirm) {
    triggerToast('New passwords do not match.', 'error');
    return;
  }
  if (newPw.length < 6) {
    triggerToast('Password must be at least 6 characters.', 'error');
    return;
  }

  const user  = getCurrentUser();
  const users = JSON.parse(localStorage.getItem('tb_users') || '[]');
  const idx   = users.findIndex(u => u.email === user.email);

  if (idx > -1 && users[idx].pw !== current) {
    triggerToast('Current password is incorrect.', 'error');
    return;
  }

  if (idx > -1) users[idx].pw = newPw;
  localStorage.setItem('tb_users', JSON.stringify(users));

  document.getElementById('currentPw').value = '';
  document.getElementById('newPw').value     = '';
  document.getElementById('confirmPw').value = '';

  triggerToast('Password updated successfully! 🔒', 'success');
}

function confirmDeleteAccount() {
  const confirmed = confirm('Are you sure? This will permanently delete your account and all your reported items.');
  if (!confirmed) return;

  const user    = getCurrentUser();
  const users   = JSON.parse(localStorage.getItem('tb_users') || '[]');
  const filtered = users.filter(u => u.email !== user.email);
  localStorage.setItem('tb_users', JSON.stringify(filtered));
  localStorage.removeItem('tb_current_user');

  // Remove user's local items
  const items = getLocalItems().filter(i => i.email !== user.email);
  saveLocalItems(items);

  if (typeof renderNavAuth === 'function') renderNavAuth();
  triggerToast('Account deleted. Goodbye! 👋', 'info');
  showSection('home');
}
function togglePasswordForm() {
  const form = document.getElementById('pwChangeForm');
  const btn  = document.getElementById('togglePwBtn');
  const isHidden = form.classList.contains('pw-form-hidden');

  form.classList.toggle('pw-form-hidden', !isHidden);
  btn.textContent = isHidden ? 'Cancel' : 'Change';

  // Clear fields on close
  if (!isHidden) {
    document.getElementById('currentPw').value = '';
    document.getElementById('newPw').value     = '';
    document.getElementById('confirmPw').value = '';
  }
}