<script lang="ts">
	import { isInstantFail } from '$lib/structure';
	import type { SavedWord, TypingFlow } from '$lib/structure';
	import { chartPrefs } from '$lib/chartPrefs.svelte';
	import * as echarts from 'echarts';

	let {
		words,
		selectedDate = null,
	}: {
		words: SavedWord[];
		selectedDate?: string | null;
	} = $props();

	let activeChart: 'flow' | 'accuracy' | 'reaction' | 'length' | 'assumptions' | 'heatmap' = $state('flow');

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
	let dayFlows = $derived.by((): WordFlow[] => {
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
		// Filter instant-fails for accuracy charts, but keep all for reference
		const filtered = flows.filter(f => !isInstantFail(f.flow));
		filtered.forEach((f, i) => f.index = i);
		return filtered;
	});

	// All flows including instant-fails — used by the Rushed/Assumptions tab
	let allDayFlows = $derived.by((): WordFlow[] => {
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
	// Detect gaps > 5 min between consecutive flows
	const BREAK_THRESHOLD_MS = 5 * 60 * 1000;
	let breakIndices = $derived.by(() => {
		const breaks = new Set<number>();
		for (let i = 1; i < dayFlows.length; i++) {
			const gap = dayFlows[i].flow.timestamp - dayFlows[i - 1].flow.timestamp;
			if (gap >= BREAK_THRESHOLD_MS) {
				breaks.add(i);
			}
		}
		return breaks;
	});

	// Format timestamp for X-axis labels
	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	// ── FLOW STATE CHART ──
	let flowData = $derived.by(() => {
		if (dayFlows.length === 0) return [];
		const result: { index: number; speed: number; correct: boolean; timestamp: number; word: string; isBreak: boolean }[] = [];
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
				});
			}
			result.push({
				index: result.length,
				speed: f.flow.speed || 0,
				correct: f.flow.correct,
				timestamp: f.flow.timestamp,
				word: f.word,
				isBreak: false,
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

	// ── ROLLING ACCURACY CHART ──
	let rollingAccuracy = $derived.by(() => {
		const windowSize = 20;
		if (dayFlows.length < windowSize) return [];
		const result: { index: number; accuracy: number | null; correct: number; timestamp: number }[] = [];
		for (let i = windowSize - 1; i < dayFlows.length; i++) {
			// Check if this window spans a break
			let spansBreak = false;
			for (let j = i - windowSize + 2; j <= i; j++) {
				if (breakIndices.has(j)) { spansBreak = true; break; }
			}
			if (spansBreak) {
				// Insert null to break the line
				result.push({ index: i, accuracy: null, correct: 0, timestamp: dayFlows[i].flow.timestamp });
			} else {
				let correct = 0;
				for (let j = i - windowSize + 1; j <= i; j++) {
					if (dayFlows[j].flow.correct) correct++;
				}
				result.push({ index: i, accuracy: (correct / windowSize) * 100, correct, timestamp: dayFlows[i].flow.timestamp });
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
					if (!d || d.isBreak) return '<span style="color:#6b7280">Break</span>';
					return `<b>${d.word}</b> (${speedZoneLabel(d.speed)})<br/>speed: ${d.speed?.toFixed(2)} | ${d.correct ? '<span style="color:#22c55e">correct</span>' : '<span style="color:#ef4444">error</span>'}<br/><span style="color:#6b7280">${formatTime(d.timestamp)}</span>`;
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
					if (d.accuracy === null) return '<span style="color:#6b7280">Break</span>';
					return `<b>${Math.round(d.accuracy)}% accuracy</b><br/>word #${d.index + 1} | ${d.correct}/20 correct`;
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
				{ type: 'inside', start: 0, end: 100 },
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
					return `<b>${d._word}: ${Math.round(d._reaction)}ms</b><br/>${d._correct ? 'correct' : 'error'}${d._rushed ? ' (rushed!)' : ''}<br/><span style="color:#6b7280">${d._time || ''}</span>`;
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
		<!-- Date picker (only when not externally controlled) -->
		{#if !selectedDate}
			<div class="flex items-center gap-2">
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
			</div>
		{/if}

		<!-- Summary row -->
		{#if summary}
			<div class="grid grid-cols-3 gap-1.5">
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
			</div>
			<div class="flex items-center justify-between text-[9px] text-base-text-muted">
				<span>{summary.startTime} - {summary.endTime}</span>
				<span>avg react: {summary.avgReaction}ms</span>
			</div>
		{/if}

		<!-- Chart tabs -->
		<div class="flex flex-wrap gap-1">
			{#each [
				{ key: 'flow', label: 'Flow State' },
				{ key: 'accuracy', label: 'Accuracy' },
				{ key: 'reaction', label: 'Reaction' },
				{ key: 'length', label: 'By Length' },
				{ key: 'assumptions', label: 'Rushed' },
				{ key: 'heatmap', label: 'Hourly' },
			] as tab}
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
	</div>
{/if}
