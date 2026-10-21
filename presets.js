import { scenarios } from './defaults.js';
import { migrateWorldState } from './core.js';

export function presetName(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('이름을 입력해주세요.');
    if (value.trim().length > 120) throw new Error('이름은 120자 이내로 입력해주세요.');
    return value.trim();
}

export function combinationSnapshot(value) {
    const state = migrateWorldState(value);
    for (const s of scenarios.filter(s => state.selected.includes(s.id))) state.overrides[s.id] ??= s.prompt;
    return state;
}

function migrateLibrary(old) {
    if (!Array.isArray(old.prompts) || !Array.isArray(old.combinations)) throw new Error('이전 보관함이 손상되었습니다. 기존 데이터는 유지됩니다.');
    const entries = [];
    const seenIds = new Set();
    const names = new Set();
    const add = (entry, type) => {
        if (!entry || typeof entry.id !== 'string' || !entry.id || seenIds.has(entry.id)) throw new Error('이전 보관함의 식별자가 손상되었습니다.');
        seenIds.add(entry.id);
        let state;
        if (type === 'prompt') {
            if (!scenarios.some(s => s.id === entry.scenarioId) || typeof entry.prompt !== 'string') throw new Error('이전 프롬프트를 읽을 수 없습니다.');
            state = combinationSnapshot({ selected: [entry.scenarioId], overrides: { [entry.scenarioId]: entry.prompt } });
        } else {
            if (!entry.state || typeof entry.state !== 'object') throw new Error('이전 조합을 읽을 수 없습니다.');
            state = combinationSnapshot(entry.state);
        }
        const originalName = presetName(entry.name);
        let name = originalName;
        let suffix = 2;
        while (names.has(name)) { const tail = ` (${suffix++})`; name = originalName.slice(0, 120 - tail.length) + tail; }
        names.add(name);
        entries.push({ id: `legacy-${type}-${entry.id}`, name, state });
    };
    old.combinations.forEach(e => add(e, 'world'));
    old.prompts.forEach(e => add(e, 'prompt'));
    // Retain an exact archival copy; migration never erases the old libraries.
    return { schemaVersion: 2, entries, legacyV1: JSON.parse(JSON.stringify(old)) };
}

export function readLibrary(value) {
    if (value === undefined) return { schemaVersion: 2, entries: [] };
    if (value?.schemaVersion === 1) return migrateLibrary(value);
    if (!value || value.schemaVersion !== 2 || !Array.isArray(value.entries)) throw new Error('보관함을 읽을 수 없습니다. 기존 데이터는 유지됩니다.');
    const used = new Set();
    return {
        ...value,
        entries: value.entries.map(entry => {
            if (!entry || typeof entry.id !== 'string' || !entry.id || used.has(entry.id) || !entry.state || typeof entry.state !== 'object') throw new Error('보관함 데이터가 손상되었습니다.');
            used.add(entry.id);
            return { ...entry, name: presetName(entry.name), state: migrateWorldState(entry.state) };
        }),
    };
}

export function mutateLibrary(source, operation, entry) {
    const lib = readLibrary(source);
    const index = lib.entries.findIndex(p => p.id === entry.id);
    if (operation !== 'create' && index < 0) throw new Error('저장된 세계관이 없습니다.');
    if (operation === 'delete') { lib.entries.splice(index, 1); return lib; }
    const candidate = operation === 'rename' ? { ...lib.entries[index], name: presetName(entry.name) } : { ...entry, name: presetName(entry.name) };
    if (lib.entries.some(p => p.id !== candidate.id && p.name === candidate.name)) throw new Error('같은 이름이 있습니다. 다른 이름을 입력해주세요.');
    if (operation === 'create') {
        if (index >= 0) throw new Error('중복 식별자입니다.');
        lib.entries.push(candidate);
    } else if (operation === 'update' || operation === 'rename') lib.entries[index] = candidate;
    else throw new Error('알 수 없는 작업입니다.');
    return readLibrary(lib);
}
