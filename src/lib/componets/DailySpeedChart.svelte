<script lang="ts">
	import type { SavedWord, TypingFlow } from '$lib/structure';

	let {
		words
	}: {
		words: SavedWord[];
	} = $props();

	let showChart = $state(true);
	let selectedDate: string | null = $state(null);

	// Chart dimensions
	const width = 420;
	const height = 220;
	const padding = { top: 25, right: 20, bottom: 45, left: 50 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;

	interface DayStats {
		date: string;
		label: string;
		avgDuration: number;
		wordCount: number;
		correctCount: number;
	}

	interface DayWordFlow {
		word: string;
		flow: TypingFlow;
	}

	// Collect all flows from all words, group by day
	let dailyStats = $derived.by(() => {
		const dayMap = new Map<string, { totalDuration: number; count: number; correct: number }>();

		for (const w of words) {
			if (!w.typingFlows) continue;
			for (const flow of w.typingFlows) {
				const d = new Date(flow.timestamp);
				const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				const dur = flow.totalDuration || flow.letterIntervals.reduce((a, b) => a + b, 0);

				const existing = dayMap.get(key);
				if (existing) {
					existing.totalDuration += dur;
					existing.count++;
					if (flow.correct) existing.correct++;
				} else {
					dayMap.set(key, { totalDuration: dur, count: 1, correct: flow.correct ? 1 : 0 });
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
				wordCount: data.count,
				correctCount: data.correct,
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

	// Overlay chart: shared max across all flows for selected day
	let dayOverlayMax = $derived.by(() => {
		let max = 1;
		for (const { flow } of selectedDayFlows) {
			for (const v of flow.letterIntervals) {
				if (v > max) max = v;
			}
		}
		return max;
	});

	// Build overlay path with shared max
	function buildOverlayPath(intervals: number[], sharedMax: number, maxLen: number): string {
		if (intervals.length < 2) return '';
		const stepX = maxLen > 1 ? chartW / (maxLen - 1) : 0;
		return intervals
			.map((val, i) => {
				const x = padding.left + i * stepX;
				const y = padding.top + chartH - (val / sharedMax) * chartH;
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	}

	let dayOverlayMaxLen = $derived(selectedDayFlows.length > 0 ? Math.max(...selectedDayFlows.map(f => f.flow.letterIntervals.length)) : 0);

	// Average intervals for overlay
	let dayAvgIntervals = $derived.by(() => {
		if (selectedDayFlows.length === 0) return [];
		const avgs: number[] = [];
		for (let i = 0; i < dayOverlayMaxLen; i++) {
			let sum = 0;
			let count = 0;
			for (const { flow } of selectedDayFlows) {
				if (i < flow.letterIntervals.length) {
					sum += flow.letterIntervals[i];
					count++;
				}
			}
			avgs.push(count > 0 ? sum / count : 0);
		}
		return avgs;
	});

	let dayAvgPath = $derived(dayOverlayMaxLen > 0 ? buildOverlayPath(dayAvgIntervals, dayOverlayMax, dayOverlayMaxLen) : '');

	const overlayColors = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#a855f7'];

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

	let maxAvg = $derived(dailyStats.length > 0 ? Math.max(...dailyStats.map(d => d.avgDuration), 1) : 1);

	function formatMs(ms: number): string {
		return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function buildDailyPath(stats: DayStats[]): string {
		if (stats.length < 2) return '';
		const stepX = chartW / (stats.length - 1);
		return stats
			.map((s, i) => {
				const x = padding.left + i * stepX;
				const y = padding.top + chartH - (s.avgDuration / maxAvg) * chartH;
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	}

	let dailyPath = $derived(buildDailyPath(dailyStats));

	let hoveredDay: DayStats | null = $state(null);
	let hoveredPos: { x: number; y: number } | null = $state(null);

	function selectDay(date: string) {
		selectedDate = selectedDate === date ? null : date;
	}
</script>

{#if dailyStats.length > 0}
	<div class="pt-2">
		<!-- Header -->
		<div class="mb-3 space-y-2">
			<div class="flex items-center justify-between">
				<h4 class="text-sm font-bold tracking-wide text-accent uppercase">Daily Speed</h4>
				<button
					onclick={() => { showChart = !showChart; if (!showChart) selectedDate = null; }}
					class="rounded p-1 text-base-text-muted transition-colors hover:text-accent"
					title={showChart ? 'Hide chart' : 'Show chart'}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						style="transform: rotate({showChart ? 180 : 0}deg); transition: transform 0.2s;">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</div>
			<div class="flex items-center justify-between text-sm">
				<div class="flex items-center gap-2">
					<span class="font-bold text-orange-400">{streak.current}d streak</span>
					{#if streak.longest > streak.current}
						<span class="text-base-text-muted">(best {streak.longest}d)</span>
					{/if}
				</div>
				{#if todayStats}
					<div class="text-base-text">
						Today: <span class="font-bold text-cyan-400">{formatMs(todayStats.avgDuration)}</span>
						<span class="text-base-text-muted">({todayStats.wordCount} words)</span>
					</div>
				{/if}
			</div>
		</div>

		{#if showChart}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<svg
				viewBox="0 0 {width} {height}"
				class="w-full"
				onmouseleave={() => { hoveredDay = null; hoveredPos = null; }}
			>
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
						fill="#9ca3af"
						font-size="10"
						font-weight="500"
					>
						{formatMs(maxAvg * pct)}
					</text>
				{/each}

				{#if dailyPath}
					<path d={dailyPath} fill="none" stroke="#06b6d4" stroke-width="3" stroke-linejoin="round" />
				{/if}

				{#each dailyStats as day, i}
					{@const stepX = dailyStats.length > 1 ? chartW / (dailyStats.length - 1) : 0}
					{@const x = padding.left + i * stepX}
					{@const y = padding.top + chartH - (day.avgDuration / maxAvg) * chartH}
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
							r={day.date === selectedDate ? 8 : day.date === todayKey ? 7 : 5}
							fill={day.date === selectedDate ? '#f59e0b' : day.date === todayKey ? '#06b6d4' : '#22c55e'}
							stroke={day.date === selectedDate ? '#fbbf24' : '#1f2937'}
							stroke-width={day.date === selectedDate ? 2.5 : 1.5}
						/>
						{#if dailyStats.length <= 14}
							<text
								x={x}
								y={padding.top + chartH + 18}
								text-anchor="middle"
								fill={day.date === selectedDate ? '#fbbf24' : '#9ca3af'}
								font-size="9"
								font-weight={day.date === selectedDate ? 'bold' : '500'}
								transform="rotate(-30, {x}, {padding.top + chartH + 18})"
							>
								{day.label}
							</text>
						{/if}
					</g>
				{/each}

				{#if hoveredDay && hoveredPos}
					<rect
						x={Math.min(hoveredPos.x - 52, width - 110)}
						y={hoveredPos.y - 40}
						width="104"
						height="32"
						rx="5"
						fill="var(--theme-surface, #1f2937)"
						stroke="#06b6d4"
						stroke-width="1"
					/>
					<text
						x={Math.min(hoveredPos.x, width - 58)}
						y={hoveredPos.y - 26}
						text-anchor="middle"
						fill="#67e8f9"
						font-size="10"
						font-weight="bold"
					>
						{hoveredDay.label}: {formatMs(hoveredDay.avgDuration)}
					</text>
					<text
						x={Math.min(hoveredPos.x, width - 58)}
						y={hoveredPos.y - 14}
						text-anchor="middle"
						fill="#d1d5db"
						font-size="9"
					>
						{hoveredDay.wordCount} words, {hoveredDay.correctCount} correct
					</text>
				{/if}
			</svg>

			{#if dailyStats.length > 1 && !selectedDate}
				{@const first = dailyStats[0]}
				{@const last = dailyStats[dailyStats.length - 1]}
				{@const diff = last.avgDuration - first.avgDuration}
				<div class="mt-2 flex items-center gap-2 text-sm text-base-text-muted">
					<span>{dailyStats.length} days tracked</span>
					<span class="font-medium {diff < 0 ? 'text-green-400' : diff > 0 ? 'text-red-400' : 'text-base-text-muted'}">
						{diff < 0 ? 'Faster' : diff > 0 ? 'Slower' : 'Same'} by {formatMs(Math.abs(diff))} since first day
					</span>
				</div>
			{/if}

			<!-- Day detail view -->
			{#if selectedDate && selectedDayStats}
				<div class="mt-4 rounded-lg border border-accent/30 bg-surface-hover/50 p-4">
					<div class="mb-3 flex items-center justify-between">
						<h5 class="text-base font-bold text-accent">{selectedDayStats.label}</h5>
						<div class="flex items-center gap-3 text-sm text-base-text">
							<span>{selectedDayStats.wordCount} words</span>
							<span class="font-medium text-green-400">{selectedDayStats.correctCount} correct</span>
							<button
								onclick={() => (selectedDate = null)}
								class="ml-1 text-base-text-muted hover:text-accent"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>

					<!-- All flows overlaid for this day -->
					{#if selectedDayFlows.length > 0}
						<p class="mb-2 text-sm text-base-text-muted">{selectedDayFlows.length} flows overlaid (white = average)</p>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<svg viewBox="0 0 {width} {height}" class="w-full">
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
									fill="#9ca3af"
									font-size="10"
									font-weight="500"
								>
									{formatMs(dayOverlayMax * pct)}
								</text>
							{/each}

							{#each selectedDayFlows as { flow }, i}
								{@const path = buildOverlayPath(flow.letterIntervals, dayOverlayMax, dayOverlayMaxLen)}
								{#if path}
									<path
										d={path}
										fill="none"
										stroke={overlayColors[i % overlayColors.length]}
										stroke-width="1.5"
										stroke-linejoin="round"
										opacity="0.35"
									/>
								{/if}
							{/each}

							{#if dayAvgPath}
								<path d={dayAvgPath} fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" />
							{/if}
						</svg>
					{/if}

					<!-- Individual word list for this day -->
					<div class="mt-3 space-y-1">
						{#each selectedDayFlows as { word, flow }, i}
							{@const dur = flow.totalDuration || flow.letterIntervals.reduce((a, b) => a + b, 0)}
							<div class="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-surface-hover/50">
								<div class="flex items-center gap-2">
									<span class="w-5 text-center font-mono text-base-text-muted">{i + 1}</span>
									<span class="font-medium text-base-text">{word}</span>
								</div>
								<div class="flex items-center gap-3">
									<span class="font-mono text-base-text">{formatMs(dur)}</span>
									<span class="font-medium {flow.correct ? 'text-green-400' : 'text-red-400'}">
										{flow.correct ? 'ok' : 'err'}
									</span>
									<span class="text-base-text-muted">{formatTime(flow.timestamp)}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
{/if}
