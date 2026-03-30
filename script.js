// ==================== STATE ====================
const state = {
  username: '',
  imageDataUrl: null,
  quoteText: '',
  classType: 'Bitty',
  tier: 'IV',
};

const QUOTES = [
  "\"You're the reason they have to put 'Not Financial Advice' on everything.\"",
  "\"Diamond hands forged in the fires of a thousand red candles.\"",
  "\"Not a degen. A connoisseur of high-risk opportunities.\"",
  "\"I don't have a gambling problem. I have a conviction problem.\"",
  "\"Sleep is for those who haven't discovered 4x leverage.\"",
  "\"My portfolio is a reflection of my personality — volatile and misunderstood.\"",
  "\"They laughed at me. Then they laughed again. Then again. I'm still holding.\"",
  "\"I came for the gains, I stayed for the chaos.\"",
  "\"Reality is just a bear market. I refuse to sell.\"",
  "\"When in doubt, ape in. When certain, ape in harder.\"",
];

// ==================== ELEMENTS ====================
const usernameInput = document.getElementById('username-input');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadTitle = document.getElementById('upload-title');
const uploadSub = document.getElementById('upload-sub');
const uploadContent = document.getElementById('upload-content');
const selectorsRow = document.getElementById('selectors-row');
const generateBtn = document.getElementById('generate-btn');
const classSelect = document.getElementById('class-select');
const tierSelect = document.getElementById('tier-select');
const quoteInput = document.getElementById('quote-input');
const modalOverlay = document.getElementById('modal-overlay');

// Card elements
const cardUsername = document.getElementById('card-username');
const cardQuote = document.getElementById('card-quote');
const cardClass = document.getElementById('card-class');
const cardTier = document.getElementById('card-tier');
const cardHash = document.getElementById('card-hash');
const cardHexId = document.getElementById('card-hex-id');
const cardAvatar = document.getElementById('card-avatar');

// ==================== USERNAME LOGIC ====================
usernameInput.addEventListener('input', () => {
  state.username = usernameInput.value.trim();

  if (state.username.length > 0) {
    uploadZone.classList.add('unlocked');
    uploadZone.style.cursor = 'pointer';
    uploadTitle.textContent = 'CLICK OR DRAG TO UPLOAD';
    uploadSub.textContent = 'Supports JPG, PNG, GIF, WEBP';
  } else {
    uploadZone.classList.remove('unlocked');
    uploadZone.style.cursor = 'not-allowed';
    uploadTitle.textContent = 'AWAITING USERNAME...';
    uploadSub.textContent = 'Enter Username to Unlock Upload';

    // Reset image state
    if (!state.imageDataUrl) {
      uploadContent.style.display = 'flex';
      const preview = uploadZone.querySelector('.upload-preview');
      if (preview) preview.remove();
    }
  }
});

// ==================== UPLOAD LOGIC ====================
uploadZone.addEventListener('click', () => {
  if (!state.username) return;
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFile(e.target.files[0]);
  }
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!state.username) return;
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (!state.username) return;

  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.imageDataUrl = e.target.result;
    showUploadPreview(state.imageDataUrl);
    showControls();
  };
  reader.readAsDataURL(file);
}

function showUploadPreview(src) {
  // Remove existing preview
  const existing = uploadZone.querySelector('.upload-preview');
  if (existing) existing.remove();

  uploadZone.classList.add('has-image');
  uploadContent.style.display = 'none';

  const img = document.createElement('img');
  img.src = src;
  img.className = 'upload-preview';
  img.alt = 'Uploaded image preview';
  uploadZone.appendChild(img);
}

function showControls() {
  selectorsRow.style.display = 'flex';
  generateBtn.style.display = 'flex';
  selectorsRow.style.animation = 'fadeInUp 0.3s ease';
  generateBtn.style.animation = 'fadeInUp 0.35s ease';
}

// ==================== GENERATE CARD ====================
function generateCard() {
  if (!state.username || !state.imageDataUrl) return;

  // Pick a random hex ID
  const hexId = '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  cardHexId.textContent = hexId;

  // Set username
  cardUsername.textContent = state.username.toUpperCase();

  // Set avatar
  cardAvatar.src = state.imageDataUrl;

  // Set quote
  const customQuote = quoteInput.value.trim();
  if (customQuote) {
    cardQuote.textContent = `"${customQuote}"`;
  } else {
    const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    cardQuote.textContent = randomQuote;
  }

  // Set class
  state.classType = classSelect.value;
  cardClass.textContent = state.classType;

  // Set tier
  state.tier = tierSelect.value;
  cardTier.textContent = `TIER ${state.tier}`;

  // Set hash (random hex color)
  const hash = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
  cardHash.textContent = hash;

  // Show modal
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ==================== MODAL CLOSE ====================
function closeModal(event) {
  if (event && event.target !== modalOverlay) return;
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ==================== DOWNLOAD CARD ====================
async function downloadCard() {
  const card = document.getElementById('ritual-card');

  try {
    const canvas = await html2canvas(card, {
      scale: 3,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    const link = document.createElement('a');
    link.download = `ritual-card-${state.username.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Download error:', err);
    alert('Failed to download card. Please try again.');
  }
}

// ==================== STYLE: FADE IN UP ====================
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);
