const STORAGE_KEY = "recallforge-state-v1";
const CLOUD_CONFIG_KEY = "recallforge-cloud-config-v1";
const CLOUD_LAST_SYNC_KEY = "recallforge-cloud-last-sync-v1";
const CLOUD_DEVICE_KEY = "recallforge-cloud-device-v1";
const CLOUD_REMEMBERED_LOGIN_KEY = "recallforge-cloud-remembered-login-v1";
const CLOUD_TABLE = "recallforge_sync";
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
  renderAll();
  initCloudSync();
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
    /!\[[^\]\n]{0,80}]\((?:data:image\/|https?:\/\/|recallforge-image:)/.test(text) ||
    /(^|\n)\s*\|.+\|\s*\n\s*\|?[\s:|-]{3,}\|/.test(text)
  );
}

function compactImageDataUrls(value) {
  return String(value || "").replace(
    /!\[([^\]\n]{0,80})\]\((data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)\)/g,
    (_match, alt, dataUrl) => `![${alt || "解説画像"}](${createCardImageReference(dataUrl)})`
  );
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

function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const imported = file.name.toLowerCase().endsWith(".csv") ? parseCsvCards(text) : parseJsonCards(text);
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

  return html + renderTextBlock(text.slice(cursor), references);
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

function renderTextBlock(value, references = new Map()) {
  const lines = String(value || "").split("\n");
  let html = "";
  let plainLines = [];

  const flushPlainLines = () => {
    if (plainLines.length === 0) return;
    html += renderInlineMarkdown(plainLines.join("\n"), references);
    plainLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (isMarkdownTableStart(lines, index)) {
      flushPlainLines();
      const table = collectMarkdownTable(lines, index);
      html += renderMarkdownTable(table, references);
      index = table.endIndex;
    } else {
      plainLines.push(lines[index]);
    }
  }

  flushPlainLines();
  return html;
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
  const pattern = /\*\*([^*\n]+?)\*\*|\[([^\]\n]{1,120})]\((https?:\/\/[^\s)]+)\)|\[([^\]\n]{1,120})]\[([^\]\n]{1,80})]|(https?:\/\/[^\s<>"']+)/g;
  let cursor = 0;
  let html = "";
  let match = pattern.exec(text);

  while (match) {
    html += escapeHtml(text.slice(cursor, match.index));
    if (match[1]) {
      html += `<strong>${escapeHtml(match[1])}</strong>`;
    } else if (match[2] && match[3]) {
      const href = normalizeReferenceUrl(match[3]);
      html += href
        ? `<a class="reference-link" href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[2])}</a>`
        : escapeHtml(match[0]);
    } else if (match[4] && match[5]) {
      const reference = references.get(normalizeReferenceId(match[5]));
      const title = reference?.title ? ` title="${escapeAttribute(reference.title)}"` : "";
      html += reference?.url
        ? `<a class="reference-link" href="${escapeAttribute(reference.url)}" target="_blank" rel="noopener noreferrer"${title}>${escapeHtml(match[4])}</a>`
        : escapeHtml(match[0]);
    } else {
      const { url, trailing } = splitTrailingUrlPunctuation(match[6]);
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

function initCloudSync() {
  renderCloudConfigInputs();
  renderCloudLoginInputs();
  bindCloudLifecycleSync();
  cloudClient = createCloudClient();
  renderCloudStatus();
  if (!cloudClient) return;

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
  if (suppressCloudAutoSync || !cloudClient || !cloudSession?.user) return;
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
    const user = await getCloudUser(client);
    cloudBusy = true;
    renderCloudStatus();

    if (mode === "upload") {
      await upsertCloudState(client, user.id, serializeAppState(state));
    } else {
      const remoteState = await fetchCloudState(client, user.id);
      if (mode === "download") {
        if (!remoteState) throw new Error("クラウド側に同期データがまだありません。");
        applySyncedState(mergeAppStates(state, remoteState));
      } else {
        const merged = remoteState ? mergeAppStates(state, remoteState) : serializeAppState(state);
        applySyncedState(merged);
        await upsertCloudState(client, user.id, serializeAppState(state));
      }
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

async function fetchCloudState(client, userId) {
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .select("state")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.state || null;
}

async function upsertCloudState(client, userId, payload) {
  const { error } = await client.from(CLOUD_TABLE).upsert(
    {
      user_id: userId,
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
