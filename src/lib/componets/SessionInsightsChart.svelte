<script lang="ts">
	import { isInstantFail, getErrorType } from '$lib/structure';
	import type { SavedWord, TypingFlow, MindDojoSettings } from '$lib/structure';
	import { chartPrefs } from '$lib/chartPrefs.svelte';
	import { getBaseStyle } from '$lib/style';
	import RenderWord from './render_word/Word.svelte';
	import { setContext, getContext } from 'svelte';
	import * as echarts from 'echarts';

	// Override settings context for replay — Letter component reads from this
	const originalSettingsGetter: () => MindDojoSettings | undefined = getContext('settings');
	let replaySettingsOverride: MindDojoSettings | null = $state(null);
	setContext('settings', () => replaySettingsOverride || originalSettingsGetter?.());

	let {
		words,
		selectedDate = null,
	}: {
		words: SavedWord[];
		selectedDate?: string | null;
	} = $props();

	let activeChart: 'flow' | 'accuracy' | 'reaction' | 'length' | 'assumptions' | 'heatmap' | 'sessions' | 'modes' | 'recovery' | 'autospeed' | 'combos' | 'errorpos' | 'sessionpos' | 'patterns' | 'errors' = $state('flow');

	interface WordFlow {
		word: string;
		flow: TypingFlow;
		wordLen: number;
		index: number;
	}

	// Date picker state
	let pickedDate = $state(selectedDate || todayKey());

	function todayKey(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// Available dates
	let availableDates = $derived.by(() => {
		const dates = new Set<string>();
		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				const d = new Date(flow.timestamp);
				dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
			}
		}
		return [...dates].sort().reverse();
	});

	let effectiveDate = $derived(selectedDate || pickedDate || todayKey());

	// Get all flows for the selected day, sorted chronologically
	let selectedSessionIdx: number | null = $state(null); // null = all sessions

	// Raw day flows (before session filter)
	let rawDayFlows = $derived.by((): WordFlow[] => {
		if (!effectiveDate) return [];
		const flows: WordFlow[] = [];
		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				const d = new Date(flow.timestamp);
				const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				if (key === effectiveDate) {
					flows.push({ word: w.word.word, flow, wordLen: w.word.word.length, index: 0 });
				}
			}
		}
		flows.sort((a, b) => a.flow.timestamp - b.flow.timestamp);
		const filtered = flows.filter(f => !isInstantFail(f.flow));
		filtered.forEach((f, i) => f.index = i);
		return filtered;
	});

	let rawAllDayFlows = $derived.by((): WordFlow[] => {
		if (!effectiveDate) return [];
		const flows: WordFlow[] = [];
		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				const d = new Date(flow.timestamp);
				const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				if (key === effectiveDate) {
					flows.push({ word: w.word.word, flow, wordLen: w.word.word.length, index: 0 });
				}
			}
		}
		flows.sort((a, b) => a.flow.timestamp - b.flow.timestamp);
		flows.forEach((f, i) => f.index = i);
		return flows;
	});

	// Session-filtered flows — all charts derive from these
	let dayFlows = $derived.by((): WordFlow[] => {
		if (selectedSessionIdx === null) return rawDayFlows;
		const sess = rawDaySessions.find(s => s.index === selectedSessionIdx);
		if (!sess || sess.flows.length === 0) return rawDayFlows;
		const startTs = sess.flows[0].flow.timestamp;
		const endTs = sess.flows[sess.flows.length - 1].flow.timestamp;
		const filtered = rawDayFlows.filter(f => f.flow.timestamp >= startTs && f.flow.timestamp <= endTs);
		filtered.forEach((f, i) => f.index = i);
		return filtered;
	});

	let allDayFlows = $derived.by((): WordFlow[] => {
		if (selectedSessionIdx === null) return rawAllDayFlows;
		const sess = rawDaySessions.find(s => s.index === selectedSessionIdx);
		if (!sess || sess.flows.length === 0) return rawAllDayFlows;
		const startTs = sess.flows[0].flow.timestamp;
		const endTs = sess.flows[sess.flows.length - 1].flow.timestamp;
		const filtered = rawAllDayFlows.filter(f => f.flow.timestamp >= startTs && f.flow.timestamp <= endTs);
		filtered.forEach((f, i) => f.index = i);
		return filtered;
	});

	// Summary stats
	let summary = $derived.by(() => {
		if (dayFlows.length === 0) return null;
		const correct = dayFlows.filter(f => f.flow.correct).length;
		const total = dayFlows.length;
		const speeds = new Set(dayFlows.map(f => f.flow.speed).filter(Boolean));
		const avgReaction = dayFlows.filter(f => f.flow.reactionTime > 0).reduce((s, f) => s + f.flow.reactionTime, 0) / (dayFlows.filter(f => f.flow.reactionTime > 0).length || 1);
		const totalDur = dayFlows.reduce((s, f) => s + (f.flow.totalDuration || 0) + (f.flow.reactionTime || 0), 0);
		const t0 = new Date(dayFlows[0].flow.timestamp);
		const t1 = new Date(dayFlows[dayFlows.length - 1].flow.timestamp);

		// Assumption failures
		let assumptions = 0;
		for (const f of dayFlows) {
			if (!f.flow.correct && f.flow.reactionTime < 150 && f.flow.totalDuration <= 50) {
				assumptions++;
			}
		}

		return {
			correct,
			errors: total - correct,
			total,
			accuracy: Math.round((correct / total) * 100),
			speeds: [...speeds],
			avgReaction: Math.round(avgReaction),
			totalDur,
			assumptions,
			startTime: t0.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
			endTime: t1.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
		};
	});

	// ── SESSION BREAK DETECTION ──
	const BREAK_THRESHOLD_MS = 5 * 60 * 1000;

	function detectBreaks(flows: WordFlow[]): Set<number> {
		const breaks = new Set<number>();
		for (let i = 1; i < flows.length; i++) {
			const gap = flows[i].flow.timestamp - flows[i - 1].flow.timestamp;
			if (gap >= BREAK_THRESHOLD_MS) breaks.add(i);
			const prevMode = flows[i - 1].flow.mode || 'letter-by-letter';
			const currMode = flows[i].flow.mode || 'letter-by-letter';
			if (prevMode !== currMode) breaks.add(i);
		}
		return breaks;
	}

	// Raw breaks (for session list — uses unfiltered flows)
	let rawBreakIndices = $derived(detectBreaks(rawDayFlows));
	// Filtered breaks (for charts — uses session-filtered flows)
	let breakIndices = $derived(detectBreaks(dayFlows));

	// ── SESSION AGGREGATION ──
	interface DaySession {
		index: number;
		startTime: string;
		endTime: string;
		wordCount: number;
		accuracy: number;
		instantFails: number;
		avgSpeed: number;
		first30Accuracy: number;
		last30Accuracy: number;
		fatigueDelta: number;
		presenceCV: number;
		flows: WordFlow[];
		durationMs: number;
		longestStreak: number;
		mode: string;
	}

	function sessionCV(flows: WordFlow[]): number {
		const intervals: number[] = [];
		for (const f of flows) {
			if (!f.flow.correct) continue;
			const interKey = f.flow.letterIntervals.slice(1).filter(v => v > 0);
			intervals.push(...interKey);
		}
		if (intervals.length < 5) return 0;
		const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
		const stdDev = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
		return mean > 0 ? stdDev / mean : 0;
	}

	function sliceAccuracy(flows: WordFlow[], start: number, count: number): number {
		const slice = flows.slice(start, start + count);
		if (slice.length === 0) return 0;
		return (slice.filter(f => f.flow.correct).length / slice.length) * 100;
	}

	function buildSessions(flows: WordFlow[], breaks: Set<number>, allFlows: WordFlow[]): DaySession[] {
		if (flows.length === 0) return [];
		const sessionChunks: WordFlow[][] = [];
		let chunkStart = 0;
		const sortedBreaks = [...breaks].sort((a, b) => a - b);
		for (const brk of sortedBreaks) {
			if (brk > chunkStart) {
				sessionChunks.push(flows.slice(chunkStart, brk));
			}
			chunkStart = brk;
		}
		if (chunkStart < flows.length) {
			sessionChunks.push(flows.slice(chunkStart));
		}

		return sessionChunks.map((chunk, idx) => {
			const startTs = chunk[0].flow.timestamp;
			const endTs = chunk[chunk.length - 1].flow.timestamp;
			const correct = chunk.filter(f => f.flow.correct).length;
			const speeds = chunk.map(f => f.flow.speed).filter((s): s is number => typeof s === 'number' && s > 0);
			const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
			const instantFails = allFlows.filter(f =>
				f.flow.timestamp >= startTs && f.flow.timestamp <= endTs && isInstantFail(f.flow)
			).length;
			const first30 = sliceAccuracy(chunk, 0, Math.min(30, chunk.length));
			const last30 = sliceAccuracy(chunk, Math.max(0, chunk.length - 30), 30);
			const durationMs = endTs - startTs;
			let longestStreak = 0, curStreak = 0;
			for (const f of chunk) {
				if (f.flow.correct) { curStreak++; longestStreak = Math.max(longestStreak, curStreak); }
				else curStreak = 0;
			}
			return {
				index: idx + 1,
				startTime: new Date(startTs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
				endTime: new Date(endTs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
				wordCount: chunk.length,
				accuracy: chunk.length > 0 ? Math.round((correct / chunk.length) * 100) : 0,
				instantFails, avgSpeed: Math.round(avgSpeed * 100) / 100,
				first30Accuracy: Math.round(first30), last30Accuracy: Math.round(last30),
				fatigueDelta: Math.round(last30 - first30),
				presenceCV: Math.round(sessionCV(chunk) * 100) / 100,
				flows: chunk, durationMs, longestStreak,
				mode: (() => {
					const modes = chunk.map(f => f.flow.mode || 'letter-by-letter');
					const counts = new Map<string, number>();
					for (const m of modes) counts.set(m, (counts.get(m) || 0) + 1);
					return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'letter-by-letter';
				})(),
			};
		});
	}

	// Raw sessions (for session selector — always from unfiltered flows)
	let rawDaySessions = $derived(buildSessions(rawDayFlows, rawBreakIndices, rawAllDayFlows));
	// Filtered sessions (for charts — from session-filtered flows)
	let daySessions = $derived(buildSessions(dayFlows, breakIndices, allDayFlows));

	// ── SESSION INSIGHTS ──
	let sessionInsights = $derived.by(() => {
		if (daySessions.length === 0) return null;

		// Best accuracy
		const bestAccuracy = Math.max(...daySessions.map(s => s.accuracy));

		// Average length
		const avgLength = Math.round(daySessions.reduce((s, sess) => s + sess.wordCount, 0) / daySessions.length);

		// Optimal length: avg word count where rolling 20-word accuracy first drops below 60%
		// across sessions with 50+ words
		const bigSessions = daySessions.filter(s => s.wordCount >= 50);
		let optimalLength: number | null = null;
		if (bigSessions.length > 0) {
			// For each big session, find the dayFlows chunk and compute where rolling accuracy drops
			let dropPoints: number[] = [];
			let chunkStart = 0;
			const sortedBreaks = [...breakIndices].sort((a, b) => a - b);
			const sessionStarts: number[] = [0];
			for (const brk of sortedBreaks) sessionStarts.push(brk);

			for (let si = 0; si < sessionStarts.length; si++) {
				const start = sessionStarts[si];
				const end = si < sessionStarts.length - 1 ? sessionStarts[si + 1] : dayFlows.length;
				const chunk = dayFlows.slice(start, end);
				if (chunk.length < 50) continue;

				const windowSize = 20;
				for (let i = windowSize - 1; i < chunk.length; i++) {
					let correct = 0;
					for (let j = i - windowSize + 1; j <= i; j++) {
						if (chunk[j].flow.correct) correct++;
					}
					if ((correct / windowSize) * 100 < 60) {
						dropPoints.push(i + 1);
						break;
					}
				}
			}
			if (dropPoints.length > 0) {
				optimalLength = Math.round(dropPoints.reduce((a, b) => a + b, 0) / dropPoints.length);
			}
		}

		// Best time: hour with highest accuracy across sessions
		const hourBuckets: Record<number, { correct: number; total: number }> = {};
		for (const f of dayFlows) {
			const h = new Date(f.flow.timestamp).getHours();
			if (!hourBuckets[h]) hourBuckets[h] = { correct: 0, total: 0 };
			hourBuckets[h].total++;
			if (f.flow.correct) hourBuckets[h].correct++;
		}
		let bestHour = '';
		let bestHourAcc = 0;
		for (const [h, b] of Object.entries(hourBuckets)) {
			const acc = b.total > 0 ? (b.correct / b.total) * 100 : 0;
			if (acc > bestHourAcc) {
				bestHourAcc = acc;
				bestHour = `${h.padStart(2, '0')}:00`;
			}
		}

		// Recovery effect: avg accuracy gain at start of session vs end of previous session
		let recoveryEffect: number | null = null;
		if (daySessions.length >= 2) {
			const deltas: number[] = [];
			for (let i = 1; i < daySessions.length; i++) {
				deltas.push(daySessions[i].first30Accuracy - daySessions[i - 1].last30Accuracy);
			}
			recoveryEffect = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
		}

		// Session efficiency
		const shortSessions = daySessions.filter(s => s.wordCount < 100);
		const longSessions = daySessions.filter(s => s.wordCount > 200);
		const shortAvg = shortSessions.length > 0 ? Math.round(shortSessions.reduce((s, sess) => s + sess.accuracy, 0) / shortSessions.length) : null;
		const longAvg = longSessions.length > 0 ? Math.round(longSessions.reduce((s, sess) => s + sess.accuracy, 0) / longSessions.length) : null;

		return {
			bestAccuracy,
			avgLength,
			optimalLength,
			bestHour,
			bestHourAcc: Math.round(bestHourAcc),
			recoveryEffect,
			shortAvg,
			longAvg,
		};
	});

	// Format timestamp for X-axis labels
	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	// ── FLOW STATE CHART ──
	let flowData = $derived.by(() => {
		if (dayFlows.length === 0) return [];
		const result: { index: number; speed: number; correct: boolean; timestamp: number; word: string; isBreak: boolean; dayIndex: number }[] = [];
		for (let i = 0; i < dayFlows.length; i++) {
			const f = dayFlows[i];
			// Insert a null-gap point before a break
			if (breakIndices.has(i)) {
				result.push({
					index: result.length,
					speed: 0,
					correct: true,
					timestamp: dayFlows[i - 1].flow.timestamp + 1000,
					word: '',
					isBreak: true,
					dayIndex: i,
				});
			}
			result.push({
				index: result.length,
				speed: f.flow.speed || 0,
				correct: f.flow.correct,
				timestamp: f.flow.timestamp,
				word: f.word,
				isBreak: false,
				dayIndex: i,
			});
		}
		return result;
	});

	let speedZones = $derived.by(() => {
		if (flowData.length === 0) return { base: 0, flow: 0, challenge: 0 };
		const speeds = [...new Set(flowData.map(f => f.speed).filter(s => s > 0))].sort((a, b) => a - b);
		if (speeds.length === 0) return { base: 0, flow: 0, challenge: 0 };
		const speedCounts = new Map<number, number>();
		for (const f of flowData) {
			speedCounts.set(f.speed, (speedCounts.get(f.speed) || 0) + 1);
		}
		const sortedByCount = [...speedCounts.entries()].sort((a, b) => b[1] - a[1]);
		const base = sortedByCount[0]?.[0] || speeds[0];
		return {
			base,
			flow: speeds.find(s => s > base && s <= base * 1.15) || base * 1.1,
			challenge: speeds.find(s => s > base * 1.15) || base * 1.25,
		};
	});

	function speedZoneLabel(speed: number): string {
		if (!speed) return '?';
		if (speed >= speedZones.challenge * 0.98) return 'Challenge';
		if (speed >= speedZones.flow * 0.98) return 'Flow';
		return 'Base';
	}

	function speedZoneColor(speed: number): string {
		if (!speed) return '#6b7280';
		if (speed >= speedZones.challenge * 0.98) return '#f59e0b';
		if (speed >= speedZones.flow * 0.98) return '#06b6d4';
		return '#8b5cf6';
	}

	let flowTransitions = $derived(flowData.filter((f, i) => i > 0 && flowData[i - 1].speed !== f.speed));

	let flowSpeedStats = $derived.by(() => {
		const uniqueSpeeds = [...new Set(flowData.map(f => f.speed).filter(s => s > 0))];
		return uniqueSpeeds.map(spd => {
			const count = flowData.filter(f => f.speed === spd).length;
			const correct = flowData.filter(f => f.speed === spd && f.correct).length;
			return { spd, count, correct, pct: Math.round((correct / count) * 100) };
		});
	});

	// ── ERROR TYPE BREAKDOWN ──
	let errorTypeBreakdown = $derived.by(() => {
		let you = 0, game = 0;
		for (const f of allDayFlows) {
			if (f.flow.correct) continue;
			const et = getErrorType(f.flow);
			if (et === 'you') you++;
			else if (et === 'game') game++;
		}
		const total = you + game;
		return {
			you, game, total,
			youPct: total > 0 ? Math.round((you / total) * 100) : 0,
			gamePct: total > 0 ? Math.round((game / total) * 100) : 0,
		};
	});

	// ── ROLLING ACCURACY CHART ──
	// Build session-relative position map: dayFlow index → { sessionIdx, posInSession }
	let sessionPositionMap = $derived.by(() => {
		const map: { sessionIdx: number; posInSession: number }[] = [];
		let sessIdx = 1, posInSess = 1;
		for (let i = 0; i < dayFlows.length; i++) {
			if (breakIndices.has(i)) { sessIdx++; posInSess = 1; }
			map.push({ sessionIdx: sessIdx, posInSession: posInSess });
			posInSess++;
		}
		return map;
	});

	let rollingAccuracy = $derived.by(() => {
		const windowSize = 20;
		if (dayFlows.length < windowSize) return [];
		const result: { index: number; accuracy: number | null; correct: number; timestamp: number; word: string; wordCorrect: boolean; reaction: number; speed: number; sessionIdx: number; posInSession: number; mode: string }[] = [];
		for (let i = windowSize - 1; i < dayFlows.length; i++) {
			const f = dayFlows[i];
			const pos = sessionPositionMap[i];
			// Check if this window spans a break
			let spansBreak = false;
			for (let j = i - windowSize + 2; j <= i; j++) {
				if (breakIndices.has(j)) { spansBreak = true; break; }
			}
			if (spansBreak) {
				result.push({ index: i, accuracy: null, correct: 0, timestamp: f.flow.timestamp, word: f.word, wordCorrect: f.flow.correct, reaction: f.flow.reactionTime, speed: f.flow.speed || 0, sessionIdx: pos.sessionIdx, posInSession: pos.posInSession, mode: f.flow.mode || 'letter-by-letter' });
			} else {
				let correct = 0;
				for (let j = i - windowSize + 1; j <= i; j++) {
					if (dayFlows[j].flow.correct) correct++;
				}
				result.push({ index: i, accuracy: (correct / windowSize) * 100, correct, timestamp: f.flow.timestamp, word: f.word, wordCorrect: f.flow.correct, reaction: f.flow.reactionTime, speed: f.flow.speed || 0, sessionIdx: pos.sessionIdx, posInSession: pos.posInSession, mode: f.flow.mode || 'letter-by-letter' });
			}
		}
		return result;
	});

	// ── REACTION TIME DATA ──
	let reactionData = $derived.by(() => {
		return dayFlows
			.filter(f => f.flow.reactionTime > 0 && f.flow.reactionTime < 10000)
			.map((f, i) => ({
				index: f.index,
				reaction: f.flow.reactionTime,
				correct: f.flow.correct,
				word: f.word,
				timestamp: f.flow.timestamp,
			}));
	});

	// ── ACCURACY BY WORD LENGTH ──
	let lengthAccuracy = $derived.by(() => {
		const buckets: Record<string, { correct: number; total: number }> = {};
		for (const f of dayFlows) {
			const len = f.wordLen;
			const bucket = len <= 4 ? '3-4' : len <= 6 ? '5-6' : len <= 8 ? '7-8' : len <= 10 ? '9-10' : len <= 13 ? '11-13' : '14+';
			if (!buckets[bucket]) buckets[bucket] = { correct: 0, total: 0 };
			buckets[bucket].total++;
			if (f.flow.correct) buckets[bucket].correct++;
		}
		const order = ['3-4', '5-6', '7-8', '9-10', '11-13', '14+'];
		return order.filter(k => buckets[k]).map(k => ({
			label: k,
			accuracy: Math.round((buckets[k].correct / buckets[k].total) * 100),
			total: buckets[k].total,
			correct: buckets[k].correct,
		}));
	});

	// ── ASSUMPTION FAILURES (uses allDayFlows to include instant-fails) ──
	let assumptionFailures = $derived.by(() => {
		const results: { word: string; prevWord: string; reaction: number; index: number; time: string }[] = [];
		for (let i = 0; i < allDayFlows.length; i++) {
			const f = allDayFlows[i];
			if (!f.flow.correct && f.flow.reactionTime < 150 && (f.flow.totalDuration || 0) <= 50) {
				const prev = i > 0 ? allDayFlows[i - 1] : null;
				results.push({
					word: f.word,
					prevWord: prev?.word || '',
					reaction: f.flow.reactionTime,
					index: i,
					time: new Date(f.flow.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
				});
			}
		}
		return results;
	});

	// ── HOURLY HEATMAP ──
	let hourlyHeatmap = $derived.by(() => {
		const hours: Record<number, { correct: number; total: number }> = {};
		for (const f of dayFlows) {
			const h = new Date(f.flow.timestamp).getHours();
			if (!hours[h]) hours[h] = { correct: 0, total: 0 };
			hours[h].total++;
			if (f.flow.correct) hours[h].correct++;
		}
		const allHours = Object.keys(hours).map(Number).sort((a, b) => a - b);
		return allHours.map(h => ({
			hour: h,
			label: `${h.toString().padStart(2, '0')}:00`,
			accuracy: hours[h].total > 0 ? Math.round((hours[h].correct / hours[h].total) * 100) : 0,
			total: hours[h].total,
			correct: hours[h].correct,
		}));
	});

	let easyWordsLostToRushing = $derived(assumptionFailures.filter(f => f.word.length <= 6));

	// ── CASCADES: chains of consecutive assumption failures ──
	let cascades = $derived.by(() => {
		const chains: { start: number; length: number; words: string[] }[] = [];
		let current: { start: number; words: string[] } | null = null;

		for (let i = 0; i < allDayFlows.length; i++) {
			const f = allDayFlows[i];
			const isAssumption = !f.flow.correct && f.flow.reactionTime < 150 && (f.flow.totalDuration || 0) <= 50;

			if (isAssumption) {
				if (!current) current = { start: i, words: [f.word] };
				else current.words.push(f.word);
			} else {
				if (current && current.words.length >= 3) {
					chains.push({ start: current.start, length: current.words.length, words: current.words });
				}
				current = null;
			}
		}
		if (current && current.words.length >= 3) {
			chains.push({ start: current.start, length: current.words.length, words: current.words });
		}
		return chains;
	});

	function formatMs(ms: number): string {
		return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
	}

	// ── PATTERN DETECTION ENGINE ──

	interface FlowStreak {
		startIdx: number;
		endIdx: number;
		length: number;
		avgInterval: number;
		cv: number;
		avgReaction: number;
		speed: number;
		sessionIdx: number;
		posInSession: number;
		avgWordLen: number;
		words: string[];
		mode: string;
		wordFlows: WordFlow[];
	}

	interface SpiralCluster {
		startIdx: number;
		endIdx: number;
		errorCount: number;
		trigger: string;
		triggerWordLen: number;
		triggerFamiliarity: number;
		postErrorReaction: number;
		speed: number;
		sessionIdx: number;
		posInSession: number;
		words: string[];
		rushed: number;
		mode: string;
		wordFlows: WordFlow[];
	}

	function computeCV(intervals: number[]): number {
		if (intervals.length < 2) return 1;
		const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
		const stdDev = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
		return mean > 0 ? stdDev / mean : 1;
	}

	let flowStreaks = $derived.by((): FlowStreak[] => {
		if (dayFlows.length < 5) return [];
		const streaks: FlowStreak[] = [];
		let streakStart = -1;

		for (let i = 0; i < dayFlows.length; i++) {
			if (breakIndices.has(i)) {
				// End current streak if exists
				if (streakStart >= 0 && i - streakStart >= 5) {
					streaks.push(buildFlowStreak(streakStart, i - 1));
				}
				streakStart = -1;
			}
			if (dayFlows[i].flow.correct) {
				if (streakStart < 0) streakStart = i;
			} else {
				if (streakStart >= 0 && i - streakStart >= 5) {
					streaks.push(buildFlowStreak(streakStart, i - 1));
				}
				streakStart = -1;
			}
		}
		if (streakStart >= 0 && dayFlows.length - streakStart >= 5) {
			streaks.push(buildFlowStreak(streakStart, dayFlows.length - 1));
		}
		return streaks.sort((a, b) => b.length - a.length);
	});

	function buildFlowStreak(start: number, end: number): FlowStreak {
		const flows = dayFlows.slice(start, end + 1);
		const allIntervals = flows.flatMap(f => f.flow.letterIntervals.slice(1).filter(v => v > 0));
		const avg = allIntervals.length > 0 ? allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length : 0;
		const reactions = flows.map(f => f.flow.reactionTime).filter(r => r > 0);
		const pos = start < sessionPositionMap.length ? sessionPositionMap[start] : { sessionIdx: 0, posInSession: 0 };
		const modes = flows.map(f => f.flow.mode || 'letter-by-letter');
		const modeCounts = new Map<string, number>();
		for (const m of modes) modeCounts.set(m, (modeCounts.get(m) || 0) + 1);
		const dominantMode = [...modeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'letter-by-letter';

		return {
			startIdx: start,
			endIdx: end,
			length: end - start + 1,
			avgInterval: Math.round(avg),
			cv: Math.round(computeCV(allIntervals) * 1000) / 1000,
			avgReaction: reactions.length > 0 ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length) : 0,
			speed: flows[0].flow.speed || 0,
			sessionIdx: pos.sessionIdx,
			posInSession: pos.posInSession,
			avgWordLen: Math.round(flows.reduce((s, f) => s + f.wordLen, 0) / flows.length * 10) / 10,
			words: flows.map(f => f.word),
			mode: dominantMode,
			wordFlows: flows,
		};
	}

	let spiralClusters = $derived.by((): SpiralCluster[] => {
		if (dayFlows.length < 3) return [];
		const clusters: SpiralCluster[] = [];
		let i = 0;

		while (i < dayFlows.length) {
			if (!dayFlows[i].flow.correct) {
				// Found an error — look for cluster (3+ errors in 5 words)
				const windowEnd = Math.min(i + 5, dayFlows.length);
				let errorCount = 0;
				let clusterEnd = i;
				const clusterWords: string[] = [];
				let rushed = 0;

				for (let j = i; j < windowEnd; j++) {
					if (breakIndices.has(j)) break;
					clusterWords.push(dayFlows[j].word);
					if (!dayFlows[j].flow.correct) {
						errorCount++;
						clusterEnd = j;
					}
					if (dayFlows[j].flow.reactionTime < 150) rushed++;
				}

				if (errorCount >= 3) {
					const trigger = dayFlows[i];
					const pos = i < sessionPositionMap.length ? sessionPositionMap[i] : { sessionIdx: 0, posInSession: 0 };
					const nextWordReaction = i + 1 < dayFlows.length ? dayFlows[i + 1].flow.reactionTime : 0;
					const wordStats = words.find(w => w.word.word === trigger.word);

					const clusterFlows = dayFlows.slice(i, clusterEnd + 1);
					const clusterMode = trigger.flow.mode || 'letter-by-letter';

					clusters.push({
						startIdx: i,
						endIdx: clusterEnd,
						errorCount,
						trigger: trigger.word,
						triggerWordLen: trigger.wordLen,
						triggerFamiliarity: wordStats?.stats.seen || 0,
						postErrorReaction: Math.round(nextWordReaction),
						speed: trigger.flow.speed || 0,
						sessionIdx: pos.sessionIdx,
						posInSession: pos.posInSession,
						words: clusterWords,
						rushed,
						mode: clusterMode,
						wordFlows: clusterFlows,
					});
					i = clusterEnd + 1;
					continue;
				}
			}
			i++;
		}
		return clusters;
	});

	// Aggregate flow/spiral fingerprints
	let patternSummary = $derived.by(() => {
		if (flowStreaks.length === 0 && spiralClusters.length === 0) return null;

		// Flow fingerprint
		const flowSpeeds = flowStreaks.map(s => s.speed).filter(s => s > 0);
		const flowPositions = flowStreaks.map(s => s.posInSession);
		const flowReactions = flowStreaks.map(s => s.avgReaction).filter(r => r > 0);
		const flowCVs = flowStreaks.map(s => s.cv);
		const flowWordLens = flowStreaks.map(s => s.avgWordLen);

		// Spiral fingerprint
		const spiralSpeeds = spiralClusters.map(s => s.speed).filter(s => s > 0);
		const spiralPositions = spiralClusters.map(s => s.posInSession);
		const spiralTriggerLens = spiralClusters.map(s => s.triggerWordLen);
		const spiralPostReactions = spiralClusters.map(s => s.postErrorReaction).filter(r => r > 0);
		const spiralRushed = spiralClusters.reduce((s, c) => s + c.rushed, 0);
		const spiralUnfamiliar = spiralClusters.filter(c => c.triggerFamiliarity <= 1).length;

		const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
		const avgF = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100 : 0;

		return {
			totalFlowWords: flowStreaks.reduce((s, f) => s + f.length, 0),
			totalSpiralErrors: spiralClusters.reduce((s, c) => s + c.errorCount, 0),
			longestStreak: flowStreaks.length > 0 ? flowStreaks[0].length : 0,
			flowCount: flowStreaks.length,
			spiralCount: spiralClusters.length,
			flow: {
				avgSpeed: avgF(flowSpeeds),
				avgPosition: avg(flowPositions),
				avgReaction: avg(flowReactions),
				avgCV: avgF(flowCVs),
				avgWordLen: avgF(flowWordLens),
			},
			spiral: {
				avgSpeed: avgF(spiralSpeeds),
				avgPosition: avg(spiralPositions),
				avgTriggerLen: avgF(spiralTriggerLens),
				avgPostReaction: avg(spiralPostReactions),
				rushedCount: spiralRushed,
				unfamiliarTriggers: spiralUnfamiliar,
				unfamiliarPct: spiralClusters.length > 0 ? Math.round((spiralUnfamiliar / spiralClusters.length) * 100) : 0,
			},
		};
	});

	// ── ECHARTS SETUP ──
	const darkTheme = {
		backgroundColor: 'transparent',
		textStyle: { color: '#9ca3af' },
		title: { textStyle: { color: '#e5e7eb' } },
	};

	let flowChartEl: HTMLDivElement | undefined = $state();
	let accuracyChartEl: HTMLDivElement | undefined = $state();
	let reactionChartEl: HTMLDivElement | undefined = $state();
	let lengthChartEl: HTMLDivElement | undefined = $state();
	let assumptionsChartEl: HTMLDivElement | undefined = $state();
	let heatmapChartEl: HTMLDivElement | undefined = $state();
	let expandedSessionIdx: number | null = $state(null);
	let patternsChartEl: HTMLDivElement | undefined = $state();
	let patternPopup: { type: 'flow' | 'spiral'; index: number } | null = $state(null);
	let patternSessionFilter: number | null = $state(null); // null = all sessions

	// ── SESSION REPLAY ──
	let sessionReplayActive = $state(false);
	let sessionReplayFlows: WordFlow[] = $state([]);
	let sessionReplayIdx = $state(0);
	let sessionReplayLetterIdx = $state(0);
	let sessionReplaySpeed = $state(1);
	let sessionReplayPaused = $state(false);
	let sessionReplayTimers: ReturnType<typeof setTimeout>[] = [];
	let sessionReplayStats = $state({ correct: 0, errors: 0, combo: 0, bestCombo: 0 });
	let sessionReplayLabel = $state('');
	let sessionReplayFlash: 'success' | 'error' | '' = $state('');
	let sessionReplayHideRef = $state(false);
	let sessionReplayMode: 'as-typed' | 'left-to-right' | 'center' = $state('as-typed');
	let sessionReplayShowFuture = $state(false);
	let sessionReplayShowPast = $state(true);

	// Build replay settings and word object for RenderWord
	let replaySettings = $derived.by((): MindDojoSettings | null => {
		if (!sessionReplayActive) return null;
		const wf = sessionReplayFlows[sessionReplayIdx];
		if (!wf) return null;
		const flow = wf.flow;
		const mode = flow.mode || 'letter-by-letter';
		const dir = sessionReplayMode === 'as-typed'
			? (flow.direction || 'left-to-right')
			: sessionReplayMode;

		const base = originalSettingsGetter?.() || {} as MindDojoSettings;
		const effectiveDir = (mode === 'full-word' ? 'left-to-right' : dir) as 'left-to-right' | 'center';
		// Future ON with left-to-right: show untyped letters (use full-word rendering for untyped visibility)
		// Future OFF: letter-by-letter hides untyped, center shows only current
		const useFullWordRendering = mode === 'full-word' || (sessionReplayShowFuture && effectiveDir === 'left-to-right');
		return {
			...base,
			displayMode: useFullWordRendering ? 'full-word' : 'letter-by-letter',
			letterStyle: {
				randomSize: false, randomWeight: false, randomFont: false,
				randomTransform: false, randomColor: false,
				letterDisplayDirection: effectiveDir,
			},
			hideTypedLetter: !sessionReplayShowPast,
			joinRandomLetters: true, // suppress WordMeaning popup in replay
			displayLetterInUpperCase: base?.displayLetterInUpperCase || false,
		} as MindDojoSettings;
	});

	let replayWord = $derived.by(() => {
		if (!sessionReplayActive) return null;
		const wf = sessionReplayFlows[sessionReplayIdx];
		if (!wf) return null;
		return { word: wf.word, meanings: [], synonyms: [], antonyms: [] };
	});

	let replayTypedWord = $derived.by(() => {
		if (!sessionReplayActive) return '';
		const wf = sessionReplayFlows[sessionReplayIdx];
		if (!wf) return '';
		return wf.word.slice(0, sessionReplayLetterIdx);
	});

	let replayBaseStyles = $derived.by(() => {
		if (!sessionReplayActive || !replaySettings) return [];
		const wf = sessionReplayFlows[sessionReplayIdx];
		if (!wf) return [];
		return wf.word.split('').map(letter => getBaseStyle(letter, replaySettings!));
	});

	function startSessionReplay(flows: WordFlow[], label: string = '') {
		stopSessionReplay();
		if (flows.length === 0) return;
		sessionReplayFlows = flows;
		sessionReplayLabel = label;
		sessionReplayActive = true;
		sessionReplayIdx = 0;
		sessionReplayLetterIdx = 0;
		sessionReplayPaused = false;
		sessionReplayStats = { correct: 0, errors: 0, combo: 0, bestCombo: 0 };
		updateReplaySettingsOverride();
		playNextWord();
	}

	function updateReplaySettingsOverride() {
		if (!sessionReplayActive || !replaySettings) {
			replaySettingsOverride = null;
			return;
		}
		replaySettingsOverride = replaySettings;
	}

	function playNextWord() {
		if (sessionReplayIdx >= sessionReplayFlows.length || sessionReplayPaused) return;
		updateReplaySettingsOverride();
		const wf = sessionReplayFlows[sessionReplayIdx];
		const flow = wf.flow;
		sessionReplayLetterIdx = 0;

		const speedFactor = sessionReplaySpeed;
		const reaction = flow.reactionTime || 500;

		// Show reaction delay then animate letters
		let cumulative = reaction / speedFactor;
		sessionReplayTimers.push(setTimeout(() => {
			sessionReplayLetterIdx = 1;
		}, cumulative));

		for (let i = 1; i < flow.letterIntervals.length; i++) {
			cumulative += (flow.letterIntervals[i] || 0) / speedFactor;
			const idx = i + 1;
			sessionReplayTimers.push(setTimeout(() => {
				sessionReplayLetterIdx = idx;
			}, cumulative));
		}

		// After word completes — flash + update stats + next word
		cumulative += 200 / speedFactor;
		sessionReplayTimers.push(setTimeout(() => {
			// Flash
			sessionReplayFlash = flow.correct ? 'success' : 'error';
			setTimeout(() => { sessionReplayFlash = ''; }, 300 / speedFactor);

			if (flow.correct) {
				sessionReplayStats.correct++;
				sessionReplayStats.combo++;
				if (sessionReplayStats.combo > sessionReplayStats.bestCombo) sessionReplayStats.bestCombo = sessionReplayStats.combo;
			} else {
				sessionReplayStats.errors++;
				sessionReplayStats.combo = 0;
			}
			sessionReplayStats = sessionReplayStats;
		}, cumulative));

		cumulative += 500 / speedFactor;
		sessionReplayTimers.push(setTimeout(() => {
			sessionReplayIdx++;
			if (sessionReplayIdx < sessionReplayFlows.length && !sessionReplayPaused) {
				playNextWord();
			}
		}, cumulative));
	}

	function stopSessionReplay() {
		for (const t of sessionReplayTimers) clearTimeout(t);
		sessionReplayTimers = [];
		sessionReplayActive = false;
		sessionReplayPaused = false;
		replaySettingsOverride = null;
	}

	function toggleSessionReplayPause() {
		if (sessionReplayPaused) {
			sessionReplayPaused = false;
			playNextWord();
		} else {
			sessionReplayPaused = true;
			for (const t of sessionReplayTimers) clearTimeout(t);
			sessionReplayTimers = [];
		}
	}

	function skipToWord(idx: number) {
		for (const t of sessionReplayTimers) clearTimeout(t);
		sessionReplayTimers = [];
		// Recompute stats up to this point
		let correct = 0, errors = 0, combo = 0, bestCombo = 0;
		for (let i = 0; i < idx; i++) {
			if (sessionReplayFlows[i].flow.correct) { correct++; combo++; if (combo > bestCombo) bestCombo = combo; }
			else { errors++; combo = 0; }
		}
		sessionReplayStats = { correct, errors, combo, bestCombo };
		sessionReplayIdx = idx;
		sessionReplayLetterIdx = 0;
		sessionReplayPaused = false;
		updateReplaySettingsOverride();
		playNextWord();
	}

	function skipToNextError() {
		for (let i = sessionReplayIdx + 1; i < sessionReplayFlows.length; i++) {
			if (!sessionReplayFlows[i].flow.correct) { skipToWord(i); return; }
		}
	}

	function skipToNextFlow() {
		let streak = 0;
		for (let i = sessionReplayIdx + 1; i < sessionReplayFlows.length; i++) {
			if (sessionReplayFlows[i].flow.correct) { streak++; if (streak >= 3) { skipToWord(i - 2); return; } }
			else streak = 0;
		}
	}

	const chartGroups = [
		{ label: 'Overview', tabs: [
			{ key: 'sessions', label: 'Sessions' },
			{ key: 'flow', label: 'Flow' },
			{ key: 'patterns', label: 'Patterns' },
		]},
		{ label: 'Timing', tabs: [
			{ key: 'accuracy', label: 'Accuracy' },
			{ key: 'reaction', label: 'Reaction' },
			{ key: 'sessionpos', label: 'Position' },
		]},
		{ label: 'Errors', tabs: [
			{ key: 'errors', label: 'Types' },
			{ key: 'errorpos', label: 'Position' },
			{ key: 'recovery', label: 'Recovery' },
			{ key: 'assumptions', label: 'Rushed' },
		]},
		{ label: 'Breakdown', tabs: [
			{ key: 'length', label: 'Length' },
			{ key: 'modes', label: 'Modes' },
			{ key: 'combos', label: 'Combos' },
			{ key: 'autospeed', label: 'Speed' },
			{ key: 'heatmap', label: 'Hourly' },
		]},
	] as const;
	let activeGroup = $derived(chartGroups.find(g => g.tabs.some(t => t.key === activeChart)) || chartGroups[0]);
	let modesChartEl: HTMLDivElement | undefined = $state();
	let recoveryChartEl: HTMLDivElement | undefined = $state();
	let autospeedChartEl: HTMLDivElement | undefined = $state();
	let combosChartEl: HTMLDivElement | undefined = $state();
	let errorposChartEl: HTMLDivElement | undefined = $state();
	let sessionposChartEl: HTMLDivElement | undefined = $state();

	let charts: Map<string, echarts.ECharts> = new Map();

	function getOrCreateChart(key: string, el: HTMLDivElement): echarts.ECharts {
		let chart = charts.get(key);
		if (chart) {
			// If the DOM element changed, dispose the old one
			if (chart.getDom() !== el) {
				chart.dispose();
				chart = undefined;
			}
		}
		if (!chart) {
			chart = echarts.init(el, darkTheme, { renderer: 'canvas' });
			charts.set(key, chart);
		}
		return chart;
	}

	/** Apply global chart type preference to switchable series */
	function applyGlobalType(option: any): any {
		const t = chartPrefs.type; // read reactive value so $effect tracks it
		if (!option.series) return option;
		const series = Array.isArray(option.series) ? option.series : [option.series];
		option.series = series.map((s: any) => {
			if (s._fixed) return s;
			const base = s._baseType || s.type;
			if (!['line', 'bar', 'scatter'].includes(base)) return s;
			const patched = { ...s, type: t };
			if (t === 'bar') {
				patched.barMaxWidth = 8;
				delete patched.areaStyle;
			} else if (t === 'scatter') {
				patched.symbolSize = s.symbolSize || 6;
				delete patched.areaStyle;
			}
			return patched;
		});
		// Ensure scroll=pan, ctrl+scroll=zoom on all dataZoom
		if (option.dataZoom) {
			const zooms = Array.isArray(option.dataZoom) ? option.dataZoom : [option.dataZoom];
			option.dataZoom = zooms.map((dz: any) => {
				if (dz.type === 'inside') {
					return { ...dz, zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: true, moveOnMouseMove: false };
				}
				return dz;
			});
		}
		return option;
	}

	function disposeChart(key: string) {
		const chart = charts.get(key);
		if (chart) {
			chart.dispose();
			charts.delete(key);
		}
	}

	// ResizeObserver for responsive charts
	let resizeObserver: ResizeObserver | undefined;

	function setupResize() {
		resizeObserver?.disconnect();
		resizeObserver = new ResizeObserver(() => {
			for (const chart of charts.values()) {
				chart.resize();
			}
		});
	}

	// ── FLOW STATE CHART ──
	$effect(() => {
		if (activeChart !== 'flow' || !flowChartEl || flowData.length === 0) {
			disposeChart('flow');
			return;
		}

		const chart = getOrCreateChart('flow', flowChartEl);
		resizeObserver?.observe(flowChartEl);

		// Use time labels on X-axis, null values at breaks
		const xLabels = flowData.map(f => f.isBreak ? '' : formatTime(f.timestamp));
		const yData = flowData.map(f => f.isBreak ? null : f.speed);
		const realPoints = flowData.filter(f => !f.isBreak);
		const correctDots = realPoints.filter(f => f.correct).map(f => [f.index, f.speed]);
		const errorDots = realPoints.filter(f => !f.correct).map(f => [f.index, f.speed]);

		// Zone transition marklines (skip breaks)
		const transitionLines = realPoints
			.filter((f, i) => {
				const prev = realPoints[i - 1];
				return prev && prev.speed !== f.speed;
			})
			.map(f => ({
				xAxis: f.index,
				lineStyle: { color: speedZoneColor(f.speed), type: 'dashed' as const, opacity: 0.5 },
			}));

		// Build visualMap pieces based on speed zones
		const pieces = flowData.map((f, i) => ({
			gte: i > 0 ? i - 0.5 : 0,
			lt: i + 0.5,
			color: f.isBreak ? 'transparent' : speedZoneColor(f.speed),
		}));

		chart.setOption(applyGlobalType({
			animation: false,
			grid: { top: 20, right: 16, bottom: 50, left: 50, containLabel: false },
			tooltip: {
				trigger: 'axis',
				backgroundColor: '#1f2937',
				borderColor: '#374151',
				textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => {
					const p = Array.isArray(params) ? params[0] : params;
					if (!p || p.dataIndex === undefined) return '';
					const d = flowData[p.dataIndex];
					if (!d || d.isBreak) return '<span style="color:#6b7280">Session break</span>';
					const di = d.dayIndex ?? p.dataIndex;
					const pos = di < sessionPositionMap.length ? sessionPositionMap[di] : { sessionIdx: 0, posInSession: 0 };
					const resultColor = d.correct ? '#22c55e' : '#ef4444';
					const resultText = d.correct ? 'correct' : 'error';
					return `<b style="color:${resultColor}">${d.word}</b> <span style="color:#6b7280">${resultText}</span><br/>`
						+ `<span style="color:#6b7280">zone:</span> ${speedZoneLabel(d.speed)} <span style="color:#6b7280">speed:</span> ${d.speed?.toFixed(2)}x<br/>`
						+ `Session ${pos.sessionIdx}, word #${pos.posInSession}<br/>`
						+ `<span style="color:#6b7280">${formatTime(d.timestamp)}</span>`;
				},
			},
			xAxis: {
				type: 'category',
				data: xLabels,
				axisLabel: { color: '#6b7280', fontSize: 9, interval: 'auto' },
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				min: (value: any) => (value.min * 0.98).toFixed(2),
				max: (value: any) => (value.max * 1.02).toFixed(2),
				axisLabel: { color: '#6b7280', fontSize: 9, formatter: (v: number) => v.toFixed(2) },
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
			},
			visualMap: {
				show: false,
				dimension: 0,
				pieces,
			},
			dataZoom: [
				{ type: 'inside', start: 0, end: 100 },
				{ type: 'slider', start: 0, end: 100, height: 20, borderColor: '#374151', fillerColor: 'rgba(99,102,241,0.15)', textStyle: { color: '#6b7280' } },
			],
			series: [
				{
					name: 'Speed',
					type: 'line',
					data: yData,
					symbol: 'none',
					lineStyle: { width: 2 },
					connectNulls: false,
					markLine: {
						silent: true,
						symbol: 'none',
						data: transitionLines,
						label: { show: false },
					},
					_fixed: true,
				},
				{
					name: 'Correct',
					type: 'scatter',
					data: correctDots,
					symbol: 'circle',
					symbolSize: 5,
					itemStyle: { color: '#22c55e', opacity: 0.7 },
					z: 10,
					_fixed: true,
				},
				{
					name: 'Error',
					type: 'scatter',
					data: errorDots,
					symbol: 'circle',
					symbolSize: 7,
					itemStyle: { color: '#ef4444', opacity: 0.9 },
					z: 10,
					_fixed: true,
				},
			],
		}), true);

		return () => {
			resizeObserver?.unobserve(flowChartEl!);
			disposeChart('flow');
		};
	});

	// ── ROLLING ACCURACY CHART ──
	$effect(() => {
		if (activeChart !== 'accuracy' || !accuracyChartEl || rollingAccuracy.length === 0) {
			disposeChart('accuracy');
			return;
		}

		const chart = getOrCreateChart('accuracy', accuracyChartEl);
		resizeObserver?.observe(accuracyChartEl);

		const xData = rollingAccuracy.map(r => formatTime(r.timestamp));
		const yData = rollingAccuracy.map(r => r.accuracy !== null ? +r.accuracy.toFixed(1) : null);

		chart.setOption(applyGlobalType({
			animation: false,
			grid: { top: 20, right: 40, bottom: 50, left: 50, containLabel: false },
			tooltip: {
				trigger: 'axis',
				backgroundColor: '#1f2937',
				borderColor: '#374151',
				textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => {
					const p = Array.isArray(params) ? params[0] : params;
					if (!p || p.dataIndex === undefined) return '';
					const d = rollingAccuracy[p.dataIndex];
					if (d.accuracy === null) return '<span style="color:#6b7280">Session break</span>';
					const resultColor = d.wordCorrect ? '#22c55e' : '#ef4444';
					const resultText = d.wordCorrect ? 'correct' : 'error';
					const reactionText = d.reaction > 0 ? `${Math.round(d.reaction)}ms` : '—';
					return `<b style="color:${resultColor}">${d.word}</b> <span style="color:#6b7280">${resultText}</span><br/>`
						+ `<b>${Math.round(d.accuracy)}%</b> rolling (${d.correct}/20)<br/>`
						+ `Session ${d.sessionIdx}, word #${d.posInSession}<br/>`
						+ `<span style="color:#6b7280">react:</span> ${reactionText} <span style="color:#6b7280">speed:</span> ${d.speed.toFixed(2)}x`;
				},
			},
			xAxis: {
				type: 'category',
				data: xData,
				axisLabel: { color: '#6b7280', fontSize: 9, interval: 'auto' },
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				min: 0,
				max: 100,
				axisLabel: { color: '#6b7280', fontSize: 9, formatter: '{value}%' },
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
			},
			dataZoom: [
				{ type: 'inside', start: 0, end: 100, zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: true, moveOnMouseMove: true },
				{ type: 'slider', start: 0, end: 100, height: 20, borderColor: '#374151', fillerColor: 'rgba(99,102,241,0.15)', textStyle: { color: '#6b7280' } },
			],
			series: [
				{
					name: 'Accuracy',
					type: 'line',
					data: yData,
					symbol: 'none',
					connectNulls: false,
					lineStyle: { width: 1.5, color: '#06b6d4' },
					areaStyle: { color: 'rgba(6, 182, 212, 0.08)' },
					itemStyle: { color: '#06b6d4' },
					_fixed: true,
					markLine: {
						silent: true,
						symbol: 'none',
						lineStyle: { width: 1, type: 'dashed' },
						label: { position: 'end', fontSize: 9, padding: [0, 0, 0, 4] },
						data: [
							{ yAxis: 80, lineStyle: { color: '#22c55e', opacity: 0.5 }, label: { formatter: 'flow', color: '#06b6d4' } },
							{ yAxis: 60, lineStyle: { color: '#f59e0b', opacity: 0.5 }, label: { formatter: 'drop', color: '#f59e0b' } },
						],
					},
				},
			],
		}), true);

		return () => {
			resizeObserver?.unobserve(accuracyChartEl!);
			disposeChart('accuracy');
		};
	});

	// ── REACTION TIME CHART ──
	$effect(() => {
		if (activeChart !== 'reaction' || !reactionChartEl || reactionData.length === 0) {
			disposeChart('reaction');
			return;
		}

		const chart = getOrCreateChart('reaction', reactionChartEl);
		resizeObserver?.observe(reactionChartEl);

		const maxR = Math.min(Math.max(...reactionData.map(r => r.reaction)), 5000);
		const sortedReactions = [...reactionData.map(r => r.reaction)].sort((a, b) => a - b);
		const medianR = sortedReactions[Math.floor(sortedReactions.length / 2)];

		const scatterData = reactionData.map(p => {
			const isRushed = p.reaction < 150;
			const pos = p.index < sessionPositionMap.length ? sessionPositionMap[p.index] : { sessionIdx: 0, posInSession: 0 };
			return {
				value: [p.index, Math.min(p.reaction, maxR)],
				itemStyle: {
					color: isRushed ? '#f59e0b' : p.correct ? '#22c55e' : '#ef4444',
					opacity: 0.7,
				},
				symbolSize: isRushed ? 7 : 5,
				_word: p.word,
				_correct: p.correct,
				_rushed: isRushed,
				_reaction: p.reaction,
				_time: formatTime(p.timestamp),
				_sessIdx: pos.sessionIdx,
				_posInSess: pos.posInSession,
			};
		});

		chart.setOption(applyGlobalType({
			animation: false,
			grid: { top: 20, right: 16, bottom: 50, left: 55, containLabel: false },
			tooltip: {
				trigger: 'item',
				backgroundColor: '#1f2937',
				borderColor: '#374151',
				textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => {
					const d = params.data;
					const resultColor = d._correct ? '#22c55e' : '#ef4444';
					return `<b style="color:${resultColor}">${d._word}</b>: ${Math.round(d._reaction)}ms${d._rushed ? ' <span style="color:#f59e0b">(rushed!)</span>' : ''}<br/>`
						+ `${d._correct ? 'correct' : 'error'}<br/>`
						+ `Session ${d._sessIdx}, word #${d._posInSess}<br/>`
						+ `<span style="color:#6b7280">${d._time || ''}</span>`;
				},
			},
			xAxis: {
				type: 'value',
				name: 'Word #',
				nameTextStyle: { color: '#6b7280', fontSize: 9 },
				axisLabel: { color: '#6b7280', fontSize: 9 },
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
			},
			yAxis: {
				type: 'value',
				name: 'ms',
				nameTextStyle: { color: '#6b7280', fontSize: 9 },
				max: maxR,
				axisLabel: {
					color: '#6b7280',
					fontSize: 9,
					formatter: (v: number) => formatMs(v),
				},
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
			},
			dataZoom: [
				{ type: 'inside', start: 0, end: 100 },
				{ type: 'slider', start: 0, end: 100, height: 20, borderColor: '#374151', fillerColor: 'rgba(99,102,241,0.15)', textStyle: { color: '#6b7280' } },
			],
			series: [
				{
					name: 'Reaction',
					type: 'scatter',
					data: scatterData,
					markLine: {
						silent: true,
						symbol: 'none',
						lineStyle: { color: '#f59e0b', type: 'dashed', opacity: 0.5 },
						label: { position: 'end', formatter: 'median', color: '#f59e0b', fontSize: 9 },
						data: [{ yAxis: medianR }],
					},
				},
			],
		}), true);

		return () => {
			resizeObserver?.unobserve(reactionChartEl!);
			disposeChart('reaction');
		};
	});

	// ── WORD LENGTH CHART ──
	$effect(() => {
		if (activeChart !== 'length' || !lengthChartEl || lengthAccuracy.length === 0) {
			disposeChart('length');
			return;
		}

		const chart = getOrCreateChart('length', lengthChartEl);
		resizeObserver?.observe(lengthChartEl);

		const categories = lengthAccuracy.map(b => b.label);
		const values = lengthAccuracy.map(b => b.accuracy);
		const colors = lengthAccuracy.map(b =>
			b.accuracy >= 60 ? '#22c55e' : b.accuracy >= 40 ? '#f59e0b' : '#ef4444'
		);

		chart.setOption(applyGlobalType({
			animation: false,
			grid: { top: 10, right: 60, bottom: 10, left: 50, containLabel: false },
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				backgroundColor: '#1f2937',
				borderColor: '#374151',
				textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => {
					const p = Array.isArray(params) ? params[0] : params;
					const b = lengthAccuracy[p.dataIndex];
					return `<b>${b.label} letters</b><br/>${b.accuracy}% (${b.correct}/${b.total})`;
				},
			},
			xAxis: {
				type: 'value',
				max: 100,
				axisLabel: { color: '#6b7280', fontSize: 9, formatter: '{value}%' },
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
			},
			yAxis: {
				type: 'category',
				data: categories,
				inverse: true,
				axisLabel: { color: '#9ca3af', fontSize: 10, fontFamily: 'monospace' },
				axisLine: { lineStyle: { color: '#374151' } },
			},
			series: [
				{
					name: 'Accuracy',
					type: 'bar',
					data: values.map((v, i) => ({
						value: v,
						itemStyle: { color: colors[i], opacity: 0.4 },
					})),
					barWidth: '60%',
					label: {
						show: true,
						position: 'right',
						formatter: (p: any) => {
							const b = lengthAccuracy[p.dataIndex];
							return `${b.accuracy}%  ${b.correct}/${b.total}`;
						},
						color: '#9ca3af',
						fontSize: 10,
					},
				},
			],
		}), true);

		return () => {
			resizeObserver?.unobserve(lengthChartEl!);
			disposeChart('length');
		};
	});

	// ── ASSUMPTIONS/RUSHED CHART ──
	$effect(() => {
		if (activeChart !== 'assumptions' || !assumptionsChartEl || allDayFlows.length === 0) {
			disposeChart('assumptions');
			return;
		}

		const chart = getOrCreateChart('assumptions', assumptionsChartEl);
		resizeObserver?.observe(assumptionsChartEl);

		// Build timeline bar data: each word is a bar segment (uses allDayFlows to include instant-fails)
		const barData = allDayFlows.map((f, i) => {
			const isAssumption = !f.flow.correct && f.flow.reactionTime < 150 && (f.flow.totalDuration || 0) <= 50;
			return {
				value: 1,
				itemStyle: {
					color: isAssumption ? '#f59e0b' : f.flow.correct ? '#22c55e' : '#ef4444',
					opacity: isAssumption ? 0.6 : 0.12,
				},
				_word: f.word,
				_correct: f.flow.correct,
				_isAssumption: isAssumption,
				_index: i,
			};
		});

		chart.setOption(applyGlobalType({
			animation: false,
			grid: { top: 4, right: 10, bottom: 4, left: 10, containLabel: false },
			tooltip: {
				trigger: 'item',
				backgroundColor: '#1f2937',
				borderColor: '#374151',
				textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => {
					const d = params.data;
					const status = d._isAssumption ? '<span style="color:#f59e0b">rushed</span>' : d._correct ? '<span style="color:#22c55e">correct</span>' : '<span style="color:#ef4444">error</span>';
					return `#${d._index + 1} <b>${d._word}</b> ${status}`;
				},
			},
			xAxis: {
				type: 'category',
				data: dayFlows.map((_, i) => i),
				show: false,
			},
			yAxis: {
				type: 'value',
				show: false,
				max: 1,
			},
			series: [
				{
					type: 'bar',
					data: barData,
					barWidth: '100%',
					barCategoryGap: '0%',
					barGap: '0%',
				},
			],
		}), true);

		return () => {
			resizeObserver?.unobserve(assumptionsChartEl!);
			disposeChart('assumptions');
		};
	});

	// ── HOURLY HEATMAP CHART ──
	$effect(() => {
		if (activeChart !== 'heatmap' || !heatmapChartEl || hourlyHeatmap.length === 0) {
			disposeChart('heatmap');
			return;
		}

		const chart = getOrCreateChart('heatmap', heatmapChartEl);
		resizeObserver?.observe(heatmapChartEl);

		const labels = hourlyHeatmap.map(h => h.label);
		const accValues = hourlyHeatmap.map(h => ({
			value: h.accuracy,
			itemStyle: {
				color: h.accuracy >= 60 ? '#22c55e' : h.accuracy >= 40 ? '#f59e0b' : '#ef4444',
				opacity: 0.4,
			},
		}));
		const volValues = hourlyHeatmap.map(h => h.total);
		const maxVol = Math.max(...volValues, 1);

		chart.setOption(applyGlobalType({
			animation: false,
			grid: { top: 20, right: 16, bottom: 30, left: 50, containLabel: false },
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				backgroundColor: '#1f2937',
				borderColor: '#374151',
				textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => {
					const ps = Array.isArray(params) ? params : [params];
					const idx = ps[0]?.dataIndex;
					if (idx === undefined) return '';
					const h = hourlyHeatmap[idx];
					return `<b>${h.label}</b><br/>Accuracy: ${h.accuracy}% (${h.correct}/${h.total})<br/>Volume: ${h.total} words`;
				},
			},
			xAxis: {
				type: 'category',
				data: labels,
				axisLabel: { color: '#6b7280', fontSize: 9 },
				axisLine: { lineStyle: { color: '#374151' } },
			},
			yAxis: [
				{
					type: 'value',
					name: 'Accuracy %',
					nameTextStyle: { color: '#6b7280', fontSize: 9 },
					max: 100,
					axisLabel: { color: '#6b7280', fontSize: 9, formatter: '{value}%' },
					axisLine: { lineStyle: { color: '#374151' } },
					splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
				},
				{
					type: 'value',
					name: 'Volume',
					nameTextStyle: { color: '#6b7280', fontSize: 9 },
					max: maxVol * 1.2,
					axisLabel: { show: false },
					axisLine: { show: false },
					splitLine: { show: false },
				},
			],
			series: [
				{
					name: 'Accuracy',
					type: 'bar',
					data: accValues,
					barWidth: '50%',
					yAxisIndex: 0,
					label: {
						show: true,
						position: 'top',
						formatter: (p: any) => `${p.value}%`,
						color: '#9ca3af',
						fontSize: 9,
					},
				},
				{
					name: 'Volume',
					type: 'bar',
					data: volValues.map(v => ({
						value: v,
						itemStyle: { color: '#06b6d4', opacity: 0.2 },
					})),
					barWidth: '50%',
					yAxisIndex: 1,
					label: {
						show: true,
						position: 'top',
						formatter: (p: any) => `${p.value}w`,
						color: '#06b6d4',
						fontSize: 8,
					},
				},
			],
		}), true);

		return () => {
			resizeObserver?.unobserve(heatmapChartEl!);
			disposeChart('heatmap');
		};
	});

	// ── MODE BREAKDOWN ──
	let modeBreakdown = $derived.by(() => {
		const buckets: Record<string, { correct: number; total: number }> = {};
		for (const f of dayFlows) {
			const mode = f.flow.mode || 'letter-by-letter';
			if (!buckets[mode]) buckets[mode] = { correct: 0, total: 0 };
			buckets[mode].total++;
			if (f.flow.correct) buckets[mode].correct++;
		}
		return Object.entries(buckets).map(([mode, stats]) => ({
			mode,
			label: mode === 'letter-by-letter' ? 'Letter' : mode === 'full-word' ? 'Full Word' : 'Chaos',
			accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
			total: stats.total,
			correct: stats.correct,
			color: mode === 'chaos' ? '#ef4444' : mode === 'full-word' ? '#a855f7' : '#3b82f6',
		}));
	});

	$effect(() => {
		if (activeChart !== 'modes' || !modesChartEl || modeBreakdown.length === 0) {
			disposeChart('modes'); return;
		}
		const chart = getOrCreateChart('modes', modesChartEl);
		resizeObserver?.observe(modesChartEl);
		const labels = modeBreakdown.map(m => m.label);
		const accData = modeBreakdown.map(m => ({ value: m.accuracy, itemStyle: { color: m.color } }));
		const volData = modeBreakdown.map(m => ({ value: m.total, itemStyle: { color: m.color, opacity: 0.25 } }));
		chart.setOption({
			animation: false, backgroundColor: 'transparent',
			grid: { left: 70, right: 60, top: 10, bottom: 10, containLabel: false },
			xAxis: { type: 'value', max: 100, axisLabel: { color: '#6b7280', fontSize: 9, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
			yAxis: { type: 'category', data: labels, axisLabel: { color: '#e5e7eb', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
			tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#e5e7eb', fontSize: 11 } },
			series: [
				{ type: 'bar', _fixed: true, data: accData, barWidth: '40%', label: { show: true, position: 'right', fontSize: 10, color: '#e5e7eb', formatter: (p: any) => { const m = modeBreakdown[p.dataIndex]; return `${m.accuracy}% (${m.correct}/${m.total})`; } } },
			],
		}, true);
		return () => { resizeObserver?.unobserve(modesChartEl!); disposeChart('modes'); };
	});

	// ── RECOVERY AFTER ERROR ──
	let recoveryData = $derived.by(() => {
		if (allDayFlows.length < 6) return null;
		const baseline = dayFlows.length > 0 ? (dayFlows.filter(f => f.flow.correct).length / dayFlows.length) * 100 : 0;
		const errorIndices: number[] = [];
		for (let i = 0; i < allDayFlows.length; i++) {
			if (!allDayFlows[i].flow.correct) errorIndices.push(i);
		}
		if (errorIndices.length === 0) return null;
		const positions: { pos: number; correct: number; total: number; accuracy: number | null }[] = [];
		for (let offset = 1; offset <= 5; offset++) {
			let correct = 0, total = 0;
			for (const errIdx of errorIndices) {
				const nextIdx = errIdx + offset;
				if (nextIdx >= allDayFlows.length) continue;
				if (nextIdx > 0) {
					const gap = allDayFlows[nextIdx].flow.timestamp - allDayFlows[nextIdx - 1].flow.timestamp;
					if (gap >= BREAK_THRESHOLD_MS) continue;
				}
				total++;
				if (allDayFlows[nextIdx].flow.correct) correct++;
			}
			positions.push({ pos: offset, correct, total, accuracy: total > 0 ? (correct / total) * 100 : null });
		}
		return { baseline: Math.round(baseline), positions, errorCount: errorIndices.length };
	});

	$effect(() => {
		if (activeChart !== 'recovery' || !recoveryChartEl || !recoveryData) {
			disposeChart('recovery'); return;
		}
		const chart = getOrCreateChart('recovery', recoveryChartEl);
		resizeObserver?.observe(recoveryChartEl);
		const data = recoveryData;
		const xLabels = data.positions.map(p => `+${p.pos}`);
		const barData = data.positions.map(p => {
			if (p.accuracy === null) return { value: 0, itemStyle: { color: '#374151' } };
			const below = p.accuracy < data.baseline;
			return { value: Math.round(p.accuracy), itemStyle: { color: below ? '#ef4444' : '#22c55e' } };
		});
		chart.setOption(applyGlobalType({
			animation: false, backgroundColor: 'transparent',
			grid: { left: 46, right: 10, top: 20, bottom: 30, containLabel: false },
			xAxis: { type: 'category', data: xLabels, axisLabel: { color: '#e5e7eb', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
			yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: '#6b7280', fontSize: 9, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
			tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => { const p = Array.isArray(params) ? params[0] : params; const pos = data.positions[p.dataIndex]; return `Word ${p.name}: ${pos.accuracy !== null ? Math.round(pos.accuracy) + '%' : 'n/a'} (${pos.correct}/${pos.total})`; }
			},
			series: [{
				type: 'bar', _baseType: 'bar', data: barData, barWidth: '50%',
				label: { show: true, position: 'top', fontSize: 10, color: '#e5e7eb', formatter: (p: any) => { const pos = data.positions[p.dataIndex]; return pos.accuracy !== null ? `${Math.round(pos.accuracy)}%` : ''; } },
				markLine: { silent: true, symbol: 'none', data: [{ yAxis: data.baseline, label: { show: true, formatter: `baseline ${data.baseline}%`, fontSize: 9, color: '#06b6d4', position: 'end' }, lineStyle: { color: '#06b6d4', type: 'dashed', width: 1 } }] },
			}],
		}), true);
		return () => { resizeObserver?.unobserve(recoveryChartEl!); disposeChart('recovery'); };
	});

	// ── AUTO SPEED ZONE TIMELINE ──
	let autospeedData = $derived.by(() => {
		const speeds = dayFlows.map(f => f.flow.speed).filter((s): s is number => typeof s === 'number' && s > 0);
		const uniqueSpeeds = new Set(speeds.map(s => s.toFixed(3)));
		if (uniqueSpeeds.size < 2) return null;
		const data: (number | null)[] = [];
		const labels: string[] = [];
		const colors: string[] = [];
		for (let i = 0; i < dayFlows.length; i++) {
			if (breakIndices.has(i)) { data.push(null); labels.push(''); colors.push('#374151'); }
			const spd = dayFlows[i].flow.speed || 0;
			data.push(spd);
			labels.push(String(data.length));
			colors.push(speedZoneColor(spd));
		}
		return { data, labels, colors };
	});

	$effect(() => {
		if (activeChart !== 'autospeed' || !autospeedChartEl || !autospeedData) {
			disposeChart('autospeed'); return;
		}
		const chart = getOrCreateChart('autospeed', autospeedChartEl);
		resizeObserver?.observe(autospeedChartEl);
		const ad = autospeedData;
		chart.setOption({
			animation: false, backgroundColor: 'transparent',
			grid: { left: 50, right: 10, top: 10, bottom: 30, containLabel: false },
			xAxis: { type: 'category', data: ad.labels, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
			yAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 9, formatter: (v: number) => v.toFixed(2) }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
			tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#e5e7eb', fontSize: 11 } },
			dataZoom: [{ type: 'inside', start: 0, end: 100, zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: true }],
			series: [{
				type: 'line', _fixed: true, data: ad.data, symbol: 'none', connectNulls: false,
				lineStyle: { width: 2 },
				itemStyle: { color: '#f59e0b' },
			}],
			visualMap: {
				show: false, dimension: 1, pieces: [
					{ lte: speedZones.base, color: '#a855f7' },
					{ gt: speedZones.base, lte: speedZones.flow, color: '#06b6d4' },
					{ gt: speedZones.flow, color: '#f59e0b' },
				],
			},
		}, true);
		return () => { resizeObserver?.unobserve(autospeedChartEl!); disposeChart('autospeed'); };
	});

	// ── COMBO STREAK DISTRIBUTION ──
	let comboData = $derived.by(() => {
		if (dayFlows.length === 0) return null;
		const streaks: number[] = [];
		let cur = 0;
		for (let i = 0; i < dayFlows.length; i++) {
			if (breakIndices.has(i) && cur > 0) { streaks.push(cur); cur = 0; }
			if (dayFlows[i].flow.correct) { cur++; } else { if (cur > 0) streaks.push(cur); cur = 0; }
		}
		if (cur > 0) streaks.push(cur);
		if (streaks.length === 0) return null;
		const bucketDefs = [
			{ label: '1', min: 1, max: 1 }, { label: '2-3', min: 2, max: 3 }, { label: '4-5', min: 4, max: 5 },
			{ label: '6-10', min: 6, max: 10 }, { label: '11-15', min: 11, max: 15 }, { label: '16-20', min: 16, max: 20 }, { label: '21+', min: 21, max: Infinity },
		];
		const buckets = bucketDefs.map(b => ({ label: b.label, count: streaks.filter(s => s >= b.min && s <= b.max).length }));
		const longest = Math.max(...streaks);
		const avg = Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 10) / 10;
		return { buckets, longest, avg, totalStreaks: streaks.length };
	});

	$effect(() => {
		if (activeChart !== 'combos' || !combosChartEl || !comboData) {
			disposeChart('combos'); return;
		}
		const chart = getOrCreateChart('combos', combosChartEl);
		resizeObserver?.observe(combosChartEl);
		const cd = comboData;
		const colors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];
		chart.setOption(applyGlobalType({
			animation: false, backgroundColor: 'transparent',
			grid: { left: 36, right: 10, top: 20, bottom: 30, containLabel: false },
			xAxis: { type: 'category', data: cd.buckets.map(b => b.label), axisLabel: { color: '#e5e7eb', fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false } },
			yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#6b7280', fontSize: 9 }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
			tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#e5e7eb', fontSize: 11 } },
			series: [{
				type: 'bar', _baseType: 'bar', barWidth: '60%',
				data: cd.buckets.map((b, i) => ({ value: b.count, itemStyle: { color: colors[i] } })),
				label: { show: true, position: 'top', fontSize: 9, color: '#9ca3af', formatter: (p: any) => p.value > 0 ? String(p.value) : '' },
			}],
		}), true);
		return () => { resizeObserver?.unobserve(combosChartEl!); disposeChart('combos'); };
	});

	// ── ERROR POSITION HEATMAP ──
	let errorPositionData = $derived.by(() => {
		const positionCounts: Record<number, number> = {};
		let totalErrors = 0;
		for (const f of dayFlows) {
			if (f.flow.correct) continue;
			const breakPos = f.flow.letterIntervals.length;
			if (breakPos === 0) continue;
			positionCounts[breakPos] = (positionCounts[breakPos] || 0) + 1;
			totalErrors++;
		}
		if (totalErrors === 0) return null;
		const maxPos = Math.min(Math.max(...Object.keys(positionCounts).map(Number)), 15);
		const positions: { pos: number; count: number }[] = [];
		for (let p = 1; p <= maxPos; p++) {
			positions.push({ pos: p, count: positionCounts[p] || 0 });
		}
		for (const [pos, count] of Object.entries(positionCounts)) {
			if (Number(pos) > 15 && positions.length > 0) positions[positions.length - 1].count += count;
		}
		const peakPos = positions.reduce((best, p) => p.count > best.count ? p : best, positions[0]);
		return { positions, totalErrors, peakPos: peakPos.pos };
	});

	$effect(() => {
		if (activeChart !== 'errorpos' || !errorposChartEl || !errorPositionData) {
			disposeChart('errorpos'); return;
		}
		const chart = getOrCreateChart('errorpos', errorposChartEl);
		resizeObserver?.observe(errorposChartEl);
		const ep = errorPositionData;
		const maxCount = Math.max(...ep.positions.map(p => p.count), 1);
		chart.setOption(applyGlobalType({
			animation: false, backgroundColor: 'transparent',
			grid: { left: 36, right: 10, top: 20, bottom: 30, containLabel: false },
			xAxis: { type: 'category', data: ep.positions.map(p => p.pos <= 14 ? String(p.pos) : '15+'), axisLabel: { color: '#e5e7eb', fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false } },
			yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#6b7280', fontSize: 9 }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
			tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => { const p = Array.isArray(params) ? params[0] : params; const pos = ep.positions[p.dataIndex]; return `Letter ${pos.pos}: ${pos.count} errors (${Math.round((pos.count / ep.totalErrors) * 100)}%)`; }
			},
			series: [{
				type: 'bar', _baseType: 'bar', barWidth: '70%',
				data: ep.positions.map(p => ({ value: p.count, itemStyle: { color: `rgba(239, 68, 68, ${0.3 + (p.count / maxCount) * 0.7})` } })),
				label: { show: true, position: 'top', fontSize: 9, color: '#9ca3af', formatter: (p: any) => p.value > 0 ? String(p.value) : '' },
			}],
		}), true);
		return () => { resizeObserver?.unobserve(errorposChartEl!); disposeChart('errorpos'); };
	});

	// ── ACCURACY BY SESSION POSITION ──
	let sessionPositionData = $derived.by(() => {
		if (dayFlows.length === 0) return null;
		const sessionChunks: WordFlow[][] = [];
		let chunkStart = 0;
		const sortedBreaks = [...breakIndices].sort((a, b) => a - b);
		for (const brk of sortedBreaks) {
			if (brk > chunkStart) sessionChunks.push(dayFlows.slice(chunkStart, brk));
			chunkStart = brk;
		}
		if (chunkStart < dayFlows.length) sessionChunks.push(dayFlows.slice(chunkStart));
		const bucketSize = 10;
		const maxBucket = 15;
		const buckets: { correct: number; total: number }[] = Array.from({ length: maxBucket }, () => ({ correct: 0, total: 0 }));
		for (const chunk of sessionChunks) {
			for (let i = 0; i < chunk.length; i++) {
				const idx = Math.min(Math.floor(i / bucketSize), maxBucket - 1);
				buckets[idx].total++;
				if (chunk[i].flow.correct) buckets[idx].correct++;
			}
		}
		const result = buckets.map((b, i) => ({
			label: i < maxBucket - 1 ? `${i * bucketSize + 1}-${(i + 1) * bucketSize}` : `${(maxBucket - 1) * bucketSize + 1}+`,
			accuracy: b.total > 0 ? Math.round((b.correct / b.total) * 100) : null,
			total: b.total,
		})).filter(b => b.total > 0);
		return result;
	});

	$effect(() => {
		if (activeChart !== 'sessionpos' || !sessionposChartEl || !sessionPositionData || sessionPositionData.length === 0) {
			disposeChart('sessionpos'); return;
		}
		const chart = getOrCreateChart('sessionpos', sessionposChartEl);
		resizeObserver?.observe(sessionposChartEl);
		const sp = sessionPositionData;
		chart.setOption(applyGlobalType({
			animation: false, backgroundColor: 'transparent',
			grid: { left: 46, right: 10, top: 10, bottom: 30, containLabel: false },
			xAxis: { type: 'category', data: sp.map(b => b.label), axisLabel: { color: '#e5e7eb', fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false } },
			yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: '#6b7280', fontSize: 9, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
			tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => { const p = Array.isArray(params) ? params[0] : params; const b = sp[p.dataIndex]; return `Words ${b.label}: ${b.accuracy}% (${b.total} words)`; }
			},
			series: [{
				type: 'line', _baseType: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
				data: sp.map(b => b.accuracy),
				lineStyle: { color: '#06b6d4', width: 2 },
				itemStyle: { color: '#06b6d4' },
				areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(6,182,212,0.15)' }, { offset: 1, color: 'rgba(6,182,212,0)' }]) },
				markLine: { silent: true, symbol: 'none', data: [
					{ yAxis: 80, label: { show: true, formatter: '80%', fontSize: 8, color: '#22c55e', position: 'end' }, lineStyle: { color: '#22c55e', type: 'dashed', width: 1, opacity: 0.5 } },
					{ yAxis: 60, label: { show: true, formatter: '60%', fontSize: 8, color: '#ef4444', position: 'end' }, lineStyle: { color: '#ef4444', type: 'dashed', width: 1, opacity: 0.5 } },
				] },
			}],
		}), true);
		return () => { resizeObserver?.unobserve(sessionposChartEl!); disposeChart('sessionpos'); };
	});

	// Filtered patterns by session
	let filteredFlowStreaks = $derived(patternSessionFilter === null ? flowStreaks : flowStreaks.filter(s => s.sessionIdx === patternSessionFilter));
	let filteredSpiralClusters = $derived(patternSessionFilter === null ? spiralClusters : spiralClusters.filter(s => s.sessionIdx === patternSessionFilter));

	// ── PATTERNS SCATTER CHART ──
	$effect(() => {
		if (activeChart !== 'patterns' || !patternsChartEl || (filteredFlowStreaks.length === 0 && filteredSpiralClusters.length === 0)) {
			disposeChart('patterns'); return;
		}
		const chart = getOrCreateChart('patterns', patternsChartEl);
		resizeObserver?.observe(patternsChartEl);

		// Mode border colors: letter=blue, full-word=purple, chaos=red
		const modeBorder = (mode: string) => mode === 'chaos' ? '#ef4444' : mode === 'full-word' ? '#a855f7' : '#3b82f6';

		// Build scatter data using filtered arrays but store ORIGINAL index for popup lookup
		const flowDots = filteredFlowStreaks.map((s) => {
			const origIdx = flowStreaks.indexOf(s);
			return {
				value: [s.posInSession, s.length],
				itemStyle: { color: '#22c55e', borderColor: modeBorder(s.mode), borderWidth: 2 },
				symbolSize: Math.max(10, Math.min(s.length * 2, 24)),
				_type: 'flow' as const, _index: origIdx,
			};
		});
		const spiralDots = filteredSpiralClusters.map((s) => {
			const origIdx = spiralClusters.indexOf(s);
			return {
				value: [s.posInSession, -s.errorCount],
				itemStyle: { color: '#ef4444', borderColor: modeBorder(s.mode), borderWidth: 2 },
				symbolSize: Math.max(10, Math.min(s.errorCount * 4, 24)),
				_type: 'spiral' as const, _index: origIdx,
			};
		});

		chart.setOption({
			animation: false, backgroundColor: 'transparent',
			grid: { left: 46, right: 16, top: 20, bottom: 30, containLabel: false },
			xAxis: {
				type: 'value', name: 'Session position', nameTextStyle: { color: '#6b7280', fontSize: 9 },
				axisLabel: { color: '#6b7280', fontSize: 9 }, axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
			},
			yAxis: {
				type: 'value', name: 'Streak / Errors',
				nameTextStyle: { color: '#6b7280', fontSize: 9 },
				axisLabel: { color: '#6b7280', fontSize: 9, formatter: (v: number) => v >= 0 ? `+${v}` : String(v) },
				axisLine: { lineStyle: { color: '#374151' } },
				splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
			},
			tooltip: {
				trigger: 'item', backgroundColor: '#1f2937', borderColor: '#374151',
				textStyle: { color: '#e5e7eb', fontSize: 11 },
				formatter: (params: any) => {
					const d = params.data;
					if (d._type === 'flow') {
						const s = flowStreaks[d._index];
						return `<b style="color:#22c55e">Flow streak</b><br/>${s.length} words | CV ${s.cv}<br/>S${s.sessionIdx} #${s.posInSession} | ${s.avgInterval}ms/key<br/><span style="color:#6b7280">Click for details</span>`;
					} else {
						const s = spiralClusters[d._index];
						return `<b style="color:#ef4444">Spiral</b><br/>${s.errorCount} errors in ${s.words.length} words<br/>Trigger: ${s.trigger}<br/>S${s.sessionIdx} #${s.posInSession}<br/><span style="color:#6b7280">Click for details</span>`;
					}
				},
			},
			series: [
				{ type: 'scatter', _fixed: true, name: 'Flow', data: flowDots },
				{ type: 'scatter', _fixed: true, name: 'Spiral', data: spiralDots },
			],
			// Zero line
			...(spiralClusters.length > 0 ? { visualMap: { show: false } } : {}),
		}, true);

		chart.off('click');
		chart.on('click', 'series', (params: any) => {
			const d = params.data;
			if (d && d._type !== undefined) {
				patternPopup = { type: d._type, index: d._index };
			}
		});

		return () => { resizeObserver?.unobserve(patternsChartEl!); disposeChart('patterns'); };
	});

	// Global setup/teardown
	$effect(() => {
		setupResize();
		return () => {
			resizeObserver?.disconnect();
			for (const chart of charts.values()) {
				chart.dispose();
			}
			charts.clear();
		};
	});
</script>

{#if dayFlows.length === 0}
	<div class="flex flex-col items-center justify-center py-8 text-center">
		<p class="text-sm text-base-text-muted">No typing data for this day</p>
	</div>
{:else}
	<div class="space-y-3">
		<!-- Date + Session picker -->
		<div class="flex items-center gap-2">
			{#if !selectedDate}
				<select
					bind:value={pickedDate}
					class="rounded border border-base-border bg-surface-hover px-2 py-1 text-xs text-base-text focus:border-accent focus:outline-none"
				>
					{#each availableDates as date}
						{@const d = new Date(date + 'T00:00:00')}
						<option value={date}>
							{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
							{date === todayKey() ? '(today)' : ''}
						</option>
					{/each}
				</select>
			{/if}
			{#if rawDaySessions.length > 1}
				<select
					value={selectedSessionIdx === null ? 'all' : String(selectedSessionIdx)}
					onchange={(e) => { const v = (e.target as HTMLSelectElement).value; selectedSessionIdx = v === 'all' ? null : parseInt(v); }}
					class="rounded border border-base-border bg-surface-hover px-2 py-1 text-xs text-base-text focus:border-accent focus:outline-none"
				>
					<option value="all">All sessions ({rawDaySessions.length})</option>
					{#each [...rawDaySessions].reverse() as sess}
						<option value={String(sess.index)}>
							S{sess.index}: {sess.startTime} ({sess.wordCount}w, {sess.accuracy}%)
						</option>
					{/each}
				</select>
			{/if}
		</div>

		<!-- Summary row -->
		{#if summary}
			<div class="grid grid-cols-4 gap-1.5">
				<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5 text-center">
					<div class="text-sm font-black {summary.accuracy >= 60 ? 'text-green-400' : summary.accuracy >= 40 ? 'text-amber-400' : 'text-red-400'}">{summary.accuracy}%</div>
					<div class="text-[8px] text-base-text-muted">accuracy</div>
				</div>
				<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5 text-center">
					<div class="text-sm font-black text-cyan-400">{summary.total}</div>
					<div class="text-[8px] text-base-text-muted">words</div>
				</div>
				<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5 text-center">
					<div class="text-sm font-black text-orange-400">{summary.assumptions}</div>
					<div class="text-[8px] text-base-text-muted">rushed</div>
				</div>
				<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5 text-center">
					<div class="text-sm font-black text-violet-400">{daySessions.length}</div>
					<div class="text-[8px] text-base-text-muted">sessions</div>
				</div>
			</div>
			<div class="flex items-center justify-between text-[9px] text-base-text-muted">
				<span>{summary.startTime} - {summary.endTime}</span>
				<span>avg react: {summary.avgReaction}ms</span>
			</div>
		{/if}

		<!-- Chart tabs — grouped -->
		<div class="space-y-1">
			<!-- Category row -->
			<div class="flex gap-1">
				{#each chartGroups as group}
					{@const isActive = group === activeGroup}
					<button
						onclick={() => { activeChart = group.tabs[0].key as typeof activeChart; }}
						class="rounded px-2 py-1 text-[10px] font-bold transition-colors {isActive
							? 'bg-surface-hover text-accent'
							: 'text-base-text-muted hover:text-base-text'}"
					>
						{group.label}
					</button>
				{/each}
			</div>
			<!-- Sub-tabs -->
			<div class="flex gap-1">
				{#each activeGroup.tabs as tab}
					<button
						onclick={() => { activeChart = tab.key as typeof activeChart; }}
						class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {activeChart === tab.key
							? 'bg-accent-muted text-accent'
							: 'text-base-text-muted hover:text-base-text'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- FLOW STATE CHART -->
		{#if activeChart === 'flow'}
			<div>
				<div class="mb-1 flex items-center gap-3 text-[9px]">
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-purple-500"></span> Base</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-cyan-400"></span> Flow</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-amber-500"></span> Challenge</span>
				</div>
				<div bind:this={flowChartEl} class="h-52 w-full"></div>
				<!-- Zone transition summary -->
				{#if flowTransitions.length > 0}
					<div class="mt-1 text-[9px] text-base-text-muted">
						{flowTransitions.length} zone transitions &middot;
						{#each flowSpeedStats as stat}
							<span class="ml-1" style="color: {speedZoneColor(stat.spd)}">
								{stat.spd.toFixed(2)}: {stat.count}w {stat.pct}%
							</span>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- ROLLING ACCURACY CHART -->
		{#if activeChart === 'accuracy'}
			<div>
				<div class="mb-1 text-[9px] text-base-text-muted">Rolling accuracy (20-word window)</div>
				<div bind:this={accuracyChartEl} class="h-52 w-full"></div>
				<!-- Summary stats -->
				{#if rollingAccuracy.length > 0}
					{@const validAcc = rollingAccuracy.filter(r => r.accuracy !== null).map(r => r.accuracy as number)}
					{@const peak = validAcc.length > 0 ? Math.max(...validAcc) : 0}
					{@const valley = validAcc.length > 0 ? Math.min(...validAcc) : 0}
					{@const avg = validAcc.length > 0 ? validAcc.reduce((s, a) => s + a, 0) / validAcc.length : 0}
					<div class="flex items-center gap-3 text-[9px] text-base-text-muted">
						<span>Peak: <span class="font-bold text-green-400">{Math.round(peak)}%</span></span>
						<span>Valley: <span class="font-bold text-red-400">{Math.round(valley)}%</span></span>
						<span>Avg: <span class="font-bold text-cyan-400">{Math.round(avg)}%</span></span>
						<span>Range: {Math.round(peak - valley)}pp</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- REACTION TIME CHART -->
		{#if activeChart === 'reaction'}
			<div>
				<div class="mb-1 text-[9px] text-base-text-muted">Reaction time per word (first keypress)</div>
				<div bind:this={reactionChartEl} class="h-52 w-full"></div>
				<!-- Legend -->
				<div class="flex items-center gap-3 text-[9px] text-base-text-muted">
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-green-500"></span> correct</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-red-500"></span> error</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"></span> rushed (&lt;150ms)</span>
				</div>
			</div>
		{/if}

		<!-- ACCURACY BY WORD LENGTH -->
		{#if activeChart === 'length'}
			<div>
				<div class="mb-2 text-[9px] text-base-text-muted">Accuracy by word length</div>
				<div bind:this={lengthChartEl} class="h-52 w-full"></div>
			</div>
		{/if}

		<!-- ASSUMPTION FAILURES -->
		{#if activeChart === 'assumptions'}
			<div>
				<div class="mb-1 text-[9px] text-base-text-muted">
					Words failed due to rushing (react &lt;150ms, 0 typing) &mdash; {assumptionFailures.length} total
				</div>

				{#if cascades.length > 0}
					<div class="mb-2 space-y-1">
						<div class="text-[10px] font-bold text-amber-400">Cascade chains (3+ consecutive rushes)</div>
						{#each cascades as chain}
							<div class="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px]">
								<span class="font-bold text-amber-400">{chain.length} in a row</span>
								<span class="ml-1 text-base-text-muted">starting at #{chain.start + 1}:</span>
								<span class="ml-1 text-base-text">{chain.words.join(' → ')}</span>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Timeline bar chart -->
				<div bind:this={assumptionsChartEl} class="h-16 w-full"></div>
				<div class="flex items-center gap-3 text-[9px] text-base-text-muted">
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-4 bg-amber-500/60"></span> rushed</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-4 bg-red-500/10"></span> normal error</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-4 bg-green-500/10"></span> correct</span>
				</div>

				<!-- Common easy words lost to rushing -->
				{#if easyWordsLostToRushing.length > 0}
					<div class="mt-2">
						<div class="text-[10px] font-bold text-base-text-muted">Easy words lost to rushing ({easyWordsLostToRushing.length})</div>
						<div class="mt-1 flex flex-wrap gap-1">
							{#each easyWordsLostToRushing.slice(0, 20) as f}
								<span class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">{f.word}</span>
							{/each}
							{#if easyWordsLostToRushing.length > 20}
								<span class="text-[10px] text-base-text-muted">+{easyWordsLostToRushing.length - 20} more</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- List -->
				<div class="mt-2 max-h-48 overflow-y-auto space-y-0.5">
					{#each assumptionFailures as f, i}
						<div class="flex items-center justify-between rounded px-2 py-0.5 text-[10px] hover:bg-surface-hover/50">
							<div class="flex items-center gap-2">
								<span class="w-5 text-right font-mono text-base-text-muted">{i + 1}</span>
								<span class="font-bold text-amber-400">{f.word}</span>
								{#if f.prevWord}
									<span class="text-base-text-muted">after "{f.prevWord}"</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<span class="font-mono text-base-text-muted">{Math.round(f.reaction)}ms</span>
								<span class="text-base-text-muted">{f.time}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- HOURLY HEATMAP -->
		{#if activeChart === 'heatmap'}
			<div>
				<div class="mb-2 text-[9px] text-base-text-muted">Performance by hour</div>
				<div bind:this={heatmapChartEl} class="h-52 w-full"></div>
			</div>
		{/if}

		<!-- SESSIONS -->
		<!-- MODE BREAKDOWN -->
		{#if activeChart === 'modes'}
			<div>
				<div class="mb-2 text-[9px] text-base-text-muted">Stats by game mode</div>
				{#if modeBreakdown.length > 0}
					<div bind:this={modesChartEl} class="h-40 w-full"></div>
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">No mode data — new flows will track this</div>
				{/if}
			</div>
		{/if}

		<!-- RECOVERY AFTER ERROR -->
		{#if activeChart === 'recovery'}
			<div>
				{#if recoveryData}
					<div class="mb-1 text-[9px] text-base-text-muted">
						Accuracy of words following an error (n={recoveryData.errorCount} errors, incl. instant-fails)
					</div>
					<div bind:this={recoveryChartEl} class="h-52 w-full"></div>
					{@const pos1 = recoveryData.positions[0]}
					{#if pos1.accuracy !== null}
						<div class="mt-1.5 text-[10px] leading-relaxed {pos1.accuracy < recoveryData.baseline - 10 ? 'text-red-400' : 'text-green-400'}">
							{#if pos1.accuracy < recoveryData.baseline - 10}
								The first letter after an error is your weakest moment ({Math.round(pos1.accuracy)}% vs {recoveryData.baseline}% baseline). Consider pausing to reset before pressing the next key.
							{:else}
								You recover well after errors — {Math.round(pos1.accuracy)}% vs {recoveryData.baseline}% baseline.
							{/if}
						</div>
					{/if}
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">Not enough data for recovery analysis</div>
				{/if}
			</div>
		{/if}

		<!-- AUTO SPEED ZONE TIMELINE -->
		{#if activeChart === 'autospeed'}
			<div>
				{#if autospeedData}
					<div class="mb-1 flex items-center gap-3 text-[9px]">
						<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-purple-500"></span> Base</span>
						<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-cyan-400"></span> Flow</span>
						<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-amber-500"></span> Challenge</span>
					</div>
					<div bind:this={autospeedChartEl} class="h-52 w-full"></div>
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">Auto speed was not active on this day</div>
				{/if}
			</div>
		{/if}

		<!-- COMBO STREAK DISTRIBUTION -->
		{#if activeChart === 'combos'}
			<div>
				{#if comboData}
					<div class="mb-1 text-[9px] text-base-text-muted">
						Streak distribution &middot; longest: <span class="font-bold text-green-400">{comboData.longest}</span>
						&middot; avg: <span class="font-bold text-cyan-400">{comboData.avg}</span>
						&middot; {comboData.totalStreaks} streaks
					</div>
					<div bind:this={combosChartEl} class="h-52 w-full"></div>
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">No streak data</div>
				{/if}
			</div>
		{/if}

		<!-- ERROR POSITION -->
		{#if activeChart === 'errorpos'}
			<div>
				{#if errorPositionData}
					<div class="mb-1 text-[9px] text-base-text-muted">
						Where in the word do errors happen? (n={errorPositionData.totalErrors})
					</div>
					<div bind:this={errorposChartEl} class="h-52 w-full"></div>
					<div class="mt-1.5 text-[10px] text-amber-400">
						Most errors at letter {errorPositionData.peakPos} — your mind may be projecting ahead of your fingers.
					</div>
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">No errors to analyze</div>
				{/if}
			</div>
		{/if}

		<!-- ACCURACY BY SESSION POSITION -->
		{#if activeChart === 'sessionpos'}
			<div>
				{#if sessionPositionData && sessionPositionData.length > 0}
					<div class="mb-1 text-[9px] text-base-text-muted">Accuracy by word position within session</div>
					<div bind:this={sessionposChartEl} class="h-52 w-full"></div>
					{@const peak = sessionPositionData.reduce((best, b) => (b.accuracy || 0) > (best.accuracy || 0) ? b : best, sessionPositionData[0])}
					{@const dropoff = sessionPositionData.find(b => (b.accuracy || 100) < 60)}
					<div class="mt-1.5 text-[10px] text-base-text-muted">
						Sweet spot: <span class="font-bold text-cyan-400">{peak.label}</span> ({peak.accuracy}%)
						{#if dropoff}
							&middot; drops below 60% at <span class="font-bold text-red-400">{dropoff.label}</span>
						{/if}
					</div>
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">Not enough data</div>
				{/if}
			</div>
		{/if}

		<!-- PATTERNS -->
		{#if activeChart === 'patterns'}
			<div class="space-y-3">
				{#if patternSummary}
					<!-- Session picker + overview -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3 text-[10px]">
							<span class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded-full bg-green-500"></span> {filteredFlowStreaks.length} flow</span>
							<span class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded-full bg-red-500"></span> {filteredSpiralClusters.length} spirals</span>
						</div>
						<div class="flex items-center gap-1">
							<button
								onclick={() => { patternSessionFilter = null; }}
								class="rounded px-1.5 py-0.5 text-[10px] {patternSessionFilter === null ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
							>All</button>
							{#each daySessions as sess}
								<button
									onclick={() => { patternSessionFilter = sess.index; }}
									class="rounded px-1.5 py-0.5 text-[10px] {patternSessionFilter === sess.index ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
								>S{sess.index}</button>
							{/each}
						</div>
					</div>

					<!-- Scatter chart -->
					<div class="mb-1 text-[9px] text-base-text-muted">Click a dot for details. Border = mode (<span class="text-blue-400">letter</span> <span class="text-purple-400">full</span> <span class="text-red-400">chaos</span>)</div>
					<div bind:this={patternsChartEl} class="h-52 w-full"></div>

					<!-- Fingerprint summary -->
					<div class="grid grid-cols-2 gap-2">
						{#if flowStreaks.length > 0}
							<div class="rounded bg-green-500/5 border border-green-500/20 px-2.5 py-2 text-[10px] space-y-0.5">
								<div class="font-bold text-green-400 text-xs">Flow</div>
								<div><span class="text-base-text-muted">Speed:</span> <span class="text-green-400">{patternSummary.flow.avgSpeed}x</span></div>
								<div><span class="text-base-text-muted">React:</span> <span class="text-green-400">{patternSummary.flow.avgReaction}ms</span></div>
								<div><span class="text-base-text-muted">Position:</span> <span class="text-green-400">#{patternSummary.flow.avgPosition}</span></div>
								<div><span class="text-base-text-muted">CV:</span> <span class="text-green-400">{patternSummary.flow.avgCV}</span></div>
							</div>
						{/if}
						{#if spiralClusters.length > 0}
							<div class="rounded bg-red-500/5 border border-red-500/20 px-2.5 py-2 text-[10px] space-y-0.5">
								<div class="font-bold text-red-400 text-xs">Spiral</div>
								<div><span class="text-base-text-muted">Speed:</span> <span class="text-red-400">{patternSummary.spiral.avgSpeed}x</span></div>
								<div><span class="text-base-text-muted">Post react:</span> <span class="text-red-400">{patternSummary.spiral.avgPostReaction}ms</span></div>
								<div><span class="text-base-text-muted">Position:</span> <span class="text-red-400">#{patternSummary.spiral.avgPosition}</span></div>
								<div><span class="text-base-text-muted">Unfamiliar:</span> <span class="text-red-400">{patternSummary.spiral.unfamiliarPct}%</span></div>
							</div>
						{/if}
					</div>

					<!-- Insight text -->
					<div class="text-[10px] leading-relaxed text-base-text-muted space-y-1">
						{#if patternSummary.flow.avgSpeed > 0 && patternSummary.spiral.avgSpeed > patternSummary.flow.avgSpeed}
							<p>Flow at <span class="text-green-400 font-bold">{patternSummary.flow.avgSpeed}x</span>, spirals at <span class="text-red-400 font-bold">{patternSummary.spiral.avgSpeed}x</span> — speed bump triggers fear.</p>
						{/if}
						{#if patternSummary.spiral.unfamiliarPct > 50}
							<p>Most spirals start with <span class="text-red-400 font-bold">unfamiliar words</span>.</p>
						{/if}
						{#if flowStreaks.length > 0 && spiralClusters.length === 0}
							<p class="text-green-400">Clean session — flow without spirals.</p>
						{/if}
					</div>
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">Not enough data for pattern detection</div>
				{/if}
			</div>

			<!-- Pattern detail popup -->
			{#if patternPopup}
				{@const isFlow = patternPopup.type === 'flow'}
				{@const clusterFlows = isFlow ? (flowStreaks[patternPopup.index]?.wordFlows || []) : (spiralClusters[patternPopup.index]?.wordFlows || [])}
				{@const maxReact = clusterFlows.length > 0 ? Math.max(...clusterFlows.map(f => f.flow.reactionTime).filter(r => r > 0), 1) : 1}
				{@const maxInterval = clusterFlows.length > 0 ? Math.max(...clusterFlows.flatMap(f => f.flow.letterIntervals.slice(1).filter(v => v > 0)), 1) : 1}
				<div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
					<div class="w-full max-w-lg rounded-xl border border-base-border bg-surface p-5 shadow-2xl max-h-[80vh] overflow-y-auto">
						{#if isFlow && flowStreaks[patternPopup.index]}
							{@const s = flowStreaks[patternPopup.index]}
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-bold text-green-400">Flow Streak — {s.length} words</h3>
									<span class="rounded px-1.5 py-0.5 text-[9px] font-bold {s.mode === 'chaos' ? 'bg-red-500/15 text-red-400' : s.mode === 'full-word' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}">
										{s.mode === 'chaos' ? 'CHAOS' : s.mode === 'full-word' ? 'FULL' : 'LETTER'}
									</span>
								</div>
								<button onclick={() => patternPopup = null} class="rounded p-1 text-base-text-muted hover:text-accent">
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
								</button>
							</div>
							<div class="grid grid-cols-4 gap-2 mb-3">
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-green-400">{s.cv}</div>
									<div class="text-[8px] text-base-text-muted">CV</div>
								</div>
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-cyan-400">{s.avgInterval}ms</div>
									<div class="text-[8px] text-base-text-muted">avg/key</div>
								</div>
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-purple-400">{s.avgReaction}ms</div>
									<div class="text-[8px] text-base-text-muted">reaction</div>
								</div>
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-accent">{s.speed.toFixed(2)}x</div>
									<div class="text-[8px] text-base-text-muted">speed</div>
								</div>
							</div>
						{:else if !isFlow && spiralClusters[patternPopup.index]}
							{@const c = spiralClusters[patternPopup.index]}
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-bold text-red-400">Spiral — {c.errorCount} errors in {c.words.length} words</h3>
									<span class="rounded px-1.5 py-0.5 text-[9px] font-bold {c.mode === 'chaos' ? 'bg-red-500/15 text-red-400' : c.mode === 'full-word' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}">
										{c.mode === 'chaos' ? 'CHAOS' : c.mode === 'full-word' ? 'FULL' : 'LETTER'}
									</span>
								</div>
								<button onclick={() => patternPopup = null} class="rounded p-1 text-base-text-muted hover:text-accent">
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
								</button>
							</div>
							<div class="grid grid-cols-4 gap-2 mb-3">
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-red-400">{c.speed.toFixed(2)}x</div>
									<div class="text-[8px] text-base-text-muted">speed</div>
								</div>
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-orange-400">{c.postErrorReaction}ms</div>
									<div class="text-[8px] text-base-text-muted">post-err</div>
								</div>
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-amber-400">{c.rushed}</div>
									<div class="text-[8px] text-base-text-muted">rushed</div>
								</div>
								<div class="rounded bg-surface-hover px-2 py-1.5 text-center">
									<div class="text-sm font-bold text-red-300">{c.triggerFamiliarity <= 1 ? 'NEW' : `${c.triggerFamiliarity}x`}</div>
									<div class="text-[8px] text-base-text-muted">familiarity</div>
								</div>
							</div>
						{/if}

						<!-- Reaction time chart (per word in cluster) -->
						{#if clusterFlows.length > 0}
							<div class="mb-3">
								<div class="text-[9px] text-base-text-muted mb-1">Reaction time per word</div>
								<div class="flex items-end gap-1" style="height: 64px;">
									{#each clusterFlows as f}
										{@const r = f.flow.reactionTime}
										{@const h = r > 0 ? Math.max(Math.min((r / maxReact) * 64, 64), 2) : 0}
										<div
											class="flex-1 min-w-[4px] rounded-t-sm {r < 150 ? 'bg-orange-500' : f.flow.correct ? 'bg-cyan-500/60' : 'bg-red-500/60'}"
											style="height: {h}px;"
											title="{f.word}: {Math.round(r)}ms"
										></div>
									{/each}
								</div>
								<div class="flex gap-1 mt-0.5">
									{#each clusterFlows as f}
										<div class="flex-1 text-center text-[7px] text-base-text-muted truncate">{f.word.slice(0, 4)}</div>
									{/each}
								</div>
							</div>

							<!-- Average inter-key interval per word -->
							<div class="mb-3">
								<div class="text-[9px] text-base-text-muted mb-1">Avg keystroke interval per word</div>
								<div class="flex items-end gap-1" style="height: 64px;">
									{#each clusterFlows as f}
										{@const intervals = f.flow.letterIntervals.slice(1).filter(v => v > 0)}
										{@const avg = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0}
										{@const h = avg > 0 ? Math.max(Math.min((avg / maxInterval) * 64, 64), 2) : 0}
										<div
											class="flex-1 min-w-[4px] rounded-t-sm {f.flow.correct ? 'bg-green-500/60' : 'bg-red-500/60'}"
											style="height: {h}px;"
											title="{f.word}: {Math.round(avg)}ms/key"
										></div>
									{/each}
								</div>
								<div class="flex gap-1 mt-0.5">
									{#each clusterFlows as f}
										{@const intervals = f.flow.letterIntervals.slice(1).filter(v => v > 0)}
										{@const avg = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0}
										<div class="flex-1 text-center text-[7px] {f.flow.correct ? 'text-green-400' : 'text-red-400'}">{Math.round(avg)}</div>
									{/each}
								</div>
							</div>

							<!-- Replay button -->
							<div class="mb-2">
								<button
									onclick={() => {
										patternPopup = null;
										const label = isFlow
											? `Flow Streak — ${clusterFlows.length} words`
											: `Spiral — ${clusterFlows.length} words`;
										startSessionReplay(clusterFlows, label);
									}}
									class="rounded border border-accent/30 bg-accent-muted/20 px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent-muted/40"
								>
									Replay this {isFlow ? 'streak' : 'spiral'}
								</button>
							</div>

							<!-- Word list with details -->
							<div class="space-y-1">
								{#each clusterFlows as f, i}
									{@const intervals = f.flow.letterIntervals.slice(1).filter(v => v > 0)}
									{@const avg = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0}
									{@const cv = intervals.length > 1 ? (() => { const m = avg; const sd = Math.sqrt(intervals.reduce((s, v) => s + (v - m) ** 2, 0) / intervals.length); return m > 0 ? sd / m : 1; })() : 1}
									<div class="flex items-center gap-2 rounded px-2 py-1 text-[10px] {f.flow.correct ? 'bg-green-500/5' : 'bg-red-500/5'}">
										<span class="w-4 text-right font-mono text-base-text-muted">{i + 1}</span>
										<span class="w-24 truncate font-bold {f.flow.correct ? 'text-green-400' : 'text-red-400'}">{f.word}</span>
										<span class="text-base-text-muted">react: {Math.round(f.flow.reactionTime)}ms</span>
										<span class="text-base-text-muted">avg: {Math.round(avg)}ms</span>
										<span class="text-base-text-muted">CV: {cv.toFixed(2)}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/if}

		<!-- ERROR TYPES -->
		{#if activeChart === 'errors'}
			<div class="space-y-3">
				{#if errorTypeBreakdown.total > 0}
					<div class="text-[9px] text-base-text-muted">{errorTypeBreakdown.total} total errors</div>

					<!-- Stacked bar -->
					<div class="flex h-8 w-full overflow-hidden rounded-full">
						{#if errorTypeBreakdown.you > 0}
							<div class="h-full bg-red-500 flex items-center justify-center text-xs font-bold text-white" style="width: {errorTypeBreakdown.youPct}%;">
								{errorTypeBreakdown.youPct}%
							</div>
						{/if}
						{#if errorTypeBreakdown.game > 0}
							<div class="h-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black" style="width: {errorTypeBreakdown.gamePct}%;">
								{errorTypeBreakdown.gamePct}%
							</div>
						{/if}
					</div>

					<!-- Two cards -->
					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-center">
							<div class="text-2xl font-black text-red-400">{errorTypeBreakdown.you}</div>
							<div class="text-sm font-bold text-red-400">You</div>
							<div class="mt-1 text-[10px] text-base-text-muted">Wrong key, rushed, misclick</div>
							<div class="text-[10px] text-base-text-muted">Within your control</div>
						</div>
						<div class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center">
							<div class="text-2xl font-black text-amber-400">{errorTypeBreakdown.game}</div>
							<div class="text-sm font-bold text-amber-400">Game</div>
							<div class="mt-1 text-[10px] text-base-text-muted">Timer ran out</div>
							<div class="text-[10px] text-base-text-muted">Speed was too high</div>
						</div>
					</div>

					<!-- Insight -->
					<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3 text-[11px] leading-relaxed text-base-text-muted">
						{#if errorTypeBreakdown.youPct > 60}
							<p>Most errors are <span class="text-red-400 font-bold">yours</span> — wrong keys, rushed reactions, misclicks. These are controllable. The letter was there. You just didn't see it clearly enough.</p>
						{:else if errorTypeBreakdown.gamePct > 60}
							<p>Most errors are the <span class="text-amber-400 font-bold">game's</span> — time ran out before you could finish. The speed is pushing past your current capacity. Consider lowering the base speed or practicing at this level until it settles.</p>
						{:else}
							<p><span class="text-red-400 font-bold">{errorTypeBreakdown.youPct}%</span> within your control, <span class="text-amber-400 font-bold">{errorTypeBreakdown.gamePct}%</span> the game's doing. Focus on reducing your errors — that's where presence training has leverage. The timer errors resolve as your speed naturally improves.</p>
						{/if}
					</div>
				{:else}
					<div class="py-8 text-center text-xs text-base-text-muted">No errors to analyze</div>
				{/if}
			</div>
		{/if}

		<!-- SESSIONS -->
		{#if activeChart === 'sessions'}
			<div class="space-y-3">
				{#if daySessions.length === 0}
					<div class="py-4 text-center text-xs text-base-text-muted">No sessions detected</div>
				{:else}
					<!-- Summary line -->
					<div class="text-[10px] text-base-text-muted">
						{daySessions.length} session{daySessions.length !== 1 ? 's' : ''} &middot;
						best: <span class="font-bold text-green-400">{Math.max(...daySessions.map(s => s.accuracy))}%</span> &middot;
						avg length: <span class="font-bold text-cyan-400">{Math.round(daySessions.reduce((s, sess) => s + sess.wordCount, 0) / daySessions.length)}</span> words
					</div>

					<!-- Session cards -->
					<div class="space-y-1.5 overflow-y-auto" style="max-height: {expandedSessionIdx !== null ? '80vh' : '16rem'};">
						{#each [...daySessions].reverse() as sess}
							{@const isExpanded = expandedSessionIdx === sess.index}
							{@const durationMin = Math.round(sess.durationMs / 60000)}
							{@const durationSec = Math.round((sess.durationMs % 60000) / 1000)}
							<div class="rounded border {isExpanded ? 'border-accent/40' : 'border-base-border'} bg-surface-hover/50">
								<!-- Clickable header -->
								<button
									onclick={() => { expandedSessionIdx = isExpanded ? null : sess.index; }}
									class="w-full px-2.5 py-2 text-left"
								>
									<div class="flex items-center justify-between">
										<div class="text-[11px] font-bold text-base-text">
											{sess.index}. {sess.startTime} - {sess.endTime}
											<span class="ml-1 font-normal text-base-text-muted">({durationMin > 0 ? `${durationMin}m ` : ''}{durationSec}s)</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="text-[10px] font-mono text-base-text-muted">CV {sess.presenceCV.toFixed(2)}</span>
											<span class="text-base-text-muted text-[10px]">{isExpanded ? '▾' : '▸'}</span>
										</div>
									</div>
									<div class="mt-1 flex items-center gap-3 text-[10px]">
										<span class="rounded px-1.5 py-0.5 text-[9px] font-bold {sess.mode === 'chaos' ? 'bg-red-500/15 text-red-400' : sess.mode === 'full-word' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}">
											{sess.mode === 'chaos' ? 'CHAOS' : sess.mode === 'full-word' ? 'FULL' : 'LETTER'}
										</span>
										<span class="text-cyan-400 font-bold">{sess.wordCount}w</span>
										<span class="{sess.accuracy >= 60 ? 'text-green-400' : sess.accuracy >= 40 ? 'text-amber-400' : 'text-red-400'} font-bold">{sess.accuracy}%</span>
										{#if sess.avgSpeed > 0}
											<span class="text-base-text-muted">spd {sess.avgSpeed.toFixed(2)}</span>
										{/if}
										{#if sess.instantFails > 0}
											<span class="text-orange-400">{sess.instantFails} rushed</span>
										{/if}
										<span class="{sess.fatigueDelta >= 0 ? 'text-green-400' : 'text-red-400'}">
											{sess.fatigueDelta >= 0 ? '+' : ''}{sess.fatigueDelta}pp fatigue
										</span>
									</div>
									<!-- Mini accuracy bar -->
									<div class="mt-1.5 h-1.5 w-full rounded-full bg-surface-hover overflow-hidden">
										<div
											class="h-full rounded-full {sess.accuracy >= 60 ? 'bg-green-500' : sess.accuracy >= 40 ? 'bg-amber-500' : 'bg-red-500'}"
											style="width: {sess.accuracy}%"
										></div>
									</div>
								</button>

								<!-- Expanded detail -->
								{#if isExpanded}
									{@const windowSize = Math.min(10, Math.floor(sess.flows.length / 3))}
									{@const reactions = sess.flows.map(f => f.flow.reactionTime).filter(r => r > 0)}
									{@const maxReact = reactions.length > 0 ? Math.min(Math.max(...reactions), 5000) : 1}
									{@const sessSpeedSet = new Set(sess.flows.map(f => f.flow.speed?.toFixed(3)).filter(Boolean))}
									<div class="border-t border-base-border px-2.5 py-3 space-y-3">
										<!-- Stats grid -->
										<div class="grid grid-cols-4 gap-1.5">
											<div class="rounded bg-surface/50 px-2 py-1.5 text-center">
												<div class="text-sm font-bold text-green-400">{sess.first30Accuracy}%</div>
												<div class="text-[8px] text-base-text-muted">first 30</div>
											</div>
											<div class="rounded bg-surface/50 px-2 py-1.5 text-center">
												<div class="text-sm font-bold text-red-400">{sess.last30Accuracy}%</div>
												<div class="text-[8px] text-base-text-muted">last 30</div>
											</div>
											<div class="rounded bg-surface/50 px-2 py-1.5 text-center">
												<div class="text-sm font-bold text-amber-400">{sess.longestStreak}</div>
												<div class="text-[8px] text-base-text-muted">best streak</div>
											</div>
											<div class="rounded bg-surface/50 px-2 py-1.5 text-center">
												<div class="text-sm font-bold text-purple-400">{Math.round((1 - Math.min(sess.presenceCV, 1.5) / 1.5) * 100)}</div>
												<div class="text-[8px] text-base-text-muted">presence</div>
											</div>
										</div>

										<!-- Word-by-word timeline strip -->
										<div>
											<div class="mb-1 text-[9px] text-base-text-muted">Word timeline</div>
											<div class="flex gap-px overflow-x-auto">
												{#each sess.flows as f, i}
													{@const isRushed = !f.flow.correct && f.flow.reactionTime < 150 && f.flow.totalDuration <= 50}
													<div
														class="h-4 min-w-[3px] flex-1 rounded-sm {isRushed ? 'bg-orange-500' : f.flow.correct ? 'bg-green-500/60' : 'bg-red-500/60'}"
														title="{f.word} — {f.flow.correct ? 'correct' : isRushed ? 'rushed' : 'error'}"
													></div>
												{/each}
											</div>
											<div class="mt-0.5 flex justify-between text-[8px] text-base-text-muted">
												<span>start</span>
												<span>{sess.flows.length} words</span>
												<span>end</span>
											</div>
										</div>

										<!-- Rolling accuracy within session -->
										{#if windowSize >= 3}
											<div>
												<div class="mb-1 text-[9px] text-base-text-muted">Accuracy curve ({windowSize}-word window)</div>
												<div class="flex items-end gap-px h-16">
													{#each { length: Math.max(1, sess.flows.length - windowSize + 1) } as _, i}
														{@const slice = sess.flows.slice(i, i + windowSize)}
														{@const acc = (slice.filter(f => f.flow.correct).length / slice.length) * 100}
														<div
															class="flex-1 min-w-[2px] rounded-t-sm {acc >= 80 ? 'bg-green-500' : acc >= 60 ? 'bg-cyan-500' : acc >= 40 ? 'bg-amber-500' : 'bg-red-500'}"
															style="height: {acc}%; opacity: {0.4 + (acc / 100) * 0.6};"
															title="Words {i + 1}-{i + windowSize}: {Math.round(acc)}%"
														></div>
													{/each}
												</div>
												<div class="mt-0.5 flex justify-between text-[8px] text-base-text-muted">
													<span>0%</span>
													<span>accuracy</span>
													<span>100%</span>
												</div>
											</div>
										{/if}

										<!-- Reaction time dots -->
										{#if reactions.length > 3}
											<div>
												<div class="mb-1 text-[9px] text-base-text-muted">
													Reaction time &middot; avg <span class="text-cyan-400">{Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length)}ms</span>
												</div>
												<div class="flex items-end gap-px h-12">
													{#each sess.flows as f}
														{@const r = f.flow.reactionTime}
														{@const h = r > 0 ? Math.min((r / maxReact) * 100, 100) : 0}
														<div
															class="flex-1 min-w-[2px] rounded-t-sm {r < 150 && !f.flow.correct ? 'bg-orange-500' : r > 3000 ? 'bg-red-500' : r > 1500 ? 'bg-amber-500' : 'bg-cyan-500/60'}"
															style="height: {h}%;"
															title="{f.word}: {Math.round(r)}ms"
														></div>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Export buttons -->
										<div class="flex gap-2">
											<button
												onclick={() => {
													// Build a word lookup for full word info
													const wordMap = new Map<string, SavedWord>();
													for (const w of words) wordMap.set(w.word.word, w);

													const data = {
														exportedAt: new Date().toISOString(),
														date: effectiveDate,
														session: {
															index: sess.index,
															startTime: sess.startTime,
															endTime: sess.endTime,
															durationMs: sess.durationMs,
															wordCount: sess.wordCount,
															accuracy: sess.accuracy,
															first30Accuracy: sess.first30Accuracy,
															last30Accuracy: sess.last30Accuracy,
															fatigueDelta: sess.fatigueDelta,
															presenceCV: sess.presenceCV,
															longestStreak: sess.longestStreak,
															avgSpeed: sess.avgSpeed,
															instantFails: sess.instantFails,
														},
														flows: sess.flows.map(f => {
															const savedWord = wordMap.get(f.word);
															return {
																word: {
																	word: f.word,
																	meanings: savedWord?.word.meanings || [],
																	synonyms: savedWord?.word.synonyms || [],
																	antonyms: savedWord?.word.antonyms || [],
																},
																stats: savedWord ? {
																	seen: savedWord.stats.seen,
																	correctlyTyped: savedWord.stats.correctlyTyped,
																	wronglyTyped: savedWord.stats.wronglyTyped,
																	starred: savedWord.stats.starred,
																} : null,
																flow: {
																	correct: f.flow.correct,
																	reactionTime: f.flow.reactionTime,
																	totalDuration: f.flow.totalDuration,
																	letterIntervals: f.flow.letterIntervals,
																	speed: f.flow.speed,
																	msPerLetter: f.flow.msPerLetter,
																	mode: f.flow.mode,
																	timestamp: f.flow.timestamp,
																},
															};
														}),
													};
													const json = JSON.stringify(data, null, 2);
													const blob = new Blob([json], { type: 'application/json' });
													const url = URL.createObjectURL(blob);
													const a = document.createElement('a');
													a.href = url;
													a.download = `session-${sess.index}-${effectiveDate}.json`;
													a.click();
													URL.revokeObjectURL(url);
												}}
												class="rounded border border-base-border px-2 py-1 text-[10px] text-base-text-muted transition-colors hover:border-accent hover:text-accent"
											>
												Export JSON
											</button>
											<button
												onclick={async () => {
													const wordMap = new Map<string, SavedWord>();
													for (const w of words) wordMap.set(w.word.word, w);
													const data = {
														exportedAt: new Date().toISOString(),
														date: effectiveDate,
														session: {
															index: sess.index, startTime: sess.startTime, endTime: sess.endTime,
															durationMs: sess.durationMs, wordCount: sess.wordCount, accuracy: sess.accuracy,
															first30Accuracy: sess.first30Accuracy, last30Accuracy: sess.last30Accuracy,
															fatigueDelta: sess.fatigueDelta, presenceCV: sess.presenceCV,
															longestStreak: sess.longestStreak, avgSpeed: sess.avgSpeed, instantFails: sess.instantFails,
														},
														flows: sess.flows.map(f => {
															const sw = wordMap.get(f.word);
															return {
																word: { word: f.word, meanings: sw?.word.meanings || [], synonyms: sw?.word.synonyms || [], antonyms: sw?.word.antonyms || [] },
																stats: sw ? { seen: sw.stats.seen, correctlyTyped: sw.stats.correctlyTyped, wronglyTyped: sw.stats.wronglyTyped, starred: sw.stats.starred } : null,
																flow: { correct: f.flow.correct, reactionTime: f.flow.reactionTime, totalDuration: f.flow.totalDuration, letterIntervals: f.flow.letterIntervals, speed: f.flow.speed, msPerLetter: f.flow.msPerLetter, mode: f.flow.mode, timestamp: f.flow.timestamp },
															};
														}),
													};
													await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
												}}
												class="rounded border border-base-border px-2 py-1 text-[10px] text-base-text-muted transition-colors hover:border-accent hover:text-accent"
											>
												Copy to Clipboard
											</button>
											<button
												onclick={() => startSessionReplay(sess.flows, `Session ${sess.index} — ${sess.startTime}`)}
												class="rounded border border-accent/30 bg-accent-muted/20 px-2 py-1 text-[10px] font-bold text-accent transition-colors hover:bg-accent-muted/40"
											>
												Replay
											</button>
										</div>

										<!-- Speed zones (if varying) -->
										{#if sessSpeedSet.size >= 2}
											<div>
												<div class="mb-1 text-[9px] text-base-text-muted">Speed zones</div>
												<div class="flex gap-px h-3">
													{#each sess.flows as f}
														{@const spd = f.flow.speed || 0}
														{@const color = spd > (sess.avgSpeed * 1.2) ? 'bg-amber-500' : spd > (sess.avgSpeed * 1.05) ? 'bg-cyan-500' : 'bg-purple-500'}
														<div class="flex-1 min-w-[2px] rounded-sm {color}" title="{f.word}: {spd.toFixed(2)}x"></div>
													{/each}
												</div>
												<div class="mt-0.5 flex gap-3 text-[8px] text-base-text-muted">
													<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-sm bg-purple-500"></span> base</span>
													<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-sm bg-cyan-500"></span> flow</span>
													<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-sm bg-amber-500"></span> push</span>
												</div>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Insights summary -->
					{#if sessionInsights}
						<div class="pt-1 border-t border-base-border">
							<div class="text-[10px] font-bold text-base-text-muted mb-1.5">Insights</div>
							<div class="grid grid-cols-2 gap-1.5">
								{#if sessionInsights.optimalLength !== null}
									<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5">
										<div class="text-[10px] font-bold text-cyan-400">{sessionInsights.optimalLength} words</div>
										<div class="text-[8px] text-base-text-muted">optimal length</div>
									</div>
								{/if}
								{#if sessionInsights.bestHour}
									<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5">
										<div class="text-[10px] font-bold text-green-400">{sessionInsights.bestHour} ({sessionInsights.bestHourAcc}%)</div>
										<div class="text-[8px] text-base-text-muted">best time</div>
									</div>
								{/if}
								{#if sessionInsights.recoveryEffect !== null}
									<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5">
										<div class="text-[10px] font-bold {sessionInsights.recoveryEffect >= 0 ? 'text-green-400' : 'text-red-400'}">
											{sessionInsights.recoveryEffect >= 0 ? '+' : ''}{sessionInsights.recoveryEffect}pp
										</div>
										<div class="text-[8px] text-base-text-muted">recovery effect</div>
									</div>
								{/if}
								{#if sessionInsights.shortAvg !== null || sessionInsights.longAvg !== null}
									<div class="rounded border border-base-border bg-surface-hover/50 px-2 py-1.5">
										<div class="text-[10px] text-base-text">
											{#if sessionInsights.shortAvg !== null}
												<span class="font-bold text-amber-400">{sessionInsights.shortAvg}%</span>
												<span class="text-base-text-muted">&lt;100w</span>
											{/if}
											{#if sessionInsights.shortAvg !== null && sessionInsights.longAvg !== null}
												<span class="text-base-text-muted mx-0.5">vs</span>
											{/if}
											{#if sessionInsights.longAvg !== null}
												<span class="font-bold text-violet-400">{sessionInsights.longAvg}%</span>
												<span class="text-base-text-muted">&gt;200w</span>
											{/if}
										</div>
										<div class="text-[8px] text-base-text-muted">session efficiency</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<style>
		@keyframes replay-flash-green {
			0% { background: rgba(34, 197, 94, 0.3); }
			100% { background: transparent; }
		}
		@keyframes replay-flash-red {
			0% { background: rgba(239, 68, 68, 0.3); }
			100% { background: transparent; }
		}
	</style>

	<!-- SESSION REPLAY OVERLAY -->
	{#if sessionReplayActive}
		{@const currentWf = sessionReplayFlows[sessionReplayIdx]}
		{@const currentFlow = currentWf?.flow}
		{@const totalWords = sessionReplayFlows.length}
		{@const accuracy = sessionReplayStats.correct + sessionReplayStats.errors > 0 ? Math.round((sessionReplayStats.correct / (sessionReplayStats.correct + sessionReplayStats.errors)) * 100) : 100}
		{@const flowMode = currentFlow?.mode || 'letter-by-letter'}
		{@const flowDirection = currentFlow?.direction || 'left-to-right'}
		{@const effectiveDirection = sessionReplayMode === 'as-typed' ? (flowMode === 'full-word' ? 'left-to-right' : flowDirection) : sessionReplayMode}
		{@const showAllLetters = flowMode === 'full-word' || effectiveDirection === 'left-to-right'}
		<div class="fixed inset-0 z-[80] flex flex-col bg-base">
			<!-- Flash overlay -->
			{#if sessionReplayFlash}
				<div
					class="pointer-events-none fixed inset-0 z-[90]"
					style="animation: {sessionReplayFlash === 'success' ? 'replay-flash-green' : 'replay-flash-red'} 0.3s ease-out;"
				></div>
			{/if}

			<!-- Top bar -->
			<div class="flex items-center justify-between border-b border-base-border px-4 py-2">
				<div class="flex items-center gap-3">
					<span class="text-sm font-bold text-accent">{sessionReplayLabel || 'Session Replay'}</span>
					<span class="text-xs text-base-text-muted">{sessionReplayIdx + 1}/{totalWords}</span>
				</div>
				<div class="flex items-center gap-2">
					{#each [0.25, 0.5, 1, 2, 5] as speed}
						<button
							onclick={() => { sessionReplaySpeed = speed; if (!sessionReplayPaused) { for (const t of sessionReplayTimers) clearTimeout(t); sessionReplayTimers = []; playNextWord(); } }}
							class="rounded px-1.5 py-0.5 text-[10px] font-mono {sessionReplaySpeed === speed ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
						>{speed}x</button>
					{/each}
					<span class="mx-1 h-4 w-px bg-base-border"></span>
					<!-- Replay mode -->
					<select
						bind:value={sessionReplayMode}
						class="rounded border border-base-border bg-surface-hover px-1.5 py-0.5 text-[10px] text-base-text focus:border-accent focus:outline-none"
					>
						<option value="as-typed">As typed</option>
						<option value="center">Center</option>
						<option value="left-to-right">Left to right</option>
					</select>
					<!-- Hide reference -->
					<button
						onclick={() => sessionReplayHideRef = !sessionReplayHideRef}
						class="rounded px-1.5 py-0.5 text-[10px] {sessionReplayHideRef ? 'text-base-text-muted hover:text-base-text' : 'bg-surface-hover text-accent'}"
						title="Toggle word reference"
					>Ref</button>
					<!-- Past/Future toggles -->
					<button
						onclick={() => sessionReplayShowPast = !sessionReplayShowPast}
						class="rounded px-1.5 py-0.5 text-[10px] {sessionReplayShowPast ? 'bg-surface-hover text-accent' : 'text-base-text-muted hover:text-base-text'}"
						title="Show/hide typed letters"
					>Past</button>
					<button
						onclick={() => sessionReplayShowFuture = !sessionReplayShowFuture}
						class="rounded px-1.5 py-0.5 text-[10px] {sessionReplayShowFuture ? 'bg-surface-hover text-accent' : 'text-base-text-muted hover:text-base-text'}"
						title="Show/hide upcoming letters"
					>Future</button>
					<span class="mx-1 h-4 w-px bg-base-border"></span>
					<button onclick={toggleSessionReplayPause} class="rounded px-2 py-0.5 text-[10px] font-bold {sessionReplayPaused ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}">
						{sessionReplayPaused ? 'Resume' : 'Pause'}
					</button>
					<button onclick={stopSessionReplay} class="rounded px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30">Close</button>
				</div>
			</div>

			<!-- Running stats -->
			<div class="flex items-center justify-center gap-6 border-b border-base-border py-2 text-xs">
				<span class="text-green-400 font-bold">{sessionReplayStats.correct}</span>
				<span class="text-base-text-muted">/</span>
				<span class="text-red-400 font-bold">{sessionReplayStats.errors}</span>
				<span class="{accuracy >= 60 ? 'text-green-400' : 'text-red-400'} font-bold">{accuracy}%</span>
				{#if sessionReplayStats.combo > 0}
					<span class="text-accent font-bold">{sessionReplayStats.combo} combo</span>
				{/if}
				{#if currentFlow?.speed}
					<span class="text-base-text-muted">{currentFlow.speed.toFixed(2)}x</span>
				{/if}
			</div>

			<!-- Main replay area -->
			<div class="flex flex-1 items-center justify-center">
				{#if currentWf && replaySettings && replayWord}
					<div class="flex flex-col items-center gap-4">
						<!-- Use actual game RenderWord component -->
						<RenderWord
							word={replayWord}
							typedWord={replayTypedWord}
							settings={replaySettings}
							baseStyles={replayBaseStyles}
							wordTransform=""
						/>

						<!-- Reference word (toggleable) -->
						{#if !sessionReplayHideRef}
							<div class="text-sm text-base-text-muted/30">{currentWf.word}</div>
						{/if}
					</div>
				{:else}
					<div class="text-center">
						<div class="text-2xl font-bold text-accent mb-2">Replay Complete</div>
						<div class="text-sm text-base-text-muted">{sessionReplayStats.correct} correct, {sessionReplayStats.errors} errors, {accuracy}%</div>
						<div class="text-sm text-base-text-muted">Best combo: {sessionReplayStats.bestCombo}</div>
					</div>
				{/if}
			</div>

			<!-- Timeline + controls -->
			<div class="border-t border-base-border px-4 py-3">
				<div class="mb-2 flex items-center justify-center gap-2">
					<button onclick={() => skipToWord(Math.max(0, sessionReplayIdx - 1))} class="rounded px-2 py-0.5 text-[10px] text-base-text-muted hover:text-base-text">Prev</button>
					<button onclick={skipToNextError} class="rounded px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300">Next Error</button>
					<button onclick={skipToNextFlow} class="rounded px-2 py-0.5 text-[10px] text-green-400 hover:text-green-300">Next Flow</button>
					<button onclick={() => skipToWord(Math.min(totalWords - 1, sessionReplayIdx + 1))} class="rounded px-2 py-0.5 text-[10px] text-base-text-muted hover:text-base-text">Next</button>
				</div>
				<div class="flex h-4 w-full gap-px overflow-hidden rounded">
					{#each sessionReplayFlows as f, i}
						<button
							onclick={() => skipToWord(i)}
							class="h-full flex-1 min-w-[2px] transition-opacity {
								i === sessionReplayIdx ? 'ring-1 ring-accent' :
								i < sessionReplayIdx ? 'opacity-40' : 'opacity-100'
							} {f.flow.correct ? 'bg-green-500/60' : 'bg-red-500/60'}"
							title="{f.word} — {f.flow.correct ? 'correct' : 'error'}"
						></button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
{/if}
