export const categories = [
    { id: 'infection', label: '감염' },
    { id: 'civilization', label: '문명' },
    { id: 'nature', label: '자연' },
];

export const scenarios = [
    ['zombie', 'infection', '좀비', 'Zombie Apocalypse', 'Zombies or infected individuals have emerged, posing a severe threat to human society. Their origin, behavior, transmission methods, and the extent of societal collapse remain open to the narrative context.'],
    ['pandemic', 'infection', '팬데믹', 'Pandemic', 'A devastating infectious disease threatens human civilization and disrupts society. Its origin, symptoms, transmission, and social consequences remain flexible according to the narrative.'],
    ['parasite', 'infection', '기생충', 'Parasite Apocalypse', 'Parasitic organisms threaten humanity, potentially altering or controlling their hosts. Their origin, biological characteristics, and effects on civilization are determined by the narrative context.'],
    ['nuclear', 'civilization', '핵전쟁', 'Nuclear War', 'Large-scale nuclear warfare has brought devastation to human civilization. The extent of destruction, environmental consequences, and surviving societies remain open to the narrative.'],
    ['war', 'civilization', '세계대전', 'World War', 'A catastrophic global conflict threatens the stability and survival of civilization. The participants, causes, progression, and consequences of the war are determined by the narrative context.'],
    ['emp', 'civilization', 'EMP', 'EMP Apocalypse', 'A widespread electromagnetic disruption has severely affected electrical systems, communications, and technological infrastructure. Its origin, scale, and long-term consequences remain open to the narrative.'],
    ['ai', 'civilization', 'AI 반란', 'AI Rebellion', 'Artificial intelligence or autonomous machines have turned against human control, threatening the existing civilization. Their motivations, capabilities, and relationship with humanity remain flexible.'],
    ['ice', 'nature', '빙하기', 'Ice Age', 'Earth is experiencing extreme global cooling, creating increasingly hostile conditions for human civilization and ecosystems. The cause, severity, and progression of the cooling remain open to the narrative.'],
    ['heat', 'nature', '폭염', 'Extreme Heat', 'Extreme temperatures threaten human survival, ecosystems, and modern civilization. The causes, affected regions, and progression of the catastrophe remain flexible.'],
    ['flood', 'nature', '대홍수', 'Great Flood', 'Massive flooding threatens human settlements and civilization across affected regions. The causes, scale, and resulting environmental changes are determined by the narrative.'],
    ['drought', 'nature', '가뭄', 'Drought', 'Severe drought and water scarcity threaten ecosystems, agriculture, and human civilization. The causes, duration, and social consequences remain open to the narrative.'],
].map(([id, category, label, title, prompt]) => Object.freeze({ id, category, label, title, prompt }));

export const guidance = 'Every listed world condition applies together to the same story. These are coexisting conditions, not alternatives: do not choose only one or ignore the others. Preserve established character personalities, relationships, and relevant conversation context where possible. Honor any explicit world-building instructions from the user. Where the user and conversation leave details open, develop plausible causes, chronology, connections between disasters, and background details that fit the narrative. Keep newly established details consistent as the story develops. Integrate the conditions naturally through the story without unnecessary exposition.';
export const postGuidance = 'When post-apocalypse mode is enabled, focus on life after major societal collapse. Survivors have had time to adapt to the changed environment to some degree. Do not impose a fixed number of years. Determine the elapsed time and level of adaptation naturally from the selected disasters and narrative context. Ongoing threats may still exist.';

