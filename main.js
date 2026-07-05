const STORAGE_KEY = "recallforge-state-v1";
const STUDY_SESSION_KEY = "recallforge-study-session-v1";
const BACKUP_LAST_AUTO_KEY = "recallforge-backup-last-auto-v1";
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLOUD_CONFIG_KEY = "recallforge-cloud-config-v1";
const CLOUD_LAST_SYNC_KEY = "recallforge-cloud-last-sync-v1";
const CLOUD_DEVICE_KEY = "recallforge-cloud-device-v1";
const CLOUD_REMEMBERED_LOGIN_KEY = "recallforge-cloud-remembered-login-v1";
const CLOUD_TABLE = "recallforge_sync";
const CLOUD_SPACE_TABLE = "recallforge_space";
const CLOUD_LOCAL_SYNC_DELAY_MS = 700;
const CLOUD_AUTO_PULL_INTERVAL_MS = 30000;
const CLOUD_RESUME_SYNC_THROTTLE_MS = 8000;
const CARD_IMAGE_MAX_EDGE = 1400;
const CARD_IMAGE_QUALITY = 0.86;
const CARD_IMAGE_ADD_BUTTON_TEXT = "解説に画像を追加";
const CARD_IMAGE_PASTE_BUTTON_TEXT = "コピー画像を貼り付け";
const DEFAULT_DECK_NAME = "医療";
const LEGACY_DEFAULT_DECK_NAME = "Default";
const DEFAULT_CARD_TAGS = ["医療"];

const DEFAULT_PRESETS = [
  { label: "5分", minutes: 5 },
  { label: "15分", minutes: 15 },
  { label: "45分", minutes: 45 },
  { label: "2時間", minutes: 120 },
  { label: "6時間", minutes: 360 },
  { label: "1日", minutes: 1440 },
  { label: "3日", minutes: 4320 },
  { label: "7日", minutes: 10080 },
  { label: "30日", minutes: 43200 }
];

const DEFAULT_DECKS = [DEFAULT_DECK_NAME, "IT関連", "AI関連"];

const SAMPLE_NOTE = `# 自律神経

- 交感神経: 心拍数を増やし、瞳孔を散大させ、消化管運動を抑制する。
- 副交感神経: 心拍数を下げ、消化管運動を促進する。
- アセチルコリンは副交感神経の主要な神経伝達物質である。

## 復習ポイント

- ノルアドレナリン: 交感神経の節後線維から放出されることが多い。
- 自律神経の中枢は視床下部にある。
- 迷走神経は副交感神経に分類される。`;

let state = loadState();
let currentRoute = "study";
let currentStudyCardId = null;
let answerVisible = false;
let candidates = [];
let cloudClient = null;
let cloudSession = null;
let cloudBusy = false;
let cloudAutoSyncTimer = null;
let cloudPeriodicSyncTimer = null;
let cloudSyncInFlight = null;
let cloudAuthSubscription = null;
let cloudLifecycleListenersBound = false;
let cloudLastResumeSyncAt = 0;
let suppressCloudAutoSync = false;
let cloudStatusOverride = null;
let cloudAutoLoginAttempted = false;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  ensureInitialCards();
  restoreStudySession();
  renderAll();
  initCloudSync();
  runDailyAutoBackup();
  registerServiceWorker();
});

function bindElements() {
  Object.assign(els, {
    navTabs: document.querySelectorAll(".nav-tab"),
    routeButtons: document.querySelectorAll("[data-route-button]"),
    views: document.querySelectorAll(".view"),
    dueCount: document.getElementById("dueCount"),
    totalCount: document.getElementById("totalCount"),
    nextDue: document.getElementById("nextDue"),
    deckFilter: document.getElementById("deckFilter"),
    practiceAnyButton: document.getElementById("practiceAnyButton"),
    studyCard: document.getElementById("studyCard"),
    intervalButtons: document.getElementById("intervalButtons"),
    customDateTime: document.getElementById("customDateTime"),
    customMinutes: document.getElementById("customMinutes"),
    scheduleCustomDate: document.getElementById("scheduleCustomDate"),
    scheduleCustomMinutes: document.getElementById("scheduleCustomMinutes"),
    editCurrentCard: document.getElementById("editCurrentCard"),
    deleteCurrentCard: document.getElementById("deleteCurrentCard"),
    cardSearch: document.getElementById("cardSearch"),
    newCardButton: document.getElementById("newCardButton"),
    cardForm: document.getElementById("cardForm"),
    cardId: document.getElementById("cardId"),
    cardType: document.getElementById("cardType"),
    cardDeck: document.getElementById("cardDeck"),
    cardFront: document.getElementById("cardFront"),
    cardBack: document.getElementById("cardBack"),
    cardBackPreviewPanel: document.getElementById("cardBackPreviewPanel"),
    cardBackPreview: document.getElementById("cardBackPreview"),
    addBackImageButton: document.getElementById("addBackImageButton"),
    pasteBackImageButton: document.getElementById("pasteBackImageButton"),
    cardBackImageFile: document.getElementById("cardBackImageFile"),
    cardTags: document.getElementById("cardTags"),
    editNote: document.getElementById("editNote"),
    clearFormButton: document.getElementById("clearFormButton"),
    exportJsonButton: document.getElementById("exportJsonButton"),
    importFile: document.getElementById("importFile"),
    cardList: document.getElementById("cardList"),
    notionInput: document.getElementById("notionInput"),
    notionDeck: document.getElementById("notionDeck"),
    generationStrictness: document.getElementById("generationStrictness"),
    blockedTerms: document.getElementById("blockedTerms"),
    loadSampleNote: document.getElementById("loadSampleNote"),
    generateCards: document.getElementById("generateCards"),
    candidateCount: document.getElementById("candidateCount"),
    candidateList: document.getElementById("candidateList"),
    selectAllCandidates: document.getElementById("selectAllCandidates"),
    acceptCandidates: document.getElementById("acceptCandidates"),
    presetEditor: document.getElementById("presetEditor"),
    addPreset: document.getElementById("addPreset"),
    deckForm: document.getElementById("deckForm"),
    newDeckName: document.getElementById("newDeckName"),
    deckList: document.getElementById("deckList"),
    editHistoryCount: document.getElementById("editHistoryCount"),
    deletedGeneratedCount: document.getElementById("deletedGeneratedCount"),
    resetDataButton: document.getElementById("resetDataButton"),
    cloudConfigForm: document.getElementById("cloudConfigForm"),
    supabaseUrl: document.getElementById("supabaseUrl"),
    supabaseAnonKey: document.getElementById("supabaseAnonKey"),
    cloudResetConfigButton: document.getElementById("cloudResetConfigButton"),
    cloudAuthForm: document.getElementById("cloudAuthForm"),
    cloudEmail: document.getElementById("cloudEmail"),
    cloudPassword: document.getElementById("cloudPassword"),
    rememberCloudLogin: document.getElementById("rememberCloudLogin"),
    cloudMemoryStatus: document.getElementById("cloudMemoryStatus"),
    cloudSignInButton: document.getElementById("cloudSignInButton"),
    cloudSignUpButton: document.getElementById("cloudSignUpButton"),
    cloudSignOutButton: document.getElementById("cloudSignOutButton"),
    cloudSyncButton: document.getElementById("cloudSyncButton"),
    cloudUploadButton: document.getElementById("cloudUploadButton"),
    cloudDownloadButton: document.getElementById("cloudDownloadButton"),
    syncStatus: document.getElementById("syncStatus"),
    updateBanner: document.getElementById("updateBanner"),
    reloadUpdateButton: document.getElementById("reloadUpdateButton"),
    messageDialog: document.getElementById("messageDialog"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogMessage: document.getElementById("dialogMessage")
  });
}

function bindEvents() {
  els.navTabs.forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route));
  });

  els.routeButtons.forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.routeButton));
  });

  els.deckFilter.addEventListener("change", () => {
    currentStudyCardId = null;
    answerVisible = false;
    renderStudy();
  });

  els.practiceAnyButton.addEventListener("click", () => {
    const card = getStudyQueue(true)[0];
    if (card) {
      currentStudyCardId = card.id;
      answerVisible = false;
      renderStudy();
    }
  });

  els.scheduleCustomDate.addEventListener("click", () => {
    if (!currentStudyCardId || !els.customDateTime.value) return;
    const target = new Date(els.customDateTime.value);
    if (Number.isNaN(target.getTime())) {
      showMessage("日時を確認してください", "再表示する日時を正しく入力してください。");
      return;
    }
    const minutes = Math.max(1, Math.ceil((target.getTime() - Date.now()) / 60000));
    scheduleCurrentCard(minutes, "日時指定");
  });

  els.scheduleCustomMinutes.addEventListener("click", () => {
    const minutes = Number.parseInt(els.customMinutes.value, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      showMessage("分数を確認してください", "1以上の分数を入力してください。");
      return;
    }
    scheduleCurrentCard(minutes, `${minutes}分`);
  });

  els.editCurrentCard.addEventListener("click", () => {
    const card = getCard(currentStudyCardId);
    if (!card) return;
    fillCardForm(card);
    setRoute("cards");
  });

  els.deleteCurrentCard.addEventListener("click", () => {
    const card = getCard(currentStudyCardId);
    if (!card) return;
    if (!window.confirm("このカードを削除しますか？")) return;
    deleteCard(card.id, "study");
  });

  els.newCardButton.addEventListener("click", () => {
    clearCardForm();
    els.cardFront.focus();
  });

  els.cardSearch.addEventListener("input", renderCardList);
  els.cardForm.addEventListener("submit", saveCardFromForm);
  els.addBackImageButton.addEventListener("click", () => els.cardBackImageFile.click());
  els.pasteBackImageButton.addEventListener("click", pasteBackImageFromClipboard);
  els.cardBackImageFile.addEventListener("change", handleBackImageFile);
  els.cardBack.addEventListener("input", updateCardBackPreview);
  els.cardBack.addEventListener("paste", handleBackImagePaste);
  els.cardBack.addEventListener("dragover", handleBackImageDragOver);
  els.cardBack.addEventListener("dragleave", handleBackImageDragLeave);
  els.cardBack.addEventListener("drop", handleBackImageDrop);
  els.clearFormButton.addEventListener("click", clearCardForm);
  els.exportJsonButton.addEventListener("click", exportCards);
  els.importFile.addEventListener("change", handleImportFile);
  els.loadSampleNote.addEventListener("click", () => {
    els.notionInput.value = SAMPLE_NOTE;
  });
  els.generateCards.addEventListener("click", generateCandidatesFromNotion);
  els.selectAllCandidates.addEventListener("click", () => {
    candidates = candidates.map((candidate) => ({ ...candidate, selected: true }));
    renderCandidates();
  });
  els.acceptCandidates.addEventListener("click", acceptSelectedCandidates);
  els.deckForm.addEventListener("submit", createDeckFromForm);
  els.addPreset.addEventListener("click", () => {
    state.settings.presets.push({ label: "90分", minutes: 90 });
    persistAndRender();
  });
  els.resetDataButton.addEventListener("click", () => {
    if (!window.confirm("保存済みデータをすべて消去しますか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = createDefaultState();
    currentStudyCardId = null;
    candidates = [];
    ensureInitialCards();
    renderAll();
  });
  els.cloudConfigForm.addEventListener("submit", saveCloudConfig);
  els.cloudResetConfigButton.addEventListener("click", resetCloudConfig);
  els.rememberCloudLogin.addEventListener("change", () => {
    if (!els.rememberCloudLogin.checked) forgetRememberedCloudCredentials();
  });
  els.cloudSignInButton.addEventListener("click", signInToCloud);
  els.cloudSignUpButton.addEventListener("click", signUpToCloud);
  els.cloudSignOutButton.addEventListener("click", signOutFromCloud);
  els.cloudSyncButton.addEventListener("click", () => syncCloud({ mode: "merge" }));
  els.cloudUploadButton.addEventListener("click", () => syncCloud({ mode: "upload" }));
  els.cloudDownloadButton.addEventListener("click", () => syncCloud({ mode: "download" }));
  els.reloadUpdateButton.addEventListener("click", applyPendingUpdate);
}

function createDefaultState() {
  return {
    cards: [],
    reviews: [],
    editHistory: [],
    deletedGenerated: [],
    assets: {},
    settings: {
      presets: DEFAULT_PRESETS.map((preset) => ({ ...preset })),
      decks: [...DEFAULT_DECKS],
      blockedTerms: []
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return normalizeLoadedState({
      ...createDefaultState(),
      ...parsed,
      settings: {
        ...createDefaultState().settings,
        ...(parsed.settings || {})
      }
    });
  } catch {
    return createDefaultState();
  }
}

function normalizeLoadedState(input) {
  const nextState = {
    ...createDefaultState(),
    ...input,
    settings: {
      ...createDefaultState().settings,
      ...(input.settings || {})
    }
  };
  const activeCards = Array.isArray(nextState.cards)
    ? nextState.cards.filter((card) => card?.status !== "deleted")
    : [];
  const legacyDefaultInUse = activeCards.some((card) => deckKey(card.deck) === deckKey(LEGACY_DEFAULT_DECK_NAME));
  nextState.settings.decks = normalizeDeckList(nextState.settings.decks || []).filter(
    (deck) => legacyDefaultInUse || deckKey(deck) !== deckKey(LEGACY_DEFAULT_DECK_NAME)
  );
  if (!nextState.settings.decks.some((deck) => deckKey(deck) === deckKey(DEFAULT_DECK_NAME))) {
    nextState.settings.decks.unshift(DEFAULT_DECK_NAME);
  }
  nextState.assets = normalizeAssets(nextState.assets);
  return nextState;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudAutoSync(CLOUD_LOCAL_SYNC_DELAY_MS);
}

function ensureInitialCards() {
  if (state.cards.length > 0) return;
  const now = new Date().toISOString();
  ensureDeckExists("Sample");
  state.cards.push(
    makeCard({
      type: "basic",
      deck: "Sample",
      front: "RecallForgeでは復習間隔をどう指定できる？",
      back: "5分、45分、6時間、任意の日時など、細かく再表示までの期間を指定できます。",
      tags: ["sample"],
      dueAt: now
    }),
    makeCard({
      type: "cloze",
      deck: "Sample",
      front: "{{c1::Notion}}からコピーしたまとめノートをもとに、カード候補を自動生成できる。",
      back: "生成候補は採用前に編集できます。",
      tags: ["sample", "cloze"],
      dueAt: now
    })
  );
  saveState();
}

function makeCard(input) {
  const now = new Date().toISOString();
  const deck = ensureDeckExists(input.deck);
  return {
    id: input.id || crypto.randomUUID(),
    type: input.type === "cloze" ? "cloze" : "basic",
    deck,
    front: normalizeText(input.front),
    back: normalizeText(input.back),
    tags: normalizeTags(input.tags),
    source: input.source || "manual",
    sourceLine: input.sourceLine || "",
    status: input.status || "active",
    ease: input.ease || 2.5,
    intervalMinutes: input.intervalMinutes || 0,
    dueAt: input.dueAt || now,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

function setRoute(route) {
  currentRoute = route;
  els.navTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.route === route));
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === `view-${route}`));
  if (route === "cards") renderCardList();
  if (route === "settings") renderSettings();
}

function renderAll() {
  syncDecksFromCards();
  renderDeckControls();
  updateCardBackPreview();
  renderStats();
  renderIntervals();
  renderStudy();
  renderCardList();
  renderCandidates();
  renderSettings();
}

function persistAndRender() {
  saveState();
  renderAll();
}

function renderStats() {
  const activeCards = state.cards.filter((card) => card.status === "active");
  const dueCards = getDueCards();
  els.dueCount.textContent = String(dueCards.length);
  els.totalCount.textContent = String(activeCards.length);
  const next = activeCards
    .filter((card) => new Date(card.dueAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0];
  els.nextDue.textContent = next ? formatRelative(next.dueAt) : "なし";
}

function renderDeckControls() {
  const selected = els.deckFilter.value || "all";
  const decks = getDeckNames();
  els.deckFilter.innerHTML = `<option value="all">すべてのデッキ</option>${decks
    .map((deck) => `<option value="${escapeAttribute(deck)}">${escapeHtml(deck)}</option>`)
    .join("")}`;
  els.deckFilter.value = decks.includes(selected) ? selected : "all";
  renderDeckSelect(els.cardDeck, els.cardDeck.value || DEFAULT_DECK_NAME, DEFAULT_DECK_NAME);
  renderDeckSelect(els.notionDeck, els.notionDeck.value || DEFAULT_DECK_NAME, DEFAULT_DECK_NAME);
}

function renderIntervals() {
  els.intervalButtons.innerHTML = "";
  state.settings.presets.forEach((preset) => {
    const button = document.createElement("button");
    button.className = "interval-button";
    button.type = "button";
    button.textContent = preset.label;
    button.addEventListener("click", () => scheduleCurrentCard(preset.minutes, preset.label));
    els.intervalButtons.appendChild(button);
  });
}

function renderStudy() {
  const current = getCard(currentStudyCardId);
  const queue = getStudyQueue(false);
  const card = current && current.status === "active" ? current : queue[0];
  currentStudyCardId = card ? card.id : null;
  saveStudySession();

  if (!card) {
    els.studyCard.innerHTML = `
      <div class="empty-state">
        <h3>復習するカードはありません</h3>
        <p>カードを追加するか、Notion取込から候補を作成してください。</p>
        <button class="primary-button" data-route-button="notion">Notion取込へ</button>
      </div>
    `;
    els.studyCard.querySelector("[data-route-button]")?.addEventListener("click", () => setRoute("notion"));
    return;
  }

  const prompt = card.type === "cloze" ? renderCloze(card.front, answerVisible) : escapeHtml(card.front);
  const answer = card.type === "cloze" ? `${renderCloze(card.front, true)}\n\n${renderRichText(card.back)}` : renderRichText(card.back);
  const dueLabel = isDue(card) ? "復習対象" : `予定: ${formatRelative(card.dueAt)}`;

  els.studyCard.innerHTML = `
    <div class="study-meta">
      <span>${escapeHtml(card.deck)} / ${card.type === "cloze" ? "穴埋め" : "通常"}</span>
      <span>${dueLabel}</span>
    </div>
    <div class="tag-row">${card.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="prompt-text">${prompt}</div>
    <button class="primary-button" id="showAnswerButton">${answerVisible ? "答えを隠す" : "答えを見る"}</button>
    <div class="answer-box ${answerVisible ? "is-visible" : ""}">
      <span class="answer-label">答え</span>
      <div class="answer-text">${answer}</div>
    </div>
  `;
  document.getElementById("showAnswerButton").addEventListener("click", () => {
    answerVisible = !answerVisible;
    renderStudy();
  });
}

// 学習中のカードと「答え表示中」の状態を端末に保存する。
// iOSが数分でページを再読み込みしても、開いていた答えを復元できるようにするため。
function saveStudySession() {
  try {
    if (currentStudyCardId) {
      localStorage.setItem(
        STUDY_SESSION_KEY,
        JSON.stringify({ cardId: currentStudyCardId, answerVisible })
      );
    } else {
      localStorage.removeItem(STUDY_SESSION_KEY);
    }
  } catch {
    // localStorageが使えない環境では保存をあきらめる（動作には影響しない）。
  }
}

function restoreStudySession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STUDY_SESSION_KEY) || "null");
    if (!parsed || typeof parsed.cardId !== "string") return;
    const card = state.cards.find((item) => item.id === parsed.cardId && item.status === "active");
    if (!card) return;
    currentStudyCardId = card.id;
    answerVisible = Boolean(parsed.answerVisible);
  } catch {
    // 復元に失敗しても通常の初期表示にフォールバックするだけ。
  }
}

function renderCardList() {
  const query = normalizeText(els.cardSearch.value).toLowerCase();
  const cards = state.cards
    .filter((card) => card.status === "active")
    .filter((card) => {
      if (!query) return true;
      return [card.front, card.back, card.deck, card.tags.join(" ")].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  if (cards.length === 0) {
    els.cardList.innerHTML = `
      <div class="empty-state compact">
        <h3>カードがありません</h3>
        <p>新規カードを作るか、Notion取込を使ってください。</p>
      </div>
    `;
    return;
  }

  els.cardList.innerHTML = cards
    .map(
      (card) => `
      <article class="list-card">
        <div class="list-card-header">
          <div>
            <h3>${escapeHtml(card.front)}</h3>
            <p>${escapeHtml(getBackPreview(card.back))}</p>
          </div>
          <span class="tag">${card.type === "cloze" ? "穴埋め" : "通常"}</span>
        </div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(card.deck)}</span>
          ${card.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <p>次回: ${formatDateTime(card.dueAt)}</p>
        <div class="card-actions">
          <button class="secondary-button" data-edit-card="${card.id}">編集</button>
          <button class="danger-button" data-delete-card="${card.id}">削除</button>
        </div>
      </article>
    `
    )
    .join("");

  els.cardList.querySelectorAll("[data-edit-card]").forEach((button) => {
    button.addEventListener("click", () => fillCardForm(getCard(button.dataset.editCard)));
  });
  els.cardList.querySelectorAll("[data-delete-card]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!window.confirm("このカードを削除しますか？")) return;
      deleteCard(button.dataset.deleteCard, "list");
    });
  });
}

function renderCandidates() {
  els.candidateCount.textContent = `候補 ${candidates.length}件`;
  if (candidates.length === 0) {
    els.candidateList.innerHTML = `
      <div class="empty-state compact">
        <h3>候補はまだありません</h3>
        <p>Notion本文を貼り付けて候補を作成してください。</p>
      </div>
    `;
    return;
  }

  els.candidateList.innerHTML = candidates
    .map(
      (candidate, index) => `
      <article class="candidate-card" data-candidate-index="${index}">
        <div class="candidate-card-header">
          <label>
            <input type="checkbox" data-candidate-selected="${index}" ${candidate.selected ? "checked" : ""} />
            採用
          </label>
          <span class="candidate-score">重要度 ${candidate.score}</span>
        </div>
        <div class="form-grid">
          <label>
            種類
            <select data-candidate-field="type">
              <option value="basic" ${candidate.type === "basic" ? "selected" : ""}>通常</option>
              <option value="cloze" ${candidate.type === "cloze" ? "selected" : ""}>穴埋め</option>
            </select>
          </label>
          <label>
            デッキ
            <select data-candidate-field="deck">
              ${renderDeckOptionsHtml(candidate.deck)}
            </select>
          </label>
        </div>
        <label>
          問題
          <textarea rows="3" data-candidate-field="front">${escapeHtml(candidate.front)}</textarea>
        </label>
        <label>
          解説
          <textarea rows="3" data-candidate-field="back">${escapeHtml(candidate.back)}</textarea>
        </label>
        <label>
          タグ
          <input data-candidate-field="tags" value="${escapeAttribute(candidate.tags.join(", "))}" />
        </label>
        <div class="candidate-actions">
          <button class="ghost-button" data-reject-candidate="${index}">候補から外す</button>
        </div>
      </article>
    `
    )
    .join("");

  els.candidateList.querySelectorAll("[data-candidate-selected]").forEach((input) => {
    input.addEventListener("change", () => {
      candidates[Number(input.dataset.candidateSelected)].selected = input.checked;
    });
  });

  els.candidateList.querySelectorAll("[data-candidate-field]").forEach((field) => {
    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, () => {
      const index = Number(field.closest("[data-candidate-index]").dataset.candidateIndex);
      const key = field.dataset.candidateField;
      candidates[index][key] = key === "tags" ? normalizeTags(field.value) : field.value;
    });
  });

  els.candidateList.querySelectorAll("[data-reject-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.rejectCandidate);
      const [removed] = candidates.splice(index, 1);
      if (removed) rememberBlockedTerms(removed.front);
      renderCandidates();
    });
  });
}

function renderSettings() {
  renderCloudStatus();
  const counts = getDeckCounts();
  els.deckList.innerHTML = getDeckNames()
    .map(
      (deck) => `
      <div class="deck-row" data-deck-name="${escapeAttribute(deck)}">
        <input aria-label="デッキ名" data-deck-field value="${escapeAttribute(deck)}" />
        <span class="deck-count">${counts.get(deck) || 0}枚</span>
        <button class="icon-button" data-remove-deck="${escapeAttribute(deck)}" aria-label="削除">×</button>
      </div>
    `
    )
    .join("");

  els.deckList.querySelectorAll("[data-deck-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const oldName = field.closest("[data-deck-name]").dataset.deckName;
      renameDeck(oldName, field.value);
    });
  });

  els.deckList.querySelectorAll("[data-remove-deck]").forEach((button) => {
    button.addEventListener("click", () => removeDeck(button.dataset.removeDeck));
  });

  els.presetEditor.innerHTML = state.settings.presets
    .map(
      (preset, index) => `
      <div class="preset-row" data-preset-index="${index}">
        <input aria-label="ラベル" data-preset-field="label" value="${escapeAttribute(preset.label)}" />
        <input aria-label="分" data-preset-field="minutes" type="number" min="1" value="${preset.minutes}" />
        <button class="icon-button" data-remove-preset="${index}" aria-label="削除">×</button>
      </div>
    `
    )
    .join("");

  els.presetEditor.querySelectorAll("[data-preset-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const index = Number(field.closest("[data-preset-index]").dataset.presetIndex);
      const key = field.dataset.presetField;
      state.settings.presets[index][key] = key === "minutes" ? Math.max(1, Number(field.value)) : field.value;
      persistAndRender();
    });
  });
  els.presetEditor.querySelectorAll("[data-remove-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.presets.splice(Number(button.dataset.removePreset), 1);
      persistAndRender();
    });
  });

  els.editHistoryCount.textContent = `${state.editHistory.length}件`;
  els.deletedGeneratedCount.textContent = `${state.deletedGenerated.length}件`;
}

function getActiveCards() {
  return state.cards.filter((card) => card.status === "active");
}

function getDueCards() {
  return getActiveCards().filter(isDue);
}

function getStudyQueue(includeFuture) {
  const deck = els.deckFilter?.value || "all";
  return getActiveCards()
    .filter((card) => deck === "all" || card.deck === deck)
    .filter((card) => includeFuture || isDue(card))
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

function isDue(card) {
  return new Date(card.dueAt).getTime() <= Date.now();
}

function getCard(id) {
  return state.cards.find((card) => card.id === id);
}

function scheduleCurrentCard(minutes, label) {
  const card = getCard(currentStudyCardId);
  if (!card) return;
  const now = Date.now();
  card.intervalMinutes = minutes;
  card.dueAt = new Date(now + minutes * 60000).toISOString();
  card.updatedAt = new Date(now).toISOString();
  state.reviews.push({
    id: crypto.randomUUID(),
    cardId: card.id,
    label,
    intervalMinutes: minutes,
    reviewedAt: new Date(now).toISOString()
  });
  currentStudyCardId = null;
  answerVisible = false;
  saveState();
  renderAll();
}

function saveCardFromForm(event) {
  event.preventDefault();
  const deck = ensureDeckExists(els.cardDeck.value);
  const back = compactImageDataUrls(els.cardBack.value);
  if (back !== els.cardBack.value) {
    els.cardBack.value = back;
    updateCardBackPreview();
  }
  const input = {
    type: els.cardType.value,
    deck,
    front: els.cardFront.value,
    back,
    tags: els.cardTags.value
  };

  if (!normalizeText(input.front) || !normalizeText(input.back)) {
    showMessage("入力を確認してください", "問題と解説の両方を入力してください。");
    return;
  }

  const existing = getCard(els.cardId.value);
  if (existing) {
    const before = { front: existing.front, back: existing.back, type: existing.type };
    Object.assign(existing, {
      type: input.type,
      deck: ensureDeckExists(input.deck),
      front: normalizeText(input.front),
      back: normalizeText(input.back),
      tags: normalizeTags(input.tags),
      updatedAt: new Date().toISOString()
    });
    if (normalizeText(els.editNote.value)) {
      state.editHistory.push({
        id: crypto.randomUUID(),
        cardId: existing.id,
        before,
        after: { front: existing.front, back: existing.back, type: existing.type },
        note: normalizeText(els.editNote.value),
        at: new Date().toISOString()
      });
    }
  } else {
    state.cards.push(makeCard(input));
  }

  clearCardForm();
  persistAndRender();
  showMessage("保存しました", "カードを保存しました。");
}

function fillCardForm(card) {
  if (!card) return;
  ensureDeckExists(card.deck);
  renderDeckControls();
  els.cardId.value = card.id;
  els.cardType.value = card.type;
  els.cardDeck.value = card.deck;
  els.cardFront.value = card.front;
  els.cardBack.value = card.back;
  els.cardTags.value = card.tags.join(", ");
  els.editNote.value = "";
  updateCardBackPreview();
}

function clearCardForm() {
  els.cardId.value = "";
  els.cardType.value = "basic";
  renderDeckSelect(els.cardDeck, DEFAULT_DECK_NAME, getDeckNames()[0] || DEFAULT_DECK_NAME);
  els.cardFront.value = "";
  els.cardBack.value = "";
  els.cardTags.value = DEFAULT_CARD_TAGS.join(", ");
  els.editNote.value = "";
  updateCardBackPreview();
}

function deleteCard(id, source) {
  const card = getCard(id);
  if (!card) return;
  card.status = "deleted";
  card.updatedAt = new Date().toISOString();
  if (card.source === "notion") {
    state.deletedGenerated.push({
      id: crypto.randomUUID(),
      cardId: card.id,
      front: card.front,
      sourceLine: card.sourceLine,
      source,
      at: new Date().toISOString()
    });
    rememberBlockedTerms(card.front);
  }
  if (currentStudyCardId === id) {
    currentStudyCardId = null;
    answerVisible = false;
  }
  persistAndRender();
}

async function handleBackImageFile(event) {
  const files = getImageFiles(event.target.files);
  if (files.length === 0) return;
  try {
    await insertBackImagesFromFiles(files);
  } catch (error) {
    showMessage("画像を追加できませんでした", error.message || "別の画像を選択してください。");
  } finally {
    els.cardBackImageFile.value = "";
  }
}

async function handleBackImagePaste(event) {
  const files = getImageFilesFromClipboard(event.clipboardData);
  const htmlImages = files.length === 0 ? getImageMarkdownFromClipboardHtml(event.clipboardData) : [];
  if (files.length === 0 && htmlImages.length === 0) return;
  event.preventDefault();
  try {
    if (files.length > 0) {
      await insertBackImagesFromFiles(files);
    } else {
      insertTextAtCursor(els.cardBack, `\n\n${htmlImages.join("\n\n")}\n\n`);
      saveState();
    }
  } catch (error) {
    showMessage("画像を貼り付けできませんでした", error.message || "別の画像を選択してください。");
  }
}

function handleBackImageDragOver(event) {
  if (!dataTransferHasFiles(event.dataTransfer)) return;
  event.preventDefault();
  els.cardBack.classList.add("is-image-drop-target");
}

function handleBackImageDragLeave() {
  els.cardBack.classList.remove("is-image-drop-target");
}

async function handleBackImageDrop(event) {
  const files = getImageFiles(event.dataTransfer?.files);
  if (files.length === 0) return;
  event.preventDefault();
  els.cardBack.classList.remove("is-image-drop-target");
  try {
    await insertBackImagesFromFiles(files);
  } catch (error) {
    showMessage("画像を追加できませんでした", error.message || "別の画像を選択してください。");
  }
}

async function pasteBackImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    els.cardBack.focus();
    showMessage("貼り付け方法", "解説欄を選んで、コピーした画像をそのままペーストしてください。");
    return;
  }
  try {
    const clipboardItems = await navigator.clipboard.read();
    const files = [];
    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      files.push(new File([blob], `clipboard-image.${mimeToExtension(imageType)}`, { type: imageType }));
    }
    if (files.length === 0) {
      showMessage("画像がありません", "先に画像をコピーしてから、もう一度押してください。");
      return;
    }
    await insertBackImagesFromFiles(files);
  } catch {
    els.cardBack.focus();
    showMessage("貼り付けできませんでした", "ブラウザが制限している場合は、解説欄を選んで通常のペーストを使ってください。");
  }
}

async function insertBackImagesFromFiles(files) {
  const imageFiles = getImageFiles(files);
  if (imageFiles.length === 0) throw new Error("画像ファイルを選択してください。");
  setBackImageBusy(true);
  try {
    const markdown = [];
    for (const file of imageFiles) {
      const dataUrl = await imageFileToCardDataUrl(file);
      markdown.push(`![解説画像](${createCardImageReference(dataUrl)})`);
    }
    insertTextAtCursor(els.cardBack, `\n\n${markdown.join("\n\n")}\n\n`);
    saveState();
  } finally {
    setBackImageBusy(false);
  }
}

function createCardImageReference(dataUrl) {
  if (!isSupportedImageDataUrl(dataUrl)) return dataUrl;
  if (!state.assets) state.assets = {};
  const id = crypto.randomUUID();
  state.assets[id] = {
    id,
    dataUrl,
    createdAt: new Date().toISOString()
  };
  return `recallforge-image:${id}`;
}

function updateCardBackPreview() {
  if (!els.cardBackPreviewPanel || !els.cardBackPreview) return;
  const compacted = compactImageDataUrls(els.cardBack?.value || "");
  if (compacted !== els.cardBack.value) {
    const nextPosition = Math.min(compacted.length, els.cardBack.selectionStart ?? compacted.length);
    els.cardBack.value = compacted;
    els.cardBack.setSelectionRange(nextPosition, nextPosition);
    saveState();
  }
  const value = els.cardBack?.value || "";
  if (!hasBackPreviewContent(value)) {
    els.cardBackPreviewPanel.hidden = true;
    els.cardBackPreview.innerHTML = "";
    return;
  }
  els.cardBackPreview.innerHTML = renderRichText(value);
  els.cardBackPreviewPanel.hidden = false;
}

function hasBackPreviewContent(value) {
  const text = String(value || "");
  return (
    // 画像
    /!\[[^\]\n]{0,80}]\((?:data:image\/|https?:\/\/|recallforge-image:)/.test(text) ||
    // 表
    /(^|\n)\s*\|.+\|\s*\n\s*\|?[\s:|-]{3,}\|/.test(text) ||
    // 見出し
    /(^|\n)#{1,6}\s+\S/.test(text) ||
    // 箇条書き・番号付きリスト
    /(^|\n)\s*(?:[-*+]|\d+[.)])\s+\S/.test(text) ||
    // 引用
    /(^|\n)\s*>\s+\S/.test(text) ||
    // コードブロック
    /(^|\n)\s*(?:`{3,}|~{3,})/.test(text) ||
    // 太字・インラインコード
    /\*\*[^*\n]+\*\*/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    // リンク・参照リンク定義
    /\[[^\]\n]+]\((?:https?:)/.test(text) ||
    /(^|\n)\s*\[[^\]\n]+]:\s*<?https?:/.test(text)
  );
}

function compactImageDataUrls(value) {
  let text = String(value || "");
  // まずMarkdown画像記法（![...](data:...)）に埋め込まれたデータURLを短い参照に置き換える。
  text = text.replace(
    /!\[([^\]\n]{0,80})\]\((data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)\)/g,
    (_match, alt, dataUrl) => `![${alt || "解説画像"}](${createCardImageReference(dataUrl)})`
  );
  // パソコンからの貼り付けなどで、記法に囲まれていない「生のデータURL」（長い文字列）が
  // そのまま入ってしまった場合も、画像として扱えるよう参照に変換する。
  // 直前が "(" のもの（＝上の変換で残った記法内）は対象外にして二重変換を防ぐ。
  text = text.replace(
    /(^|[^(])(data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)/g,
    (_match, prefix, dataUrl) => `${prefix}![解説画像](${createCardImageReference(dataUrl)})`
  );
  return text;
}

function setBackImageBusy(isBusy) {
  els.addBackImageButton.disabled = isBusy;
  els.pasteBackImageButton.disabled = isBusy;
  els.addBackImageButton.textContent = isBusy ? "画像処理中" : CARD_IMAGE_ADD_BUTTON_TEXT;
  els.pasteBackImageButton.textContent = isBusy ? "画像処理中" : CARD_IMAGE_PASTE_BUTTON_TEXT;
}

function getImageFiles(files) {
  return Array.from(files || []).filter(isImageFile);
}

function getImageFilesFromClipboard(clipboardData) {
  const files = [];
  Array.from(clipboardData?.items || []).forEach((item) => {
    if (item.kind !== "file" || !item.type.startsWith("image/")) return;
    const file = item.getAsFile();
    if (file) files.push(file);
  });
  return files.length > 0 ? files : getImageFiles(clipboardData?.files);
}

function getImageMarkdownFromClipboardHtml(clipboardData) {
  const html = clipboardData?.getData?.("text/html");
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.images)
    .map((image) => normalizeImageMarkdownSource(image.getAttribute("src") || image.src))
    .filter(Boolean)
    .map((src) => `![解説画像](${src.startsWith("data:image/") ? createCardImageReference(src) : src})`);
}

function normalizeImageMarkdownSource(src) {
  const value = normalizeText(src);
  if (isSupportedImageDataUrl(value)) return value;
  return normalizeReferenceUrl(value);
}

function isSupportedImageDataUrl(value) {
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(value || ""));
}

function dataTransferHasFiles(dataTransfer) {
  const types = dataTransfer?.types;
  if (!types) return false;
  if (typeof types.contains === "function" && types.contains("Files")) return true;
  return Array.from(types).includes("Files");
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(file.name || "");
}

function mimeToExtension(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  return "jpg";
}

function imageFileToCardDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const scale = Math.min(1, CARD_IMAGE_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("画像を処理できませんでした。");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", CARD_IMAGE_QUALITY));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像を読み込めませんでした。"));
    };
    image.src = objectUrl;
  });
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const nextPosition = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(nextPosition, nextPosition);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function exportCards() {
  const exportCards = getActiveCards().map((card) => ({
    ...card,
    back: inlineStoredImageReferences(card.back)
  }));
  const payload = JSON.stringify(exportCards, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recallforge-cards-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function inlineStoredImageReferences(value) {
  return String(value || "").replace(
    /!\[([^\]\n]{0,80})]\(recallforge-image:([A-Za-z0-9_-]+)\)/g,
    (match, alt, id) => {
      const dataUrl = resolveImageSource(`recallforge-image:${id}`);
      return dataUrl ? `![${alt || "解説画像"}](${dataUrl})` : match;
    }
  );
}

// 全データ（カード・学習履歴・修正履歴・画像・設定）を1つにまとめたバックアップを作る。
function buildBackupPayload() {
  return {
    app: "RecallForge",
    recallforgeBackup: true,
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    state: serializeAppState(state)
  };
}

function downloadFullBackup() {
  const payload = JSON.stringify(buildBackupPayload(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recallforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// 1日1回、パソコン（デスクトップ）でアプリを開いたときに全データを自動ダウンロードする。
// スマホやインストール済みPWAでは自動ダウンロードしない（Macにバックアップをためる想定）。
function runDailyAutoBackup() {
  try {
    if (!isLikelyDesktopBrowser()) return;
    const last = Number(localStorage.getItem(BACKUP_LAST_AUTO_KEY) || 0);
    if (Number.isFinite(last) && Date.now() - last < BACKUP_INTERVAL_MS) return;
    downloadFullBackup();
    localStorage.setItem(BACKUP_LAST_AUTO_KEY, String(Date.now()));
  } catch {
    // 自動バックアップに失敗しても、アプリ本体の動作は妨げない。
  }
}

function isLikelyDesktopBrowser() {
  try {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    return !standalone && !coarsePointer;
  } catch {
    return false;
  }
}

// バックアップファイルの内容で、カードと学習履歴を丸ごと復元する。
// 既存データがあっても失われないよう、新しい方を優先してマージする。
function restoreFullBackup(backupState) {
  const restored = mergeAppStates(state, backupState);
  applySyncedState(restored);
  renderAll();
}

function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const backupState = isCsv ? null : extractBackupState(text);
      if (backupState) {
        const before = getActiveCards().length;
        restoreFullBackup(backupState);
        const after = getActiveCards().length;
        showMessage(
          "バックアップから復元しました",
          `カード・学習履歴・設定を復元しました（カード ${after}件${after > before ? `／新たに ${after - before}件追加` : ""}）。`
        );
        return;
      }
      const imported = isCsv ? parseCsvCards(text) : parseJsonCards(text);
      imported.forEach((card) => state.cards.push(makeCard(card)));
      persistAndRender();
      showMessage("取り込みました", `${imported.length}件のカードを追加しました。`);
    } catch (error) {
      showMessage("取り込みできませんでした", error.message || "ファイル形式を確認してください。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

// 取り込みファイルが「全体バックアップ」かどうかを判定し、その中の状態を返す。
// 単なるカード配列や {cards:[...]} だけの旧形式は対象外（従来どおりカード追加として扱う）。
function extractBackupState(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (parsed.recallforgeBackup && parsed.state && typeof parsed.state === "object") {
    return parsed.state;
  }
  const looksLikeFullState =
    Array.isArray(parsed.cards) &&
    (Array.isArray(parsed.reviews) ||
      Array.isArray(parsed.editHistory) ||
      Array.isArray(parsed.deletedGenerated) ||
      (parsed.settings && typeof parsed.settings === "object") ||
      (parsed.assets && typeof parsed.assets === "object"));
  return looksLikeFullState ? parsed : null;
}

function parseJsonCards(text) {
  const parsed = JSON.parse(text);
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) throw new Error("JSONは配列、またはcards配列を含む形式にしてください。");
  return cards.map(validateImportedCard);
}

function parseCsvCards(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const entry = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    return validateImportedCard(entry);
  });
}

function validateImportedCard(input) {
  const front = normalizeText(input.front);
  const back = normalizeText(input.back);
  if (!front || !back) throw new Error("frontとbackが必要です。");
  return {
    type: input.type === "cloze" ? "cloze" : "basic",
    deck: ensureDeckExists(input.deck || DEFAULT_DECK_NAME),
    front,
    back,
    tags: normalizeTags(input.tags),
    source: input.source || "import"
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);
  return rows;
}

function generateCandidatesFromNotion() {
  const text = normalizeText(els.notionInput.value);
  if (!text) {
    showMessage("本文がありません", "Notionからコピーした本文を貼り付けてください。");
    return;
  }

  state.settings.blockedTerms = normalizeTags(els.blockedTerms.value).concat(state.settings.blockedTerms || []);
  const deck = ensureDeckExists(els.notionDeck.value || DEFAULT_DECK_NAME);
  const strictness = els.generationStrictness.value;
  const minimumScore = strictness === "strict" ? 5 : strictness === "wide" ? 2 : 3;
  const generated = extractCandidates(text, deck)
    .filter((candidate) => candidate.score >= minimumScore)
    .filter((candidate) => !isBlockedCandidate(candidate))
    .slice(0, 60);

  candidates = generated.map((candidate) => ({ ...candidate, selected: true }));
  saveState();
  renderCandidates();
}

function extractCandidates(text, deck) {
  const lines = text.split(/\n+/).map(cleanNoteLine).filter(Boolean);
  const output = [];
  let heading = "";

  lines.forEach((line) => {
    if (/^#{1,6}\s+/.test(line)) {
      heading = line.replace(/^#{1,6}\s+/, "").trim();
      return;
    }

    const sourceLine = line;
    const withoutBullet = line.replace(/^[-*・]\s*/, "").trim();
    const tags = DEFAULT_CARD_TAGS.concat(["notion"], heading ? [heading] : []);

    const definition = splitDefinition(withoutBullet);
    if (definition) {
      const [term, detail] = definition;
      output.push({
        id: crypto.randomUUID(),
        type: "basic",
        deck,
        front: `${term}とは？`,
        back: detail,
        tags,
        sourceLine,
        score: scoreLine(term, detail, sourceLine) + 2,
        selected: true
      });
      output.push({
        id: crypto.randomUUID(),
        type: "cloze",
        deck,
        front: `{{c1::${term}}}: ${detail}`,
        back: detail,
        tags: tags.concat(["穴埋め"]),
        sourceLine,
        score: scoreLine(term, detail, sourceLine),
        selected: true
      });
      return;
    }

    const clozeTarget = pickClozeTarget(withoutBullet);
    if (clozeTarget) {
      output.push({
        id: crypto.randomUUID(),
        type: "cloze",
        deck,
        front: withoutBullet.replace(clozeTarget, `{{c1::${clozeTarget}}}`),
        back: withoutBullet,
        tags,
        sourceLine,
        score: scoreLine(clozeTarget, withoutBullet, sourceLine),
        selected: true
      });
    }
  });

  return dedupeCandidates(output);
}

function cleanNoteLine(line) {
  return line
    .replace(/\t/g, " ")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[\[|\]\]/g, "")
    .trim();
}

function splitDefinition(line) {
  const colon = line.match(/^(.{2,40}?)[：:]\s*(.{4,})$/);
  if (colon) return [colon[1].trim(), colon[2].trim()];
  const isPattern = line.match(/^(.{2,28}?)(とは|は)\s*(.{8,})$/);
  if (isPattern && !/[。.!?]$/.test(isPattern[1])) return [isPattern[1].trim(), isPattern[3].trim()];
  const equals = line.match(/^(.{2,40}?)\s*=\s*(.{4,})$/);
  if (equals) return [equals[1].trim(), equals[2].trim()];
  return null;
}

function pickClozeTarget(line) {
  const bold = line.match(/【(.{2,24}?)】/);
  if (bold) return bold[1];
  const nounish = line.match(/^([一-龠ぁ-んァ-ンA-Za-z0-9ー・]{2,24})(は|が|を|に)/);
  if (nounish) return nounish[1];
  const quoted = line.match(/[「『](.{2,24}?)[」』]/);
  if (quoted) return quoted[1];
  return null;
}

function scoreLine(term, detail, sourceLine) {
  let score = 1;
  if (term.length >= 3 && term.length <= 18) score += 1;
  if (detail.length >= 12) score += 1;
  if (/重要|必須|ポイント|原因|結果|分類|定義|中枢|主要/.test(sourceLine)) score += 2;
  if (/^[-*・]/.test(sourceLine)) score += 1;
  if (state.editHistory.some((history) => history.after?.front?.includes(term))) score += 1;
  if (state.deletedGenerated.some((deleted) => deleted.front.includes(term))) score -= 3;
  return Math.max(0, score);
}

function dedupeCandidates(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.front}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isBlockedCandidate(candidate) {
  const terms = [...new Set(normalizeTags(els.blockedTerms.value).concat(state.settings.blockedTerms || []))];
  return terms.some((term) => term && `${candidate.front} ${candidate.back}`.includes(term));
}

function acceptSelectedCandidates() {
  const selected = candidates.filter((candidate) => candidate.selected);
  if (selected.length === 0) {
    showMessage("選択がありません", "カード化する候補を選択してください。");
    return;
  }
  selected.forEach((candidate) => {
    const deck = ensureDeckExists(candidate.deck);
    state.cards.push(
      makeCard({
        type: candidate.type,
        deck,
        front: candidate.front,
        back: candidate.back,
        tags: candidate.tags,
        source: "notion",
        sourceLine: candidate.sourceLine
      })
    );
  });
  candidates = candidates.filter((candidate) => !candidate.selected);
  persistAndRender();
  showMessage("カード化しました", `${selected.length}件のカードを追加しました。`);
}

function rememberBlockedTerms(text) {
  const candidate = pickClozeTarget(text) || text.replace(/とは？$/, "").slice(0, 24);
  if (!candidate || candidate.length < 2) return;
  const next = new Set(state.settings.blockedTerms || []);
  next.add(candidate);
  state.settings.blockedTerms = [...next].slice(-200);
}

function renderCloze(text, reveal) {
  const pattern = /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g;
  let cursor = 0;
  let html = "";
  let match = pattern.exec(text);

  while (match) {
    html += escapeHtml(text.slice(cursor, match.index));
    const answer = match[1];
    const hint = match[2];
    html += reveal
      ? `<span class="cloze-answer">${escapeHtml(answer)}</span>`
      : `<span class="cloze-blank">${hint ? escapeHtml(hint) : "　　　　　"}</span>`;
    cursor = pattern.lastIndex;
    match = pattern.exec(text);
  }

  return html + escapeHtml(text.slice(cursor));
}

function renderRichText(value) {
  const text = String(value || "");
  const references = collectReferenceLinks(text);
  const pattern = /!\[([^\]\n]{0,80})\]\(((?:data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)|(?:https?:\/\/[^\s)]+)|(?:recallforge-image:[A-Za-z0-9_-]+))\)/g;
  let cursor = 0;
  let html = "";
  let match = pattern.exec(text);

  while (match) {
    html += renderTextBlock(text.slice(cursor, match.index), references);
    const alt = escapeAttribute(match[1] || "解説画像");
    const src = resolveImageSource(match[2]);
    if (!src) {
      html += escapeHtml(match[0]);
      cursor = pattern.lastIndex;
      match = pattern.exec(text);
      continue;
    }
    html += `<figure class="answer-image-frame"><img class="answer-image" src="${src}" alt="${alt}" loading="lazy" /></figure>`;
    cursor = pattern.lastIndex;
    match = pattern.exec(text);
  }

  html += renderTextBlock(text.slice(cursor), references);
  if (!html) return "";
  return `<div class="rich-body">${html}</div>`;
}

function resolveImageSource(value) {
  const source = String(value || "");
  if (source.startsWith("data:image/")) return isSupportedImageDataUrl(source) ? source : "";
  if (source.startsWith("recallforge-image:")) {
    const id = source.replace(/^recallforge-image:/, "");
    const asset = state.assets?.[id];
    const dataUrl = typeof asset === "string" ? asset : asset?.dataUrl;
    return isSupportedImageDataUrl(dataUrl) ? dataUrl : "";
  }
  return normalizeReferenceUrl(source);
}

// ChatGPTなどから貼り付けたMarkdownを、見出し・箇条書き・番号付き・引用・区切り線・
// コードブロック・表・段落といったブロック単位で解釈してHTMLに整える。
function renderTextBlock(value, references = new Map()) {
  const lines = String(value || "").split("\n");
  let html = "";
  let paragraph = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const inner = paragraph.map((line) => renderInlineMarkdown(line, references)).join("<br />");
    html += `<p class="rich-p">${inner}</p>`;
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    // 空行は段落の区切り
    if (trimmed === "") {
      flushParagraph();
      index += 1;
      continue;
    }

    // 参照リンクの定義行（[1]: https://... "タイトル"）は表示せず、リンク解決のみに使う
    if (parseReferenceDefinition(line)) {
      flushParagraph();
      index += 1;
      continue;
    }

    // ```／~~~ で囲まれたコードブロック
    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence) {
      flushParagraph();
      const marker = fence[1][0];
      const closing = new RegExp(`^\\s*\\${marker}{3,}\\s*$`);
      const codeLines = [];
      index += 1;
      while (index < lines.length && !closing.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1; // 閉じフェンスを飛ばす
      html += `<pre class="rich-code"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
      continue;
    }

    // 表（既存のMarkdownテーブル）
    if (isMarkdownTableStart(lines, index)) {
      flushParagraph();
      const table = collectMarkdownTable(lines, index);
      html += renderMarkdownTable(table, references);
      index = table.endIndex + 1;
      continue;
    }

    // 見出し（# ～ ######）
    const heading = trimmed.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading && heading[2]) {
      flushParagraph();
      const level = heading[1].length;
      html += `<h${level} class="rich-h rich-h${level}">${renderInlineMarkdown(heading[2], references)}</h${level}>`;
      index += 1;
      continue;
    }

    // 区切り線（---, ***, ___）。表の区切り行（| を含む）は除外
    if (!line.includes("|") && /^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
      flushParagraph();
      html += `<hr class="rich-hr" />`;
      index += 1;
      continue;
    }

    // 引用（> ）。連続する行をまとめて1つの引用にする
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const quoteLines = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html += `<blockquote class="rich-quote">${renderTextBlock(quoteLines.join("\n"), references)}</blockquote>`;
      continue;
    }

    // 箇条書き・番号付きリスト（入れ子対応）
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flushParagraph();
      const list = renderMarkdownList(lines, index, references);
      html += list.html;
      index = list.next;
      continue;
    }

    // それ以外は段落として蓄積
    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  return html;
}

// インデント量に基づいて入れ子のリストを解釈する。
function renderMarkdownList(lines, start, references) {
  const listItemPattern = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

  const parse = (from, indent) => {
    let out = "";
    let items = "";
    let currentType = null;
    let cursor = from;

    const closeList = () => {
      if (!currentType) return;
      out += `<${currentType} class="rich-list">${items}</${currentType}>`;
      items = "";
      currentType = null;
    };

    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.trim() === "") {
        // 空行の先にリストの続きがあれば継続、なければ終了
        let peek = cursor + 1;
        while (peek < lines.length && lines[peek].trim() === "") peek += 1;
        const peekMatch = peek < lines.length ? lines[peek].match(listItemPattern) : null;
        if (peekMatch && peekMatch[1].length >= indent) {
          cursor = peek;
          continue;
        }
        break;
      }

      const match = line.match(listItemPattern);
      if (!match || match[1].length < indent) break;
      if (match[1].length > indent) break; // 呼び出し元が処理する深い階層

      const type = /\d/.test(match[2]) ? "ol" : "ul";
      if (currentType && currentType !== type) closeList();
      currentType = type;

      const content = match[3];
      cursor += 1;

      // 直後に続く、より深いインデントの項目は入れ子リストにする
      let nested = "";
      const nextMatch = cursor < lines.length ? lines[cursor].match(listItemPattern) : null;
      if (nextMatch && nextMatch[1].length > indent) {
        const child = parse(cursor, nextMatch[1].length);
        nested = child.html;
        cursor = child.next;
      }

      items += `<li>${renderInlineMarkdown(content, references)}${nested}</li>`;
    }

    closeList();
    return { html: out, next: cursor };
  };

  const baseIndent = (lines[start].match(/^(\s*)/)[1] || "").length;
  const result = parse(start, baseIndent);
  return { html: result.html, next: result.next };
}

function isMarkdownTableStart(lines, index) {
  if (!isLikelyMarkdownTableRow(lines[index]) || !isMarkdownTableSeparator(lines[index + 1])) return false;
  const headerCells = splitMarkdownTableRow(lines[index]);
  const separatorCells = splitMarkdownTableRow(lines[index + 1]);
  return headerCells.length >= 2 && separatorCells.length >= 2;
}

function collectMarkdownTable(lines, startIndex) {
  const header = splitMarkdownTableRow(lines[startIndex]);
  const alignments = splitMarkdownTableRow(lines[startIndex + 1]).map(parseTableAlignment);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length && isLikelyMarkdownTableRow(lines[index])) {
    rows.push(normalizeMarkdownTableRow(splitMarkdownTableRow(lines[index]), header.length));
    index += 1;
  }

  return {
    header: normalizeMarkdownTableRow(header, header.length),
    alignments,
    rows,
    endIndex: index - 1
  };
}

function renderMarkdownTable(table, references) {
  const renderCell = (tag, cell, index) => {
    const alignment = table.alignments[index] || "";
    const className = alignment ? ` class="align-${alignment}"` : "";
    return `<${tag}${className}>${renderInlineMarkdown(cell, references)}</${tag}>`;
  };
  const header = table.header.map((cell, index) => renderCell("th", cell, index)).join("");
  const rows = table.rows
    .map((row) => `<tr>${row.map((cell, index) => renderCell("td", cell, index)).join("")}</tr>`)
    .join("");

  return `<div class="answer-table-wrap"><table class="answer-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function isLikelyMarkdownTableRow(line) {
  if (typeof line !== "string" || !line.includes("|")) return false;
  return splitMarkdownTableRow(line).length >= 2;
}

function isMarkdownTableSeparator(line) {
  if (!isLikelyMarkdownTableRow(line)) return false;
  return splitMarkdownTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function splitMarkdownTableRow(line) {
  let text = String(line || "").trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && text[text.length - 2] !== "\\") text = text.slice(0, -1);

  const cells = [];
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "|" && text[index - 1] !== "\\") {
      cells.push(current.trim().replace(/\\\|/g, "|"));
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim().replace(/\\\|/g, "|"));
  return cells;
}

function normalizeMarkdownTableRow(cells, columnCount) {
  const normalized = cells.slice(0, columnCount);
  if (cells.length > columnCount && columnCount > 0) {
    normalized[columnCount - 1] = cells.slice(columnCount - 1).join(" | ");
  }
  while (normalized.length < columnCount) normalized.push("");
  return normalized;
}

function parseTableAlignment(value) {
  const marker = String(value || "").replace(/\s+/g, "");
  const startsWithColon = marker.startsWith(":");
  const endsWithColon = marker.endsWith(":");
  if (startsWithColon && endsWithColon) return "center";
  if (endsWithColon) return "right";
  return "";
}

function renderInlineMarkdown(value, references = new Map()) {
  const text = String(value || "");
  const pattern = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|\[([^\]\n]{1,120})]\((https?:\/\/[^\s)]+)\)|\[([^\]\n]{1,120})]\[([^\]\n]{1,80})]|(https?:\/\/[^\s<>"']+)/g;
  let cursor = 0;
  let html = "";
  let match = pattern.exec(text);

  while (match) {
    html += escapeHtml(text.slice(cursor, match.index));
    if (match[1]) {
      html += `<code class="rich-inline-code">${escapeHtml(match[1])}</code>`;
    } else if (match[2]) {
      html += `<strong>${escapeHtml(match[2])}</strong>`;
    } else if (match[3]) {
      html += `<em>${escapeHtml(match[3])}</em>`;
    } else if (match[4] && match[5]) {
      const href = normalizeReferenceUrl(match[5]);
      html += href
        ? `<a class="reference-link" href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[4])}</a>`
        : escapeHtml(match[0]);
    } else if (match[6] && match[7]) {
      const reference = references.get(normalizeReferenceId(match[7]));
      const title = reference?.title ? ` title="${escapeAttribute(reference.title)}"` : "";
      html += reference?.url
        ? `<a class="reference-link" href="${escapeAttribute(reference.url)}" target="_blank" rel="noopener noreferrer"${title}>${escapeHtml(match[6])}</a>`
        : escapeHtml(match[0]);
    } else {
      const { url, trailing } = splitTrailingUrlPunctuation(match[8]);
      const href = normalizeReferenceUrl(url);
      html += href
        ? `<a class="reference-link" href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(trailing)}`
        : escapeHtml(match[0]);
    }
    cursor = pattern.lastIndex;
    match = pattern.exec(text);
  }

  return html + escapeHtml(text.slice(cursor));
}

function collectReferenceLinks(value) {
  const references = new Map();
  String(value || "")
    .split("\n")
    .forEach((line) => {
      const reference = parseReferenceDefinition(line);
      if (reference) references.set(normalizeReferenceId(reference.id), reference);
    });
  return references;
}

function parseReferenceDefinition(line) {
  const match = String(line || "").match(/^\s*\[([^\]\n]+)]\s*:\s*<?(https?:\/\/[^>\s]+)>?(?:\s+["“]([^"”]+)["”])?\s*$/);
  if (!match) return null;
  const url = normalizeReferenceUrl(match[2]);
  if (!url) return null;
  return {
    id: match[1],
    url,
    title: normalizeText(match[3] || "")
  };
}

function normalizeReferenceId(value) {
  return normalizeText(value).toLocaleLowerCase("ja-JP");
}

function normalizeReferenceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function splitTrailingUrlPunctuation(value) {
  let url = String(value || "");
  let trailing = "";
  while (/[.,、。!?！？;；:：)\]）】」』]$/.test(url)) {
    trailing = `${url.slice(-1)}${trailing}`;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

function getBackPreview(value) {
  const text = String(value || "")
    .replace(/!\[[^\]]*]\((?:data:image\/[^)]+|https?:\/\/[^\s)]+|recallforge-image:[^)]+)\)/g, " [画像] ")
    .replace(/\[([^\]\n]{1,120})]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\[([^\]\n]{1,120})]\[[^\]\n]{1,80}]/g, "$1")
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/^\s*\|?[\s:|-]{3,}\|[\s:|-]*$/gm, " ")
    .replace(/\|/g, " ");
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSupabaseUrl(value) {
  const text = normalizeText(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    url.pathname = url.pathname.replace(/\/rest\/v1\/?$/, "");
    if (url.pathname === "/") url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return text.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  }
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean);
  return String(value || "")
    .split(/[,;、\n]/)
    .map(normalizeText)
    .filter(Boolean);
}

function normalizeAssets(value) {
  const assets = {};
  if (!value || typeof value !== "object") return assets;
  Object.entries(value).forEach(([id, asset]) => {
    const dataUrl = typeof asset === "string" ? asset : asset?.dataUrl;
    if (!isSupportedImageDataUrl(dataUrl)) return;
    assets[id] = {
      id,
      dataUrl,
      createdAt: normalizeText(asset?.createdAt) || new Date().toISOString()
    };
  });
  return assets;
}

function createDeckFromForm(event) {
  event.preventDefault();
  const deck = normalizeDeckName(els.newDeckName.value);
  if (!deck) {
    showMessage("デッキ名を確認してください", "デッキ名を入力してください。");
    return;
  }
  if (hasDeck(deck)) {
    showMessage("同じデッキがあります", "すでに同じ名前のデッキがあります。");
    return;
  }
  state.settings.decks.push(deck);
  els.newDeckName.value = "";
  persistAndRender();
}

function getDeckNames() {
  const names = [];
  const seen = new Set();
  const add = (name) => {
    const deck = normalizeDeckName(name);
    const key = deckKey(deck);
    if (!deck || seen.has(key)) return;
    seen.add(key);
    names.push(deck);
  };

  (state.settings.decks || []).forEach(add);
  state.cards.filter((card) => card.status === "active").forEach((card) => add(card.deck));
  candidates.forEach((candidate) => add(candidate.deck));
  if (names.length === 0) add(DEFAULT_DECK_NAME);
  return names;
}

function syncDecksFromCards() {
  state.settings.decks = getDeckNames();
}

function ensureDeckExists(value) {
  const deck = normalizeDeckName(value) || DEFAULT_DECK_NAME;
  if (!state.settings.decks) state.settings.decks = [];
  if (!hasDeck(deck)) state.settings.decks.push(deck);
  return deck;
}

function hasDeck(value) {
  const key = deckKey(value);
  return getDeckNames().some((deck) => deckKey(deck) === key);
}

function renameDeck(oldName, newNameValue) {
  const nextName = normalizeDeckName(newNameValue);
  if (!nextName) {
    showMessage("デッキ名を確認してください", "デッキ名は空にできません。");
    renderSettings();
    return;
  }
  if (deckKey(oldName) === deckKey(nextName)) {
    renderSettings();
    return;
  }
  if (hasDeck(nextName)) {
    showMessage("同じデッキがあります", "別のデッキ名を入力してください。");
    renderSettings();
    return;
  }

  state.settings.decks = getDeckNames().map((deck) => (deck === oldName ? nextName : deck));
  state.cards.forEach((card) => {
    if (card.deck === oldName) card.deck = nextName;
  });
  candidates = candidates.map((candidate) => ({
    ...candidate,
    deck: candidate.deck === oldName ? nextName : candidate.deck
  }));
  persistAndRender();
}

function removeDeck(deck) {
  const counts = getDeckCounts();
  if ((counts.get(deck) || 0) > 0) {
    showMessage("削除できません", "このデッキにはカードがあります。先にカードを別のデッキへ移動してください。");
    return;
  }
  if (getDeckNames().length <= 1) {
    showMessage("削除できません", "デッキは少なくとも1つ必要です。");
    return;
  }
  const fallback = getDeckNames().find((name) => name !== deck) || DEFAULT_DECK_NAME;
  candidates = candidates.map((candidate) => ({
    ...candidate,
    deck: candidate.deck === deck ? fallback : candidate.deck
  }));
  state.settings.decks = getDeckNames().filter((name) => name !== deck);
  persistAndRender();
}

function getDeckCounts() {
  const counts = new Map();
  state.cards
    .filter((card) => card.status === "active")
    .forEach((card) => counts.set(card.deck, (counts.get(card.deck) || 0) + 1));
  return counts;
}

function renderDeckSelect(select, selected, fallback) {
  const decks = getDeckNames();
  select.innerHTML = renderDeckOptionsHtml(selected);
  select.value = decks.includes(selected) ? selected : fallback;
  if (!select.value && decks.length > 0) select.value = decks[0];
}

function renderDeckOptionsHtml(selected) {
  return getDeckNames()
    .map(
      (deck) =>
        `<option value="${escapeAttribute(deck)}" ${deck === selected ? "selected" : ""}>${escapeHtml(deck)}</option>`
    )
    .join("");
}

function normalizeDeckName(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function deckKey(value) {
  return normalizeDeckName(value).toLocaleLowerCase("ja-JP");
}

// ログイン不要モードで使う固定の同期キー。cloud-config.js に spaceId があれば有効。
function getCloudSpaceId() {
  return normalizeText(window.RECALLFORGE_SUPABASE?.spaceId || "");
}

// ログイン不要モードでは、ログイン欄や同期先設定欄を隠して画面を簡潔にする。
function applyPasswordlessCloudUI() {
  ["cloudConfigForm", "cloudAuthForm", "cloudUploadButton", "cloudDownloadButton"].forEach((id) => {
    document.getElementById(id)?.setAttribute("hidden", "");
  });
}

// spaceId が設定されていれば「ログインなしで自動同期する」モードになる。
function isPasswordlessCloud() {
  return Boolean(getCloudSpaceId());
}

function initCloudSync() {
  renderCloudConfigInputs();
  renderCloudLoginInputs();
  bindCloudLifecycleSync();
  cloudClient = createCloudClient();
  renderCloudStatus();
  if (!cloudClient) return;

  // ログイン不要モード：認証を使わず、起動と同時に自動同期を始める。
  if (isPasswordlessCloud()) {
    applyPasswordlessCloudUI();
    startCloudPeriodicSync();
    queueCloudAutoSync(300);
    return;
  }

  cloudAuthSubscription?.unsubscribe?.();
  const authListener = cloudClient.auth.onAuthStateChange((_event, session) => {
    cloudSession = session;
    renderCloudStatus();
    if (session?.user) {
      startCloudPeriodicSync();
      queueCloudAutoSync(300);
    } else {
      stopCloudPeriodicSync();
    }
  });
  cloudAuthSubscription = authListener?.data?.subscription || null;

  cloudClient.auth.getSession().then(({ data }) => {
    cloudSession = data.session;
    renderCloudStatus();
    if (cloudSession?.user) {
      startCloudPeriodicSync();
      queueCloudAutoSync(300);
      return;
    }
    stopCloudPeriodicSync();
    attemptRememberedCloudLogin();
  });
}

function renderCloudConfigInputs() {
  const config = getCloudConfig();
  if (els.supabaseUrl) els.supabaseUrl.value = config.url;
  if (els.supabaseAnonKey) els.supabaseAnonKey.value = config.anonKey;
}

function renderCloudLoginInputs() {
  const credentials = getRememberedCloudCredentials();
  const defaultEmail = normalizeText(window.RECALLFORGE_SUPABASE?.defaultEmail);
  if (els.cloudEmail && !els.cloudEmail.value) els.cloudEmail.value = credentials?.email || defaultEmail;
  if (credentials?.password && els.cloudPassword && !els.cloudPassword.value) els.cloudPassword.value = credentials.password;
  if (els.rememberCloudLogin) els.rememberCloudLogin.checked = true;
  renderCloudMemoryStatus();
}

function renderCloudMemoryStatus() {
  if (!els.cloudMemoryStatus) return;
  const credentials = getRememberedCloudCredentials();
  els.cloudMemoryStatus.textContent = credentials
    ? `自動ログイン: この端末に保存済み (${credentials.email})`
    : "自動ログイン: 未保存。初回ログインに成功すると、この端末に保存されます。";
}

function bindCloudLifecycleSync() {
  if (cloudLifecycleListenersBound) return;
  cloudLifecycleListenersBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) queueCloudResumeSync();
  });
  window.addEventListener("focus", queueCloudResumeSync);
  window.addEventListener("online", () => queueCloudAutoSync(300));
}

function queueCloudResumeSync() {
  const now = Date.now();
  if (now - cloudLastResumeSyncAt < CLOUD_RESUME_SYNC_THROTTLE_MS) return;
  cloudLastResumeSyncAt = now;
  queueCloudAutoSync(300);
}

function startCloudPeriodicSync() {
  if (cloudPeriodicSyncTimer) return;
  cloudPeriodicSyncTimer = window.setInterval(() => {
    if (document.hidden) return;
    queueCloudAutoSync(0);
  }, CLOUD_AUTO_PULL_INTERVAL_MS);
}

function stopCloudPeriodicSync() {
  window.clearInterval(cloudPeriodicSyncTimer);
  cloudPeriodicSyncTimer = null;
}

function getCloudConfig() {
  const defaults = window.RECALLFORGE_SUPABASE || {};
  try {
    const stored = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "{}");
    return {
      url: normalizeSupabaseUrl(stored.url || defaults.url),
      anonKey: normalizeText(stored.anonKey || defaults.anonKey)
    };
  } catch {
    return {
      url: normalizeSupabaseUrl(defaults.url),
      anonKey: normalizeText(defaults.anonKey)
    };
  }
}

function saveCloudConfig(event) {
  event.preventDefault();
  clearCloudError();
  const config = {
    url: normalizeSupabaseUrl(els.supabaseUrl.value),
    anonKey: normalizeText(els.supabaseAnonKey.value)
  };
  if (!config.url || !config.anonKey) {
    setCloudStatus("同期先URLと公開キーを入力してください。", "error");
    return;
  }
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  renderCloudConfigInputs();
  cloudClient = createCloudClient();
  cloudSession = null;
  cloudAutoLoginAttempted = false;
  stopCloudPeriodicSync();
  initCloudSync();
  showMessage("同期先を保存しました", "ログインすると、この端末のカードをクラウド同期できます。");
}

function resetCloudConfig() {
  clearCloudError();
  if (!restoreDefaultCloudConfig()) return;
  showMessage("同期先を標準設定に戻しました", "もう一度ログインしてください。");
}

function restoreDefaultCloudConfig() {
  const defaults = window.RECALLFORGE_SUPABASE || {};
  const config = {
    url: normalizeSupabaseUrl(defaults.url),
    anonKey: normalizeText(defaults.anonKey)
  };
  if (!config.url || !config.anonKey) {
    setCloudStatus("標準の同期先がまだ設定されていません。", "error");
    return;
  }
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  renderCloudConfigInputs();
  cloudClient = createCloudClient();
  cloudSession = null;
  cloudAutoLoginAttempted = false;
  stopCloudPeriodicSync();
  initCloudSync();
  return true;
}

function createCloudClient() {
  const config = getCloudConfig();
  if (!config.url || !config.anonKey) return null;
  if (!window.supabase?.createClient) return null;
  return window.supabase.createClient(normalizeSupabaseUrl(config.url), config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "recallforge-supabase-auth"
    }
  });
}

function renderCloudStatus() {
  if (!els.syncStatus) return;
  if (cloudBusy) {
    setCloudStatus("同期中です。", "online");
    return;
  }
  if (cloudStatusOverride) {
    setCloudStatus(cloudStatusOverride, "error");
    return;
  }
  const config = getCloudConfig();
  if (!config.url || !config.anonKey) {
    setCloudStatus("未設定: Supabase URLと公開キーを保存してください。", "");
    return;
  }
  if (!window.supabase?.createClient) {
    setCloudStatus("同期ライブラリを読み込めません。通信環境を確認してください。", "error");
    return;
  }
  if (isPasswordlessCloud()) {
    if (!cloudClient) {
      setCloudStatus("同期の準備中です。", "");
      return;
    }
    const lastSyncAt = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
    setCloudStatus(
      `自動同期: 有効（ログイン不要）${lastSyncAt ? ` / 最終同期 ${formatDateTime(lastSyncAt)}` : ""}`,
      "online"
    );
    return;
  }
  if (!cloudClient) {
    setCloudStatus("同期先は保存済みです。ログインしてください。", "");
    return;
  }
  if (!cloudSession?.user) {
    setCloudStatus("未ログイン: 同期するにはログインしてください。", "");
    return;
  }
  const lastSync = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
  setCloudStatus(
    `ログイン中: ${cloudSession.user.email || "アカウント"}${lastSync ? ` / 最終同期 ${formatDateTime(lastSync)}` : ""}`,
    "online"
  );
}

function setCloudStatus(message, tone) {
  els.syncStatus.textContent = message;
  els.syncStatus.classList.toggle("is-online", tone === "online");
  els.syncStatus.classList.toggle("is-error", tone === "error");
}

function clearCloudError() {
  cloudStatusOverride = null;
}

function showCloudError(message) {
  cloudStatusOverride = message;
  setCloudStatus(message, "error");
}

async function signUpToCloud() {
  try {
    clearCloudError();
    const client = requireCloudClient();
    const credentials = getCloudCredentials();
    cloudBusy = true;
    renderCloudStatus();
    const { data, error } = await client.auth.signUp(credentials);
    if (error) throw error;
    cloudSession = data.session || cloudSession;
    rememberCloudCredentials(credentials);
    if (cloudSession?.user) startCloudPeriodicSync();
    renderCloudStatus();
    showMessage("アカウントを作成しました", "確認メールが届いた場合は、メール内のリンクを開いてからログインしてください。");
  } catch (error) {
    const message = getFriendlyCloudErrorMessage(error);
    recoverCloudConfigIfInvalidKey(error);
    showCloudError(message);
    showMessage("アカウント作成に失敗しました", message);
  } finally {
    cloudBusy = false;
    renderCloudStatus();
  }
}

async function signInToCloud() {
  try {
    clearCloudError();
    const client = requireCloudClient();
    const credentials = getCloudCredentials();
    cloudBusy = true;
    renderCloudStatus();
    const { data, error } = await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    cloudSession = data.session;
    rememberCloudCredentials(credentials);
    startCloudPeriodicSync();
    renderCloudStatus();
    await syncCloud({ mode: "merge", silent: true });
    showMessage("ログインしました", "この端末とクラウドのカードを同期しました。");
  } catch (error) {
    const message = getFriendlyCloudErrorMessage(error);
    recoverCloudConfigIfInvalidKey(error);
    showCloudError(message);
    showMessage("ログインに失敗しました", message);
  } finally {
    cloudBusy = false;
    renderCloudStatus();
  }
}

async function signOutFromCloud() {
  try {
    clearCloudError();
    const client = requireCloudClient();
    cloudBusy = true;
    renderCloudStatus();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    cloudSession = null;
    stopCloudPeriodicSync();
    forgetRememberedCloudCredentials();
    showMessage("ログアウトしました", "この端末のローカルデータは残っています。");
  } catch (error) {
    const message = getFriendlyCloudErrorMessage(error);
    showCloudError(message);
    showMessage("ログアウトに失敗しました", message);
  } finally {
    cloudBusy = false;
    renderCloudStatus();
  }
}

function requireCloudClient() {
  if (!cloudClient) cloudClient = createCloudClient();
  if (!cloudClient) throw new Error("先に同期先URLと公開キーを保存してください。");
  return cloudClient;
}

function getCloudCredentials() {
  const remembered = getRememberedCloudCredentials();
  const email = normalizeText(els.cloudEmail.value) || remembered?.email || "";
  const password = normalizeText(els.cloudPassword.value) || remembered?.password || "";
  if (email && els.cloudEmail && !els.cloudEmail.value) els.cloudEmail.value = email;
  if (password && els.cloudPassword && !els.cloudPassword.value) els.cloudPassword.value = password;
  if (!email || !password) throw new Error("メールとパスワードを入力してください。");
  return { email, password };
}

async function attemptRememberedCloudLogin() {
  if (cloudAutoLoginAttempted || cloudBusy || cloudSession?.user || !cloudClient) return;
  const credentials = getRememberedCloudCredentials();
  if (!credentials) return;
  cloudAutoLoginAttempted = true;
  try {
    clearCloudError();
    cloudBusy = true;
    renderCloudStatus();
    const { data, error } = await cloudClient.auth.signInWithPassword(credentials);
    if (error) throw error;
    cloudSession = data.session;
    startCloudPeriodicSync();
    renderCloudStatus();
    await syncCloud({ mode: "merge", silent: true });
  } catch (error) {
    const message = getFriendlyCloudErrorMessage(error);
    recoverCloudConfigIfInvalidKey(error);
    if (message.includes("メールアドレスまたはパスワード")) {
      forgetRememberedCloudCredentials();
    }
    showCloudError(`自動ログインに失敗しました。${message}`);
  } finally {
    cloudBusy = false;
    renderCloudStatus();
  }
}

function getRememberedCloudCredentials() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLOUD_REMEMBERED_LOGIN_KEY) || "null");
    const email = normalizeText(parsed?.email);
    const password = normalizeText(parsed?.password);
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

function rememberCloudCredentials(credentials) {
  if (!els.rememberCloudLogin?.checked) {
    forgetRememberedCloudCredentials();
    return;
  }
  localStorage.setItem(
    CLOUD_REMEMBERED_LOGIN_KEY,
    JSON.stringify({
      email: normalizeText(credentials.email),
      password: normalizeText(credentials.password),
      savedAt: new Date().toISOString()
    })
  );
  renderCloudMemoryStatus();
}

function forgetRememberedCloudCredentials() {
  localStorage.removeItem(CLOUD_REMEMBERED_LOGIN_KEY);
  if (els.rememberCloudLogin) els.rememberCloudLogin.checked = false;
  renderCloudMemoryStatus();
}

function queueCloudAutoSync(delay = 1500) {
  if (suppressCloudAutoSync || !cloudClient) return;
  // ログイン不要モードでは常に同期可。通常モードではログイン済みのときだけ。
  if (!isPasswordlessCloud() && !cloudSession?.user) return;
  window.clearTimeout(cloudAutoSyncTimer);
  cloudAutoSyncTimer = window.setTimeout(() => {
    syncCloud({ mode: "merge", silent: true });
  }, delay);
}

async function syncCloud({ mode, silent = false }) {
  if (cloudSyncInFlight) {
    if (!silent) await cloudSyncInFlight;
    return;
  }
  cloudSyncInFlight = runCloudSync({ mode, silent });
  try {
    await cloudSyncInFlight;
  } finally {
    cloudSyncInFlight = null;
  }
}

async function runCloudSync({ mode, silent = false }) {
  try {
    clearCloudError();
    const client = requireCloudClient();
    const owner = await resolveCloudOwner(client);
    cloudBusy = true;
    renderCloudStatus();

    const remoteState = await fetchCloudState(client, owner);
    if (mode === "download") {
      if (!remoteState) throw new Error("クラウド側に同期データがまだありません。");
      applySyncedState(mergeAppStates(state, remoteState));
    } else {
      // 「今すぐ同期」「この端末を保存」いずれの場合も、クラウド側のカードを消さないよう
      // 必ずリモートとマージ（和集合）してから書き戻す。これにより、空の端末や
      // 別ブラウザで開いた直後でも、クラウドのカードを誤って上書きすることはない。
      const merged = remoteState ? mergeAppStates(state, remoteState) : serializeAppState(state);
      applySyncedState(merged);
      await upsertCloudStateSafely(client, owner, serializeAppState(state), remoteState);
    }

    localStorage.setItem(CLOUD_LAST_SYNC_KEY, new Date().toISOString());
    renderAll();
    renderCloudStatus();
    if (!silent) showMessage("同期しました", "この端末とクラウドのデータを同期しました。");
  } catch (error) {
    const message = getFriendlyCloudErrorMessage(error);
    recoverCloudConfigIfInvalidKey(error);
    showCloudError(message);
    if (!silent) showMessage("同期に失敗しました", message);
  } finally {
    cloudBusy = false;
    renderCloudStatus();
  }
}

function getFriendlyCloudErrorMessage(error) {
  const message = error?.message || "同期設定を確認してください。";
  if (
    message.includes(CLOUD_SPACE_TABLE) ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("relation")
  ) {
    return "同期用のテーブルがまだ用意されていません。Supabaseの管理画面で初期設定SQLを1回だけ実行してください（手順はアプリの案内を参照）。実行後は自動で同期されます。";
  }
  if (isInvalidApiKeyError(error)) {
    return "iPhoneに保存されているSupabase公開キーが違います。標準設定に戻したので、もう一度ログインを押してください。";
  }
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが違います。入力内容を確認してください。";
  }
  if (message.includes("Email not confirmed")) {
    return "メール確認が終わっていません。Supabaseから届いた確認メールを開いてから、もう一度ログインしてください。";
  }
  if (message.includes("Auth session missing")) {
    return "ログインが完了していません。メールとパスワードを入力して、先にログインを押してください。";
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "通信に失敗しました。iPhoneがインターネットにつながっているか、同期先URLが正しいか確認してください。";
  }
  if (message.includes("row-level security") || message.includes("violates row-level security")) {
    return "Supabaseの同期ルールが保存を止めています。同期用SQLをSupabaseで実行してから、もう一度保存してください。";
  }
  return message;
}

function isInvalidApiKeyError(error) {
  const message = error?.message || "";
  return message.includes("Invalid API key") || message.includes("Invalid api key");
}

function recoverCloudConfigIfInvalidKey(error) {
  if (!isInvalidApiKeyError(error)) return;
  restoreDefaultCloudConfig();
}

async function getCloudUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("ログインしてください。");
  return data.user;
}

// 同期の宛先を決める。spaceId があればログイン不要の共有キー、なければログインユーザー。
async function resolveCloudOwner(client) {
  if (isPasswordlessCloud()) {
    return { kind: "space", key: getCloudSpaceId() };
  }
  const user = await getCloudUser(client);
  return { kind: "user", key: user.id };
}

async function fetchCloudState(client, owner) {
  if (owner.kind === "space") {
    const { data, error } = await client
      .from(CLOUD_SPACE_TABLE)
      .select("state")
      .eq("space_id", owner.key)
      .limit(1);
    if (error) throw error;
    return data?.[0]?.state || null;
  }
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .select("state")
    .eq("user_id", owner.key)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.state || null;
}

// クラウドへ書き込む前の最終安全弁。
// 正常なマージはリモートの全カード（削除済みの記録も含む）を必ず引き継ぐため、
// 書き込むカードの記録件数がリモートより減ることはない。もし減っているなら
// 何らかの異常なので、クラウドのデータを守るために書き込みを中止する。
async function upsertCloudStateSafely(client, owner, payload, remoteState) {
  const remoteCards = Array.isArray(remoteState?.cards) ? remoteState.cards.length : 0;
  const nextCards = Array.isArray(payload?.cards) ? payload.cards.length : 0;
  if (remoteCards > 0 && nextCards < remoteCards) {
    throw new Error(
      "安全のため同期を中止しました（カードが減る書き込みを防ぎました）。ページを再読み込みしてから、もう一度お試しください。"
    );
  }
  await upsertCloudState(client, owner, payload);
}

async function upsertCloudState(client, owner, payload) {
  if (owner.kind === "space") {
    const { error } = await client.from(CLOUD_SPACE_TABLE).upsert(
      {
        space_id: owner.key,
        state: payload,
        device_id: getCloudDeviceId(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "space_id" }
    );
    if (error) throw error;
    return;
  }
  const { error } = await client.from(CLOUD_TABLE).upsert(
    {
      user_id: owner.key,
      state: payload,
      device_id: getCloudDeviceId(),
      client_updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

function getCloudDeviceId() {
  let id = localStorage.getItem(CLOUD_DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLOUD_DEVICE_KEY, id);
  }
  return id;
}

function serializeAppState(input) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    cards: Array.isArray(input.cards) ? input.cards : [],
    reviews: Array.isArray(input.reviews) ? input.reviews : [],
    editHistory: Array.isArray(input.editHistory) ? input.editHistory : [],
    deletedGenerated: Array.isArray(input.deletedGenerated) ? input.deletedGenerated : [],
    assets: normalizeAssets(input.assets),
    settings: {
      ...createDefaultState().settings,
      ...(input.settings || {}),
      decks: normalizeDeckList(input.settings?.decks || []),
      blockedTerms: normalizeTags(input.settings?.blockedTerms || [])
    }
  };
}

function applySyncedState(nextState) {
  suppressCloudAutoSync = true;
  const previousStudyCardId = currentStudyCardId;
  const previousAnswerVisible = answerVisible;
  state = normalizeLoadedState({
    ...createDefaultState(),
    ...nextState,
    settings: {
      ...createDefaultState().settings,
      ...(nextState.settings || {})
    }
  });
  // 学習中のカードが同期後も残っていれば、表示中の答えを維持する。
  // これがないとバックグラウンド同期のたびに答えが閉じてしまう。
  const survivingCard = previousStudyCardId
    ? state.cards.find((card) => card.id === previousStudyCardId && card.status === "active")
    : null;
  if (survivingCard) {
    currentStudyCardId = survivingCard.id;
    answerVisible = previousAnswerVisible;
  } else {
    currentStudyCardId = null;
    answerVisible = false;
  }
  saveState();
  suppressCloudAutoSync = false;
}

function mergeAppStates(localState, remoteState) {
  const local = serializeAppState(localState);
  const remote = serializeAppState(remoteState);
  return {
    ...local,
    cards: mergeById(local.cards, remote.cards, "updatedAt"),
    reviews: mergeById(local.reviews, remote.reviews, "reviewedAt"),
    editHistory: mergeById(local.editHistory, remote.editHistory, "at"),
    deletedGenerated: mergeById(local.deletedGenerated, remote.deletedGenerated, "at"),
    assets: mergeAssets(local.assets, remote.assets),
    settings: mergeSettings(local.settings, remote.settings),
    exportedAt: new Date().toISOString()
  };
}

function mergeById(localItems, remoteItems, dateKey) {
  const merged = new Map();
  [...remoteItems, ...localItems].forEach((item) => {
    if (!item?.id) return;
    const existing = merged.get(item.id);
    if (!existing || getItemTime(item, dateKey) >= getItemTime(existing, dateKey)) {
      merged.set(item.id, item);
    }
  });
  return [...merged.values()];
}

function mergeAssets(localAssets, remoteAssets) {
  const merged = {};
  [...Object.values(remoteAssets || {}), ...Object.values(localAssets || {})].forEach((asset) => {
    if (!asset?.id || !isSupportedImageDataUrl(asset.dataUrl)) return;
    const existing = merged[asset.id];
    if (!existing || getItemTime(asset, "createdAt") >= getItemTime(existing, "createdAt")) {
      merged[asset.id] = asset;
    }
  });
  return merged;
}

function getItemTime(item, preferredKey) {
  return new Date(item[preferredKey] || item.updatedAt || item.createdAt || item.at || item.reviewedAt || 0).getTime();
}

function mergeSettings(localSettings, remoteSettings) {
  const defaults = createDefaultState().settings;
  return {
    ...defaults,
    ...remoteSettings,
    ...localSettings,
    decks: normalizeDeckList([...(remoteSettings?.decks || []), ...(localSettings?.decks || [])]),
    blockedTerms: normalizeTags([...(remoteSettings?.blockedTerms || []), ...(localSettings?.blockedTerms || [])])
  };
}

function normalizeDeckList(values) {
  const seen = new Set();
  const decks = [];
  values.concat(DEFAULT_DECKS).forEach((value) => {
    const deck = normalizeDeckName(value);
    const key = deckKey(deck);
    if (!deck || seen.has(key)) return;
    seen.add(key);
    decks.push(deck);
  });
  return decks;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatRelative(value) {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "後" : "前";
  if (abs < 60000) return "まもなく";
  if (abs < 3600000) return `${Math.round(abs / 60000)}分${suffix}`;
  if (abs < 86400000) return `${Math.round(abs / 3600000)}時間${suffix}`;
  return `${Math.round(abs / 86400000)}日${suffix}`;
}

function showMessage(title, message) {
  els.dialogTitle.textContent = title;
  els.dialogMessage.textContent = message;
  if (typeof els.messageDialog.showModal === "function") {
    els.messageDialog.showModal();
  } else {
    window.alert(`${title}\n${message}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;
  navigator.serviceWorker
    .register("./service-worker.js")
    .then((registration) => {
      if (registration.waiting) {
        showUpdateBanner(registration.waiting);
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(worker);
          }
        });
      });
    })
    .catch(() => {});

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (window.__recallForgeRefreshing) return;
    window.__recallForgeRefreshing = true;
    window.location.reload();
  });
}

function showUpdateBanner(worker) {
  window.__recallForgeWaitingWorker = worker;
  if (els.updateBanner) els.updateBanner.hidden = false;
}

function applyPendingUpdate() {
  const worker = window.__recallForgeWaitingWorker;
  if (!worker) {
    window.location.reload();
    return;
  }
  worker.postMessage({ type: "SKIP_WAITING" });
}
