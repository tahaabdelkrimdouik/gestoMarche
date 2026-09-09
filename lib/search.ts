/**
 * Client-side product search helpers.
 *
 * Search stays in-memory because the app already loads the full product
 * catalogue from Supabase. Voice search ranks locally and auto-selects
 * a dominant match — no LLM and no extra network round-trips.
 */

/** Command phrases only. Do not strip "de"/"du" — they appear in names like "pomme de terre". */
const COMMAND_FILLERS = new Set([
  'cherche',
  'chercher',
  'recherche',
  'rechercher',
  'trouve',
  'trouver',
  'montre',
  'montrer',
  'moi',
  'nous',
  'voir',
  'affiche',
  'afficher',
  'produit',
  'produits',
  'article',
  'articles',
  'plait',
  'please',
  'stp',
]);

const LEADING_ARTICLES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd']);

/** Common French STT variants → canonical tokens. Applied only while matching. */
const TOKEN_ALIASES: Record<string, string[]> = {
  tomat: ['tomate'],
  tomatte: ['tomate'],
  tomattez: ['tomate'],
  patiserie: ['patisserie'],
  patisrie: ['patisserie'],
  patisri: ['patisserie'],
  huil: ['huile'],
  huille: ['huile'],
  tournesole: ['tournesol'],
  tournsol: ['tournesol'],
  pomm: ['pomme'],
  pome: ['pomme'],
  oignion: ['oignon'],
  ognon: ['oignon'],
  carot: ['carotte'],
  carrote: ['carotte'],
  poivronn: ['poivron'],
  courget: ['courgette'],
  fromag: ['fromage'],
  yogurt: ['yaourt'],
  yogourt: ['yaourt'],
  chocola: ['chocolat'],
  banan: ['banane'],
  citronn: ['citron'],
  fraiz: ['fraise'],
  framboiz: ['framboise'],
  myrtil: ['myrtille'],
  peche: ['peche'],
  abrico: ['abricot'],
  anana: ['ananas'],
  epinard: ['epinard'],
  harico: ['haricot'],
  coca: ['coca'],
  koka: ['coca'],
};

export type ProductVoiceIntent = {
  intent: 'product_search';
  query: string;
  raw: string;
};

export type VoiceSearchDecision =
  | {
      action: 'search';
      query: string;
      matchedName: string | null;
      score: number;
      reason: 'exact' | 'dominant' | 'query';
    }
  | {
      action: 'clarify';
      reason: 'empty' | 'unintelligible';
    };

/** Score bands from scoreProductMatch — used to auto-select without asking the user. */
export const VOICE_MATCH = {
  exact: 100,
  prefix: 90,
  substring: 85,
  /** Strong unique fuzzy/token match, e.g. "tomat ronde" → "Tomate ronde". */
  autoProductMin: 70,
  /** Best must beat the runner-up by this much to be considered dominant. */
  dominantMargin: 10,
  /** At least one catalogue hit — search the spoken query as a filter. */
  autoQueryMin: 40,
  /** Known STT confidence below this, with zero catalogue hits, is treated as unintelligible. */
  sttFloor: 0.35,
} as const;

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stemFrenchToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('aux') && token.length > 5) return `${token.slice(0, -3)}al`;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -1)}`;
  if ((token.endsWith('s') || token.endsWith('x')) && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token, stemFrenchToken(token)]);
  for (const alias of TOKEN_ALIASES[token] || []) {
    variants.add(alias);
    variants.add(stemFrenchToken(alias));
  }
  const stemmed = stemFrenchToken(token);
  for (const alias of TOKEN_ALIASES[stemmed] || []) {
    variants.add(alias);
    variants.add(stemFrenchToken(alias));
  }
  return [...variants];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }

  return prev[b.length];
}

function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function maxEditDistance(token: string): number {
  if (token.length <= 8) return 1;
  return 2;
}

function tokensMatch(queryToken: string, nameToken: string): boolean {
  for (const query of tokenVariants(queryToken)) {
    for (const name of tokenVariants(nameToken)) {
      if (query === name) return true;
      if (query.length >= 3 && name.startsWith(query)) return true;
      if (name.length >= 3 && query.startsWith(name) && name.length >= 4) return true;
      const limit = maxEditDistance(query.length < name.length ? query : name);
      if (query.length >= 4 && name.length >= 4 && levenshtein(query, name) <= limit) {
        return true;
      }
    }
  }
  return false;
}

function significantTokens(normalized: string): string[] {
  return normalized.split(' ').filter((token) => token.length >= 2);
}

function queryTokensCoverName(queryTokens: string[], nameTokens: string[]): boolean {
  let qi = 0;

  while (qi < queryTokens.length) {
    let matched = false;

    for (const nameToken of nameTokens) {
      if (tokensMatch(queryTokens[qi], nameToken)) {
        qi += 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (let take = 2; take <= 3 && qi + take <= queryTokens.length; take += 1) {
      const joined = queryTokens.slice(qi, qi + take).join('');
      if (nameTokens.some((nameToken) => tokensMatch(joined, nameToken) || nameToken === joined)) {
        qi += take;
        matched = true;
        break;
      }
    }

    if (!matched) return false;
  }

  return true;
}

export function extractProductQuery(transcript: string): string {
  const normalized = normalizeSearchText(transcript);
  if (!normalized) return '';

  const tokens = normalized.split(' ').filter((token) => !COMMAND_FILLERS.has(token));
  while (tokens.length > 1 && LEADING_ARTICLES.has(tokens[0])) {
    tokens.shift();
  }

  if (tokens.length === 0) return transcript.trim();
  return tokens.join(' ');
}

export function parseProductVoiceQuery(transcript: string): ProductVoiceIntent {
  return {
    intent: 'product_search',
    query: extractProductQuery(transcript),
    raw: transcript.trim(),
  };
}

export function scoreProductMatch(query: string, name: string, code?: string | null): number {
  const rawQuery = query.trim();
  if (!rawQuery) return 0;

  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) return 0;

  const normalizedName = normalizeSearchText(name || '');
  const normalizedCode = normalizeSearchText(code || '');

  if (normalizedName === normalizedQuery) return 100;
  if (normalizedCode && normalizedCode === normalizedQuery) return 95;

  let score = 0;

  if (normalizedName.startsWith(normalizedQuery)) score = Math.max(score, 90);
  if (normalizedName.includes(normalizedQuery)) score = Math.max(score, 85);
  if (normalizedCode && normalizedCode.includes(normalizedQuery)) score = Math.max(score, 80);

  if (normalizedQuery.length >= 5) {
    const similarity = stringSimilarity(normalizedQuery, normalizedName);
    if (similarity >= 0.82) {
      score = Math.max(score, Math.round(70 + similarity * 30));
    }
  }

  const queryTokens = significantTokens(normalizedQuery);
  if (queryTokens.length === 0) {
    return Math.max(score, normalizedName.includes(normalizedQuery) ? 70 : 0);
  }

  const nameTokens = significantTokens(normalizedName);
  if (nameTokens.length > 0 && queryTokensCoverName(queryTokens, nameTokens)) {
    const extraNameTokens = Math.max(0, nameTokens.length - queryTokens.length);
    const tokenScore = Math.max(40, 78 - extraNameTokens * 4);
    score = Math.max(score, tokenScore);
  }

  return score;
}

export function matchesProductSearch(query: string, name: string, code?: string | null): boolean {
  return scoreProductMatch(query, name, code) > 0;
}

export function suggestProductNames(
  query: string,
  names: string[],
  limit = 4
): Array<{ name: string; score: number }> {
  const seen = new Set<string>();
  const ranked: Array<{ name: string; score: number }> = [];

  for (const name of names) {
    const key = normalizeSearchText(name);
    if (!key || seen.has(key)) continue;
    const score = scoreProductMatch(query, name);
    if (score <= 0) continue;
    seen.add(key);
    ranked.push({ name, score });
  }

  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
  return ranked.slice(0, limit);
}

export function uniqueTranscripts(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const cleaned = value.trim().replace(/[.,!?;:]+$/g, '');
    const key = normalizeSearchText(cleaned);
    if (!cleaned || !key || seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
  }

  return unique;
}

function rankAgainstCatalogue(query: string, names: string[]): Array<{ name: string; score: number }> {
  return suggestProductNames(query, names, 6);
}

/**
 * Pick a search query automatically from speech.
 * Uses the already-loaded product list — no extra API calls.
 */
export function resolveVoiceSearch(
  transcripts: string[],
  productNames: string[],
  sttConfidence: number | null = null
): VoiceSearchDecision {
  const candidates = uniqueTranscripts(transcripts);
  const extractedPrimary = extractProductQuery(candidates[0] || '');

  if (!extractedPrimary) {
    return { action: 'clarify', reason: 'empty' };
  }

  let bestQuery = extractedPrimary;
  let bestName: string | null = null;
  let bestScore = 0;
  let secondScore = 0;

  for (const transcript of candidates) {
    const extracted = extractProductQuery(transcript) || transcript;
    const ranked = rankAgainstCatalogue(extracted, productNames);
    const topScore = ranked[0]?.score ?? 0;
    const nextScore = ranked[1]?.score ?? 0;

    if (topScore > bestScore) {
      bestScore = topScore;
      secondScore = nextScore;
      bestName = ranked[0]?.name ?? null;
      bestQuery = extracted;
    }
  }

  const knownLowStt = sttConfidence != null && sttConfidence > 0 && sttConfidence < VOICE_MATCH.sttFloor;
  if (bestScore === 0 && knownLowStt && extractedPrimary.length < 5) {
    return { action: 'clarify', reason: 'unintelligible' };
  }

  const margin = bestScore - secondScore;
  const exactWinner = bestName != null && bestScore >= VOICE_MATCH.exact;
  const uniqueWinner = bestName != null
    && bestScore >= VOICE_MATCH.autoProductMin
    && margin >= VOICE_MATCH.dominantMargin;

  if (exactWinner || uniqueWinner) {
    return {
      action: 'search',
      query: bestName as string,
      matchedName: bestName,
      score: bestScore,
      reason: exactWinner ? 'exact' : 'dominant',
    };
  }

  return {
    action: 'search',
    query: bestQuery,
    matchedName: bestName,
    score: bestScore,
    reason: 'query',
  };
}
