import { scenarios, guidance, postGuidance } from './defaults.js';

export const NAMESPACE = 'apocalypse_au';
export const PROMPT_ID = 'apocalypse_au.world';

export function normalizeState(value) {
    const raw = value && typeof value === 'object' ? value : {};
    if (Number(raw.schemaVersion) > 1) throw new Error('더 새로운 버전의 채팅 데이터입니다. 확장팩을 업데이트하세요.');
    return {
        schemaVersion: 1,
        selected: scenarios.filter(s => Array.isArray(raw.selected) && raw.selected.includes(s.id)).map(s => s.id),
        postApocalypse: raw.postApocalypse === true,
        overrides: Object.fromEntries(scenarios.filter(s => Object.hasOwn(raw.overrides ?? {}, s.id) && typeof raw.overrides[s.id] === 'string').map(s => [s.id, raw.overrides[s.id]])),
        instructions: typeof raw.instructions === 'string' ? raw.instructions : '',
    };
}

export function composePrompt(enabled, value) {
    if (!enabled) return '';
    const state = normalizeState(value);
    const selected = scenarios.filter(s => state.selected.includes(s.id));
    if (!selected.length) return '';
    const parts = ['[Apocalypse World Setting]', selected.map((s, i) => `${i + 1}. ${s.title}\n${state.overrides[s.id] ?? s.prompt}`).join('\n\n')];
    if (state.postApocalypse) parts.push('[Post-Apocalypse]', postGuidance);
    if (state.instructions.trim()) parts.push('[Additional World Instructions]', state.instructions);
    parts.push('[General Narrative Guidance]', guidance);
    return parts.join('\n\n');
}

export function migrateWorldState(value) {
    const state = normalizeState(value);
    if (state.instructions.trim() && state.selected.length) {
        const first = scenarios.find(s => s.id === state.selected[0]);
        state.overrides[first.id] = `${state.overrides[first.id] ?? first.prompt}\n\nAdditional background:\n${state.instructions}`;
        state.instructions = '';
    }
    return state;
}

