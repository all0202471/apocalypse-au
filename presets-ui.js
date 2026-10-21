import { scenarios } from './defaults.js';
import { combinationSnapshot, mutateLibrary, readLibrary } from './presets.js';
let draftName = '';
let selectedId = '';
let renaming = false;
let renameDraft = '';

export function renderLibraries(panel, api) {
    const host = panel.querySelector('[data-library]');
    const lib = readLibrary(api.settings().library);
    host.replaceChildren();
    panel.querySelector('[data-library-count]').textContent = `${lib.entries.length}개`;
    const available = Boolean(api.context().chatId && api.context().chatMetadata);
    if (!lib.entries.some(p => p.id === selectedId)) { selectedId = ''; renaming = false; }
    const entry = lib.entries.find(p => p.id === selectedId);
    const write = (operation, value) => {
        const next = mutateLibrary(api.settings().library, operation, value);
        if (operation === 'create') { draftName = ''; selectedId = value.id; }
        renaming = false;
        api.settings().library = next;
        api.context().saveSettingsDebounced(); api.render();
    };
    const fresh = () => {
        const current = readLibrary(api.settings().library).entries.find(p => p.id === entry?.id);
        if (!entry || JSON.stringify(current) !== JSON.stringify(entry)) throw new Error('저장된 내용이 변경되었습니다. 다시 선택해주세요.');
    };
    const btn = (text, action, disabled = false) => {
        const el = api.button(text, action); el.removeAttribute('aria-pressed'); el.disabled = disabled; return el;
    };
    const save = document.createElement('div'); save.className = 'au-world-save';
    const name = document.createElement('input');
    name.type = 'text'; name.className = 'au-library-name'; name.maxLength = 120;
    name.placeholder = '세계관 이름'; name.setAttribute('aria-label', '세계관 이름'); name.value = draftName;
    name.addEventListener('input', () => { draftName = name.value; });
    const create = btn('현재 세계관 저장', () => {
        const id = globalThis.crypto?.randomUUID?.() ?? `world-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        write('create', { id, name: name.value, state: combinationSnapshot(api.state()) });
    }, !available);
    save.append(name, create); host.append(save);
    const picker = document.createElement('select'); picker.className = 'au-library-select'; picker.setAttribute('aria-label', '저장된 세계관');
    const option = (value, text) => { const el = document.createElement('option'); el.value = value; el.textContent = text; return el; };
    picker.append(option('', lib.entries.length ? '저장된 세계관 선택' : '저장된 세계관 없음'), ...lib.entries.map(p => option(p.id, p.name)));
    picker.value = selectedId;
    picker.addEventListener('change', () => { selectedId = picker.value; renaming = false; api.render(); });
    host.append(picker);
    const subtitle = document.createElement('p'); subtitle.className = 'au-world-description';
    subtitle.textContent = entry ? scenarios.filter(s => entry.state.selected.includes(s.id)).map(s => s.label).join(' · ') || '재난 미선택' : '';
    if (entry?.state.postApocalypse) subtitle.textContent += ' · 포스트';
    subtitle.hidden = !entry; host.append(subtitle);
    const toolbar = document.createElement('div'); toolbar.className = 'au-world-toolbar';
    const load = btn('불러오기', async () => {
        if (!entry) return;
        const key = api.chatKey(); const before = api.state();
        const hasChanges = before.selected.length || before.postApocalypse || Object.keys(before.overrides).length || before.instructions;
        if (hasChanges && JSON.stringify(combinationSnapshot(before)) !== JSON.stringify(entry.state)) {
            if (!await api.confirm('세계관 불러오기', '현재 채팅의 세계관을 저장된 내용으로 바꿀까요?', '불러오기')) return;
        }
        if (api.chatKey() !== key || JSON.stringify(api.state()) !== JSON.stringify(before)) return;
        fresh(); await api.changeChat(state => Object.assign(state, combinationSnapshot(entry.state)));
    }, !available || !entry);
    const rename = btn('이름 변경', () => { renaming = !renaming; renameDraft = entry.name; api.render(); }, !entry);
    const update = btn('덮어쓰기', async () => {
        const key = api.chatKey(); const snapshot = combinationSnapshot(api.state());
        if (!await api.confirm('저장 내용 덮어쓰기', '현재 채팅의 세계관으로 저장 내용을 바꿀까요?', '덮어쓰기')) return;
        if (api.chatKey() !== key) return;
        fresh(); write('update', { ...entry, state: snapshot });
    }, !available || !entry);
    const remove = btn('삭제', async () => {
        if (!await api.confirm('세계관 삭제', '보관함에서 삭제할까요? 이미 불러온 채팅은 유지됩니다.', '삭제')) return;
        fresh(); write('delete', { id: entry.id });
    }, !entry);
    toolbar.append(load, rename, update, remove); host.append(toolbar);
    if (renaming && entry) {
        const row = document.createElement('div'); row.className = 'au-rename-row';
        const input = document.createElement('input'); input.type = 'text'; input.maxLength = 120; input.className = 'au-library-name'; input.value = renameDraft; input.setAttribute('aria-label', '새 이름');
        input.addEventListener('input', () => { renameDraft = input.value; });
        const commit = btn('변경', () => { fresh(); write('rename', { id: entry.id, name: input.value }); });
        row.append(input, commit); host.append(row);
    }
}
