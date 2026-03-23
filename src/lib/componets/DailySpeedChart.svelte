<script lang="ts">
	import { isInstantFail } from '$lib/structure';
	import type { SavedWord, TypingFlow } from '$lib/structure';
	import SessionInsightsChart from './SessionInsightsChart.svelte';
	import Chart from './Chart.svelte';
	import ChartTypeToggle from './ChartTypeToggle.svelte';
	import * as echarts from 'echarts';

	let {
		words
	}: {
		words: SavedWord[];
	} = $props();

	let showChart = $state(true);
	let selectedDate: string | null = $state(null);
	let breakdownTab: 'speed' | 'length' | 'patterns' = $state('length');
	let chartMode: 'speed' | 'accuracy' | 'volume' = $state('speed');

	interface DayStats {
		date: string;
		label: string;
		avgDuration: number;
		medianDuration: number;
		wordCount: number;
		correctCount: number;
		errorCount: number;
		accuracy: number;
		fastestWord: { word: string; duration: number } | null;
		slowestWord: { word: string; duration: number } | null;
		avgLetterTime: number;
		totalPracticeMs: number;
	}

	interface DayWordFlow {
		word: string;
		flow: TypingFlow;
	}

	function median(arr: number[]): number {
		if (arr.length === 0) return 0;
		const sorted = [...arr].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	}

	// Collect all flows from all words, group by day
	let dailyStats = $derived.by(() => {
		const dayMap = new Map<string, {
			durations: number[];
			totalDuration: number;
			count: number;
			correct: number;
			allLetterTimes: number[];
			fastest: { word: string; duration: number } | null;
			slowest: { word: string; duration: number } | null;
		}>();

		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				if (isInstantFail(flow)) continue;
				const d = new Date(flow.timestamp);
				const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				const dur = flow.totalDuration || flow.letterIntervals.reduce((a, b) => a + b, 0);

				let existing = dayMap.get(key);
				if (!existing) {
					existing = { durations: [], totalDuration: 0, count: 0, correct: 0, allLetterTimes: [], fastest: null, slowest: null };
					dayMap.set(key, existing);
				}

				existing.durations.push(dur);
				existing.totalDuration += dur;
				existing.count++;
				if (flow.correct) existing.correct++;
				existing.allLetterTimes.push(...flow.letterIntervals);

				if (!existing.fastest || dur < existing.fastest.duration) {
					existing.fastest = { word: w.word.word, duration: dur };
				}
				if (!existing.slowest || dur > existing.slowest.duration) {
					existing.slowest = { word: w.word.word, duration: dur };
				}
			}
		}

		const stats: DayStats[] = [];
		for (const [date, data] of dayMap) {
			const d = new Date(date + 'T00:00:00');
			stats.push({
				date,
				label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
				avgDuration: data.totalDuration / data.count,
				medianDuration: median(data.durations),
				wordCount: data.count,
				correctCount: data.correct,
				errorCount: data.count - data.correct,
				accuracy: data.count > 0 ? Math.round((data.correct / data.count) * 100) : 0,
				fastestWord: data.fastest,
				slowestWord: data.slowest,
				avgLetterTime: data.allLetterTimes.length > 0
					? data.allLetterTimes.reduce((a, b) => a + b, 0) / data.allLetterTimes.length
					: 0,
				totalPracticeMs: data.totalDuration,
			});
		}

		stats.sort((a, b) => a.date.localeCompare(b.date));
		return stats;
	});

	// Get all flows for the selected day
	let selectedDayFlows = $derived.by((): DayWordFlow[] => {
		if (!selectedDate) return [];
		const flows: DayWordFlow[] = [];
		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				const d = new Date(flow.timestamp);
				const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				if (key === selectedDate) {
					flows.push({ word: w.word.word, flow });
				}
			}
		}
		flows.sort((a, b) => a.flow.timestamp - b.flow.timestamp);
		return flows;
	});

	let selectedDayStats = $derived(dailyStats.find(d => d.date === selectedDate));

	// Today's key
	let todayKey = $derived.by(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});

	let todayStats = $derived(dailyStats.find(d => d.date === todayKey));

	// Streak calculation
	let streak = $derived.by(() => {
		if (dailyStats.length === 0) return { current: 0, longest: 0 };

		const dateSet = new Set(dailyStats.map(d => d.date));
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		let current = 0;
		const cursor = new Date(today);
		while (true) {
			const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
			if (dateSet.has(key)) {
				current++;
				cursor.setDate(cursor.getDate() - 1);
			} else {
				break;
			}
		}

		let longest = 0;
		let run = 0;
		const sorted = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));
		for (let i = 0; i < sorted.length; i++) {
			if (i === 0) {
				run = 1;
			} else {
				const prev = new Date(sorted[i - 1].date + 'T00:00:00');
				const curr = new Date(sorted[i].date + 'T00:00:00');
				const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
				run = diffDays === 1 ? run + 1 : 1;
			}
			if (run > longest) longest = run;
		}

		return { current, longest };
	});

	// Chart data based on mode
	let chartValues = $derived(dailyStats.map(d =>
		chartMode === 'speed' ? d.avgDuration :
		chartMode === 'accuracy' ? d.accuracy :
		d.wordCount
	));
	let chartColor = $derived(chartMode === 'speed' ? '#06b6d4' : chartMode === 'accuracy' ? '#22c55e' : '#a855f7');

	// 7-day moving average
	let movingAvg = $derived.by(() => {
		if (chartValues.length < 3) return [];
		const window = Math.min(7, Math.floor(chartValues.length / 2));
		const avgs: (number | null)[] = [];
		for (let i = 0; i < chartValues.length; i++) {
			if (i < window - 1) { avgs.push(null); continue; }
			let sum = 0;
			for (let j = i - window + 1; j <= i; sum += chartValues[j++]);
			avgs.push(sum / window);
		}
		return avgs;
	});

	// Overall stats
	let totalWords = $derived(dailyStats.reduce((s, d) => s + d.wordCount, 0));
	let totalCorrect = $derived(dailyStats.reduce((s, d) => s + d.correctCount, 0));
	let totalPracticeTime = $derived(dailyStats.reduce((s, d) => s + d.totalPracticeMs, 0));
	let overallAccuracy = $derived(totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : 0);

	// Week-over-week comparison
	let weekComparison = $derived.by(() => {
		if (dailyStats.length < 2) return null;
		const today = new Date();
		const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - 6); thisWeekStart.setHours(0, 0, 0, 0);
		const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);

		const thisWeek = dailyStats.filter(d => { const dt = new Date(d.date + 'T00:00:00'); return dt >= thisWeekStart; });
		const lastWeek = dailyStats.filter(d => { const dt = new Date(d.date + 'T00:00:00'); return dt >= lastWeekStart && dt < thisWeekStart; });

		if (thisWeek.length === 0) return null;

		const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
		const twAcc = avg(thisWeek.map(d => d.accuracy));
		const lwAcc = lastWeek.length > 0 ? avg(lastWeek.map(d => d.accuracy)) : null;
		const twWords = thisWeek.reduce((s, d) => s + d.wordCount, 0);
		const lwWords = lastWeek.reduce((s, d) => s + d.wordCount, 0);
		const twDays = thisWeek.length;
		const lwDays = lastWeek.length;

		return {
			thisWeek: { accuracy: Math.round(twAcc), words: twWords, days: twDays },
			lastWeek: lwAcc !== null ? { accuracy: Math.round(lwAcc), words: lwWords, days: lwDays } : null,
			accDelta: lwAcc !== null ? Math.round(twAcc - lwAcc) : null,
			wordsDelta: lwWords > 0 ? Math.round(((twWords - lwWords) / lwWords) * 100) : null,
		};
	});

	let speedZoneAccuracy = $derived.by(() => {
		const zones = new Map<number, { correct: number; total: number }>();
		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				if (isInstantFail(flow) || !flow.speed) continue;
				const spd = parseFloat(flow.speed.toFixed(2));
				let z = zones.get(spd);
				if (!z) { z = { correct: 0, total: 0 }; zones.set(spd, z); }
				z.total++;
				if (flow.correct) z.correct++;
			}
		}
		return [...zones.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([speed, stats]) => ({
				speed,
				accuracy: Math.round((stats.correct / stats.total) * 100),
				total: stats.total,
				correct: stats.correct,
			}));
	});

	let lifetimeLengthAccuracy = $derived.by(() => {
		const buckets: Record<string, { correct: number; total: number }> = {};
		for (const w of words) {
			if (!w.typingFlows) continue;
			const len = w.word.word.length;
			const bucket = len <= 4 ? '3-4' : len <= 6 ? '5-6' : len <= 8 ? '7-8' : len <= 10 ? '9-10' : len <= 13 ? '11-13' : '14+';
			for (const flow of w.typingFlows) {
				if (isInstantFail(flow)) continue;
				if (!buckets[bucket]) buckets[bucket] = { correct: 0, total: 0 };
				buckets[bucket].total++;
				if (flow.correct) buckets[bucket].correct++;
			}
		}
		const order = ['3-4', '5-6', '7-8', '9-10', '11-13', '14+'];
		return order.filter(k => buckets[k]).map(k => ({
			label: k,
			accuracy: Math.round((buckets[k].correct / buckets[k].total) * 100),
			total: buckets[k].total,
		}));
	});

	let overallPresence = $derived.by(() => {
		const allIntervals: number[] = [];
		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				if (isInstantFail(flow) || !flow.correct) continue;
				// Skip first interval (reaction time)
				const interKey = flow.letterIntervals.slice(1).filter(v => v > 0);
				allIntervals.push(...interKey);
			}
		}
		if (allIntervals.length < 10) return null;
		const mean = allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length;
		const stdDev = Math.sqrt(allIntervals.reduce((s, v) => s + (v - mean) ** 2, 0) / allIntervals.length);
		const cv = mean > 0 ? stdDev / mean : 0;
		return Math.max(0, Math.round((1 - Math.min(cv, 1.5) / 1.5) * 100));
	});

	function formatMs(ms: number): string {
		return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
	}

	function formatPracticeTime(ms: number): string {
		const mins = Math.floor(ms / 60000);
		if (mins < 60) return `${mins}m`;
		const hrs = Math.floor(mins / 60);
		return `${hrs}h ${mins % 60}m`;
	}

	function formatChartValue(val: number): string {
		if (chartMode === 'speed') return formatMs(val);
		if (chartMode === 'accuracy') return `${Math.round(val)}%`;
		return `${Math.round(val)}`;
	}

	function selectDay(date: string) {
		selectedDate = selectedDate === date ? null : date;
	}

	// Build ECharts option from current data
	function buildChartOption(): echarts.EChartsOption {
		const labels = dailyStats.map(d => d.label);
		const values = chartValues;
		const maData = movingAvg;
		const todayIdx = dailyStats.findIndex(d => d.date === todayKey);
		const selectedIdx = selectedDate ? dailyStats.findIndex(d => d.date === selectedDate) : -1;

		// Mark points for low-accuracy days in speed mode
		const lowAccuracyIndices: number[] = [];
		if (chartMode === 'speed') {
			dailyStats.forEach((d, i) => {
				if (d.accuracy < 70) lowAccuracyIndices.push(i);
			});
		}

		// Build symbol size and item style arrays for highlighting
		const symbolSizes = dailyStats.map((d, i) => {
			if (i === selectedIdx) return 12;
			if (d.date === todayKey) return 9;
			return 6;
		});

		const itemColors = dailyStats.map((d, i) => {
			if (i === selectedIdx) return '#f59e0b';
			return chartColor;
		});

		// Build mark points for low accuracy
		const markPointData = lowAccuracyIndices.map(i => ({
			coord: [i, values[i]],
			symbol: 'circle',
			symbolSize: selectedIdx === i ? 20 : 14,
			itemStyle: {
				color: 'transparent',
				borderColor: '#ef4444',
				borderWidth: 1,
				borderType: 'dashed' as const,
				opacity: 0.6,
			},
			label: { show: false },
		}));

		const mainSeries: any = {
			name: chartMode === 'speed' ? 'Avg Speed' : chartMode === 'accuracy' ? 'Accuracy' : 'Words/Day',
			type: 'line',
			data: values.map((v, i) => ({
				value: v,
				symbol: 'circle',
				symbolSize: symbolSizes[i],
				itemStyle: {
					color: itemColors[i],
					borderColor: i === selectedIdx ? '#fbbf24' : '#1f2937',
					borderWidth: i === selectedIdx ? 2 : 1,
				},
			})),
			smooth: false,
			lineStyle: {
				color: chartColor,
				width: 2,
			},
			areaStyle: {
				color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
					{ offset: 0, color: chartColor + '20' },
					{ offset: 1, color: chartColor + '05' },
				]),
			},
			emphasis: {
				disabled: true,
			},
			triggerLineEvent: true,
		};

		if (markPointData.length > 0) {
			mainSeries.markPoint = {
				data: markPointData,
				animation: false,
			};
		}

		const series: any[] = [mainSeries];

		// Moving average line
		if (maData.length > 0) {
			series.push({
				name: '7-day Avg',
				type: 'line',
				data: maData.map(v => v ?? '-') as any,
				smooth: false,
				lineStyle: {
					color: '#ffffff',
					width: 1.5,
					type: 'dashed',
					opacity: 0.5,
				},
				symbol: 'none',
				emphasis: {
					disabled: true,
				},
				connectNulls: false,
			});
		}

		const option: echarts.EChartsOption = {
			backgroundColor: 'transparent',
			animation: true,
			animationDuration: 300,
			grid: {
				left: 46,
				right: 16,
				top: 16,
				bottom: dailyStats.length > 20 ? 40 : 30,
				containLabel: false,
			},
			xAxis: {
				type: 'category',
				data: labels,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					color: '#6b7280',
					fontSize: 9,
					rotate: dailyStats.length > 10 ? 30 : 0,
					interval: dailyStats.length > 20 ? 'auto' : 0,
				},
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					color: '#6b7280',
					fontSize: 9,
					formatter: (val: number) => formatChartValue(val),
				},
				splitLine: {
					lineStyle: {
						color: '#374151',
						width: 0.5,
					},
				},
			},
			tooltip: {
				trigger: 'axis',
				backgroundColor: '#1f2937',
				borderColor: chartColor,
				borderWidth: 0.8,
				textStyle: {
					color: '#d1d5db',
					fontSize: 11,
				},
				formatter: (params: any) => {
					const idx = params[0]?.dataIndex;
					if (idx == null || !dailyStats[idx]) return '';
					const day = dailyStats[idx];
					const val = chartValues[idx];
					return `<div style="font-weight:bold;color:${chartColor};margin-bottom:2px">${day.label} — ${formatChartValue(val)}</div>` +
						`<div>${day.wordCount} words · ${day.accuracy}% acc</div>` +
						`<div style="color:#9ca3af;font-size:10px">median ${formatMs(day.medianDuration)} · ${formatMs(day.avgLetterTime)}/letter</div>`;
				},
			},
			series,
		};

		// Add dataZoom if many days
		if (dailyStats.length > 20) {
			option.dataZoom = [
				{
					type: 'slider',
					show: true,
					height: 14,
					bottom: 2,
					borderColor: 'transparent',
					backgroundColor: '#1f293780',
					fillerColor: chartColor + '30',
					handleStyle: { color: chartColor },
					textStyle: { color: '#6b7280', fontSize: 9 },
					start: Math.max(0, 100 - (20 / dailyStats.length) * 100),
					end: 100,
				},
				{
					type: 'inside',
					zoomOnMouseWheel: true,
					moveOnMouseMove: true,
				},
			];
		}

		return option;
	}

	let chartOption = $derived(buildChartOption());

	// ── CROSS-SESSION PATTERNS ──
	let crossSessionPatterns = $derived.by(() => {
		// Gather all flows across all days with timestamps
		const allFlows: { word: string; correct: boolean; speed: number; reaction: number; mode: string; timestamp: number; wordLen: number; seen: number; intervals: number[] }[] = [];
		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const f of w.typingFlows) {
				if (isInstantFail(f)) continue;
				allFlows.push({
					word: w.word.word,
					correct: f.correct,
					speed: f.speed || 0,
					reaction: f.reactionTime || 0,
					mode: f.mode || 'letter-by-letter',
					timestamp: f.timestamp,
					wordLen: w.word.word.length,
					seen: w.stats.seen,
					intervals: f.letterIntervals.slice(1).filter(v => v > 0),
				});
			}
		}
		allFlows.sort((a, b) => a.timestamp - b.timestamp);
		if (allFlows.length < 20) return null;

		// Find flow streaks (5+ correct)
		let flowSpeeds: number[] = [], flowReactions: number[] = [], flowPositions: number[] = [], flowHours: number[] = [], flowModes: string[] = [];
		let spiralSpeeds: number[] = [], spiralReactions: number[] = [], spiralPositions: number[] = [], spiralHours: number[] = [];
		let streakStart = -1, pos = 0;

		// Words that always fail (3+ attempts, 0 correct)
		const nemesisWords: { word: string; attempts: number }[] = [];
		for (const w of words) {
			const attempts = w.stats.correctlyTyped + w.stats.wronglyTyped;
			if (attempts >= 3 && w.stats.correctlyTyped === 0) {
				nemesisWords.push({ word: w.word.word, attempts });
			}
		}
		nemesisWords.sort((a, b) => b.attempts - a.attempts);

		for (let i = 0; i < allFlows.length; i++) {
			pos++;
			// Reset position on 5min gap
			if (i > 0 && allFlows[i].timestamp - allFlows[i-1].timestamp > 300000) pos = 1;

			if (allFlows[i].correct) {
				if (streakStart < 0) streakStart = i;
			} else {
				if (streakStart >= 0 && i - streakStart >= 5) {
					// Record flow fingerprint
					for (let j = streakStart; j < i; j++) {
						flowSpeeds.push(allFlows[j].speed);
						flowReactions.push(allFlows[j].reaction);
						flowHours.push(new Date(allFlows[j].timestamp).getHours());
						flowModes.push(allFlows[j].mode);
					}
					flowPositions.push(pos - (i - streakStart));
				}
				streakStart = -1;

				// Check for spiral (3 errors in 5 words)
				let errCount = 0;
				for (let j = i; j < Math.min(i + 5, allFlows.length); j++) {
					if (!allFlows[j].correct) errCount++;
				}
				if (errCount >= 3) {
					spiralSpeeds.push(allFlows[i].speed);
					spiralReactions.push(i + 1 < allFlows.length ? allFlows[i+1].reaction : 0);
					spiralPositions.push(pos);
					spiralHours.push(new Date(allFlows[i].timestamp).getHours());
				}
			}
		}

		const avg = (a: number[]) => a.length > 0 ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0;
		const avgF = (a: number[]) => a.length > 0 ? Math.round(a.reduce((s, v) => s + v, 0) / a.length * 100) / 100 : 0;
		const modeCount = (a: string[]) => {
			const counts = new Map<string, number>();
			for (const m of a) counts.set(m, (counts.get(m) || 0) + 1);
			return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'letter-by-letter';
		};
		const peakHour = (a: number[]) => {
			if (a.length === 0) return null;
			const counts = new Map<number, number>();
			for (const h of a) counts.set(h, (counts.get(h) || 0) + 1);
			const peak = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
			return peak ? `${peak[0]}:00` : null;
		};

		return {
			flow: {
				avgSpeed: avgF(flowSpeeds),
				avgReaction: avg(flowReactions),
				avgPosition: avg(flowPositions),
				peakHour: peakHour(flowHours),
				dominantMode: modeCount(flowModes),
				totalWords: flowSpeeds.length,
			},
			spiral: {
				avgSpeed: avgF(spiralSpeeds),
				avgPostReaction: avg(spiralReactions),
				avgPosition: avg(spiralPositions),
				peakHour: peakHour(spiralHours),
				count: spiralSpeeds.length,
			},
			nemesisWords: nemesisWords.slice(0, 10),
		};
	});

	function onChartClick(params: any) {
		const idx = params.dataIndex;
		if (idx != null && dailyStats[idx]) {
			selectDay(dailyStats[idx].date);
		}
	}
</script>

{#if dailyStats.length > 0}
	<div class="space-y-3">
		<!-- Summary cards -->
		<div class="grid grid-cols-4 gap-2 {overallPresence !== null ? 'grid-cols-5' : ''}">
			<div class="rounded-lg border border-base-border bg-surface-hover/50 p-2 text-center">
				<div class="text-lg font-black text-orange-400">{streak.current}</div>
				<div class="text-[9px] text-base-text-muted">day streak</div>
			</div>
			<div class="rounded-lg border border-base-border bg-surface-hover/50 p-2 text-center">
				<div class="text-lg font-black text-cyan-400">{totalWords}</div>
				<div class="text-[9px] text-base-text-muted">words typed</div>
			</div>
			<div class="rounded-lg border border-base-border bg-surface-hover/50 p-2 text-center">
				<div class="text-lg font-black {overallAccuracy >= 70 ? 'text-green-400' : overallAccuracy >= 40 ? 'text-amber-400' : 'text-red-400'}">{overallAccuracy}%</div>
				<div class="text-[9px] text-base-text-muted">accuracy</div>
			</div>
			<div class="rounded-lg border border-base-border bg-surface-hover/50 p-2 text-center">
				<div class="text-lg font-black text-purple-400">{formatPracticeTime(totalPracticeTime)}</div>
				<div class="text-[9px] text-base-text-muted">practice</div>
			</div>
			{#if overallPresence !== null}
				<div class="rounded-lg border border-base-border bg-surface-hover/50 p-2 text-center">
					<div class="text-lg font-black {overallPresence >= 70 ? 'text-green-400' : overallPresence >= 40 ? 'text-amber-400' : 'text-red-400'}">{overallPresence}</div>
					<div class="text-[9px] text-base-text-muted">presence</div>
				</div>
			{/if}
		</div>

		<!-- Week comparison -->
		{#if weekComparison}
			<div class="flex items-center gap-3 rounded-lg border border-base-border bg-surface-hover/30 px-3 py-2 text-[10px]">
				<span class="font-bold text-base-text-muted">This week</span>
				<span class="{weekComparison.thisWeek.accuracy >= 60 ? 'text-green-400' : 'text-amber-400'} font-bold">{weekComparison.thisWeek.accuracy}%</span>
				<span class="text-cyan-400">{weekComparison.thisWeek.words}w</span>
				<span class="text-base-text-muted">{weekComparison.thisWeek.days}d</span>
				{#if weekComparison.lastWeek}
					<span class="text-base-text-muted">vs</span>
					<span class="font-bold text-base-text-muted">Last week</span>
					<span class="text-base-text-muted">{weekComparison.lastWeek.accuracy}%</span>
					<span class="text-base-text-muted">{weekComparison.lastWeek.words}w</span>
					{#if weekComparison.accDelta !== null}
						<span class="font-bold {weekComparison.accDelta >= 0 ? 'text-green-400' : 'text-red-400'}">
							{weekComparison.accDelta >= 0 ? '+' : ''}{weekComparison.accDelta}pp
						</span>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Today highlight -->
		{#if todayStats}
			<div class="rounded-lg border border-accent/30 bg-accent-muted/10 p-3">
				<div class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">Today</div>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4 text-sm">
						<span class="text-base-text"><span class="font-bold text-cyan-400">{formatMs(todayStats.avgDuration)}</span> avg</span>
						<span class="text-base-text"><span class="font-bold text-accent">{todayStats.wordCount}</span> words</span>
						<span class="{todayStats.accuracy >= 70 ? 'text-green-400' : 'text-amber-400'}">{todayStats.accuracy}%</span>
					</div>
					{#if todayStats.fastestWord}
						<span class="text-[10px] text-base-text-muted">fastest: <span class="text-green-400">{todayStats.fastestWord.word}</span> {formatMs(todayStats.fastestWord.duration)}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Accuracy breakdown (tabbed: by length / by speed) -->
		{#if lifetimeLengthAccuracy.length > 0 || speedZoneAccuracy.length > 1}
			<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
				<div class="mb-2 flex items-center justify-between">
					<h5 class="text-[10px] font-bold uppercase tracking-wide text-base-text-muted">Accuracy Breakdown</h5>
					<div class="flex gap-1">
						<button
							onclick={() => { breakdownTab = 'length'; }}
							class="rounded px-2 py-0.5 text-[10px] font-medium {breakdownTab === 'length' ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
						>
							By Length
						</button>
						{#if speedZoneAccuracy.length > 1}
							<button
								onclick={() => { breakdownTab = 'speed'; }}
								class="rounded px-2 py-0.5 text-[10px] font-medium {breakdownTab === 'speed' ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
							>
								By Speed
							</button>
						{/if}
						{#if crossSessionPatterns}
							<button
								onclick={() => { breakdownTab = 'patterns'; }}
								class="rounded px-2 py-0.5 text-[10px] font-medium {breakdownTab === 'patterns' ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
							>
								Patterns
							</button>
						{/if}
					</div>
				</div>
				<div class="space-y-1">
					{#if breakdownTab === 'length'}
						{#each lifetimeLengthAccuracy as bucket}
							<div class="flex items-center gap-2 text-[10px]">
								<span class="w-10 text-right font-mono text-base-text-muted">{bucket.label}</span>
								<div class="flex-1 h-3 rounded bg-surface-hover overflow-hidden">
									<div class="h-full rounded {bucket.accuracy >= 60 ? 'bg-green-500/40' : bucket.accuracy >= 40 ? 'bg-amber-500/40' : 'bg-red-500/40'}" style="width: {Math.max(bucket.accuracy, 2)}%"></div>
								</div>
								<span class="w-8 text-right font-bold {bucket.accuracy >= 60 ? 'text-green-400' : bucket.accuracy >= 40 ? 'text-amber-400' : 'text-red-400'}">{bucket.accuracy}%</span>
								<span class="w-10 text-right text-base-text-muted">{bucket.total}w</span>
							</div>
						{/each}
					{:else if breakdownTab === 'speed'}
						{#each speedZoneAccuracy as zone}
							<div class="flex items-center gap-2 text-[10px]">
								<span class="w-10 text-right font-mono text-base-text-muted">{zone.speed.toFixed(2)}x</span>
								<div class="flex-1 h-3 rounded bg-surface-hover overflow-hidden">
									<div class="h-full rounded {zone.accuracy >= 60 ? 'bg-green-500/40' : zone.accuracy >= 40 ? 'bg-amber-500/40' : 'bg-red-500/40'}" style="width: {Math.max(zone.accuracy, 2)}%"></div>
								</div>
								<span class="w-8 text-right font-bold {zone.accuracy >= 60 ? 'text-green-400' : zone.accuracy >= 40 ? 'text-amber-400' : 'text-red-400'}">{zone.accuracy}%</span>
								<span class="w-10 text-right text-base-text-muted">{zone.total}w</span>
							</div>
						{/each}
					{:else if breakdownTab === 'patterns' && crossSessionPatterns}
						<div class="space-y-2.5">
							<!-- Flow vs Spiral comparison -->
							<div class="grid grid-cols-2 gap-2">
								<div class="rounded bg-green-500/5 border border-green-500/20 px-2.5 py-2">
									<div class="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1.5">Flow conditions</div>
									<div class="space-y-1 text-[10px]">
										<div><span class="text-base-text-muted">Speed:</span> <span class="text-green-400">{crossSessionPatterns.flow.avgSpeed}x</span></div>
										<div><span class="text-base-text-muted">React:</span> <span class="text-green-400">{crossSessionPatterns.flow.avgReaction}ms</span></div>
										<div><span class="text-base-text-muted">Position:</span> <span class="text-green-400">#{crossSessionPatterns.flow.avgPosition}</span></div>
										{#if crossSessionPatterns.flow.peakHour}
											<div><span class="text-base-text-muted">Best hour:</span> <span class="text-green-400">{crossSessionPatterns.flow.peakHour}</span></div>
										{/if}
										<div><span class="text-base-text-muted">Mode:</span> <span class="text-green-400">{crossSessionPatterns.flow.dominantMode === 'letter-by-letter' ? 'Letter' : crossSessionPatterns.flow.dominantMode === 'full-word' ? 'Full Word' : 'Chaos'}</span></div>
										<div><span class="text-base-text-muted">Total:</span> <span class="text-green-400">{crossSessionPatterns.flow.totalWords}w</span></div>
									</div>
								</div>
								<div class="rounded bg-red-500/5 border border-red-500/20 px-2.5 py-2">
									<div class="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1.5">Spiral conditions</div>
									<div class="space-y-1 text-[10px]">
										<div><span class="text-base-text-muted">Speed:</span> <span class="text-red-400">{crossSessionPatterns.spiral.avgSpeed}x</span></div>
										<div><span class="text-base-text-muted">Post-err react:</span> <span class="text-red-400">{crossSessionPatterns.spiral.avgPostReaction}ms</span></div>
										<div><span class="text-base-text-muted">Position:</span> <span class="text-red-400">#{crossSessionPatterns.spiral.avgPosition}</span></div>
										{#if crossSessionPatterns.spiral.peakHour}
											<div><span class="text-base-text-muted">Worst hour:</span> <span class="text-red-400">{crossSessionPatterns.spiral.peakHour}</span></div>
										{/if}
										<div><span class="text-base-text-muted">Count:</span> <span class="text-red-400">{crossSessionPatterns.spiral.count} spirals</span></div>
									</div>
								</div>
							</div>

							<!-- Nemesis words -->
							{#if crossSessionPatterns.nemesisWords.length > 0}
								<div>
									<div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Words that always break you</div>
									<div class="flex flex-wrap gap-1">
										{#each crossSessionPatterns.nemesisWords as nw}
											<span class="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">{nw.word} <span class="text-base-text-muted">({nw.attempts}x)</span></span>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Insight text -->
							<div class="text-[10px] text-base-text-muted leading-relaxed space-y-1">
								{#if crossSessionPatterns.flow.avgSpeed > 0 && crossSessionPatterns.spiral.avgSpeed > crossSessionPatterns.flow.avgSpeed}
									<p>Flow at <span class="text-green-400 font-bold">{crossSessionPatterns.flow.avgSpeed}x</span>, spirals at <span class="text-red-400 font-bold">{crossSessionPatterns.spiral.avgSpeed}x</span> — the speed bump triggers fear.</p>
								{/if}
								{#if crossSessionPatterns.flow.avgPosition > 0 && crossSessionPatterns.spiral.avgPosition > crossSessionPatterns.flow.avgPosition}
									<p>Flow around word <span class="text-green-400 font-bold">#{crossSessionPatterns.flow.avgPosition}</span>, spirals around <span class="text-red-400 font-bold">#{crossSessionPatterns.spiral.avgPosition}</span>.</p>
								{/if}
								{#if crossSessionPatterns.spiral.avgPostReaction > 0 && crossSessionPatterns.spiral.avgPostReaction < 200}
									<p>After errors you rush (<span class="text-orange-400 font-bold">{crossSessionPatterns.spiral.avgPostReaction}ms</span>) — pause before the next letter.</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Chart header with mode tabs -->
		<div class="flex items-center justify-between">
			<div class="flex gap-1">
				{#each [
					{ key: 'speed', label: 'Speed', color: 'text-cyan-400' },
					{ key: 'accuracy', label: 'Accuracy', color: 'text-green-400' },
					{ key: 'volume', label: 'Volume', color: 'text-purple-400' },
				] as tab}
					<button
						onclick={() => { chartMode = tab.key as typeof chartMode; }}
						class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {chartMode === tab.key ? `bg-surface-hover ${tab.color}` : 'text-base-text-muted hover:text-base-text'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
			<button
				onclick={() => { showChart = !showChart; if (!showChart) selectedDate = null; }}
				class="text-[10px] text-base-text-muted hover:text-accent"
			>
				{showChart ? 'Hide' : 'Show'}
			</button>
			<ChartTypeToggle />
		</div>

		{#if showChart}
			<Chart option={chartOption} height="200px" onclick={onChartClick} />

			<!-- Legend -->
			<div class="flex flex-wrap items-center gap-3 text-[9px] text-base-text-muted">
				<span class="flex items-center gap-1">
					<span class="inline-block h-0.5 w-4 rounded" style="background: {chartColor};"></span>
					{chartMode === 'speed' ? 'avg speed' : chartMode === 'accuracy' ? 'accuracy' : 'words/day'}
				</span>
				{#if movingAvg.length > 0}
					<span class="flex items-center gap-1">
						<span class="inline-block h-0.5 w-4 rounded border-b border-dashed border-white/50"></span>
						7-day avg
					</span>
				{/if}
				<span class="flex items-center gap-1">
					<span class="inline-block h-2 w-2 rounded-full" style="background: {chartColor};"></span>
					day
				</span>
				<span class="flex items-center gap-1">
					<span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ring-1 ring-amber-400"></span>
					selected
				</span>
				{#if chartMode === 'speed'}
					<span class="flex items-center gap-1">
						<span class="inline-block h-3 w-3 rounded-full border border-dashed border-red-500/60"></span>
						low accuracy
					</span>
				{/if}
				<span class="ml-auto">click a day for details</span>
			</div>

			<!-- Trend summary -->
			{#if dailyStats.length > 1 && !selectedDate}
				{@const first = dailyStats[0]}
				{@const last = dailyStats[dailyStats.length - 1]}
				{@const speedDiff = last.avgDuration - first.avgDuration}
				{@const accDiff = last.accuracy - first.accuracy}
				<div class="flex items-center gap-4 rounded-lg border border-base-border bg-surface-hover/30 px-3 py-2 text-[11px]">
					<span class="text-base-text-muted">{dailyStats.length} days</span>
					<span class="{speedDiff < 0 ? 'text-green-400' : speedDiff > 0 ? 'text-red-400' : 'text-base-text-muted'}">
						Speed: {speedDiff < 0 ? 'faster' : speedDiff > 0 ? 'slower' : 'same'} by {formatMs(Math.abs(speedDiff))}
					</span>
					<span class="{accDiff > 0 ? 'text-green-400' : accDiff < 0 ? 'text-red-400' : 'text-base-text-muted'}">
						Accuracy: {accDiff > 0 ? '+' : ''}{accDiff}%
					</span>
					{#if streak.longest > streak.current}
						<span class="text-base-text-muted">best streak: {streak.longest}d</span>
					{/if}
				</div>
			{/if}
		{/if}

		<!-- Day detail view -->
		{#if selectedDate && selectedDayStats}
			<div class="rounded-lg border border-accent/30 bg-surface-hover/50 p-3">
				<div class="mb-3 flex items-center justify-between">
					<h5 class="text-sm font-bold text-accent">{selectedDayStats.label}</h5>
					<button
						onclick={() => (selectedDate = null)}
						class="text-base-text-muted hover:text-accent"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<SessionInsightsChart {words} selectedDate={selectedDate} />
			</div>
		{/if}
	</div>
{/if}
