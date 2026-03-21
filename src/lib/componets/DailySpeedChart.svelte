<script lang="ts">
	import type { SavedWord, TypingFlow } from '$lib/structure';

	let {
		words
	}: {
		words: SavedWord[];
	} = $props();

	let showChart = $state(true);
	let selectedDate: string | null = $state(null);
	let chartMode: 'speed' | 'accuracy' | 'volume' = $state('speed');

	// Chart dimensions
	const width = 400;
	const height = 180;
	const padding = { top: 20, right: 16, bottom: 40, left: 46 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;

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
	let chartMax = $derived(chartValues.length > 0 ? Math.max(...chartValues, 1) : 1);
	let chartColor = $derived(chartMode === 'speed' ? '#06b6d4' : chartMode === 'accuracy' ? '#22c55e' : '#a855f7');

	// 7-day moving average
	let movingAvg = $derived.by(() => {
		if (chartValues.length < 3) return [];
		const window = Math.min(7, Math.floor(chartValues.length / 2));
		const avgs: (number | null)[] = [];
		for (let i = 0; i < chartValues.length; i++) {
			if (i < window - 1) { avgs.push(null); continue; }
			let sum = 0;
			for (let j = i - window + 1; j <= i; j++) sum += chartValues[j];
			avgs.push(sum / window);
		}
		return avgs;
	});

	// Overall stats
	let totalWords = $derived(dailyStats.reduce((s, d) => s + d.wordCount, 0));
	let totalCorrect = $derived(dailyStats.reduce((s, d) => s + d.correctCount, 0));
	let totalPracticeTime = $derived(dailyStats.reduce((s, d) => s + d.totalPracticeMs, 0));
	let overallAccuracy = $derived(totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : 0);

	function formatMs(ms: number): string {
		return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
	}

	function formatPracticeTime(ms: number): string {
		const mins = Math.floor(ms / 60000);
		if (mins < 60) return `${mins}m`;
		const hrs = Math.floor(mins / 60);
		return `${hrs}h ${mins % 60}m`;
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function formatChartValue(val: number): string {
		if (chartMode === 'speed') return formatMs(val);
		if (chartMode === 'accuracy') return `${Math.round(val)}%`;
		return `${Math.round(val)}`;
	}

	function buildPath(values: number[], max: number): string {
		if (values.length < 2) return '';
		const stepX = chartW / (values.length - 1);
		return values
			.map((v, i) => {
				const x = padding.left + i * stepX;
				const y = padding.top + chartH - (v / max) * chartH;
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	}

	function buildAreaPath(values: number[], max: number): string {
		if (values.length < 2) return '';
		const stepX = chartW / (values.length - 1);
		const lineParts = values.map((v, i) => {
			const x = padding.left + i * stepX;
			const y = padding.top + chartH - (v / max) * chartH;
			return `${i === 0 ? 'M' : 'L'}${x},${y}`;
		});
		const bottomRight = `L${padding.left + (values.length - 1) * stepX},${padding.top + chartH}`;
		const bottomLeft = `L${padding.left},${padding.top + chartH}`;
		return lineParts.join(' ') + bottomRight + bottomLeft + 'Z';
	}

	function buildMovingAvgPath(avgs: (number | null)[], max: number): string {
		if (avgs.length < 2) return '';
		const stepX = chartW / (avgs.length - 1);
		let started = false;
		return avgs
			.map((v, i) => {
				if (v === null) return '';
				const x = padding.left + i * stepX;
				const y = padding.top + chartH - (v / max) * chartH;
				const cmd = started ? 'L' : 'M';
				started = true;
				return `${cmd}${x},${y}`;
			})
			.filter(Boolean)
			.join(' ');
	}

	let mainPath = $derived(buildPath(chartValues, chartMax));
	let areaPath = $derived(buildAreaPath(chartValues, chartMax));
	let maPath = $derived(buildMovingAvgPath(movingAvg, chartMax));

	let hoveredDay: DayStats | null = $state(null);
	let hoveredPos: { x: number; y: number } | null = $state(null);

	function selectDay(date: string) {
		selectedDate = selectedDate === date ? null : date;
	}
</script>

{#if dailyStats.length > 0}
	<div class="space-y-3">
		<!-- Summary cards -->
		<div class="grid grid-cols-4 gap-2">
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
		</div>

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
		</div>

		{#if showChart}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<svg
				viewBox="0 0 {width} {height}"
				class="w-full"
				onmouseleave={() => { hoveredDay = null; hoveredPos = null; }}
			>
				<!-- Grid lines -->
				{#each [0, 0.25, 0.5, 0.75, 1] as pct}
					<line
						x1={padding.left}
						y1={padding.top + chartH * (1 - pct)}
						x2={padding.left + chartW}
						y2={padding.top + chartH * (1 - pct)}
						stroke="var(--theme-border, #374151)"
						stroke-width="0.5"
					/>
					<text
						x={padding.left - 6}
						y={padding.top + chartH * (1 - pct) + 4}
						text-anchor="end"
						fill="#6b7280"
						font-size="9"
					>
						{formatChartValue(chartMax * pct)}
					</text>
				{/each}

				<!-- Area fill -->
				{#if areaPath}
					<path d={areaPath} fill={chartColor} opacity="0.08" />
				{/if}

				<!-- Main line -->
				{#if mainPath}
					<path d={mainPath} fill="none" stroke={chartColor} stroke-width="2" stroke-linejoin="round" />
				{/if}

				<!-- Moving average -->
				{#if maPath}
					<path d={maPath} fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="4 3" opacity="0.5" />
				{/if}

				<!-- Data points -->
				{#each dailyStats as day, i}
					{@const stepX = dailyStats.length > 1 ? chartW / (dailyStats.length - 1) : 0}
					{@const x = padding.left + i * stepX}
					{@const val = chartValues[i]}
					{@const y = padding.top + chartH - (val / chartMax) * chartH}
					{@const isSelected = day.date === selectedDate}
					{@const isToday = day.date === todayKey}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						onmouseenter={() => { hoveredDay = day; hoveredPos = { x, y }; }}
						onmouseleave={() => { hoveredDay = null; hoveredPos = null; }}
						onclick={() => selectDay(day.date)}
						style="cursor: pointer;"
					>
						<circle
							cx={x}
							cy={y}
							r={isSelected ? 7 : isToday ? 6 : 4}
							fill={isSelected ? '#f59e0b' : isToday ? chartColor : chartColor}
							stroke={isSelected ? '#fbbf24' : '#1f2937'}
							stroke-width={isSelected ? 2 : 1}
							opacity={isSelected || isToday ? 1 : 0.8}
						/>
						<!-- Accuracy ring for speed mode -->
						{#if chartMode === 'speed' && day.accuracy < 70}
							<circle
								cx={x}
								cy={y}
								r={isSelected ? 9 : 6}
								fill="none"
								stroke="#ef4444"
								stroke-width="1"
								stroke-dasharray="2 2"
								opacity="0.6"
							/>
						{/if}
						{#if dailyStats.length <= 14}
							<text
								x={x}
								y={padding.top + chartH + 16}
								text-anchor="middle"
								fill={isSelected ? '#fbbf24' : '#6b7280'}
								font-size="8"
								font-weight={isSelected ? 'bold' : '400'}
								transform="rotate(-30, {x}, {padding.top + chartH + 16})"
							>
								{day.label}
							</text>
						{/if}
					</g>
				{/each}

				<!-- Hover tooltip -->
				{#if hoveredDay && hoveredPos}
					{@const val = chartMode === 'speed' ? hoveredDay.avgDuration : chartMode === 'accuracy' ? hoveredDay.accuracy : hoveredDay.wordCount}
					<rect
						x={Math.min(Math.max(hoveredPos.x - 60, padding.left), width - 124)}
						y={Math.max(hoveredPos.y - 52, 2)}
						width="120"
						height="44"
						rx="5"
						fill="var(--theme-surface, #1f2937)"
						stroke={chartColor}
						stroke-width="0.8"
					/>
					<text
						x={Math.min(Math.max(hoveredPos.x, padding.left + 60), width - 64)}
						y={Math.max(hoveredPos.y - 36, 16)}
						text-anchor="middle"
						fill={chartColor}
						font-size="10"
						font-weight="bold"
					>
						{hoveredDay.label} — {formatChartValue(val)}
					</text>
					<text
						x={Math.min(Math.max(hoveredPos.x, padding.left + 60), width - 64)}
						y={Math.max(hoveredPos.y - 24, 28)}
						text-anchor="middle"
						fill="#d1d5db"
						font-size="9"
					>
						{hoveredDay.wordCount} words · {hoveredDay.accuracy}% acc
					</text>
					<text
						x={Math.min(Math.max(hoveredPos.x, padding.left + 60), width - 64)}
						y={Math.max(hoveredPos.y - 13, 39)}
						text-anchor="middle"
						fill="#9ca3af"
						font-size="8"
					>
						median {formatMs(hoveredDay.medianDuration)} · {formatMs(hoveredDay.avgLetterTime)}/letter
					</text>
				{/if}
			</svg>

			<!-- Legend -->
			<div class="flex items-center gap-4 text-[9px] text-base-text-muted">
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
					<div class="flex items-center gap-3 text-xs">
						<span class="text-base-text">{selectedDayStats.wordCount} words</span>
						<span class="text-green-400">{selectedDayStats.correctCount} correct</span>
						<span class="text-red-400">{selectedDayStats.errorCount} errors</span>
						<button
							onclick={() => (selectedDate = null)}
							class="ml-1 text-base-text-muted hover:text-accent"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<!-- Day stats -->
				<div class="mb-3 grid grid-cols-4 gap-2 text-center text-[10px]">
					<div>
						<div class="text-sm font-bold text-cyan-400">{formatMs(selectedDayStats.avgDuration)}</div>
						<div class="text-base-text-muted">avg</div>
					</div>
					<div>
						<div class="text-sm font-bold text-blue-400">{formatMs(selectedDayStats.medianDuration)}</div>
						<div class="text-base-text-muted">median</div>
					</div>
					<div>
						<div class="text-sm font-bold text-purple-400">{formatMs(selectedDayStats.avgLetterTime)}</div>
						<div class="text-base-text-muted">per letter</div>
					</div>
					<div>
						<div class="text-sm font-bold {selectedDayStats.accuracy >= 70 ? 'text-green-400' : 'text-amber-400'}">{selectedDayStats.accuracy}%</div>
						<div class="text-base-text-muted">accuracy</div>
					</div>
				</div>

				<!-- Fastest / slowest -->
				{#if selectedDayStats.fastestWord || selectedDayStats.slowestWord}
					<div class="mb-3 flex gap-3 text-[10px]">
						{#if selectedDayStats.fastestWord}
							<div class="flex-1 rounded border border-green-500/20 bg-green-500/5 px-2 py-1.5">
								<span class="text-base-text-muted">Fastest:</span>
								<span class="ml-1 font-bold text-green-400">{selectedDayStats.fastestWord.word}</span>
								<span class="ml-1 text-base-text-muted">{formatMs(selectedDayStats.fastestWord.duration)}</span>
							</div>
						{/if}
						{#if selectedDayStats.slowestWord}
							<div class="flex-1 rounded border border-red-500/20 bg-red-500/5 px-2 py-1.5">
								<span class="text-base-text-muted">Slowest:</span>
								<span class="ml-1 font-bold text-red-400">{selectedDayStats.slowestWord.word}</span>
								<span class="ml-1 text-base-text-muted">{formatMs(selectedDayStats.slowestWord.duration)}</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Individual word list for this day -->
				<div class="max-h-60 space-y-0.5 overflow-y-auto">
					{#each selectedDayFlows as { word, flow }, i}
						{@const dur = flow.totalDuration || flow.letterIntervals.reduce((a, b) => a + b, 0)}
						<div class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-surface-hover/50">
							<div class="flex items-center gap-2">
								<span class="w-4 text-center font-mono text-[10px] text-base-text-muted">{i + 1}</span>
								<span class="font-medium text-base-text">{word}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="font-mono text-base-text">{formatMs(dur)}</span>
								<span class="w-6 text-center font-medium {flow.correct ? 'text-green-400' : 'text-red-400'}">
									{flow.correct ? 'ok' : 'err'}
								</span>
								<span class="text-[10px] text-base-text-muted">{formatTime(flow.timestamp)}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
