/**
 * Chatbot engine — pure, synchronous intent classification.
 *
 * Why a rule-based engine instead of calling an LLM:
 *   1. Works offline (the rider might be on poor cellular)
 *   2. Zero per-message cost
 *   3. Deterministic answers, always consistent with HelpScreen/FareInfoScreen
 *   4. Instant response (no network latency)
 *
 * If/when an LLM key is added to server/.env, swap the export with an
 * async variant that calls the server — the caller API (returns
 * `{ id, answer, actions }`) stays identical, so the UI does not change.
 */

import { INTENTS, FALLBACK } from '../constants/chatbotKnowledge';

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had', 'having', 'i', 'me', 'my',
    'you', 'your', 'we', 'us', 'our', 'they', 'them', 'their', 'it', 'its',
    'to', 'of', 'in', 'on', 'at', 'for', 'by', 'with', 'from', 'as', 'and',
    'or', 'but', 'if', 'so', 'not', 'no', 'yes', 'this', 'that', 'these',
    'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why',
    'how', 'can', 'could', 'should', 'would', 'will', 'just', 'very', 'really',
    'please', 'pls', 'plz', 'ok', 'okay',
]);

const normalize = (s) =>
    String(s || '')
        .toLowerCase()
        .replace(/[^\w\s']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const tokenize = (s) =>
    normalize(s)
        .split(' ')
        .filter((t) => t && !STOP_WORDS.has(t));

/**
 * Score a single intent against the normalized user text.
 * Strategy:
 *   - +3 per keyword phrase substring-matched in the raw normalized string
 *   - +2 if any regex pattern matches (strong signal)
 *   - +1 per keyword-token overlap with user tokens
 * The raw score is then normalized by a modest denominator so short
 * messages don't skew everything toward generic intents.
 */
const scoreIntent = (intent, normText, userTokens) => {
    let score = 0;

    if (Array.isArray(intent.keywords)) {
        for (const kw of intent.keywords) {
            const k = kw.toLowerCase();
            if (!k) continue;
            if (k.includes(' ')) {
                if (normText.includes(k)) score += 3;
            } else if (userTokens.includes(k)) {
                score += 2;
            } else if (normText.includes(k)) {
                score += 1;
            }
        }
    }

    if (Array.isArray(intent.patterns)) {
        for (const rx of intent.patterns) {
            if (rx.test(normText)) {
                score += 2;
                break;
            }
        }
    }

    return score;
};

/**
 * Classify a free-text user message into an intent + reply payload.
 *
 * @param {string} text
 * @returns {{ id: string, answer: string, actions?: Array<{label:string,screen:string,params?:object}> }}
 */
export const classifyAndAnswer = (text) => {
    const normText = normalize(text);
    if (!normText) return { id: FALLBACK.id, answer: FALLBACK.answer, actions: FALLBACK.actions };

    const userTokens = tokenize(text);

    let best = null;
    let bestScore = 0;

    for (const intent of INTENTS) {
        const s = scoreIntent(intent, normText, userTokens);
        if (s > bestScore) {
            bestScore = s;
            best = intent;
        }
    }

    // Confidence threshold: need at least one solid keyword hit (2) OR
    // a regex match (2) to commit to a specific intent.
    if (!best || bestScore < 2) {
        return { id: FALLBACK.id, answer: FALLBACK.answer, actions: FALLBACK.actions };
    }

    return { id: best.id, answer: best.answer, actions: best.actions };
};

/**
 * Simulated "thinking" delay so the UI shows a brief typing indicator —
 * otherwise answers pop in so fast it feels robotic.
 */
export const getReply = (text) =>
    new Promise((resolve) => {
        const result = classifyAndAnswer(text);
        const delay = 350 + Math.random() * 400;
        setTimeout(() => resolve(result), delay);
    });
