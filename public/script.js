/* ============================================================
   benimhakkimda — AI Interview Module · script.js
   Professional AI Interview Simulation Logic
   ============================================================ */

// ─── Configuration ──────────────────────────────────────────
const API_PORT  = '5178';
const API_BASE  = (() => {
  const { protocol, hostname, port, origin } = window.location;
  if (protocol === 'file:') return `http://localhost:${API_PORT}`;
  if (['localhost','127.0.0.1','::1'].includes(hostname) && port !== API_PORT)
    return `${protocol}//${hostname}:${API_PORT}`;
  return origin;
})();

const STORAGE_KEY = 'bhm_interview_v2';

const MODE_CONFIG = {
  quick:     { label: 'Hızlı Mülakat',       count: 5,  type: 'ik'     },
  technical: { label: 'Teknik + Mantık',      count: 10, type: 'teknik' },
  cv:        { label: 'CV / Deneyim Odaklı',  count: 8,  type: 'cv'     },
  aptitude:  { label: 'Genel Yetenek',        count: 10, type: 'yetenek' },
  psychometric: { label: 'Psikoteknik',       count: 10, type: 'psikoteknik' },
};

function normalizeMode(mode) {
  return MODE_CONFIG[mode] ? mode : 'quick';
}

const SCORE_THRESHOLDS = [
  { min: 90, label: 'Mükemmel',       color: 'var(--success)' },
  { min: 75, label: 'Çok İyi',        color: 'var(--accent)'  },
  { min: 60, label: 'İyi',            color: 'var(--info)'    },
  { min: 40, label: 'Gelişiyor',      color: 'var(--warning)' },
  { min: 0,  label: 'Çalışmaya Devam',color: 'var(--danger)'  },
];

let selectedStructuredAnswer = '';

function getQuestionText(question) {
  return typeof question === 'string' ? question : question?.text || '';
}

function getQuestionKind(question) {
  return typeof question === 'object' && question?.kind ? question.kind : 'open';
}

function isStructuredQuestion(question) {
  return ['multiple_choice', 'likert'].includes(getQuestionKind(question));
}

// ─── Application State ───────────────────────────────────────
const AppState = {
  setup: {
    role:       loadPref('role')       || 'Software Developer',
    level:      loadPref('level')      || 'junior',
    language:   loadPref('language')   || 'tr',
    mode:       normalizeMode(loadPref('mode') || 'quick'),
    ttsEnabled: loadPref('ttsEnabled') || false,
    cvText:     loadPref('cvText')     || '',
  },
  interview: {
    active:         false,
    questions:      [],
    currentIndex:   0,
    results:        [],
    startTime:      null,
    timerInterval:  null,
    elapsedSeconds: 0,
  },
};

// ─── DOM Helper ──────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

// ─── Storage ─────────────────────────────────────────────────
function loadPref(key) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePref(key, value) {
  try { localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify(value)); }
  catch { /* storage full */ }
}

function persistSetup() {
  const s = AppState.setup;
  savePref('role',     s.role);
  savePref('level',    s.level);
  savePref('language', s.language);
  savePref('mode',     s.mode);
  savePref('cvText',   s.cvText);
}

// ─── API Service ─────────────────────────────────────────────
async function apiCall(endpoint, body, timeoutMs = 28000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
      cache:   'no-store',
    });
    const ct   = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : { error: await res.text() };
    if (!res.ok) throw new Error(data.error || 'Sunucu hatası');
    return data;
  } catch (err) {
    if (err.name === 'AbortError')
      throw new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
    if (err instanceof TypeError)
      throw new Error(`Sunucuya bağlanılamadı. http://localhost:${API_PORT} adresinin çalıştığından emin olun.`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Speech Recognition ──────────────────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SR) {
  recognition = new SR();
  recognition.continuous    = true;
  recognition.interimResults = true;
}

// ─── Text-to-Speech (kaldırıldı) ──────────────────────────── 
// TTS özelliği kaldırıldı.

// ─── Orb State Controller ─────────────────────────────────────
function setOrbState(state) {
  const stage = $('voiceOrbStage');
  if (!stage) return;
  stage.setAttribute('data-state', state);

  const statusEl = $('orbStatusText');
  const pillEl   = $('answerModePill');

  const states = {
    idle:      { status: 'Cevap Bekleniyor',   pill: 'Cevap Bekleniyor',   pillClass: 'badge-accent'   },
    listening: { status: 'Dinliyor...',         pill: 'Mikrofon Aktif',     pillClass: 'badge-danger'   },
    speaking:  { status: 'Soru Okunuyor...',    pill: 'AI Soruyor',         pillClass: 'badge-accent'   },
    thinking:  { status: 'Analiz Ediliyor...', pill: 'AI Değerlendiriyor', pillClass: 'badge-warning'  },
    feedback:  { status: 'Değerlendirme Hazır', pill: 'Analiz Tamamlandı',  pillClass: 'badge-success'  },
  };

  const cfg = states[state] || states.idle;
  if (statusEl) statusEl.textContent = cfg.status;
  if (pillEl) {
    pillEl.textContent = cfg.pill;
    pillEl.className   = `badge ${cfg.pillClass}`;
  }
}

function setLiveTag(text) {
  const el = $('questionLiveBadge');
  if (el) el.textContent = text;
}

// ─── Step Navigation ──────────────────────────────────────────
function showStep(name) {
  document.querySelectorAll('.widget-step').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  const target = $(`step-${name}`);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  const meta = $('widgetSessionMeta');
  if (meta) meta.style.display = name === 'interview' ? 'flex' : 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Setup Page Initialization ────────────────────────────────
function initSetupPage() {
  const roleInput = $('setupRole');
  const cvArea    = $('setupCVText');

  if (roleInput) roleInput.value = AppState.setup.role;
  if (cvArea)    cvArea.value    = AppState.setup.cvText;

  // Level selector
  bindSegControl('setupLevel', 'level', (btn) => btn.dataset.level);

  // Language selector
  bindSegControl('setupLanguage', 'language', (btn) => btn.dataset.lang);

  // Mode cards
  const modeContainer = $('setupMode');
  if (modeContainer) {
    modeContainer.querySelectorAll('.mode-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.mode === AppState.setup.mode);
      card.addEventListener('click', () => {
        modeContainer.querySelector('.mode-card.selected')?.classList.remove('selected');
        card.classList.add('selected');
        AppState.setup.mode = normalizeMode(card.dataset.mode);
      });
    });
  }

  // CV File Upload
  const fileInput  = $('setupCVFile');
  const statusBar  = $('cvUploadStatus');
  const fileNameEl = $('cvUploadFileName');
  const clearBtn   = $('cvUploadClear');

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const name = file.name;
      const ext  = name.split('.').pop().toLowerCase();

      try {
        let text = '';

        if (ext === 'txt') {
          text = await readFileAsText(file);
        } else if (ext === 'pdf') {
          text = await extractPdfText(file);
        } else {
          // .doc / .docx — fallback: raw text extraction
          text = await readFileAsText(file);
        }

        if (text.trim()) {
          const cvArea = $('setupCVText');
          if (cvArea) cvArea.value = text.trim();
          if (fileNameEl) fileNameEl.textContent = name;
          if (statusBar)  statusBar.style.display = 'flex';
          showToast('Dosya başarıyla okundu.', 'success');
        } else {
          showToast('Dosyadan metin okunamadı. Lütfen düzdüz metin (.txt) formatı deneyin.', 'error');
        }
      } catch (err) {
        showToast('Dosya okuma hatası: ' + err.message, 'error');
      }

      // Reset input so same file can be re-selected
      fileInput.value = '';
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const cvArea = $('setupCVText');
      if (cvArea)    cvArea.value           = '';
      if (statusBar) statusBar.style.display = 'none';
    });
  }

  const startBtn = $('setupStartBtn');
  if (startBtn) startBtn.addEventListener('click', startSimulation);
}

// ─── File Readers ─────────────────────────────────────────────
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsText(file, 'UTF-8');
  });
}

async function extractPdfText(file) {
  // PDF.js yüklenmemişse ArrayBuffer üzerinden ham metin çıkarımı
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // PDF içindeki düz metin öğelerini regex ile çıkar
        const binary = new Uint8Array(e.target.result);
        let raw = '';
        for (let i = 0; i < binary.length; i++) {
          raw += String.fromCharCode(binary[i]);
        }
        // Extract text between BT...ET blocks
        const matches = raw.match(/BT[\s\S]*?ET/g) || [];
        let text = matches
          .join(' ')
          .replace(/\/[A-Za-z]+\s+\d+\s+Tf/g, ' ')
          .replace(/\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+Tm/g, ' ')
          .replace(/\(([^)]+)\)\s*Tj/g, '$1 ')
          .replace(/\[([^\]]+)\]\s*TJ/g, (m, p1) => p1.replace(/\(([^)]+)\)/g, '$1') + ' ')
          .replace(/[^\x20-\x7E\xC0-\xFF]/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (text.length < 50) {
          // Not enough text extracted
          resolve('');
        } else {
          resolve(text);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('PDF okunamadı'));
    reader.readAsArrayBuffer(file);
  });
}



function bindSegControl(containerId, stateKey, valueGetter) {
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', valueGetter(btn) === AppState.setup[stateKey]);
    btn.addEventListener('click', () => {
      container.querySelector('.seg-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      AppState.setup[stateKey] = valueGetter(btn);
    });
  });
}

// ─── Start Simulation ─────────────────────────────────────────
async function startSimulation() {
  const startBtn = $('setupStartBtn');

  // Collect form values
  AppState.setup.role   = $('setupRole')?.value.trim()  || 'Software Developer';
  AppState.setup.cvText = $('setupCVText')?.value.trim() || '';
  persistSetup();

  if (startBtn) {
    startBtn.disabled   = true;
    startBtn.innerHTML  = '<span class="loading-spinner"></span> Hazırlanıyor...';
  }

  try {
    const modeCfg = MODE_CONFIG[AppState.setup.mode];
    const payload = {
      role:     AppState.setup.role,
      type:     modeCfg.type,
      level:    AppState.setup.level,
      language: AppState.setup.language,
      count:    modeCfg.count,
    };

    if (AppState.setup.cvText) {
      payload.cvData = { cvText: AppState.setup.cvText };
    }

    const data = await apiCall('/api/generate-questions', payload, 24000);

    if (!data.questions?.length) {
      throw new Error('Sorular oluşturulamadı. Lütfen tekrar deneyin.');
    }

    AppState.interview = {
      active:         true,
      questions:      data.questions.slice(0, modeCfg.count),
      currentIndex:   0,
      results:        [],
      startTime:      Date.now(),
      timerInterval:  null,
      elapsedSeconds: 0,
    };

    showStep('interview');
    initInterviewUI();
    startTimer();

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (startBtn) {
      startBtn.disabled  = false;
      startBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Simülasyonu Başlat';
    }
  }
}

// ─── Timer ────────────────────────────────────────────────────
function startTimer() {
  AppState.interview.elapsedSeconds = 0;
  if (AppState.interview.timerInterval) clearInterval(AppState.interview.timerInterval);
  AppState.interview.timerInterval = setInterval(() => {
    AppState.interview.elapsedSeconds++;
    const el = $('widgetTimer');
    if (el) el.textContent = formatTime(AppState.interview.elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (AppState.interview.timerInterval) {
    clearInterval(AppState.interview.timerInterval);
    AppState.interview.timerInterval = null;
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Interview UI Init ────────────────────────────────────────
function initInterviewUI() {
  const modeCfg   = MODE_CONFIG[AppState.setup.mode];
  const modeBadge = $('sidebarModeBadge');
  const langBadge = $('sidebarLangBadge');
  const roleLabel = $('aiAvatarRole');

  if (modeBadge) modeBadge.textContent = modeCfg.label;
  if (langBadge) langBadge.textContent = AppState.setup.language === 'en' ? 'İngilizce' : 'Türkçe';
  if (roleLabel) {
    const roles = {
      teknik: 'Kıdemli Teknik Mülakatçı',
      ik:     'Kariyer Koçu',
      cv:     'Deneyim Analisti',
      yetenek: 'Genel Yetenek Uzmanı',
      psikoteknik: 'Psikoteknik Değerlendirici',
    };
    roleLabel.textContent = roles[modeCfg.type] || 'AI Mülakatçı';
  }

  setOrbState('idle');
  displayCurrentQuestion();
}

// ─── Display Current Question ─────────────────────────────────
function displayCurrentQuestion() {
  const iv      = AppState.interview;
  const total   = iv.questions.length;
  const current = iv.currentIndex + 1;
  const question = iv.questions[iv.currentIndex];
  const questionText = getQuestionText(question);

  setOrbState('speaking');
  setLiveTag('Soru Gösteriliyor');

  // Progress
  const numEl    = $('currentQuestionNum');
  const progEl   = $('widgetProgressText');
  if (numEl)  numEl.textContent  = current;
  if (progEl) progEl.textContent = `Soru ${current} / ${total}`;

  // Typewriter effect
  const textEl = $('currentQuestionText');
  if (textEl) {
    textEl.textContent = '';
    let i = 0;
    const tick = setInterval(() => {
      if (i < questionText.length) {
        textEl.textContent += questionText.charAt(i++);
      } else {
        clearInterval(tick);
        setLiveTag('Cevap Bekleniyor');
        setOrbState('idle');
      }
    }, 14);
  }

  const tipEl = $('questionCoachNote');
  if (tipEl) {
    tipEl.textContent = buildCoachTip(question, AppState.setup.mode, iv.currentIndex);
  }

  // Reset answer area
  renderAnswerInput(question);
  setEl('btnSubmitAnswer', el => el.disabled = true);
  setEl('btnImproveAnswer', el => el.disabled = true);

  hideElement('hintPanel');
  hideElement('improvedAnswerPanel');
  hideElement('instantFeedback');

  // Button visibility for last question
  const nextBtn   = $('btnNextQuestion');
  const finishBtn = $('btnFinishInterview');
  if (nextBtn)   nextBtn.style.display   = 'inline-flex';
  if (finishBtn) finishBtn.style.display = 'none';

  // TTS kaldırıldı
}

function buildCoachTip(question, mode, index) {
  const text = getQuestionText(question).toLowerCase();
  const kind = getQuestionKind(question);

  if (kind === 'likert') {
    return 'Bu bölümde doğru cevap yok; ideal görüneni değil, iş hayatındaki gerçek davranışınıza en yakın seçeneği işaretleyin.';
  }

  if (kind === 'multiple_choice') {
    if (/örüntü|dizi|sayı dizisi|soru işareti|şekil|sonraki/.test(text)) {
      return 'Örüntü sorularında önce artış-azalış farklarına, sonra çarpma-bölme ve dönüşümlü kurallara bakın.';
    }
    if (/paragraf|ana fikir|çıkarılabilir|kesin olarak|yargı/.test(text)) {
      return 'Sözel sorularda yorum katmadan yalnızca metinden kesin çıkan bilgiye gidin; güçlü çeldiriciler genelde “fazla genelleme” yapar.';
    }
    if (/yüzde|fiyat|oran|kişi|gün|saat|hız|ortalama|kar|zarar|tl/.test(text)) {
      return 'Sayısal soruda bilinmeyeni 100 veya 1 birim kabul etmek işlemi hızlandırır; sonucu seçeneklerle sağlamasını yapın.';
    }
    if (/anlatım|sözcük|eş anlam|karşıt|bağlaç|cümle/.test(text)) {
      return 'Türkçe sorularında önce gereksiz sözcük, anlam çelişkisi ve bağlaç ilişkisini kontrol edin.';
    }
    return 'Önce bariz yanlış iki seçeneği eleyin, sonra kalan seçenekleri soru kökündeki ana ipucuyla karşılaştırın.';
  }

  if (/api|endpoint|debug|bug|kod|fonksiyon|git|veritabanı|database|sql/.test(text)) {
    return 'Teknik cevapta sırayı gösterin: önce teşhis, sonra kontrol edeceğiniz kanıt, en son çözüm ve risk azaltma adımı.';
  }
  if (/hedef kitle|kampanya|marka|slogan|reklam|bütçe|kanal|brief/.test(text)) {
    return 'Pazarlama cevabında hedef kitle, ana mesaj, kanal seçimi ve başarı metriğini birlikte kurun.';
  }
  if (/geri bildirim|ekip|anlaşmazlık|hata|deadline|teslim|stres/.test(text)) {
    return 'Davranışsal soruda kısa bir olay anlatın: bağlam, sizin aksiyonunuz, sonuç ve öğrendiğiniz ders.';
  }
  if (/cv|proje|deneyim|beceri|rolünüz|katkınız/.test(text)) {
    return 'CV sorusunda görevinizi netleştirin: neyi siz yaptınız, hangi kararları aldınız, sonuç ne oldu?';
  }

  const fallbackTips = [
    'Cevabı üç parçaya bölün: kısa bağlam, sizin yaklaşımınız, ölçülebilir veya gözlenebilir sonuç.',
    'Genel konuşmak yerine tek bir örnek seçin; mülakatçı örneğin içindeki karar mantığını duymak ister.',
    'Cevabın sonunda “bu deneyimden şunu öğrendim” gibi kısa bir kapanış ekleyin.',
  ];
  return fallbackTips[index % fallbackTips.length];
}

function renderAnswerInput(question) {
  selectedStructuredAnswer = '';
  const kind = getQuestionKind(question);
  const ta = $('answerTextarea');
  const choicePanel = $('choicePanel');
  const micBtn = $('btnVoiceRecord');
  const hintBtn = $('btnGetHint');
  const improveBtn = $('btnImproveAnswer');

  if (ta) {
    ta.value = '';
    ta.style.display = kind === 'open' ? 'block' : 'none';
  }
  if (micBtn) micBtn.style.display = kind === 'open' ? 'inline-flex' : 'none';
  if (choicePanel) {
    choicePanel.innerHTML = '';
    choicePanel.classList.toggle('hidden', kind === 'open');
  }
  if (hintBtn) hintBtn.style.display = kind === 'open' ? 'inline-flex' : 'none';
  if (improveBtn) improveBtn.style.display = kind === 'open' ? 'inline-flex' : 'none';

  if (kind === 'open' || !choicePanel) return;

  const options = Array.isArray(question.options) ? question.options : [];
  options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-option';
    btn.dataset.value = option;
    btn.innerHTML = `<span class="choice-key">${String.fromCharCode(65 + index)}</span><span>${escHtml(option)}</span>`;
    btn.addEventListener('click', () => {
      choicePanel.querySelector('.choice-option.selected')?.classList.remove('selected');
      btn.classList.add('selected');
      selectedStructuredAnswer = option;
      setEl('btnSubmitAnswer', el => el.disabled = false);
    });
    choicePanel.appendChild(btn);
  });
}


// ─── Submit Answer ────────────────────────────────────────────
async function submitAnswer() {
  const ta     = $('answerTextarea');
  const currentQuestion = AppState.interview.questions[AppState.interview.currentIndex];
  const answer = isStructuredQuestion(currentQuestion)
    ? selectedStructuredAnswer
    : (ta?.value.trim() || '');
  if (!answer) return;

  setOrbState('thinking');
  setLiveTag('AI Değerlendiriyor...');

  const submitBtn = $('btnSubmitAnswer');
  if (submitBtn) {
    submitBtn.disabled  = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Değerlendiriliyor...';
  }

  try {
    const iv       = AppState.interview;
    const question = iv.questions[iv.currentIndex];
    const questionText = getQuestionText(question);

    const result = await apiCall('/api/evaluate-answer', {
      role:     AppState.setup.role,
      type:     MODE_CONFIG[AppState.setup.mode].type,
      level:    AppState.setup.level,
      language: AppState.setup.language,
      question: questionText,
      questionObj: question,
      answer,
    }, 26000);

    iv.results[iv.currentIndex] = { question: questionText, answer, ...result };

    renderInstantFeedback(result);

    const isLast = iv.currentIndex >= iv.questions.length - 1;
    const nextBtn   = $('btnNextQuestion');
    const finishBtn = $('btnFinishInterview');
    if (isLast) {
      if (nextBtn)   nextBtn.style.display   = 'none';
      if (finishBtn) finishBtn.style.display = 'inline-flex';
    }

  } catch (err) {
    setOrbState('idle');
    setLiveTag('Hata Oluştu');
    showToast(err.message, 'error');
    if (submitBtn) submitBtn.disabled = false;
  } finally {
    if (submitBtn) {
      submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Cevabı Gönder';
    }
  }
}

// ─── Render Instant Feedback ──────────────────────────────────
function renderInstantFeedback(result) {
  setOrbState('feedback');
  setLiveTag('Değerlendirme Hazır');
  const feedbackPanel = $('instantFeedback');
  showElement('instantFeedback');

  if (feedbackPanel) {
    feedbackPanel.classList.toggle('is-multiple-choice', result.kind === 'multiple_choice');
    feedbackPanel.classList.toggle('is-correct', result.isCorrect === true);
    feedbackPanel.classList.toggle('is-wrong', result.isCorrect === false);
  }

  const netlikEl   = $('fbNetlik');
  const ozgunlukEl = $('fbOzgunluk');
  const kisalikEl  = $('fbKisalik');
  const scoreKeys = document.querySelectorAll('.score-key');
  if (scoreKeys.length >= 3) {
    scoreKeys[0].textContent = result.kind === 'multiple_choice' ? 'Doğruluk' : 'Netlik';
    scoreKeys[1].textContent = result.kind === 'multiple_choice' ? 'Çözüm Mantığı' : 'Özgünlük';
    scoreKeys[2].textContent = result.kind === 'multiple_choice' ? 'Cevaplandı' : 'Akıcılık';
  }

  if (netlikEl)   animateNumber(netlikEl,   0, result.netlik   || 0, 700);
  if (ozgunlukEl) animateNumber(ozgunlukEl, 0, result.ozgunluk || 0, 700);
  if (kisalikEl)  animateNumber(kisalikEl,  0, result.kisalik  || 0, 700);

  const resultGrid = $('answerResultGrid');
  if (resultGrid) {
    const showResultGrid = result.kind === 'multiple_choice';
    resultGrid.classList.toggle('hidden', !showResultGrid);
    if (showResultGrid) {
      setEl('fbSelectedAnswer', el => el.textContent = result.selectedAnswer || '—');
      setEl('fbCorrectAnswer', el => el.textContent = result.correctAnswer || '—');
    }
  }

  setEl('fbStrength',    el => el.textContent = result.guclu_yan    || '—');
  setEl('fbImprovement', el => el.textContent = result.iyilestirme  || '—');
  setEl('fbBetterAnswer',el => el.textContent = result.daha_iyi_cevap || '—');
  setEl('fbAnswerAnalysis', el => el.textContent = result.cevap_analizi || buildFallbackAnalysis(result));
  renderFeedbackList('fbMissingPoints', result.eksik_noktalar);
  renderFeedbackList('fbNextSteps', result.sonraki_adimlar);

  const summaryEl = $('feedbackCoachLine');
  if (summaryEl) {
    summaryEl.classList.remove('is-correct', 'is-wrong', 'is-neutral');
    if (result.kind === 'multiple_choice') {
      summaryEl.classList.add(result.isCorrect ? 'is-correct' : 'is-wrong');
      summaryEl.textContent = result.isCorrect
        ? 'Doğru cevap. Çözüm mantığını da kurabilirsen bu soru tam puanlık.'
        : `Yanlış cevap. Seçtiğin seçenek: "${result.selectedAnswer}". Doğru seçenek: "${result.correctAnswer}".`;
      $('instantFeedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    summaryEl.classList.add('is-neutral');
    const score = result.genel_skor ||
      Math.round(((result.netlik||0)+(result.ozgunluk||0)+(result.kisalik||0))/3);
    summaryEl.textContent = score >= 75
      ? 'Güçlü bir cevap. Temel noktaları net ve somut biçimde ele aldınız.'
      : 'Cevabınız doğru yönde ancak daha somut örnekler ve yapılandırılmış bir format cevabınızı güçlendirir.';
  }

  $('instantFeedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderFeedbackList(id, items) {
  const el = $(id);
  if (!el) return;
  const list = Array.isArray(items) && items.length ? items : ['Daha somut örnek, net sonuç ve ölçülebilir etki ekleyin.'];
  el.innerHTML = list
    .filter(Boolean)
    .map(item => `<li>${escHtml(item)}</li>`)
    .join('');
}

function buildFallbackAnalysis(result) {
  const score = result.genel_skor ||
    Math.round(((result.netlik||0)+(result.ozgunluk||0)+(result.kisalik||0))/3);
  return score >= 75
    ? 'Cevabınız genel olarak anlaşılır; daha güçlü olması için karar mantığınızı ve sonucu daha görünür hale getirin.'
    : 'Cevap temel niyeti gösteriyor ancak örnek, aksiyon ve sonuç kısmı yeterince net olmadığı için mülakatçı ikna olmakta zorlanabilir.';
}

function evaluateMultipleChoice(question, answer) {
  const isCorrect = answer === question.correctAnswer;
  const explanation = question.explanation || 'Çözüm mantığını adım adım kontrol ederek ilerleyin.';
  return {
    kind: 'multiple_choice',
    isCorrect,
    selectedAnswer: answer,
    correctAnswer: question.correctAnswer,
    netlik: isCorrect ? 100 : 0,
    ozgunluk: isCorrect ? 100 : 35,
    kisalik: 100,
    genel_skor: isCorrect ? 100 : 45,
    guclu_yan: isCorrect
      ? 'Doğru seçeneği işaretlediniz. Bu soru tipinde sadece cevabı değil, kısa çözüm yolunu da zihinden kurmanız önemli.'
      : 'Cevabınız kaydedildi ama doğru seçenekle eşleşmedi. Bu, sonucu bulmadan önce seçeneklerden birine erken gittiğinizi gösteriyor.',
    iyilestirme: isCorrect
      ? 'Aynı tür sorularda cevabı işaretlemeden önce çözüm gerekçesini tek cümleyle kurun.'
      : `Doğru cevap "${question.correctAnswer}". Seçtiğiniz "${answer}" seçeneğini doğru cevaptan ayıran kuralı veya işlemi tekrar kontrol edin.`,
    daha_iyi_cevap: explanation,
    cevap_analizi: isCorrect
      ? `Cevap doğru. Çözüm mantığı: ${explanation}`
      : `Bu cevap yanlış. Seçtiğiniz "${answer}" seçeneği soru kökündeki kuralla uyuşmuyor. Doğru cevap "${question.correctAnswer}" çünkü ${explanation}`,
    eksik_noktalar: isCorrect
      ? ['Çözüm gerekçesini sözlü olarak kurma', 'Benzer soru tipindeki kuralı tanıma']
      : ['Seçtiğiniz cevabın neden uymadığını kontrol etme', 'Soru kökündeki ana kuralı bulma', 'Doğru cevabın işlem/gerekçesini kurma'],
    sonraki_adimlar: isCorrect
      ? ['Aynı kuralı başka örnekte hızlıca deneyin.', 'Cevabı işaretlemeden önce bir cümlelik gerekçe kurun.']
      : ['Cevap seçmeden önce verilenleri küçük notlara ayırın.', 'Her seçeneği ana kurala göre tek tek eleyin.', 'İşlemli sorularda sonucu seçenekle değil, önce kendi hesabınızla bulun.'],
  };
}

function evaluateLikert(question, answer) {
  const value = Number(question.scale?.[answer] || 3);
  const score = question.reverse ? 110 - (value * 20) : 30 + (value * 14);
  const clamped = Math.max(20, Math.min(100, Math.round(score)));
  return {
    netlik: clamped,
    ozgunluk: clamped,
    kisalik: 100,
    genel_skor: clamped,
    guclu_yan: 'Yanıtınız kişilik ve çalışma eğilimi değerlendirmesine eklendi.',
    iyilestirme: 'Bu bölümde doğru/yanlış yoktur; tutarlı ve dürüst yanıtlar daha anlamlı sonuç verir.',
    daha_iyi_cevap: question.trait ? `Ölçülen eğilim: ${question.trait}` : 'Bu ifade iş ortamındaki davranış tercihlerinizi anlamak için kullanılır.',
    cevap_analizi: 'Bu yanıt kişisel çalışma eğiliminizi anlamak için kaydedildi. Tek bir ifadeden kesin sonuç çıkarılmaz; tutarlılık tüm cevaplar birlikte değerlendirilerek anlaşılır.',
    eksik_noktalar: ['Bu soru bir bilgi sorusu değildir', 'En doğru çıktı için olduğunuz gibi yanıtlayın'],
    sonraki_adimlar: ['İfadeyi gerçek iş davranışınızla karşılaştırın.', 'İdeal cevabı değil, size en yakın seçeneği işaretleyin.'],
  };
}

// ─── Next Question / Skip ─────────────────────────────────────
function nextQuestion() {
  const iv = AppState.interview;
  if (iv.currentIndex >= iv.questions.length - 1) return;
  iv.currentIndex++;
  displayCurrentQuestion();
}

function skipQuestion() {
  const iv = AppState.interview;
  iv.results[iv.currentIndex] = {
    question:       getQuestionText(iv.questions[iv.currentIndex]),
    answer:         AppState.setup.language === 'en' ? '(Skipped)' : '(Pas Geçildi)',
    netlik: 0, ozgunluk: 0, kisalik: 0, teknik_dogruluk: 0,
    ozguven: 0, star_uyumu: 0, genel_skor: 0,
    cevap_analizi: 'Bu soru pas geçildiği için cevap analizi oluşturulmadı.',
    guclu_yan: '', iyilestirme: 'Bu soru pas geçildi.', daha_iyi_cevap: '',
    eksik_noktalar: [], sonraki_adimlar: [],
  };

  if (iv.currentIndex >= iv.questions.length - 1) {
    finishInterview();
  } else {
    iv.currentIndex++;
    displayCurrentQuestion();
  }
}

// ─── Get Hint ─────────────────────────────────────────────────
async function getHint() {
  const hintBtn = $('btnGetHint');
  if (hintBtn) {
    hintBtn.disabled  = true;
    hintBtn.innerHTML = '<span class="loading-spinner"></span> Yükleniyor...';
  }

  try {
    const iv       = AppState.interview;
    const question = getQuestionText(iv.questions[iv.currentIndex]);

    const data = await apiCall('/api/get-hint', {
      question,
      role:     AppState.setup.role,
      type:     MODE_CONFIG[AppState.setup.mode].type,
      language: AppState.setup.language,
    }, 15000);

    setEl('hintText', el => el.textContent = data.hint || '');
    const tagsEl = $('hintKeyPoints');
    if (tagsEl && data.keyPoints) {
      renderTagList(tagsEl, data.keyPoints, 'span', 'tag');
    }

    showElement('hintPanel');
    $('hintPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (hintBtn) {
      hintBtn.disabled  = false;
      hintBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> İpucu';
    }
  }
}

// ─── Improve Answer ───────────────────────────────────────────
async function improveAnswer() {
  const ta     = $('answerTextarea');
  const answer = ta?.value.trim() || '';
  if (!answer) return;

  const improveBtn = $('btnImproveAnswer');
  if (improveBtn) {
    improveBtn.disabled  = true;
    improveBtn.innerHTML = '<span class="loading-spinner"></span> Yapılandırılıyor...';
  }

  try {
    const iv       = AppState.interview;
    const question = getQuestionText(iv.questions[iv.currentIndex]);

    const data = await apiCall('/api/improve-answer', {
      question,
      answer,
      role:     AppState.setup.role,
      language: AppState.setup.language,
    }, 20000);

    setEl('improvedAnswerText', el => el.textContent = data.improvedAnswer || '');
    const tipsEl = $('improvedAnswerTips');
    if (tipsEl && data.tips) {
      renderTagList(tipsEl, data.tips, 'span', 'tag');
    }

    const starSection = $('starFormatSection');
    if (starSection && data.starFormat) {
      const s = data.starFormat;
      if (s.situation || s.task || s.action || s.result) {
        setEl('starSituation', el => el.textContent = s.situation || '—');
        setEl('starTask',      el => el.textContent = s.task      || '—');
        setEl('starAction',    el => el.textContent = s.action    || '—');
        setEl('starResult',    el => el.textContent = s.result    || '—');
        starSection.classList.remove('hidden');
      } else {
        starSection.classList.add('hidden');
      }
    }

    showElement('improvedAnswerPanel');
    $('improvedAnswerPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (improveBtn) {
      improveBtn.disabled  = false;
      improveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Geliştir';
    }
  }
}

// ─── Voice Recording (tek buton toggle) ─────────────────────
function toggleVoiceRecording() {
  if (isRecording) {
    stopVoiceRecording();
  } else {
    startVoiceRecording();
  }
}

function startVoiceRecording() {
  if (!recognition) {
    showToast('Tarayıcınız ses tanımayı desteklemiyor. Chrome ile deneyin.', 'error');
    return;
  }
  if (isRecording) return;

  const langCode = AppState.setup.language === 'en' ? 'en-US' : 'tr-TR';
  recognition.lang = langCode;

  const ta = $('answerTextarea');
  if (ta) ta.value = '';
  isRecording = true;

  const micBtn    = $('btnVoiceRecord');
  const statusEl  = $('speechStatusContainer');

  if (micBtn)   micBtn.classList.add('recording');
  if (statusEl) statusEl.style.display = 'flex';
  setEl('speechStatusText', el => el.textContent = 'Dinliyorum, lütfen konuşun...');
  setLiveTag('Sizi Dinliyor');
  setOrbState('listening');

  recognition.onresult = (event) => {
    let finalT = '', interimT = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalT += t;
      else interimT += t;
    }
    if (finalT && ta) {
      ta.value = (ta.value + ' ' + finalT).trim();
      ta.dispatchEvent(new Event('input'));
    }
    const statusEl = $('speechStatusText');
    if (interimT && statusEl) statusEl.textContent = `... ${interimT}`;
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') {
      showToast('Mikrofon bağlantısında sorun oluştu.', 'error');
      stopVoiceRecording();
    }
  };

  recognition.onend = () => {
    if (isRecording) recognition.start();
  };

  recognition.start();
}

function stopVoiceRecording() {
  if (!isRecording) return;
  isRecording = false;

  if (recognition) {
    recognition.onresult = null;
    recognition.onerror  = null;
    recognition.onend    = null;
    recognition.stop();
  }

  const micBtn    = $('btnVoiceRecord');
  const statusEl  = $('speechStatusContainer');

  if (micBtn)   micBtn.classList.remove('recording');
  if (statusEl) statusEl.style.display = 'none';
  setLiveTag('Cevap Bekleniyor');
  setOrbState('idle');
}

// ─── Finish Interview ─────────────────────────────────────────
async function finishInterview() {
  stopTimer();
  showStep('report');

  const titleEl = $('reportTitle');
  const metaEl  = $('reportMeta');
  const scoreEl = $('reportOverallScore');
  const labelEl = $('reportScoreLabel');

  if (titleEl) titleEl.textContent = 'Değerlendirme Raporu Hazırlanıyor...';
  if (metaEl)  metaEl.textContent  = `${AppState.setup.role} · ${AppState.setup.level.toUpperCase()} · ${AppState.setup.language === 'en' ? 'İngilizce' : 'Türkçe'}`;
  if (scoreEl) scoreEl.textContent = '—';
  if (labelEl) labelEl.textContent = 'Analiz ediliyor...';

  try {
    const iv   = AppState.interview;
    const data = await apiCall('/api/generate-report', {
      role:     AppState.setup.role,
      level:    AppState.setup.level,
      mode:     AppState.setup.mode,
      language: AppState.setup.language,
      results:  iv.results,
    }, 30000);

    renderFinalReport(data);

  } catch (err) {
    showToast(err.message, 'error');
    if (titleEl) titleEl.textContent = 'Rapor oluşturulamadı';
    if (labelEl) labelEl.textContent = 'Veriler alınamadı. Tekrar deneyin.';
  }
}

// ─── Render Final Report ──────────────────────────────────────
function renderFinalReport(data) {
  const score = data.overallScore || 0;
  const lbl   = getScoreLabel(score);

  setEl('reportTitle',       el => el.textContent = 'Mülakat Değerlendirme Raporu');
  setEl('reportScoreLabel',  el => { el.textContent = lbl.label; el.style.color = lbl.color; });

  const scoreEl = $('reportOverallScore');
  if (scoreEl) animateNumber(scoreEl, 0, score, 1200);

  // Score ring conic gradient
  const ring = $('reportScoreCircle');
  if (ring) {
    const deg = score * 3.6;
    ring.style.background = `conic-gradient(${lbl.color} ${deg}deg, var(--surface-3) 0deg)`;
  }

  // Strengths
  const strengthsEl = $('reportStrengthsList');
  if (strengthsEl) {
    renderTagList(strengthsEl, data.strengths, 'li', '', 'Yeterli veri bulunamadı.');
  }

  // Weaknesses
  const weaknessesEl = $('reportWeaknessesList');
  if (weaknessesEl) {
    renderTagList(weaknessesEl, data.weaknesses, 'li', '', 'Belirgin bir gelişim alanı tespit edilmedi.');
  }

  // Radar chart
  renderRadarChart(data.categoryScores || {});

  // Q&A review
  const qaEl = $('reportQuestionsList');
  if (qaEl) {
    const iv = AppState.interview;
    qaEl.innerHTML = iv.results.map((res, i) => {
      const qScore = res.genel_skor ||
        Math.round(((res.netlik||0)+(res.ozgunluk||0)+(res.kisalik||0))/3) || 0;
      const badgeClass = qScore >= 70 ? 'badge-success' : qScore >= 45 ? 'badge-warning' : 'badge-danger';
      return `
        <div class="qa-review-item">
          <div class="qa-review-header">
            <span class="qa-question-text">Soru ${i+1}: ${escHtml(res.question)}</span>
            <span class="badge ${badgeClass}">${qScore}/100</span>
          </div>
          <div class="qa-review-body">
            <p><span class="qa-field-label">Cevabınız:</span> <span class="qa-answer-text">"${escHtml(res.answer)}"</span></p>
            ${res.guclu_yan    ? `<p><span class="qa-field-label">Güçlü Yön:</span> ${escHtml(res.guclu_yan)}</p>`    : ''}
            ${res.iyilestirme  ? `<p><span class="qa-field-label">Geliştirme:</span> ${escHtml(res.iyilestirme)}</p>` : ''}
            ${res.daha_iyi_cevap ? `<p><span class="qa-field-label">Daha İyi Cevap:</span> <span class="qa-better">${escHtml(res.daha_iyi_cevap)}</span></p>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Study plan
  const studyEl = $('reportStudyList');
  if (studyEl) {
    studyEl.innerHTML = (data.studyPlan || []).map(item => `
      <div class="study-plan-item">
        <p class="study-plan-topic">${escHtml(item.topic || '')}</p>
        <p class="study-plan-desc">${escHtml(item.description || '')}</p>
      </div>
    `).join('') || '<p style="color:var(--text-muted); font-size:0.85rem;">Çalışma planı oluşturulamadı.</p>';
  }
}

// ─── Radar Chart ──────────────────────────────────────────────
function renderRadarChart(scores) {
  const canvas = $('reportRadarCanvas');
  if (!canvas || typeof Chart === 'undefined') return;
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const labels = ['Teknik', 'İletişim', 'Özgüven', 'Netlik', 'Problem Çözme'];
  const values = [
    scores.teknik        || 0,
    scores.iletisim      || 0,
    scores.ozguven       || 0,
    scores.netlik        || 0,
    scores.problem_cozme || 0,
  ];

  canvas._chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Performans',
        data:  values,
        backgroundColor: 'rgba(79,126,245,0.12)',
        borderColor:     '#4f7ef5',
        borderWidth:     2,
        pointBackgroundColor: '#4f7ef5',
        pointBorderColor:     '#4f7ef5',
        pointRadius:     4,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max:         100,
          ticks:       { stepSize: 25, color: '#4a5670', backdropColor: 'transparent', font: { size: 9 } },
          grid:        { color: 'rgba(255,255,255,0.05)' },
          angleLines:  { color: 'rgba(255,255,255,0.05)' },
          pointLabels: { color: '#8392a8', font: { size: 10, weight: '600' } },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// ─── Utility Functions ────────────────────────────────────────
function getScoreLabel(score) {
  return SCORE_THRESHOLDS.find(t => score >= t.min) || SCORE_THRESHOLDS.at(-1);
}

function animateNumber(el, from, to, durationMs = 900) {
  const start = performance.now();
  const range = to - from;
  function tick(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + range * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function setEl(id, fn) {
  const el = $(id);
  if (el) fn(el);
}

function showElement(id) {
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function hideElement(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function renderTagList(el, items, tag = 'span', cls = 'tag', emptyMsg = '') {
  if (!el) return;
  const arr = Array.isArray(items) ? items : [];
  if (arr.length === 0) {
    if (emptyMsg) {
      el.innerHTML = `<${tag}${cls ? ` class="${cls}"` : ''}>${escHtml(emptyMsg)}</${tag}>`;
    } else {
      el.innerHTML = '';
    }
    return;
  }
  el.innerHTML = arr
    .filter(Boolean)
    .map(i => `<${tag}${cls ? ` class="${cls}"` : ''}>${escHtml(String(i))}</${tag}>`)
    .join('');
}

// ─── Event Wiring ─────────────────────────────────────────────
function initInterviewEvents() {
  const listen = (id, ev, fn) => setEl(id, el => el.addEventListener(ev, fn));

  listen('btnSubmitAnswer',   'click', submitAnswer);
  listen('btnVoiceRecord',    'click', toggleVoiceRecording);
  listen('btnSkipQuestion',   'click', skipQuestion);
  listen('btnGetHint',        'click', getHint);
  listen('btnImproveAnswer',  'click', improveAnswer);
  listen('btnNextQuestion',   'click', nextQuestion);
  listen('btnFinishInterview','click', finishInterview);
  listen('btnExitInterview',  'click', () => {
    if (confirm(AppState.setup.language === 'en'
      ? "Are you sure you want to exit the interview? Your progress will be lost."
      : "Mülakattan çıkmak istediğinize emin misiniz? Tüm ilerlemeniz silinecektir.")) {
      stopTimer();
      stopVoiceRecording();
      showStep('setup');
    }
  });

  // Enable submit/improve when textarea has content
  const ta = $('answerTextarea');
  if (ta) {
    ta.addEventListener('input', () => {
      const hasContent = ta.value.trim().length > 0;
      setEl('btnSubmitAnswer',  el => el.disabled = !hasContent);
      setEl('btnImproveAnswer', el => el.disabled = !hasContent);
    });
  }
}

function initReportEvents() {
  setEl('btnRetryInterview', el => el.addEventListener('click', () => showStep('setup')));
}

// ─── Toast System ─────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 280);
  }, 4000);
}

// ─── App Init ─────────────────────────────────────────────────
function init() {
  initSetupPage();
  initInterviewEvents();
  initReportEvents();
  showStep('setup');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
