// ===================== STATE =====================
let discordUser = null;
let manualImageDataUrl = null;

// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', async () => {
  // Fix html2canvas ignoring CSS invert filters by converting raw image pixels to white
  document.querySelectorAll('.wm').forEach(invertImgToWhite);

  const params = new URLSearchParams(window.location.search);

  if (params.get('error')) {
    const msgs = {
      denied: 'Authorization denied by Discord.',
      failed: 'Authentication failed. Please try again.',
      not_configured: 'Discord OAuth not configured. Please set up your .env file.',
    };
    showError(msgs[params.get('error')] || 'An error occurred.');
  }

  if (params.get('connected') === 'true') {
    await loadDiscordUser();
  }

  // Check if already logged in
  if (!discordUser) {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        discordUser = await res.json();
        showConnectedPanel();
      }
    } catch (e) { /* not connected */ }
  }

  setupManualUpload();
  setupHolographic();
  window.history.replaceState({}, '', '/');
});

// ===================== DISCORD LOAD =====================
async function loadDiscordUser() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error();
    discordUser = await res.json();
    showConnectedPanel();
  } catch {
    showError('Failed to load Discord profile. Please try again.');
  }
}

function showConnectedPanel() {
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('connected-panel').style.display = '';

  const u = discordUser;
  const avatarUrl = getAvatarUrl(u.id, u.avatar);

  document.getElementById('prev-avatar').src = avatarUrl;
  document.getElementById('prev-name').textContent = u.username;
  document.getElementById('prev-tag').textContent = u.tag;

  // Tự động phân tích Role từ Server (Bảng ánh xạ ID -> Tên Role)
  const ROLE_MAP = {
    "1450031752323141643": "OG", 
    "1461573987678289963": "Little Prince",
    "1456553231961423905": "X-Axis",
    "1456553470625841243": "Y-Axis",
    // "z-axis chưa có ID": "Z-Axis",
    "1474316475224297524": "Ambassador"
  };

  const checkboxes = document.querySelectorAll('#role-checkboxes input');
  // Xóa trắng và khóa không cho user tự click
  checkboxes.forEach(cb => { 
    cb.checked = false; 
    cb.disabled = true; 
    cb.parentElement.style.opacity = "0.5";
  }); 

  // Nếu người dùng có roles trong server thì đối chiếu bật sáng checkbox
  if (u.guild_member && u.guild_member.roles) {
    let hasRole = false;
    u.guild_member.roles.forEach(roleId => {
      const roleName = ROLE_MAP[roleId];
      if (roleName) {
        const cb = document.querySelector(`#role-checkboxes input[value="${roleName}"]`);
        if (cb) {
          cb.checked = true;
          cb.parentElement.style.opacity = "1";
          hasRole = true;
        }
      }
    });
    // Nếu quét xong mà không trùng Role nào thì mặc định cấp Member
    if (!hasRole) {
      document.querySelector('#role-checkboxes').insertAdjacentHTML('beforeend', '<p style="color:#aaa; font-size:11px; margin-top:5px; width:100%;">Auto-detected: No special roles found. Defaulting to MEMBER.</p>');
    }
  } else {
    document.querySelector('#role-checkboxes').insertAdjacentHTML('beforeend', '<p style="color:#aaa; font-size:11px; margin-top:5px; width:100%;">Not in server. Defaulting to MEMBER.</p>');
  }
}

// ===================== AVATAR URL =====================
function getAvatarUrl(id, hash) {
  if (!hash) {
    const idx = Number(BigInt(id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const ext = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${id}/${hash}.${ext}?size=512`;
}

// ===================== GET ACCOUNT AGE =====================
function getAccountCreatedYear(discordId) {
  const ms = Number(BigInt(discordId) >> 22n) + 1420070400000;
  return new Date(ms).getFullYear();
}

function getAccountAgeYears(discordId) {
  const ms = Number(BigInt(discordId) >> 22n) + 1420070400000;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24 * 365.25);
}

function getServerAgeYears(joinedAt) {
  if (!joinedAt) return 0;
  return (Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

// ===================== RANK & THEME LOGIC =====================
const ROLE_HIERARCHY = [
  { keywords: ['ambassador'], theme: 'theme-teal', rankLabel: 'AMBASSADOR' },
  { keywords: ['z-axis', 'z axis'], theme: 'theme-blue', rankLabel: 'Z-AXIS' },
  { keywords: ['y-axis', 'y axis'], theme: 'theme-gold', rankLabel: 'Y-AXIS' },
  { keywords: ['x-axis', 'x axis'], theme: 'theme-red', rankLabel: 'X-AXIS' },
  { keywords: ['little prince', 'prince'], theme: 'theme-purple', rankLabel: 'LITTLE PRINCE' },
  { keywords: ['og'], theme: 'theme-green', rankLabel: 'OG' }
];

function getThemeInfo(rolesArray) {
  let highestIndex = 999;
  let highest = null;

  for (const role of rolesArray) {
    const lowerRole = role.toLowerCase();
    for (let i = 0; i < ROLE_HIERARCHY.length; i++) {
      const match = ROLE_HIERARCHY[i].keywords.some(kw => lowerRole.includes(kw));
      if (match && i < highestIndex) {
        highestIndex = i;
        highest = ROLE_HIERARCHY[i];
      }
    }
  }
  
  if (!highest) {
    return { theme: 'theme-green', rankLabel: 'MEMBER' }; // Default nếu k có rank
  }
  return highest;
}

// ===================== GENERATE FROM DISCORD =====================
function generateFromDiscord() {
  if (!discordUser) return;
  const u = discordUser;
  
  let avatarHash = u.avatar;
  const avatarUrl = getAvatarUrl(u.id, avatarHash);
  const displayName = (u.guild_member && u.guild_member.nick) ? u.guild_member.nick : u.username;
  const joinedDate = u.guild_member ? new Date(u.guild_member.joined_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  // Get Roles from Checkboxes (which were auto-checked by Discord fetch)
  const checkboxes = document.querySelectorAll('#role-checkboxes input:checked');
  let roleArray = Array.from(checkboxes).map(cb => cb.value);
  if (roleArray.length === 0) {
    roleArray = ['MEMBER']; // Default
  }

  // Get Country
  const countryInput = document.getElementById('user-country').value;

  const themeInfo = getThemeInfo(roleArray);

  buildCard({
    name: displayName,
    avatarUrl,
    tag: u.tag,
    joined: joinedDate,
    country: countryInput,
    roles: roleArray,
    themeClass: themeInfo.theme,
    rankLabel: themeInfo.rankLabel
  });
}

// ===================== GENERATE MANUAL =====================
async function generateManual() {
  const username = document.getElementById('manual-username').value.trim();
  let manualDate = document.getElementById('manual-date').value.trim();
  if (!username) { showError('Please enter a username.'); return; }
  if (!manualImageDataUrl) { showError('Please upload an image.'); return; }

  if (!manualDate) { 
    manualDate = '01/01/2026'; 
  } else {
    // Validate format dd/mm/yyyy
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(manualDate)) {
      showError('Date must be in DD/MM/YYYY format');
      return;
    }
  }

  // Get Roles
  const checkboxes = document.querySelectorAll('#manual-roles input:checked');
  let roleArray = Array.from(checkboxes).map(cb => cb.value);
  if (roleArray.length === 0) roleArray = ['MEMBER'];

  // Get Country
  const countryInput = document.getElementById('manual-country').value;
  const themeInfo = getThemeInfo(roleArray);

  buildCard({
    name: username,
    avatarUrl: manualImageDataUrl,
    tag: `@${username}`,
    joined: manualDate,
    country: countryInput,
    roles: roleArray,
    themeClass: themeInfo.theme,
    rankLabel: themeInfo.rankLabel
  });
}

// ===================== BUILD CARD =====================
function buildCard(data) {
  document.getElementById('c-name').textContent = data.name;
  document.getElementById('c-tag').textContent = data.tag;
  document.getElementById('c-joined').textContent = data.joined;
  document.getElementById('c-country').textContent = data.country.toUpperCase();

  // Randomise signature
  const signatures = ['plpiaoliang', 'ChrisF(✱,✱)', '0xsexybanana', '0xzagen'];
  document.getElementById('c-signature').textContent = signatures[Math.floor(Math.random() * signatures.length)];

  // Render Roles
  const rolesGrid = document.getElementById('c-roles');
  rolesGrid.innerHTML = '';
  if (data.roles.length > 0) {
    data.roles.forEach(role => {
      const sp = document.createElement('span');
      sp.className = 'role-tag';
      sp.textContent = role;
      rolesGrid.appendChild(sp);
    });
  } else {
    rolesGrid.innerHTML = '<span class="role-tag" style="opacity:0.5">MEMBER</span>';
  }

  // Avatar
  const img = document.getElementById('c-avatar');
  img.src = data.avatarUrl;
  img.crossOrigin = 'anonymous';

  // Apply Theme Class
  const card = document.getElementById('pokemon-card');
  card.className = `passport-card ${data.themeClass}`;

  // Open modal
  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ===================== MANUAL UPLOAD =====================
function setupManualUpload() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--green)'; });
  uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    manualImageDataUrl = e.target.result;
    document.getElementById('upload-label').textContent = '✓ ' + file.name;
    document.getElementById('upload-area').style.borderColor = 'var(--green)';
  };
  reader.readAsDataURL(file);
}

// ===================== HOLOGRAPHIC 3D EFFECT =====================
function setupHolographic() {
  const wrapper = document.getElementById('card-wrapper');
  const holoLayer = document.getElementById('holo-layer');

  wrapper.addEventListener('mousemove', e => {
    const r = wrapper.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width;
    const my = (e.clientY - r.top) / r.height;
    const rx = (my - 0.5) * 22;
    const ry = (0.5 - mx) * 22;

    wrapper.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
    wrapper.style.boxShadow = `${-ry * 0.5}px ${rx * 0.5}px 60px rgba(0,0,0,.7), 0 0 50px rgba(246,201,87,.3)`;
    holoLayer.style.setProperty('--mx', (mx * 100) + '%');
    holoLayer.style.setProperty('--my', (my * 100) + '%');
  });

  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.transform = '';
    wrapper.style.boxShadow = '';
  });
}

// ===================== CLOSE MODAL =====================
function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('card-wrapper').style.transform = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ===================== DOWNLOAD =====================
async function downloadCard() {
  const card = document.getElementById('pokemon-card');
  const wrapper = document.getElementById('card-wrapper');
  const origTransform = wrapper.style.transform;
  const origShadow = card.style.boxShadow; // Store shadow
  
  wrapper.style.transform = '';
  card.style.boxShadow = 'none'; // Temporarily disable drop shadows to avoid blurry dark edges

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });
    const name = (discordUser?.username || document.getElementById('manual-username')?.value || 'card').toLowerCase().replace(/\s+/g, '-');
    const link = document.createElement('a');
    link.download = `axis-passport-${name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error(err);
    alert('Download failed. Try right-clicking the card to save as image.');
  }

  wrapper.style.transform = origTransform;
  card.style.boxShadow = origShadow; // Restore shadow
}

// ===================== ERROR =====================
function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.style.display = 'block';
}

// ===================== UTILS =====================
function invertImgToWhite(img) {
  if (img.complete) process();
  else img.onload = process;

  function process() {
    if (img.dataset.inverted) return;
    const cw = img.naturalWidth || 400, ch = img.naturalHeight || 400;
    const cvs = document.createElement('canvas');
    cvs.width = cw; cvs.height = ch;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    const idata = ctx.getImageData(0, 0, cw, ch);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; }
    }
    ctx.putImageData(idata, 0, 0);
    img.src = cvs.toDataURL();
    img.dataset.inverted = "true";
  }
}

// ===================== SHARE TO X (TWITTER) =====================
function shareToTwitter() {
  const text = `[Your content]\n\n@nheoweb3 @plpiaoliang @chris_anm01\n\nCreate your passport here: https://axis-protocol-passport.vercel.app/`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  
  // 1. Mở Tap Twitter lên trước để tránh bị trình duyệt chặn Pop-up (nếu để sau hàm tải bất đồng bộ)
  window.open(url, '_blank');
  
  // 2. Chép văn bản vào khay nhớ tạm để lỡ họ muốn Paste ảnh luôn (nếu trình duyệt hỗ trợ)
  try { navigator.clipboard.writeText(text); } catch(e) {}
  
  // 3. Tự động tải ảnh Passport xuống cho họ đính kèm
  downloadCard();
}
