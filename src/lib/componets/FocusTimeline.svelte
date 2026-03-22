<script lang="ts">
	import Chart from './Chart.svelte';
	import type * as echarts from 'echarts';

	let {
		timeline
	}: {
		timeline: { word: string; correct: boolean; duration: number; ts: number }[];
	} = $props();

	let showTimeline = $state(false);

	// Filter out session boundary markers
	let realTimeline = $derived(timeline.filter(t => t.word !== '---'));

	// Detect breaks > 5 min between consecutive entries
	const BREAK_MS = 5 * 60 * 1000;
	let breakIndices = $derived.by(() => {
		const breaks = new Set<number>();
		for (let i = 1; i < realTimeline.length; i++) {
			if (realTimeline[i].ts - realTimeline[i - 1].ts >= BREAK_MS) {
				breaks.add(i);
			}
		}
		return breaks;
	});

	// Compute focus zones — sliding window of 5 words
	let zones = $derived.by(() => {
		if (realTimeline.length < 2) return [];
		const windowSize = 5;
		const result: { startIdx: number; endIdx: number; accuracy: number | null; avgDuration: number; ts: number }[] = [];
		for (let i = 0; i <= realTimeline.length - windowSize; i++) {
			// Check if this window spans a break
			let spansBreak = false;
			for (let j = i + 1; j < i + windowSize; j++) {
				if (breakIndices.has(j)) { spansBreak = true; break; }
			}
			if (spansBreak) {
				result.push({
					startIdx: i,
					endIdx: i + windowSize - 1,
					accuracy: null,
					avgDuration: 0,
					ts: realTimeline[i + windowSize - 1].ts,
				});
			} else {
				const window = realTimeline.slice(i, i + windowSize);
				const correct = window.filter(w => w.correct).length;
				const avgDur = window.reduce((s, w) => s + w.duration, 0) / windowSize;
				result.push({
					startIdx: i,
					endIdx: i + windowSize - 1,
					accuracy: correct / windowSize,
					avgDuration: avgDur,
					ts: realTimeline[i + windowSize - 1].ts,
				});
			}
		}
		return result;
	});

	// Valid zones (non-null accuracy)
	let validZones = $derived(zones.filter(z => z.accuracy !== null) as { accuracy: number; ts: number }[]);

	// Peak accuracy across all zones
	let peakAccuracy = $derived(
		validZones.length > 0 ? Math.max(...validZones.map(z => z.accuracy)) * 100 : 0
	);

	// Current rolling accuracy (last valid zone)
	let currentRollingAccuracy = $derived(
		validZones.length > 0 ? validZones[validZones.length - 1].accuracy * 100 : 0
	);

	// Fatigue threshold: peak - 20
	let fatigueThreshold = $derived(peakAccuracy - 20);

	// Whether currently fatigued
	let isFatigued = $derived(
		zones.length > 0 && currentRollingAccuracy <= fatigueThreshold && peakAccuracy >= 40
	);

	// ECharts option for the accuracy curve
	let chartOption = $derived.by((): echarts.EChartsOption => {
		if (zones.length === 0) return {};

		const accuracyData = zones.map((z, i) => z.accuracy !== null ? [i, Math.round(z.accuracy * 100)] : [i, null]);
		const thresholdVal = Math.max(0, Math.round(fatigueThreshold));

		// Build markArea data for fatigued regions (accuracy <= threshold)
		const fatigueAreas: any[] = [];
		let areaStart: number | null = null;
		for (let i = 0; i < zones.length; i++) {
			const acc = zones[i].accuracy !== null ? zones[i].accuracy! * 100 : null;
			if (acc !== null && acc <= thresholdVal && peakAccuracy >= 40) {
				if (areaStart === null) areaStart = i;
			} else {
				if (areaStart !== null) {
					fatigueAreas.push([
						{ xAxis: areaStart },
						{ xAxis: i - 1 },
					]);
					areaStart = null;
				}
			}
		}
		if (areaStart !== null) {
			fatigueAreas.push([
				{ xAxis: areaStart },
				{ xAxis: zones.length - 1 },
			]);
		}

		return {
			grid: { left: 30, right: 8, top: 8, bottom: 20 },
			xAxis: {
				type: 'value',
				min: 0,
				max: zones.length - 1,
				axisLabel: { show: false },
				axisTick: { show: false },
				axisLine: { show: false },
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				min: 0,
				max: 100,
				axisLabel: { fontSize: 8, color: '#888' },
				splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
			},
			dataZoom: [
				{ type: 'inside', xAxisIndex: 0 },
			],
			series: [
				{
					_fixed: true,
					type: 'line',
					data: accuracyData,
					smooth: true,
					symbol: 'none',
					connectNulls: false,
					lineStyle: { width: 1.5, color: '#22c55e' },
					areaStyle: {
						color: {
							type: 'linear',
							x: 0, y: 0, x2: 0, y2: 1,
							colorStops: [
								{ offset: 0, color: 'rgba(34,197,94,0.3)' },
								{ offset: 0.2, color: 'rgba(34,197,94,0.2)' },
								{ offset: 0.5, color: 'rgba(245,158,11,0.15)' },
								{ offset: 1, color: 'rgba(239,68,68,0.15)' },
							],
						},
					},
					markLine: peakAccuracy >= 40 ? {
						silent: true,
						symbol: 'none',
						data: [
							{
								yAxis: thresholdVal,
								lineStyle: { color: '#ef4444', type: 'dashed', width: 1 },
								label: { show: true, fontSize: 8, color: '#ef4444', formatter: 'fatigue', position: 'insideEndTop' },
							},
						],
					} : undefined,
					markArea: fatigueAreas.length > 0 ? {
						silent: true,
						itemStyle: { color: 'rgba(239,68,68,0.1)' },
						data: fatigueAreas,
					} : undefined,
				} as any,
				// Visual reference lines at 80% and 50%
				{
					_fixed: true,
					type: 'line',
					data: [],
					markLine: {
						silent: true,
						symbol: 'none',
						data: [
							{
								yAxis: 80,
								lineStyle: { color: 'rgba(34,197,94,0.2)', type: 'dotted', width: 1 },
								label: { show: false },
							},
							{
								yAxis: 50,
								lineStyle: { color: 'rgba(245,158,11,0.2)', type: 'dotted', width: 1 },
								label: { show: false },
							},
						],
					},
				} as any,
			],
		};
	});

	// Current streak type
	let currentZone = $derived.by(() => {
		if (realTimeline.length < 3) return null;
		const last5 = realTimeline.slice(-5);
		const correct = last5.filter(w => w.correct).length;
		const rate = correct / last5.length;
		if (rate >= 0.8) return 'flow';
		if (rate <= 0.4) return 'struggle';
		return 'mixed';
	});

	let zoneLabel = $derived(
		currentZone === 'flow' ? 'IN THE ZONE' :
		currentZone === 'struggle' ? 'STRUGGLING' :
		currentZone === 'mixed' ? 'WARMING UP' : ''
	);
	let zoneColor = $derived(
		currentZone === 'flow' ? '#22c55e' :
		currentZone === 'struggle' ? '#ef4444' : '#f59e0b'
	);

	function formatMs(ms: number): string {
		return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
	}
</script>

{#if realTimeline.length > 0}
	<div class="flex items-center gap-3">
		<!-- Live zone indicator -->
		{#if currentZone}
			<div class="flex items-center gap-1.5">
				<div
					class="h-1.5 w-1.5 rounded-full"
					class:animate-pulse={currentZone === 'flow'}
					style="background: {zoneColor};"
				></div>
				<span class="text-[9px] font-bold tracking-wider" style="color: {zoneColor};">
					{zoneLabel}
				</span>
			</div>
		{/if}

		<!-- Mini timeline bar -->
		{#if realTimeline.length >= 3}
			<button
				onclick={() => (showTimeline = !showTimeline)}
				class="flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-surface-hover"
				title="Focus timeline"
			>
				{#each realTimeline.slice(-20) as entry}
					<div
						class="h-2 w-1 rounded-sm"
						style="background: {entry.correct ? '#22c55e' : '#ef4444'}; opacity: 0.7;"
					></div>
				{/each}
			</button>
		{/if}
	</div>

	<!-- Expanded timeline -->
	{#if showTimeline && realTimeline.length >= 5}
		<div class="fixed top-10 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-base-border bg-surface p-4 shadow-xl">
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-bold text-accent">Session Focus Map</span>
				<button onclick={() => (showTimeline = false)} class="text-base-text-muted hover:text-accent">
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Rolling accuracy curve -->
			{#if zones.length > 0}
				<div class="w-80">
					<Chart option={chartOption} height="80px" />
				</div>
			{/if}

			<!-- Word-by-word list (last 30) -->
			<div class="mt-2 flex max-w-[320px] flex-wrap gap-1">
				{#each realTimeline.slice(-30) as entry}
					<span
						class="rounded px-1.5 py-0.5 text-[10px] font-medium"
						style="background: {entry.correct ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color: {entry.correct ? '#4ade80' : '#f87171'};"
						title="{entry.word} — {formatMs(entry.duration)}"
					>
						{entry.word.length > 8 ? entry.word.slice(0, 8) + '..' : entry.word}
					</span>
				{/each}
			</div>

			<!-- Stats -->
			<div class="mt-2 flex flex-wrap gap-3 text-[10px] text-base-text-muted">
				<span>{realTimeline.length} words</span>
				<span class="text-green-400">{realTimeline.filter(t => t.correct).length} correct</span>
				<span class="text-red-400">{realTimeline.filter(t => !t.correct).length} errors</span>
				{#if zones.length > 0}
					<span class="text-accent">Peak: {Math.round(peakAccuracy)}%</span>
					<span style="color: {currentRollingAccuracy >= 80 ? '#22c55e' : currentRollingAccuracy >= 50 ? '#f59e0b' : '#ef4444'};">
						Rolling: {Math.round(currentRollingAccuracy)}%
					</span>
					{#if isFatigued}
						<span class="font-bold text-red-400">Fatigue detected</span>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
{/if}
