import { categories, scenarios } from './defaults.js';
import { NAMESPACE, PROMPT_ID, migrateWorldState, composePrompt } from './core.js';
import { renderLibraries } from './presets-ui.js';
import { readLibrary } from './presets.js';

const context = () => SillyTavern.getContext();
let panel = null;
let menu = null;
let category = null;
let problem = '';
let opening = false;
let editorId = null;
const pendingSaves = new Set();

function chatKey() {
    const ctx = context();
    return JSON.stringify([ctx.groupId ?? null, ctx.characters?.[ctx.characterId]?.avatar ?? ctx.characterId ?? null, ctx.chatId ?? null]);
}

function globalSettings() {
    const ctx = context();
    if (!ctx.extensionSettings[NAMESPACE]) ctx.extensionSettings[NAMESPACE] = { schemaVersion: 1, enabled: false };
    if (ctx.extensionSettings[NAMESPACE].library?.schemaVersion === 1) {
        ctx.extensionSettings[NAMESPACE].library = readLibrary(ctx.extensionSettings[NAMESPACE].library);
        ctx.saveSettingsDebounced();
    }
    return ctx.extensionSettings[NAMESPACE];
}

function currentState() {
    const ctx = context();
    return migrateWorldState(ctx.chatId && ctx.chatMetadata ? ctx.chatMetadata[NAMESPACE] : undefined);
}

function inject() {
    const ctx = context();
    const prompt = ctx.chatId && ctx.chatMetadata ? composePrompt(globalSettings().enabled === true, currentState()) : '';
    // ST 1.19.0: IN_PROMPT = 0, SYSTEM = 0; no World Info scan.
    ctx.setExtensionPrompt(PROMPT_ID, prompt, 0, 0, false, 0);
    return prompt;
}

function renderMenu() {
    if (!menu) return;
    const enabled = globalSettings().enabled === true;
    menu.dataset.enabled = String(enabled);
    menu.querySelector('[data-menu-state]').textContent = enabled ? 'ON' : 'OFF';
    menu.setAttribute('aria-label', `멸망 확장팩 · ${enabled ? '활성화' : '비활성화'}`);
    menu.title = enabled ? '멸망 확장팩 · 활성화' : '멸망 확장팩 · 비활성화';
}

function report(error) {
    console.error('[멸망 확장팩]', error);
    problem = '설정 처리 오류: ' + error.message;
    try { inject(); } catch { context().setExtensionPrompt(PROMPT_ID, '', 0, 0, false, 0); }
    if (panel) {
        panel.querySelector('[data-status]').textContent = problem;
        panel.querySelector('[data-status]').hidden = false;
    }
}

async function confirmAction(title, message, action) {
    const ctx = context();
    const body = document.createElement('div');
    body.className = 'au-confirm-content';
    const heading = document.createElement('h3'); heading.textContent = title;
    const description = document.createElement('p'); description.textContent = message;
    body.append(heading, description);
    const popup = new ctx.Popup(body, ctx.POPUP_TYPE.CONFIRM, '', { okButton: action, cancelButton: '취소' });
    popup.dlg.classList.add('apocalypse-au-dialog', 'au-compact-dialog');
    return await popup.show() === ctx.POPUP_RESULT.AFFIRMATIVE;
}

async function changeChat(change, redraw = true) {
    const ctx = context();
    if (!ctx.chatId || !ctx.chatMetadata) return;
    const key = chatKey();
    const state = migrateWorldState(ctx.chatMetadata[NAMESPACE]);
    change(state);
    ctx.chatMetadata[NAMESPACE] = migrateWorldState(state);
    if (redraw) render();
    else refreshPreview();
    // ST internally waits for pending chat saves; rapid-switch disk safety needs live QA.
    const saving = Promise.resolve().then(() => {
        // Do not start a delayed save against a different chat.
        if (chatKey() === key && context().chatMetadata === ctx.chatMetadata) return ctx.saveMetadata();
    });
    pendingSaves.add(saving);
    try { await saving; }
    catch (error) {
        console.error('[멸망 확장팩] 채팅 저장 실패', error);
        // Saving failures must not erase an otherwise valid prompt or affect another chat.
        if (chatKey() === key && panel) {
            problem = '채팅 저장에 실패했습니다. 편집 내용은 현재 화면에 유지됩니다. 연결을 확인해주세요.';
            panel.querySelector('[data-status]').textContent = problem;
            panel.querySelector('[data-status]').hidden = false;
        }
    } finally { pendingSaves.delete(saving); }
}

function refreshPreview() {
    const prompt = inject();
    if (!panel) return;
    panel.querySelector('[data-preview-box]').hidden = !prompt;
    panel.querySelector('[data-preview]').textContent = prompt;
}

function renderEditor(state) {
    const box = panel.querySelector('[data-editor]');
    const scenario = scenarios.find(s => s.id === editorId && state.selected.includes(s.id));
    box.hidden = !scenario;
    box.replaceChildren();
    if (!scenario) { editorId = null; return; }
    const key = chatKey();
    const heading = document.createElement('div');
    heading.className = 'au-section-heading';
    const label = document.createElement('label');
    label.htmlFor = 'au-prompt-text';
    label.textContent = `${scenario.label} 프롬프트`;
    const close = button('접기', () => { editorId = null; render(); });
    heading.append(label, close);
    const textarea = document.createElement('textarea');
    textarea.id = 'au-prompt-text';
    textarea.className = 'au-textarea';
    textarea.rows = 8;
    textarea.spellcheck = false;
    textarea.value = state.overrides[scenario.id] ?? scenario.prompt;
    textarea.addEventListener('input', () => {
        if (chatKey() !== key) return;
        const text = textarea.value;
        changeChat(v => { v.overrides[scenario.id] = text; }, false).catch(report);
        const reset = box.querySelector('[data-reset]');
        if (reset) reset.disabled = text === scenario.prompt;
    });
    const reset = button('기본값 복원', async () => {
        const original = currentState().overrides[scenario.id] ?? scenario.prompt;
        if (original === scenario.prompt) return;
        if (!await confirmAction('기본값 복원', '이 채팅에서 수정한 프롬프트를 기본값으로 되돌릴까요?', '복원')) return;
        // A confirmation opened for one chat must never reset another chat's data.
        if (chatKey() !== key || (currentState().overrides[scenario.id] ?? scenario.prompt) !== original) return;
        await changeChat(v => { delete v.overrides[scenario.id]; });
    });
    reset.dataset.reset = '';
    reset.disabled = textarea.value === scenario.prompt;
    const hint = document.createElement('p');
    hint.className = 'au-editor-hint';
    hint.textContent = '이 채팅에만 적용 · 입력 즉시 반영';
    box.append(heading, textarea, hint, reset);
}

function button(text, action, active = false) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'au-choice';
    el.textContent = text;
    el.setAttribute('aria-pressed', String(active));
    el.addEventListener('click', () => Promise.resolve().then(action).catch(report));
    return el;
}

function setSwitch(selector, checked) {
    const el = panel.querySelector(selector);
    el.setAttribute('aria-checked', String(checked));
    el.querySelector('[data-switch-state]').textContent = checked ? 'ON' : 'OFF';
}

function render() {
    const ctx = context();
    const state = currentState();
    const available = Boolean(ctx.chatId && ctx.chatMetadata);
    const enabled = globalSettings().enabled === true;
    const prompt = inject();
    renderMenu();
    if (!panel) return;
    panel.dataset.enabled = String(enabled);
    setSwitch('[data-enabled]', enabled);
    setSwitch('[data-post]', state.postApocalypse);
    panel.querySelector('[data-chat]').disabled = !available;
    panel.querySelector('[data-categories]').replaceChildren(...categories.map(c => {
        const el = button(c.label, () => { category = category === c.id ? null : c.id; render(); }, category === c.id);
        el.setAttribute('aria-expanded', String(category === c.id));
        el.setAttribute('aria-controls', 'au-subtypes');
        return el;
    }));
    const types = panel.querySelector('[data-scenarios]');
    types.hidden = category === null;
    types.replaceChildren(...scenarios.filter(s => s.category === category).map(s => button(s.label, () => changeChat(v => {
        v.selected = v.selected.includes(s.id) ? v.selected.filter(id => id !== s.id) : [...v.selected, s.id];
    }), state.selected.includes(s.id))));

    const list = panel.querySelector('[data-selected]');
    list.replaceChildren();
    for (const s of scenarios.filter(s => state.selected.includes(s.id))) {
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = s.label;
        const remove = button('×', () => changeChat(v => { v.selected = v.selected.filter(id => id !== s.id); }));
        remove.setAttribute('aria-label', `${s.label} 해제`);
        const edit = button('프롬프트 편집', () => { editorId = editorId === s.id ? null : s.id; render(); }, editorId === s.id);
        edit.classList.add('au-edit-button');
        edit.setAttribute('aria-expanded', String(editorId === s.id));
        edit.setAttribute('aria-controls', 'au-editor');
        item.append(name, edit, remove);
        list.append(item);
    }
    panel.querySelector('[data-empty]').hidden = state.selected.length > 0;
    panel.querySelector('[data-count]').textContent = `${state.selected.length}개`;
    renderEditor(state);
    renderLibraries(panel, {
        settings: globalSettings, context, state: currentState, render, chatKey,
        button, changeChat, confirm: confirmAction, compose: state => composePrompt(true, state),
    });
    panel.querySelector('[data-preview-box]').hidden = !prompt;
    panel.querySelector('[data-preview]').textContent = prompt;
    const status = panel.querySelector('[data-status]');
    status.textContent = problem || (!available ? '기존 채팅을 열면 세계관을 설정할 수 있어요.' : '');
    status.hidden = !status.textContent;
}

function createPanel() {
    const el = document.createElement('section');
    el.id = 'apocalypse-au';
    el.setAttribute('aria-label', '멸망 확장팩');
    // Static markup only. User-authored text is rendered with textContent.
    el.innerHTML = `
      <header class="au-header"><div class="au-emblem" aria-hidden="true">☢</div><div><h2>멸망 확장팩</h2></div><span class="au-edition">세계관 설정</span></header>
      <div class="au-power-row"><div><h3 id="au-power-label">확장 활성화</h3></div><button type="button" class="au-switch" role="switch" aria-labelledby="au-power-label" aria-checked="false" data-enabled><span data-switch-state>OFF</span><span class="au-switch-track" aria-hidden="true"></span></button></div>
      <p data-status class="au-notice" role="status" hidden></p>
      <fieldset data-chat><legend class="au-sr-only">채팅별 세계관 설정</legend>
      <section class="au-section"><div class="au-section-heading"><h3>아포칼립스 유형</h3><span>여러 개 선택 가능</span></div><div data-categories class="au-categories" aria-label="유형 탐색"></div><div id="au-subtypes" data-scenarios class="au-subtypes" aria-label="세부 재난" hidden></div></section>
      <section class="au-section"><div class="au-section-heading"><h3>선택한 세계관</h3><span data-count>0개</span></div><ul data-selected class="au-selected"></ul><p data-empty class="au-empty">아직 고른 재난이 없어요.</p></section>
      <section id="au-editor" data-editor class="au-editor" hidden></section>
      <div class="au-post-row"><div><h3 id="au-post-label">포스트 아포칼립스</h3><p>멸망 이후의 삶</p></div><button type="button" class="au-switch" role="switch" aria-labelledby="au-post-label" aria-checked="false" data-post><span data-switch-state>OFF</span><span class="au-switch-track" aria-hidden="true"></span></button></div>
      </fieldset>
      <section class="au-section au-library-section"><div class="au-section-heading"><h3><button type="button" class="au-library-toggle" data-library-toggle aria-expanded="false" aria-controls="au-library-body">보관함</button></h3><span data-library-count></span></div><div id="au-library-body" data-library hidden></div></section>
      <details data-preview-box class="au-preview" hidden><summary>세계관 프롬프트 보기</summary><pre data-preview></pre></details>
      <footer class="au-footer"><span aria-hidden="true">↻</span> 변경 즉시 반영 · 채팅별 자동 저장</footer>`;
    el.querySelector('[data-enabled]').addEventListener('click', () => {
        try {
            globalSettings().enabled = globalSettings().enabled !== true;
            context().saveSettingsDebounced();
            render();
        } catch (error) { report(error); }
    });
    el.querySelector('[data-post]').addEventListener('click', () => {
        changeChat(v => { v.postApocalypse = !v.postApocalypse; }).catch(report);
    });
    el.querySelector('[data-library-toggle]').addEventListener('click', event => {
        const body = el.querySelector('[data-library]');
        body.hidden = !body.hidden;
        event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
    });
    return el;
}

async function openPanel() {
    if (opening) return;
    opening = true;
    category = null;
    editorId = null;
    panel = createPanel();
    try {
        render();
        const ctx = context();
        const popup = new ctx.Popup(panel, ctx.POPUP_TYPE.TEXT, '', {
            okButton: '닫기', allowVerticalScrolling: true,
            onClosing: async () => { await Promise.allSettled([...pendingSaves]); return true; },
        });
        popup.dlg.classList.add('apocalypse-au-dialog');
        await popup.show();
    } catch (error) { report(error); }
    finally { panel = null; opening = false; }
}

function mountMenu() {
    const host = document.querySelector('#extensionsMenu');
    if (!host || menu) return;
    menu = document.createElement('div');
    menu.id = 'apocalypse-au-menu';
    menu.className = 'list-group-item flex-container flexGap5';
    menu.setAttribute('role', 'button');
    menu.setAttribute('tabindex', '0');
    menu.setAttribute('aria-haspopup', 'dialog');
    menu.innerHTML = '<span class="fa-solid fa-radiation extensionsMenuExtensionButton" aria-hidden="true"></span><span>멸망 확장팩</span><span data-menu-state class="au-menu-badge">OFF</span>';
    menu.addEventListener('click', openPanel);
    menu.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPanel(); }
    });
    host.append(menu);
    renderMenu();
}

function start() {
    const ctx = context();
    mountMenu();
    // The wand menu can be created after extension scripts are loaded.
    if (!menu) {
        const observer = new MutationObserver(() => { mountMenu(); if (menu) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
        context().setExtensionPrompt(PROMPT_ID, '', 0, 0, false, 0);
        category = null;
        editorId = null;
        try { problem = ''; render(); } catch (error) { report(error); }
    });
    try { render(); } catch (error) { report(error); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();


