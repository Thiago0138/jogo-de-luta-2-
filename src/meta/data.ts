// ─────────────────────────────────────────────────────────────────────────────
//  Ringue de Lendas — static game data: rarities, stats, cosmetics, abilities,
//  consumables, chests, missions and challenges. Pure data, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario' | 'mitico' | 'cosmico';

export interface RarityDef {
  id: Rarity;
  name: string;
  color: string;
  glow: string;
  hex: number;
  tier: number;
  /** maximum mint number shown on serials (#12 / 500) */
  mint: number;
  /** coins received when recycling a duplicate */
  recycle: number;
}

export const RARITIES: RarityDef[] = [
  { id: 'comum', name: 'Comum', color: '#b9c3d0', glow: 'rgba(185,195,208,.35)', hex: 0xb9c3d0, tier: 0, mint: 99999, recycle: 15 },
  { id: 'incomum', name: 'Incomum', color: '#4ade80', glow: 'rgba(74,222,128,.45)', hex: 0x4ade80, tier: 1, mint: 25000, recycle: 40 },
  { id: 'raro', name: 'Raro', color: '#38bdf8', glow: 'rgba(56,189,248,.5)', hex: 0x38bdf8, tier: 2, mint: 10000, recycle: 100 },
  { id: 'epico', name: 'Épico', color: '#b65cff', glow: 'rgba(182,92,255,.55)', hex: 0xb65cff, tier: 3, mint: 2500, recycle: 260 },
  { id: 'lendario', name: 'Lendário', color: '#ffb020', glow: 'rgba(255,176,32,.6)', hex: 0xffb020, tier: 4, mint: 1000, recycle: 700 },
  { id: 'mitico', name: 'Mítico', color: '#ff3b5c', glow: 'rgba(255,59,92,.65)', hex: 0xff3b5c, tier: 5, mint: 250, recycle: 1800 },
  { id: 'cosmico', name: 'Cósmico', color: '#7df9ff', glow: 'rgba(160,120,255,.75)', hex: 0x9d7bff, tier: 6, mint: 50, recycle: 5000 },
];
export const RARITY: Record<Rarity, RarityDef> = Object.fromEntries(RARITIES.map((r) => [r.id, r])) as Record<Rarity, RarityDef>;

// ── Stats ────────────────────────────────────────────────────────────────────
export type StatKey = 'str' | 'tec' | 'spd' | 'agi' | 'def' | 'vit' | 'sta' | 'crt' | 'cha' | 'res';
export interface StatDef { key: StatKey; name: string; short: string; desc: string; icon: string; color: string }
export const STATS: StatDef[] = [
  { key: 'str', name: 'Força', short: 'FOR', desc: 'Dano dos socos, pontapés e golpes de impacto.', icon: 'fist', color: '#ff5d5d' },
  { key: 'tec', name: 'Técnica', short: 'TEC', desc: 'Dano e sucesso de agarrões, suplexes e projeções.', icon: 'grab', color: '#ff9f43' },
  { key: 'spd', name: 'Velocidade', short: 'VEL', desc: 'Ritmo de ataque e deslocação no ringue.', icon: 'bolt', color: '#ffd23f' },
  { key: 'agi', name: 'Esquiva', short: 'ESQ', desc: 'Probabilidade de desviar de ataques.', icon: 'wind', color: '#4ade80' },
  { key: 'def', name: 'Defesa', short: 'DEF', desc: 'Probabilidade de bloquear e redução de dano.', icon: 'shield', color: '#38bdf8' },
  { key: 'vit', name: 'Vitalidade', short: 'VIT', desc: 'Pontos de vida máximos.', icon: 'heart', color: '#ff4d8d' },
  { key: 'sta', name: 'Fôlego', short: 'FOL', desc: 'Resistência ao cansaço e recuperação de energia.', icon: 'lungs', color: '#2dd4bf' },
  { key: 'crt', name: 'Crítico', short: 'CRT', desc: 'Probabilidade de golpes críticos devastadores.', icon: 'target', color: '#f472b6' },
  { key: 'cha', name: 'Carisma', short: 'CAR', desc: 'Enche a barra de Super mais depressa. O público adora-te.', icon: 'star', color: '#c084fc' },
  { key: 'res', name: 'Resiliência', short: 'RES', desc: 'Levanta-te mais depressa e escapa às contagens.', icon: 'phoenix', color: '#fb923c' },
];
export const STAT_BASE = 10;
export const STAT_POINTS_PER_LEVEL = 3;
export const MAX_LEVEL = 60;
export const xpToNext = (lvl: number) => Math.round(70 * Math.pow(lvl, 1.42) + 50);
export const maxHpFor = (lvl: number, vit: number) => Math.round(150 + (lvl - 1) * 9 + vit * 4);

// ── Appearance ───────────────────────────────────────────────────────────────
export const SKIN_TONES = [0xffe0c4, 0xf6c9a0, 0xe8b088, 0xd29a6c, 0xb87a50, 0x96603c, 0x6e4428, 0x4a2c1a, 0xa7d8a2, 0x9ec3ff];
export const HAIR_COLORS = [0x1c1410, 0x3b2416, 0x6b3e1f, 0xa8642c, 0xe0b25a, 0xf4e3b0, 0xd8d8e0, 0xc2272d, 0xff4fa3, 0x3f7cff, 0x26c281, 0x8b5cf6];
export const EYE_COLORS = [0x3a2414, 0x6b4423, 0x2f6fd8, 0x2fa86a, 0x8c8c99, 0xd8a017, 0xc0283c, 0x8b5cf6];
export const EYE_STYLES = ['Redondos', 'Determinados', 'Sonolentos', 'Grandes', 'Furiosos', 'Felizes'];
export const BROW_STYLES = ['Normais', 'Grossas', 'Zangadas', 'Finas', 'Arqueadas', 'Monocelha'];
export const MOUTH_STYLES = ['Sorriso', 'Sério', 'Grito', 'Dentes', 'Malandro', 'Boquinha'];
export const BEARD_STYLES = ['Nenhuma', 'Bigode', 'Pera', 'Barba Curta', 'Barba Viking', 'Costeletas'];
export const BUILDS = ['Esguio', 'Atlético', 'Robusto'];

export interface HairStyleDef { id: string; name: string; premium?: string }
export const BASE_HAIR: HairStyleDef[] = [
  { id: 'careca', name: 'Careca' },
  { id: 'rapado', name: 'Rapado' },
  { id: 'curto', name: 'Curto' },
  { id: 'espetado', name: 'Espetado' },
  { id: 'moicano', name: 'Moicano' },
  { id: 'afro', name: 'Afro' },
  { id: 'rabo', name: 'Rabo-de-cavalo' },
  { id: 'comprido', name: 'Comprido' },
  { id: 'franja', name: 'Franja' },
];

export interface Appearance {
  name: string;
  skinTone: number;
  height: number; // 0.94 – 1.06, purely cosmetic
  build: number; // 0..2
  eyes: number;
  eyeColor: number;
  brows: number;
  mouth: number;
  beard: number;
  hair: string; // base style id or premium hair item id
  hairColor: number;
  skin: string; // outfit item id
}

// ── Items ────────────────────────────────────────────────────────────────────
export type ItemKind = 'skin' | 'hair' | 'special' | 'super' | 'passive';
export type Pattern = 'plain' | 'stripes' | 'flames' | 'stars' | 'camo' | 'checker' | 'bolt' | 'scales' | 'galaxy' | 'tiger' | 'split';
export type Top = 'none' | 'singlet' | 'jacket' | 'gi';
export type Mask = 'none' | 'luchador' | 'half' | 'visor' | 'demon';

export interface SkinLook {
  primary: number;
  secondary: number;
  accent: number;
  top: Top;
  pattern: Pattern;
  mask?: Mask;
  gloves: number;
  boots: number;
  /** particle aura color, 'rainbow' cycles hue */
  aura?: number | 'rainbow';
  /** emissive glow added to accent parts */
  glow?: number;
}

export interface HairLook {
  base: string; // geometry style to build
  color?: number; // forced color
  glow?: number;
  fx?: 'fire' | 'ice' | 'spark' | 'galaxy' | 'crystal';
  crown?: boolean;
}

export type Source = 'starter' | 'chest' | 'shop' | 'level' | 'mission' | 'challenge' | 'premium';

export interface ItemDef {
  id: string;
  kind: ItemKind;
  name: string;
  rarity: Rarity;
  desc: string;
  source: Source[];
  price?: { coins?: number; gems?: number };
  look?: SkinLook;
  hair?: HairLook;
  /** fight move id for specials & supers */
  move?: string;
  /** meter cost for specials */
  cost?: number;
  passive?: { key: PassiveKey; value: number };
  tradable?: boolean;
}

export type PassiveKey = 'ironSkin' | 'secondWind' | 'counter' | 'showman' | 'vampire' | 'phoenix' | 'berserk' | 'quickRecovery' | 'critBoost' | 'tagMaster' | 'thorns';

const S = (id: string, name: string, rarity: Rarity, look: SkinLook, desc: string, source: Source[], price?: ItemDef['price']): ItemDef => ({
  id, kind: 'skin', name, rarity, look, desc, source, price, tradable: !source.includes('starter'),
});

export const SKINS: ItemDef[] = [
  // Comum
  S('sk_classico', 'Calções Clássicos', 'comum', { primary: 0xd62839, secondary: 0xffffff, accent: 0xffd23f, top: 'none', pattern: 'plain', gloves: 0xd62839, boots: 0x1d1d28 }, 'O visual de quem está a começar. Vermelho e branco, sem medo.', ['starter']),
  S('sk_azul', 'Azul Treino', 'comum', { primary: 0x2563eb, secondary: 0xe5e7eb, accent: 0x93c5fd, top: 'singlet', pattern: 'plain', gloves: 0x1e40af, boots: 0x111827 }, 'Equipamento de treino do ginásio do bairro.', ['starter', 'chest']),
  S('sk_verde', 'Verde Ginásio', 'comum', { primary: 0x16a34a, secondary: 0x0f172a, accent: 0xa3e635, top: 'none', pattern: 'plain', gloves: 0x15803d, boots: 0x0f172a }, 'Cheira a balneário e determinação.', ['chest', 'shop'], { coins: 300 }),
  S('sk_preto', 'Preto Básico', 'comum', { primary: 0x18181b, secondary: 0x3f3f46, accent: 0xe4e4e7, top: 'singlet', pattern: 'plain', gloves: 0x27272a, boots: 0x09090b }, 'Simples. Elegante. Ameaçador.', ['chest', 'shop'], { coins: 300 }),
  S('sk_rookie', 'Amarelo Rookie', 'comum', { primary: 0xfacc15, secondary: 0x1f2937, accent: 0xffffff, top: 'none', pattern: 'plain', gloves: 0xeab308, boots: 0x1f2937 }, 'Impossível não te verem no ringue.', ['chest', 'shop'], { coins: 300 }),
  // Incomum
  S('sk_riscas', 'Riscas Retro', 'incomum', { primary: 0xf97316, secondary: 0xfff7ed, accent: 0x0ea5e9, top: 'singlet', pattern: 'stripes', gloves: 0xf97316, boots: 0xfff7ed }, 'Diretamente dos anos 80, com bigode opcional.', ['chest', 'shop'], { coins: 700 }),
  S('sk_camo', 'Camuflado', 'incomum', { primary: 0x4d7c0f, secondary: 0x365314, accent: 0xa16207, top: 'singlet', pattern: 'camo', gloves: 0x3f6212, boots: 0x292524 }, 'Ninguém te vê chegar.', ['chest', 'shop'], { coins: 700 }),
  S('sk_xadrez', 'Xadrez de Rua', 'incomum', { primary: 0xe11d48, secondary: 0x111827, accent: 0xffffff, top: 'none', pattern: 'checker', gloves: 0x111827, boots: 0xe11d48 }, 'Estilo de quem cresceu a lutar no parque.', ['chest']),
  S('sk_ninja', 'Ninja da Noite', 'incomum', { primary: 0x1e1b4b, secondary: 0x312e81, accent: 0xef4444, top: 'gi', pattern: 'plain', mask: 'half', gloves: 0x0f0d2e, boots: 0x0f0d2e }, 'Silencioso até ao primeiro golpe.', ['chest']),
  S('sk_veterano', 'Veterano', 'incomum', { primary: 0x78350f, secondary: 0xfde68a, accent: 0xb45309, top: 'jacket', pattern: 'plain', gloves: 0x78350f, boots: 0x451a03 }, 'Para quem cumpriu missões semanais com honra.', ['mission']),
  // Raro
  S('sk_luchador', 'Luchador Dourado', 'raro', { primary: 0x0ea5e9, secondary: 0xffd23f, accent: 0xffffff, top: 'none', pattern: 'stars', mask: 'luchador', gloves: 0xffd23f, boots: 0x0ea5e9 }, 'Máscara sagrada. Nunca a tires no ringue.', ['chest', 'shop'], { coins: 1800 }),
  S('sk_tigre', 'Tigre Listrado', 'raro', { primary: 0xf59e0b, secondary: 0x1c1917, accent: 0xffffff, top: 'none', pattern: 'tiger', gloves: 0x1c1917, boots: 0xf59e0b }, 'Garras afiadas e rugido ainda mais.', ['chest', 'shop'], { coins: 1800 }),
  S('sk_neon', 'Neon Miami', 'raro', { primary: 0xff2e88, secondary: 0x22d3ee, accent: 0xfef08a, top: 'singlet', pattern: 'split', gloves: 0x22d3ee, boots: 0xff2e88, glow: 0xff2e88 }, 'Palmeiras, pôr do sol e suplexes.', ['chest']),
  S('sk_marinheiro', 'Lobo do Mar', 'raro', { primary: 0x1e3a8a, secondary: 0xffffff, accent: 0xdc2626, top: 'singlet', pattern: 'stripes', gloves: 0xffffff, boots: 0x1e3a8a }, 'Enfrentou tempestades piores que tu.', ['chest']),
  S('sk_karateca', 'Faixa Preta', 'raro', { primary: 0xf8fafc, secondary: 0x0a0a0a, accent: 0xdc2626, top: 'gi', pattern: 'plain', gloves: 0xdc2626, boots: 0xf8fafc }, 'Disciplina, respeito e uma joelhada voadora.', ['level']),
  // Épico
  S('sk_chamas', 'Chamas Infernais', 'epico', { primary: 0x111111, secondary: 0xff5a1f, accent: 0xffd23f, top: 'none', pattern: 'flames', gloves: 0xff5a1f, boots: 0x111111, glow: 0xff5a1f }, 'Os calções literalmente aquecem o ringue.', ['chest', 'shop'], { gems: 220 }),
  S('sk_cromado', 'Cavaleiro Cromado', 'epico', { primary: 0xcbd5e1, secondary: 0x475569, accent: 0x38bdf8, top: 'jacket', pattern: 'plain', mask: 'visor', gloves: 0x94a3b8, boots: 0x334155, glow: 0x38bdf8 }, 'Armadura polida para duelos de honra.', ['chest']),
  S('sk_samurai', 'Samurai Escarlate', 'epico', { primary: 0xb91c1c, secondary: 0x111827, accent: 0xfbbf24, top: 'gi', pattern: 'scales', gloves: 0x111827, boots: 0xb91c1c }, 'Mil anos de tradição num só golpe.', ['chest', 'shop'], { gems: 220 }),
  S('sk_toxic', 'Tóxico', 'epico', { primary: 0x84cc16, secondary: 0x1a2e05, accent: 0xd9f99d, top: 'singlet', pattern: 'bolt', mask: 'half', gloves: 0x1a2e05, boots: 0x84cc16, glow: 0xa3e635 }, 'Radioativo. Não toques.', ['chest']),
  S('sk_pirata', 'Pirata Fantasma', 'epico', { primary: 0x0f766e, secondary: 0x134e4a, accent: 0x5eead4, top: 'jacket', pattern: 'plain', gloves: 0x134e4a, boots: 0x042f2e, aura: 0x5eead4 }, 'Morreu no mar. Voltou para o ringue.', ['chest']),
  // Lendário
  S('sk_campeao', 'Campeão Dourado', 'lendario', { primary: 0xffd23f, secondary: 0xffffff, accent: 0xb45309, top: 'none', pattern: 'stars', gloves: 0xffd23f, boots: 0xffffff, aura: 0xffd23f, glow: 0xffb020 }, 'Ouro da cabeça aos pés. Só para campeões.', ['chest', 'shop'], { gems: 650 }),
  S('sk_tempestade', 'Tempestade', 'lendario', { primary: 0x1e293b, secondary: 0x38bdf8, accent: 0xe0f2fe, top: 'singlet', pattern: 'bolt', gloves: 0x38bdf8, boots: 0x1e293b, aura: 0x7dd3fc, glow: 0x38bdf8 }, 'Cada passo é um trovão.', ['chest']),
  S('sk_dragao', 'Dragão de Jade', 'lendario', { primary: 0x047857, secondary: 0xfbbf24, accent: 0x6ee7b7, top: 'gi', pattern: 'scales', gloves: 0xfbbf24, boots: 0x064e3b, aura: 0x34d399, glow: 0x10b981 }, 'Escamas mais duras que aço.', ['chest']),
  S('sk_reitag', 'Rei da Tag', 'lendario', { primary: 0x7c3aed, secondary: 0xfacc15, accent: 0xffffff, top: 'jacket', pattern: 'split', gloves: 0xfacc15, boots: 0x7c3aed, aura: 0xfacc15 }, 'Desafio Lendário: vence 25 lutas de Tag Team.', ['challenge']),
  S('sk_colosso', 'Colosso', 'lendario', { primary: 0x57534e, secondary: 0xd6d3d1, accent: 0xf97316, top: 'none', pattern: 'camo', mask: 'demon', gloves: 0x292524, boots: 0x1c1917, aura: 0xf97316, glow: 0xf97316 }, 'Desafio Lendário: derrota O Colosso.', ['challenge']),
  // Mítico
  S('sk_fenix', 'Fénix Imortal', 'mitico', { primary: 0xdc2626, secondary: 0xfb923c, accent: 0xfef08a, top: 'none', pattern: 'flames', gloves: 0xfb923c, boots: 0x7f1d1d, aura: 0xff7b1f, glow: 0xff5a1f }, 'Renasce das cinzas a cada round.', ['chest', 'challenge']),
  S('sk_abismo', 'Abismo', 'mitico', { primary: 0x0b0418, secondary: 0x6d28d9, accent: 0xc084fc, top: 'jacket', pattern: 'galaxy', mask: 'visor', gloves: 0x2e1065, boots: 0x0b0418, aura: 0xa855f7, glow: 0x9333ea }, 'Desafio Lendário: 50 vitórias por K.O.', ['chest', 'challenge']),
  S('sk_gelo', 'Titã de Gelo', 'mitico', { primary: 0xe0f2fe, secondary: 0x0284c7, accent: 0x7dd3fc, top: 'gi', pattern: 'scales', gloves: 0xbae6fd, boots: 0x0c4a6e, aura: 0xbae6fd, glow: 0x7dd3fc }, 'O ar congela à volta dele.', ['chest']),
  S('sk_invicto', 'Invicto', 'mitico', { primary: 0x0a0a0a, secondary: 0xffd23f, accent: 0xff3b5c, top: 'jacket', pattern: 'stars', gloves: 0xff3b5c, boots: 0x0a0a0a, aura: 0xff3b5c, glow: 0xff3b5c }, 'Desafio Lendário: 10 vitórias seguidas.', ['challenge']),
  // Cósmico
  S('sk_nebulosa', 'Nebulosa', 'cosmico', { primary: 0x1e1b4b, secondary: 0xec4899, accent: 0x67e8f9, top: 'none', pattern: 'galaxy', gloves: 0xa855f7, boots: 0x1e1b4b, aura: 'rainbow', glow: 0xa855f7 }, 'Feito de poeira de estrelas. Existem apenas 50.', ['chest']),
  S('sk_deus', 'Deus do Ringue', 'cosmico', { primary: 0xffffff, secondary: 0xffd23f, accent: 0x7df9ff, top: 'jacket', pattern: 'galaxy', mask: 'visor', gloves: 0xffd23f, boots: 0xffffff, aura: 'rainbow', glow: 0xffe08a }, 'Desafio Lendário: derrota o Titã Cósmico.', ['challenge']),
];

const H = (id: string, name: string, rarity: Rarity, hair: HairLook, desc: string, source: Source[], price?: ItemDef['price']): ItemDef => ({
  id, kind: 'hair', name, rarity, hair, desc, source, price, tradable: true,
});

export const HAIRS: ItemDef[] = [
  H('h_dreads', 'Dreads', 'incomum', { base: 'dreads' }, 'Rastas pesadas que voam a cada golpe.', ['chest', 'shop'], { coins: 900 }),
  H('h_coque', 'Coque Samurai', 'raro', { base: 'coque' }, 'Prático e intimidante.', ['chest', 'shop'], { coins: 1600 }),
  H('h_topete', 'Topete Rock', 'raro', { base: 'topete' }, 'Duas latas de laca por luta.', ['chest', 'shop'], { coins: 1600 }),
  H('h_neon', 'Moicano Neon', 'epico', { base: 'moicano', glow: 0xff2e88, color: 0xff2e88 }, 'Brilha no escuro. Literalmente.', ['chest', 'shop'], { gems: 160 }),
  H('h_cristal', 'Cristal', 'epico', { base: 'cristal', color: 0x93c5fd, glow: 0x60a5fa, fx: 'crystal' }, 'Cabelo de cristal lapidado.', ['chest']),
  H('h_relampago', 'Relâmpago', 'lendario', { base: 'super', color: 0xffe14d, glow: 0xffd23f, fx: 'spark' }, 'Faíscas a cada movimento. Poder máximo.', ['chest', 'shop'], { gems: 480 }),
  H('h_fogo', 'Cabeça de Fogo', 'lendario', { base: 'chamas', color: 0xff6a00, glow: 0xff4500, fx: 'fire' }, 'Chamas vivas. Não uses capacete.', ['chest']),
  H('h_gelo', 'Coroa de Gelo', 'mitico', { base: 'cristal', color: 0xe0f7ff, glow: 0x7dd3fc, fx: 'ice', crown: true }, 'Desafio Lendário: derrota a Rainha Gélida.', ['challenge', 'chest']),
  H('h_coroa', 'Coroa Real', 'mitico', { base: 'comprido', crown: true }, 'Desafio Lendário: coleciona 30 itens diferentes.', ['challenge']),
  H('h_galaxia', 'Galáxia', 'cosmico', { base: 'chamas', color: 0x7c3aed, glow: 0xa78bfa, fx: 'galaxy' }, 'Um universo inteiro no teu couro cabeludo.', ['chest']),
];

const A = (id: string, kind: 'special' | 'super', name: string, rarity: Rarity, move: string, desc: string, source: Source[], cost = 50, price?: ItemDef['price']): ItemDef => ({
  id, kind, name, rarity, move, desc, source, cost, price, tradable: !source.includes('starter'),
});

export const SPECIALS: ItemDef[] = [
  A('sp_abraco', 'special', 'Abraço do Urso', 'comum', 'bearhug', 'Esmaga o adversário num abraço que tira o fôlego.', ['starter', 'chest'], 35),
  A('sp_chuva', 'special', 'Chuva de Socos', 'incomum', 'flurry', 'Uma rajada de oito socos em menos de dois segundos.', ['level', 'chest', 'shop'], 40, { coins: 1200 }),
  A('sp_joelhada', 'special', 'Joelhada Voadora', 'raro', 'flyingknee', 'Salta e acerta com o joelho em cheio no queixo.', ['level', 'chest', 'shop'], 45, { coins: 2400 }),
  A('sp_gancho', 'special', 'Gancho de Fogo', 'raro', 'fireupper', 'Um uppercut envolto em chamas que lança o adversário ao ar.', ['chest', 'shop'], 50, { coins: 2400 }),
  A('sp_tornado', 'special', 'Lariat Tornado', 'epico', 'tornado', 'Gira como um furacão com o braço estendido.', ['chest', 'level'], 55),
  A('sp_martelo', 'special', 'Martelo de Gelo', 'epico', 'icehammer', 'Golpe a duas mãos que congela e abranda o adversário.', ['chest'], 55),
  A('sp_sismico', 'special', 'Suplex Sísmico', 'lendario', 'quake', 'Suplex alemão que faz tremer a arena inteira.', ['chest'], 60),
  A('sp_relampago', 'special', 'Pontapé Relâmpago', 'lendario', 'boltkick', 'Teletransporta-se para trás do adversário e ataca.', ['chest'], 60),
  A('sp_fantasma', 'special', 'Lariat Fantasma', 'mitico', 'phantom', 'Investida com imagens fantasma impossível de ler.', ['chest'], 60),
  A('sp_atomica', 'special', 'Bomba Atómica', 'mitico', 'atomic', 'Powerbomb que termina numa explosão nuclear.', ['chest'], 65),
];

export const SUPERS: ItemDef[] = [
  A('su_bomba', 'super', 'Bomba Final', 'comum', 'sup_bomb', 'Powerbomb em cascata: o finisher clássico.', ['starter'], 100),
  A('su_gigante', 'super', 'Suplex Gigante', 'raro', 'sup_triple', 'Três suplexes seguidos, o último do alto.', ['chest', 'level', 'shop'], 100, { coins: 3500 }),
  A('su_trovao', 'super', 'Punho do Trovão', 'epico', 'sup_thunder', 'Carrega um relâmpago e desfere um soco que atravessa o ringue.', ['chest', 'shop'], 100, { gems: 300 }),
  A('su_meteoro', 'super', 'Meteoro', 'lendario', 'sup_meteor', 'Salta até às luzes e cai como um meteoro em chamas.', ['chest', 'level'], 100),
  A('su_dragao', 'super', 'Dragão Ascendente', 'mitico', 'sup_dragon', 'Uppercut em espiral que invoca um dragão de fogo.', ['chest'], 100),
  A('su_supernova', 'super', 'Supernova', 'cosmico', 'sup_nova', 'Levita, reúne energia cósmica e explode como uma estrela.', ['chest'], 100),
];

const P = (id: string, name: string, rarity: Rarity, key: PassiveKey, value: number, desc: string, source: Source[], price?: ItemDef['price']): ItemDef => ({
  id, kind: 'passive', name, rarity, passive: { key, value }, desc, source, price, tradable: true,
});

export const PASSIVES: ItemDef[] = [
  P('pa_ferro', 'Pele de Ferro', 'comum', 'ironSkin', 0.07, 'Recebe 7% menos dano.', ['chest', 'shop'], { coins: 600 }),
  P('pa_contra', 'Contra-Ataque', 'incomum', 'counter', 0.18, '+18% de hipótese de contra-atacar após esquivar ou bloquear.', ['chest', 'level']),
  P('pa_showman', 'Showman', 'incomum', 'showman', 0.3, 'A barra de Super enche 30% mais depressa.', ['chest', 'shop'], { coins: 1400 }),
  P('pa_rapido', 'Recuperação Rápida', 'raro', 'quickRecovery', 0.35, 'Levanta-se do tapete 35% mais depressa.', ['chest']),
  P('pa_folego', 'Segundo Fôlego', 'raro', 'secondWind', 0.2, 'Uma vez por luta, recupera 20% de vida ao ficar abaixo de 25%.', ['chest', 'level']),
  P('pa_olho', 'Olho de Águia', 'epico', 'critBoost', 0.1, '+10% de probabilidade de golpe crítico.', ['chest']),
  P('pa_espinhos', 'Espinhos', 'epico', 'thorns', 0.15, 'Devolve 15% do dano recebido ao atacante.', ['chest']),
  P('pa_berserk', 'Berserker', 'lendario', 'berserk', 0.35, 'Abaixo de 30% de vida, causa +35% de dano.', ['chest']),
  P('pa_tag', 'Mestre da Tag', 'lendario', 'tagMaster', 0.5, 'Em Tag Team, o parceiro recupera vida 50% mais depressa e entra com fúria.', ['chest', 'challenge']),
  P('pa_vampiro', 'Vampiro', 'mitico', 'vampire', 0.12, 'Recupera 12% do dano causado.', ['chest']),
  P('pa_fenix', 'Alma de Fénix', 'cosmico', 'phoenix', 0.35, 'Uma vez por luta, ao ser derrotado, renasce com 35% de vida.', ['chest']),
];

export const ITEMS: ItemDef[] = [...SKINS, ...HAIRS, ...SPECIALS, ...SUPERS, ...PASSIVES];
export const ITEM: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const KIND_LABEL: Record<ItemKind, string> = {
  skin: 'Skin', hair: 'Penteado', special: 'Golpe Especial', super: 'Super Ataque', passive: 'Passiva',
};

// ── Consumables (used automatically in fights) ──────────────────────────────
export type ConsumableEffect = 'heal' | 'meter' | 'rage' | 'shield' | 'elixir';
export interface ConsumableDef { id: string; name: string; rarity: Rarity; desc: string; effect: ConsumableEffect; value: number; color: string; price?: { coins?: number; gems?: number } }
export const CONSUMABLES: ConsumableDef[] = [
  { id: 'c_vida', name: 'Poção de Vida', rarity: 'comum', desc: 'Usada automaticamente abaixo de 35% de vida. Recupera 22% da vida.', effect: 'heal', value: 0.22, color: '#ff4d6d', price: { coins: 120 } },
  { id: 'c_energia', name: 'Bebida Energética', rarity: 'incomum', desc: 'Enche 50% da barra de Super quando a luta aperta.', effect: 'meter', value: 50, color: '#ffd23f', price: { coins: 220 } },
  { id: 'c_furia', name: 'Tónico da Fúria', rarity: 'raro', desc: '+30% de dano durante 12 segundos.', effect: 'rage', value: 0.3, color: '#ff7a1f', price: { coins: 420 } },
  { id: 'c_escudo', name: 'Escudo de Aço', rarity: 'epico', desc: 'Bloqueia por completo os próximos 3 golpes.', effect: 'shield', value: 3, color: '#38bdf8', price: { gems: 30 } },
  { id: 'c_elixir', name: 'Elixir Cósmico', rarity: 'lendario', desc: 'Recupera 45% de vida e enche a barra de Super.', effect: 'elixir', value: 0.45, color: '#c084fc', price: { gems: 80 } },
];
export const CONSUMABLE: Record<string, ConsumableDef> = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));

// ── Chests ───────────────────────────────────────────────────────────────────
export interface ChestDef {
  id: string;
  name: string;
  rarity: Rarity;
  colors: [number, number, number]; // body, trim, glow
  items: number;
  consumables: number;
  coins: [number, number];
  gems?: [number, number];
  weights: Partial<Record<Rarity, number>>;
  price?: { coins?: number; gems?: number };
  desc: string;
}
export const CHESTS: ChestDef[] = [
  { id: 'ch_madeira', name: 'Baú de Madeira', rarity: 'comum', colors: [0x8b5a2b, 0x6b6b74, 0xffe2a8], items: 1, consumables: 2, coins: [60, 140], weights: { comum: 66, incomum: 27, raro: 7 }, price: { coins: 250 }, desc: '1 item · 2 consumíveis · moedas' },
  { id: 'ch_prata', name: 'Baú de Prata', rarity: 'raro', colors: [0x9aa6b8, 0x2d3a55, 0x9fe3ff], items: 2, consumables: 2, coins: [150, 320], weights: { comum: 25, incomum: 40, raro: 27, epico: 8 }, price: { coins: 900 }, desc: '2 itens · Raro ou melhor garantido' },
  { id: 'ch_ouro', name: 'Baú de Ouro', rarity: 'epico', colors: [0xf5b82e, 0x7a2fd0, 0xfff1a8], items: 3, consumables: 3, coins: [300, 600], gems: [5, 15], weights: { incomum: 28, raro: 42, epico: 24, lendario: 6 }, price: { gems: 120 }, desc: '3 itens · Épico ou melhor garantido' },
  { id: 'ch_obsidiana', name: 'Baú de Obsidiana', rarity: 'lendario', colors: [0x1b1030, 0xffb020, 0xffc65c], items: 4, consumables: 3, coins: [600, 1200], gems: [15, 40], weights: { raro: 30, epico: 44, lendario: 21, mitico: 5 }, price: { gems: 320 }, desc: '4 itens · Lendário ou melhor garantido' },
  { id: 'ch_cosmico', name: 'Baú Cósmico', rarity: 'cosmico', colors: [0x150b3a, 0x7df9ff, 0xd8b4fe], items: 5, consumables: 4, coins: [1500, 3000], gems: [40, 90], weights: { epico: 38, lendario: 40, mitico: 18, cosmico: 4 }, price: { gems: 880 }, desc: '5 itens · Mítico ou melhor garantido' },
];
export const CHEST: Record<string, ChestDef> = Object.fromEntries(CHESTS.map((c) => [c.id, c]));
/** guaranteed minimum rarity for the best item in each chest */
export const CHEST_GUARANTEE: Record<string, Rarity> = {
  ch_madeira: 'comum', ch_prata: 'raro', ch_ouro: 'epico', ch_obsidiana: 'lendario', ch_cosmico: 'mitico',
};

// ── Premium currency packs (real money — checkout not wired yet) ────────────
export const GEM_PACKS = [
  { id: 'gp_1', gems: 80, bonus: 0, price: '0,99 €' },
  { id: 'gp_2', gems: 500, bonus: 50, price: '4,99 €', tag: 'Popular' },
  { id: 'gp_3', gems: 1100, bonus: 150, price: '9,99 €' },
  { id: 'gp_4', gems: 2400, bonus: 400, price: '19,99 €', tag: 'Melhor valor' },
  { id: 'gp_5', gems: 6500, bonus: 1500, price: '49,99 €' },
];

// ── Missions ─────────────────────────────────────────────────────────────────
export type EventKey =
  | 'fight' | 'win' | 'hits' | 'super' | 'special' | 'pinWin' | 'koWin' | 'tagWin' | 'tags' | 'chest'
  | 'potion' | 'kickout' | 'aerial' | 'grapple' | 'perfect' | 'crit' | 'dodge' | 'block' | 'streak' | 'bossWin';

export interface Reward { coins?: number; gems?: number; xp?: number; chest?: string; item?: string }
export interface MissionDef { id: string; text: string; event: EventKey; target: number; reward: Reward }

export const DAILY_POOL: MissionDef[] = [
  { id: 'd_win2', text: 'Vence 2 lutas', event: 'win', target: 2, reward: { coins: 180, xp: 120 } },
  { id: 'd_fight3', text: 'Disputa 3 lutas', event: 'fight', target: 3, reward: { coins: 150, xp: 100 } },
  { id: 'd_hits60', text: 'Acerta 60 golpes', event: 'hits', target: 60, reward: { coins: 160, xp: 110 } },
  { id: 'd_super2', text: 'Usa 2 Super Ataques', event: 'super', target: 2, reward: { coins: 200, xp: 120, gems: 5 } },
  { id: 'd_special4', text: 'Usa 4 Golpes Especiais', event: 'special', target: 4, reward: { coins: 180, xp: 110 } },
  { id: 'd_pin1', text: 'Vence por pinfall', event: 'pinWin', target: 1, reward: { coins: 200, xp: 130 } },
  { id: 'd_ko1', text: 'Vence por K.O.', event: 'koWin', target: 1, reward: { coins: 200, xp: 130 } },
  { id: 'd_tag1', text: 'Vence 1 luta de Tag Team', event: 'tagWin', target: 1, reward: { coins: 220, xp: 140 } },
  { id: 'd_kick3', text: 'Escapa a 3 contagens', event: 'kickout', target: 3, reward: { coins: 170, xp: 110 } },
  { id: 'd_aerial2', text: 'Faz 2 ataques aéreos', event: 'aerial', target: 2, reward: { coins: 170, xp: 110 } },
  { id: 'd_grapple10', text: 'Faz 10 projeções', event: 'grapple', target: 10, reward: { coins: 170, xp: 110 } },
  { id: 'd_crit8', text: 'Acerta 8 golpes críticos', event: 'crit', target: 8, reward: { coins: 170, xp: 110 } },
  { id: 'd_chest1', text: 'Abre 1 baú', event: 'chest', target: 1, reward: { coins: 120, xp: 80, gems: 5 } },
  { id: 'd_dodge15', text: 'Esquiva 15 ataques', event: 'dodge', target: 15, reward: { coins: 160, xp: 100 } },
];

export const WEEKLY_POOL: MissionDef[] = [
  { id: 'w_win15', text: 'Vence 15 lutas', event: 'win', target: 15, reward: { coins: 1200, xp: 900, gems: 30 } },
  { id: 'w_super12', text: 'Usa 12 Super Ataques', event: 'super', target: 12, reward: { coins: 900, xp: 700, chest: 'ch_prata' } },
  { id: 'w_tag6', text: 'Vence 6 lutas de Tag Team', event: 'tagWin', target: 6, reward: { coins: 1000, xp: 800, gems: 25 } },
  { id: 'w_hits500', text: 'Acerta 500 golpes', event: 'hits', target: 500, reward: { coins: 900, xp: 700 } },
  { id: 'w_ko6', text: 'Vence 6 lutas por K.O.', event: 'koWin', target: 6, reward: { coins: 1000, xp: 800, chest: 'ch_prata' } },
  { id: 'w_perfect3', text: 'Vence 3 lutas com mais de 60% de vida', event: 'perfect', target: 3, reward: { coins: 1100, xp: 800, gems: 30 } },
  { id: 'w_chest5', text: 'Abre 5 baús', event: 'chest', target: 5, reward: { coins: 800, xp: 600, chest: 'ch_ouro' } },
  { id: 'w_aerial10', text: 'Faz 10 ataques aéreos', event: 'aerial', target: 10, reward: { coins: 900, xp: 700, gems: 20 } },
];
export const WEEKLY_BONUS: Reward = { chest: 'ch_ouro', item: 'sk_veterano', gems: 50 };

export interface ChallengeDef {
  id: string; name: string; desc: string; target: number; event?: EventKey; kind: 'counter' | 'streak' | 'boss' | 'collection';
  reward: Reward; rarity: Rarity; boss?: string;
}
export const CHALLENGES: ChallengeDef[] = [
  { id: 'ch_colosso', name: 'O Colosso', desc: 'Derrota O Colosso, um gigante de pedra (Nível 5+).', target: 1, kind: 'boss', boss: 'colosso', reward: { item: 'sk_colosso', gems: 60 }, rarity: 'lendario' },
  { id: 'ch_rainha', name: 'Rainha Gélida', desc: 'Derrota a Rainha Gélida no seu trono de gelo (Nível 12+).', target: 1, kind: 'boss', boss: 'rainha', reward: { item: 'h_gelo', gems: 100 }, rarity: 'mitico' },
  { id: 'ch_fenix', name: 'Fénix Negra', desc: 'Derrota a Fénix Negra, que renasce uma vez (Nível 20+).', target: 1, kind: 'boss', boss: 'fenix', reward: { item: 'sk_fenix', gems: 150 }, rarity: 'mitico' },
  { id: 'ch_tita', name: 'Titã Cósmico', desc: 'Derrota o Titã Cósmico, o lutador final (Nível 30+).', target: 1, kind: 'boss', boss: 'tita', reward: { item: 'sk_deus', chest: 'ch_cosmico' }, rarity: 'cosmico' },
  { id: 'ch_invicto', name: 'Invicto', desc: 'Vence 10 lutas seguidas sem perder.', target: 10, kind: 'streak', reward: { item: 'sk_invicto', gems: 80 }, rarity: 'mitico' },
  { id: 'ch_tag', name: 'Mestre da Tag', desc: 'Vence 25 lutas de Tag Team.', target: 25, kind: 'counter', event: 'tagWin', reward: { item: 'sk_reitag', gems: 60 }, rarity: 'lendario' },
  { id: 'ch_ko', name: 'Destruidor', desc: 'Vence 50 lutas por K.O.', target: 50, kind: 'counter', event: 'koWin', reward: { item: 'sk_abismo', gems: 100 }, rarity: 'mitico' },
  { id: 'ch_colecao', name: 'Colecionador', desc: 'Reúne 30 itens diferentes na tua coleção.', target: 30, kind: 'collection', reward: { item: 'h_coroa', gems: 80 }, rarity: 'mitico' },
  { id: 'ch_super', name: 'Mestre do Super', desc: 'Usa 150 Super Ataques.', target: 150, kind: 'counter', event: 'super', reward: { item: 'pa_tag', chest: 'ch_obsidiana' }, rarity: 'lendario' },
];

// ── Level road ───────────────────────────────────────────────────────────────
export const LEVEL_REWARDS: Record<number, Reward> = {
  2: { coins: 200 },
  3: { item: 'sp_chuva' },
  4: { chest: 'ch_madeira' },
  5: { gems: 30, chest: 'ch_prata' },
  6: { item: 'pa_contra' },
  8: { item: 'sp_joelhada' },
  10: { chest: 'ch_ouro', gems: 40 },
  12: { item: 'pa_folego' },
  14: { item: 'su_gigante' },
  16: { item: 'sk_karateca' },
  18: { chest: 'ch_ouro' },
  20: { item: 'sp_tornado', gems: 80 },
  25: { chest: 'ch_obsidiana' },
  30: { item: 'su_meteoro' },
  35: { chest: 'ch_obsidiana', gems: 120 },
  40: { chest: 'ch_cosmico' },
  50: { chest: 'ch_cosmico', gems: 300 },
  60: { chest: 'ch_cosmico', gems: 500 },
};

// ── Opponents ────────────────────────────────────────────────────────────────
export const NAMES_FIRST = ['El', 'Zé', 'Dona', 'Rei', 'Lady', 'Capitão', 'Barão', 'Kid', 'Sra.', 'Mestre', 'Big', 'Tio', 'Prima', 'Doutor', 'Senhor', 'Mini', 'Mega', 'Tia'];
export const NAMES_LAST = ['Trovão', 'Bigorna', 'Marreta', 'Polvo', 'Faísca', 'Chouriço', 'Muralha', 'Tufão', 'Nitro', 'Cometa', 'Suplex', 'Bacalhau', 'Vulcão', 'Raio', 'Granito', 'Tornado', 'Pimenta', 'Martelo', 'Furacão', 'Javali', 'Ciclone', 'Bifana', 'Petardo', 'Tubarão', 'Lince', 'Bisonte', 'Pancada', 'Cobra'];

export interface BossDef { id: string; name: string; title: string; levelReq: number; levelBonus: number; app: Partial<Appearance>; super: string; specials: string[]; passives: string[]; hpMul: number }
export const BOSSES: Record<string, BossDef> = {
  colosso: { id: 'colosso', name: 'O Colosso', title: 'Gigante de Pedra', levelReq: 5, levelBonus: 3, app: { skinTone: 6, build: 2, hair: 'careca', skin: 'sk_colosso', beard: 4, brows: 5, mouth: 1, eyes: 4, height: 1.06 }, super: 'su_bomba', specials: ['sp_abraco', 'sp_sismico'], passives: ['pa_ferro'], hpMul: 1.35 },
  rainha: { id: 'rainha', name: 'Rainha Gélida', title: 'Soberana do Inverno', levelReq: 12, levelBonus: 4, app: { skinTone: 0, build: 0, hair: 'h_gelo', hairColor: 6, skin: 'sk_gelo', beard: 0, eyes: 1, eyeColor: 2, mouth: 4, height: 1.0 }, super: 'su_trovao', specials: ['sp_martelo', 'sp_joelhada'], passives: ['pa_olho'], hpMul: 1.3 },
  fenix: { id: 'fenix', name: 'Fénix Negra', title: 'Aquela que Renasce', levelReq: 20, levelBonus: 5, app: { skinTone: 5, build: 1, hair: 'h_fogo', skin: 'sk_fenix', beard: 0, eyes: 4, eyeColor: 6, mouth: 2, height: 1.02 }, super: 'su_dragao', specials: ['sp_gancho', 'sp_tornado'], passives: ['pa_fenix'], hpMul: 1.3 },
  tita: { id: 'tita', name: 'Titã Cósmico', title: 'O Fim de Todas as Lutas', levelReq: 30, levelBonus: 6, app: { skinTone: 9, build: 2, hair: 'h_galaxia', skin: 'sk_nebulosa', beard: 0, eyes: 3, eyeColor: 7, mouth: 3, height: 1.06 }, super: 'su_supernova', specials: ['sp_atomica', 'sp_fantasma'], passives: ['pa_vampiro', 'pa_berserk'], hpMul: 1.45 },
};

export const PARTNERS: { name: string; app: Partial<Appearance>; bias: StatKey[] }[] = [
  { name: 'Tiago Trovão', app: { skinTone: 2, hair: 'espetado', hairColor: 1, skin: 'sk_azul', beard: 3, build: 1 }, bias: ['str', 'spd'] },
  { name: 'Marta Marreta', app: { skinTone: 4, hair: 'rabo', hairColor: 7, skin: 'sk_rookie', beard: 0, build: 0, eyes: 3 }, bias: ['agi', 'crt'] },
  { name: 'Bruno Betão', app: { skinTone: 6, hair: 'careca', skin: 'sk_preto', beard: 2, build: 2 }, bias: ['vit', 'def'] },
];
