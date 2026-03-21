<script lang="ts">
	import type { TypingFlow } from '$lib/structure';

	let {
		flows,
		word,
		defaultView = 'history',
	}: {
		flows: TypingFlow[];
		word: string;
		defaultView?: 'history' | 'latest' | 'insights';
	} = $props();

	let selectedFlowIndex: number | null = $state(null);
	let view: 'latest' | 'history' | 'insights' = $state(defaultView === 'history' ? 'history' : defaultView === 'insights' ? 'insights' : 'latest');
	let chartUnit: 'ms' | 'pct' = $state('ms');

	function getMsPerLetter(flow: TypingFlow): number {
		if (flow.msPerLetter) return flow.msPerLetter;
		if (flow.speed) return 1000 / Math.max(flow.speed, 1);
		return 500; // fallback for old data
	}

	/** Normalize an interval to % of time budget. 100% = used all allowed time for one letter */
	function toPct(ms: number, msPerLetter: number): number {
		return msPerLetter > 0 ? (ms / msPerLetter) * 100 : 0;
	}

	let activeFlow = $derived(
		selectedFlowIndex !== null ? flows[selectedFlowIndex] : flows[flows.length - 1]
	);

	// Chart dimensions
	const width = 280;
	const height = 120;
	const padding = { top: 16, right: 12, bottom: 28, left: 34 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;

	// ── Helpers ──

	function formatMs(ms: number): string {
		return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
	}

	function formatVal(val: number): string {
		if (chartUnit === 'pct') return `${Math.round(val)}%`;
		return formatMs(val);
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	// Get typing intervals excluding reaction time (first entry).
	// Old flows: intervals[0] = reaction time (large). New flows: intervals[0] = 0, reactionTime is separate.
	// We skip index 0 and chart only inter-key intervals (indices 1+), mapped to letters 1+.
	// Letter 0 gets null (first key has no inter-key interval).
	function getTypingIntervals(flow: TypingFlow): number[] {
		// New format: reactionTime field exists and intervals[0] is 0
		if (flow.reactionTime !== undefined && flow.letterIntervals.length > 0 && flow.letterIntervals[0] === 0) {
			return flow.letterIntervals.slice(1);
		}
		// Old format: intervals[0] is the reaction time — skip it
		return flow.letterIntervals.slice(1);
	}

	function getReactionTime(flow: TypingFlow): number {
		if (flow.reactionTime !== undefined) return flow.reactionTime;
		// Old format: first interval was reaction time
		return flow.letterIntervals.length > 0 ? flow.letterIntervals[0] : 0;
	}

	function mapIntervalsToWord(intervals: number[], reactionTime: number): (number | null)[] {
		// First letter uses reaction time, rest use inter-key intervals
		const mapped: (number | null)[] = [reactionTime > 0 ? reactionTime : null];
		for (let i = 0; i < word.length - 1; i++) {
			mapped.push(i < intervals.length ? intervals[i] : null);
		}
		return mapped;
	}

	// ── Single flow chart (Latest view) ──

	function buildFlowPoints(flow: TypingFlow): { x: number; y: number; val: number | null; letter: string; idx: number; isHesitation: boolean; isRush: boolean; isReaction: boolean }[] {
		const interKeyIntervals = getTypingIntervals(flow);
		const reaction = getReactionTime(flow);
		const budgetMs = getMsPerLetter(flow);
		const mapped = mapIntervalsToWord(interKeyIntervals, reaction);

		// Convert to display values based on unit
		const toDisplay = (ms: number) => chartUnit === 'pct' ? toPct(ms, budgetMs) : ms;

		// For scale + hesitation detection, use inter-key intervals only (not reaction time)
		const typed = interKeyIntervals.filter(v => v > 0);
		const avg = typed.length > 0 ? typed.reduce((a, b) => a + b, 0) / typed.length : 0;
		const stdDev = typed.length > 1
			? Math.sqrt(typed.reduce((s, v) => s + (v - avg) ** 2, 0) / typed.length)
			: 0;

		// Display values for scaling
		const displayVals = mapped.map(v => v !== null && v > 0 ? toDisplay(v) : null);
		const allDisplayVals = displayVals.filter((v): v is number => v !== null && v > 0);
		const maxVal = Math.max(...allDisplayVals, 1);
		const stepX = word.length > 1 ? chartW / (word.length - 1) : 0;

		return mapped.map((val, i) => {
			const displayVal = displayVals[i];
			const x = padding.left + i * stepX;
			const y = displayVal !== null && displayVal > 0
				? padding.top + chartH - (displayVal / maxVal) * chartH
				: padding.top + chartH;
			const isFirst = i === 0;
			return {
				x, y, val: displayVal, letter: word[i],
				idx: i,
				isHesitation: !isFirst && val !== null && val > 0 && val > avg + stdDev * 0.8,
				isRush: !isFirst && val !== null && val > 0 && val < avg - stdDev * 0.5 && val < avg * 0.6,
				isReaction: isFirst && val !== null && val > 0,
			};
		});
	}

	function buildFlowPath(points: { x: number; y: number; val: number | null }[]): string {
		const typed = points.filter(p => p.val !== null);
		if (typed.length < 2) return '';
		return typed.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
	}

	let activePoints = $derived(activeFlow ? buildFlowPoints(activeFlow) : []);
	let activePath = $derived(buildFlowPath(activePoints));
	let activeInterKey = $derived(activeFlow ? getTypingIntervals(activeFlow).filter(v => v > 0) : []);
	let activeMax = $derived(activeInterKey.length > 0 ? Math.max(...activeInterKey, 1) : 1);
	let activeAvg = $derived(activeInterKey.length > 0
		? activeInterKey.reduce((a, b) => a + b, 0) / activeInterKey.length
		: 0);
	let activeReaction = $derived(activeFlow ? getReactionTime(activeFlow) : 0);

	// Overall average speed across ALL flows for this word (typing only, excludes reaction)
	let overallAvgSpeed = $derived.by(() => {
		if (flows.length === 0) return 0;
		const durations = flows.map(f => {
			const interKey = getTypingIntervals(f);
			return interKey.length > 0 ? interKey.reduce((a, b) => a + b, 0) : 0;
		});
		return durations.reduce((a, b) => a + b, 0) / durations.length;
	});

	let fastestFlow = $derived.by(() => {
		if (flows.length === 0) return null;
		let fastest = flows[0];
		for (const f of flows) {
			const dur = f.totalDuration || f.letterIntervals.reduce((a, b) => a + b, 0);
			const bestDur = fastest.totalDuration || fastest.letterIntervals.reduce((a, b) => a + b, 0);
			if (dur < bestDur && f.correct) fastest = f;
		}
		return fastest;
	});

	let fastestDuration = $derived(fastestFlow
		? fastestFlow.totalDuration || fastestFlow.letterIntervals.reduce((a, b) => a + b, 0)
		: 0);

	// Average reaction time across all flows
	let avgReactionTime = $derived.by(() => {
		if (flows.length === 0) return 0;
		const reactions = flows.map(f => getReactionTime(f));
		return reactions.reduce((a, b) => a + b, 0) / reactions.length;
	});

	// ── History overlay ──

	// Use inter-key intervals only, normalized if in pct mode
	let overlayMax = $derived.by(() => {
		let max = 1;
		for (const f of flows) {
			const budget = getMsPerLetter(f);
			for (const v of getTypingIntervals(f)) {
				const dv = chartUnit === 'pct' ? toPct(v, budget) : v;
				if (dv > max) max = dv;
			}
		}
		return max;
	});

	function buildOverlayPath(intervals: number[], sharedMax: number, flow?: TypingFlow): string {
		if (intervals.length < 1) return '';
		const budget = flow ? getMsPerLetter(flow) : 500;
		const stepX = word.length > 1 ? chartW / (word.length - 1) : 0;
		return intervals
			.map((val, i) => {
				const dv = chartUnit === 'pct' ? toPct(val, budget) : val;
				const x = padding.left + (i + 1) * stepX;
				const y = padding.top + chartH - (dv / sharedMax) * chartH;
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	}

	const overlayColors = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#a855f7'];

	let avgIntervals = $derived.by(() => {
		if (flows.length === 0) return [];
		const maxLen = word.length - 1; // inter-key intervals count
		const avgs: number[] = [];
		for (let i = 0; i < maxLen; i++) {
			let sum = 0;
			let count = 0;
			for (const f of flows) {
				const interKey = getTypingIntervals(f);
				if (i < interKey.length) {
					sum += interKey[i];
					count++;
				}
			}
			avgs.push(count > 0 ? sum / count : 0);
		}
		return avgs;
	});

	let overlayAvgPath = $derived(buildOverlayPath(avgIntervals, overlayMax));
	let overlayStepX = $derived(word.length > 1 ? chartW / (word.length - 1) : 0);

	// ── Insights ──

	let correctFlows = $derived(flows.filter(f => f.correct));
	let errorFlows = $derived(flows.filter(f => !f.correct));
	let successRate = $derived(flows.length > 0 ? Math.round((correctFlows.length / flows.length) * 100) : 0);

	// Where errors happen: which letter index do people stop at?
	let errorBreakpoints = $derived.by(() => {
		const counts: number[] = new Array(word.length).fill(0);
		for (const f of errorFlows) {
			// The last typed letter index is where they broke
			const breakIdx = Math.min(f.letterIntervals.length - 1, word.length - 1);
			if (breakIdx >= 0) counts[breakIdx]++;
		}
		return counts;
	});

	// Per-letter average hesitation (inter-key only, letter 0 has no data)
	let letterAvgs = $derived.by(() => {
		const avgs: { avg: number; count: number }[] = [];
		// Letter 0: no inter-key interval
		avgs.push({ avg: 0, count: 0 });
		for (let i = 0; i < word.length - 1; i++) {
			let sum = 0;
			let count = 0;
			for (const f of flows) {
				const interKey = getTypingIntervals(f);
				if (i < interKey.length) {
					sum += interKey[i];
					count++;
				}
			}
			avgs.push({ avg: count > 0 ? sum / count : 0, count });
		}
		return avgs;
	});

	// Overall consistency (coefficient of variation across all intervals)
	let consistency = $derived.by(() => {
		const allIntervals = flows.flatMap(f => getTypingIntervals(f)).filter(v => v > 0);
		if (allIntervals.length < 2) return null;
		const mean = allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length;
		const stdDev = Math.sqrt(allIntervals.reduce((s, v) => s + (v - mean) ** 2, 0) / allIntervals.length);
		// Lower CV = more consistent = more "present"
		const cv = mean > 0 ? stdDev / mean : 0;
		return { mean, stdDev, cv };
	});

	// Presence score: 0-100, higher = more consistent timing = more present
	let presenceScore = $derived.by(() => {
		if (!consistency) return null;
		// CV of 0 = perfect = 100, CV of 1+ = erratic = 0
		return Math.max(0, Math.round((1 - Math.min(consistency.cv, 1.5) / 1.5) * 100));
	});

	// Trend: compare first half of attempts to second half
	let trend = $derived.by(() => {
		if (flows.length < 4) return null;
		const mid = Math.floor(flows.length / 2);
		const firstHalf = flows.slice(0, mid);
		const secondHalf = flows.slice(mid);
		const avgDuration = (arr: TypingFlow[]) =>
			arr.reduce((s, f) => s + (f.totalDuration || f.letterIntervals.reduce((a, b) => a + b, 0)), 0) / arr.length;
		const avgFirst = avgDuration(firstHalf);
		const avgSecond = avgDuration(secondHalf);
		const firstCorrectRate = firstHalf.filter(f => f.correct).length / firstHalf.length;
		const secondCorrectRate = secondHalf.filter(f => f.correct).length / secondHalf.length;
		return {
			speedChange: avgFirst > 0 ? ((avgFirst - avgSecond) / avgFirst) * 100 : 0,
			accuracyChange: (secondCorrectRate - firstCorrectRate) * 100,
			improving: avgSecond < avgFirst && secondCorrectRate >= firstCorrectRate,
		};
	});

	// Hesitation hotspots: letters where avg time is > 1.5x the overall average
	let hotspots = $derived.by(() => {
		if (letterAvgs.length === 0) return [];
		const overallAvg = letterAvgs.reduce((s, l) => s + l.avg, 0) / letterAvgs.length;
		return letterAvgs.map((l, i) => ({
			letter: word[i],
			idx: i,
			avg: l.avg,
			ratio: overallAvg > 0 ? l.avg / overallAvg : 0,
			isHot: l.avg > overallAvg * 1.4 && l.count >= 2,
		}));
	});

	let hoveredPoint: { x: number; y: number; val: number; letter: string; isHesitation: boolean; isRush: boolean; isReaction: boolean } | null = $state(null);

	const viewLabels = ['latest', 'history', 'insights'] as const;
</script>

{#if flows.length > 0}
	<div class="mt-3 border-t border-base-border pt-3">
		<!-- Header with view tabs -->
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<h4 class="text-xs font-semibold tracking-wide text-accent uppercase">Typing Flow</h4>
				{#if view !== 'insights'}
					<button
						onclick={() => chartUnit = chartUnit === 'ms' ? 'pct' : 'ms'}
						class="rounded px-1 py-0.5 text-[9px] font-mono transition-colors {chartUnit === 'pct' ? 'bg-purple-500/20 text-purple-400' : 'text-base-text-muted hover:text-base-text'}"
						title={chartUnit === 'ms' ? 'Switch to % of time budget (comparable across speeds)' : 'Switch to raw milliseconds'}
					>
						{chartUnit === 'ms' ? 'ms' : '%'}
					</button>
				{/if}
			</div>
			<div class="flex gap-1">
				{#each viewLabels as v}
					<button
						onclick={() => { view = v; }}
						class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {view === v ? 'bg-accent text-black' : 'text-base-text-muted hover:text-accent'}"
					>
						{v === 'latest' ? 'Latest' : v === 'history' ? 'History' : 'Insights'}
					</button>
				{/each}
			</div>
		</div>

		<!-- ═══════ LATEST VIEW ═══════ -->
		{#if view === 'latest'}
			<div class="relative">
				{#if activeFlow}
					<div class="mb-1 flex items-center justify-between text-xs text-base-text-muted">
						<span class={activeFlow.correct ? 'text-green-400' : 'text-red-400'}>
							{activeFlow.correct ? 'Correct' : 'Error'}
							{#if !activeFlow.correct}
								<span class="text-base-text-muted ml-1">
									({activeFlow.letterIntervals.length}/{word.length} letters)
								</span>
							{/if}
							<span class="text-base-text-muted ml-1">{formatMs(activeFlow.totalDuration || activeFlow.letterIntervals.reduce((a, b) => a + b, 0))}</span>
						</span>
						<span>{formatDate(activeFlow.timestamp)}</span>
					</div>
					<!-- Average speed stats -->
					{#if flows.length > 1}
						<div class="mb-1.5 flex flex-wrap gap-3 text-[10px] text-base-text-muted">
							<span>avg: <span class="text-cyan-400 font-bold">{formatMs(overallAvgSpeed)}</span></span>
							{#if fastestDuration > 0}
								<span>best: <span class="text-green-400 font-bold">{formatMs(fastestDuration)}</span></span>
							{/if}
							<span>react: <span class="{avgReactionTime > 3000 ? 'text-red-400' : avgReactionTime > 1500 ? 'text-amber-400' : 'text-green-400'} font-bold">{formatMs(avgReactionTime)}</span></span>
							<span>attempts: <span class="text-accent">{flows.length}</span></span>
						</div>
					{/if}
					{#if flows.length <= 1 && activeReaction > 0}
						<div class="mb-1.5 text-[10px] text-base-text-muted">
							react: <span class="{activeReaction > 3000 ? 'text-red-400' : activeReaction > 1500 ? 'text-amber-400' : 'text-green-400'} font-bold">{formatMs(activeReaction)}</span>
							{#if activeFlow?.speed}
								<span class="ml-2">speed: <span class="text-accent">{activeFlow.speed.toFixed(2)}x</span></span>
							{/if}
						</div>
					{/if}
				{/if}

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<svg
					viewBox="0 0 {width} {height}"
					class="w-full"
					onmouseleave={() => (hoveredPoint = null)}
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
							x={padding.left - 4}
							y={padding.top + chartH * (1 - pct) + 3}
							text-anchor="end"
							fill="var(--theme-text-muted, #6b7280)"
							font-size="7"
						>
							{formatVal(activeMax * pct)}
						</text>
					{/each}

					<!-- Average line (dashed) -->
					{#if activeAvg > 0}
						{@const avgY = padding.top + chartH - (activeAvg / activeMax) * chartH}
						<line
							x1={padding.left}
							y1={avgY}
							x2={padding.left + chartW}
							y2={avgY}
							stroke="#6b7280"
							stroke-width="0.8"
							stroke-dasharray="4 3"
						/>
						<text
							x={padding.left + chartW + 2}
							y={avgY + 3}
							fill="#6b7280"
							font-size="6"
						>
							avg
						</text>
					{/if}

					<!-- 100% budget line (only in % mode) -->
					{#if chartUnit === 'pct' && activeMax > 0}
						{@const budgetY = padding.top + chartH - (100 / activeMax) * chartH}
						{#if budgetY >= padding.top && budgetY <= padding.top + chartH}
							<line
								x1={padding.left}
								y1={budgetY}
								x2={padding.left + chartW}
								y2={budgetY}
								stroke="#ef4444"
								stroke-width="0.8"
								stroke-dasharray="6 3"
								opacity="0.5"
							/>
							<text
								x={padding.left + chartW + 2}
								y={budgetY + 3}
								fill="#ef4444"
								font-size="6"
								opacity="0.7"
							>
								100%
							</text>
						{/if}
					{/if}

					<!-- Flow line -->
					{#if activePath}
						<path d={activePath} fill="none" stroke="var(--theme-accent, #f59e0b)" stroke-width="2" stroke-linejoin="round" />
					{/if}

					<!-- Points and letter labels -->
					{#each activePoints as pt, i}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<g
							onmouseenter={() => { if (pt.val !== null) hoveredPoint = pt as any; }}
							onmouseleave={() => (hoveredPoint = null)}
							style="cursor: {pt.val !== null ? 'pointer' : 'default'};"
						>
							{#if pt.val !== null}
								<circle
									cx={pt.x} cy={pt.y} r="3.5"
									fill={pt.isReaction ? '#a855f7' : pt.isHesitation ? '#f59e0b' : pt.isRush ? '#06b6d4' : activeFlow?.correct ? '#22c55e' : '#ef4444'}
									stroke="var(--theme-surface, #1f2937)" stroke-width="1"
								/>
							{:else}
								<!-- Untyped letter: faded X -->
								<text
									x={pt.x} y={padding.top + chartH - 4}
									text-anchor="middle"
									fill="#4b5563"
									font-size="8"
								>-</text>
							{/if}
							<text
								x={pt.x}
								y={padding.top + chartH + 14}
								text-anchor="middle"
								fill={pt.val !== null ? (pt.isReaction ? '#a855f7' : pt.isHesitation ? '#f59e0b' : 'var(--theme-accent, #d4a574)') : '#4b5563'}
								font-size="8"
								font-weight={pt.isHesitation ? '900' : 'bold'}
								opacity={pt.val !== null ? 1 : 0.4}
							>
								{pt.letter}
							</text>
						</g>
					{/each}

					<!-- Hover tooltip -->
					{#if hoveredPoint}
						{@const label = hoveredPoint.isReaction ? 'reaction' : hoveredPoint.isHesitation ? 'hesitation' : hoveredPoint.isRush ? 'autopilot' : ''}
						{@const tooltipW = label ? 60 : 36}
						{@const tooltipH = label ? 20 : 14}
						{@const nearTop = hoveredPoint.y - tooltipH - 8 < padding.top}
						{@const tipY = nearTop ? hoveredPoint.y + 8 : hoveredPoint.y - tooltipH - 6}
						{@const tipX = Math.max(padding.left, Math.min(hoveredPoint.x - tooltipW / 2, width - tooltipW - 2))}
						{@const tipCenterX = tipX + tooltipW / 2}
						<rect
							x={tipX}
							y={tipY}
							width={tooltipW}
							height={tooltipH}
							rx="3"
							fill="var(--theme-surface, #1f2937)"
							stroke={hoveredPoint.isReaction ? '#a855f7' : hoveredPoint.isHesitation ? '#f59e0b' : hoveredPoint.isRush ? '#06b6d4' : 'var(--theme-accent, #f59e0b)'}
							stroke-width="0.5"
						/>
						<text
							x={tipCenterX}
							y={tipY + (label ? 9 : 10)}
							text-anchor="middle"
							fill="var(--theme-accent, #fbbf24)"
							font-size="7"
							font-weight="bold"
						>
							{formatVal(hoveredPoint.val)}
						</text>
						{#if label}
							<text
								x={tipCenterX}
								y={tipY + 17}
								text-anchor="middle"
								fill={hoveredPoint.isReaction ? '#a855f7' : hoveredPoint.isHesitation ? '#f59e0b' : '#06b6d4'}
								font-size="6"
							>
								{label}
							</text>
						{/if}
					{/if}
				</svg>

				<!-- Legend -->
				<div class="mt-1 flex flex-wrap gap-3 text-[9px] text-base-text-muted">
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-purple-500"></span> reaction</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-green-500"></span> correct</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-red-500"></span> error</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-amber-500"></span> hesitation</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-cyan-500"></span> autopilot</span>
					{#if chartUnit === 'pct'}
						<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded border-b border-dashed border-red-500/50"></span> budget</span>
					{/if}
					{#if activeFlow && !activeFlow.correct}
						<span class="flex items-center gap-1"><span class="text-[#4b5563]">-</span> untyped</span>
					{/if}
				</div>

				<!-- Flow selector -->
				{#if flows.length > 1}
					<div class="mt-2 flex items-center gap-2">
						<span class="text-[10px] text-base-text-muted">Attempt:</span>
						<div class="flex flex-wrap gap-1">
							{#each flows as flow, i}
								<button
									onclick={() => (selectedFlowIndex = i)}
									class="h-4 w-4 rounded-sm text-[8px] font-bold transition-colors {selectedFlowIndex === i || (selectedFlowIndex === null && i === flows.length - 1) ? 'bg-accent text-black' : flow.correct ? 'bg-green-800 text-green-300' : 'bg-red-900 text-red-300'}"
								>
									{i + 1}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

		<!-- ═══════ HISTORY VIEW ═══════ -->
		{:else if view === 'history'}
			<div>
				<p class="mb-1 text-[10px] text-base-text-muted">{flows.length} attempts overlaid &middot; white = average</p>
				<svg viewBox="0 0 {width} {height}" class="w-full">
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
							x={padding.left - 4}
							y={padding.top + chartH * (1 - pct) + 3}
							text-anchor="end"
							fill="var(--theme-text-muted, #6b7280)"
							font-size="7"
						>
							{formatVal(overlayMax * pct)}
						</text>
					{/each}

					<!-- Individual flow lines -->
					{#each flows as flow, i}
						{@const interKey = getTypingIntervals(flow)}
						{@const path = buildOverlayPath(interKey, overlayMax, flow)}
						{#if path}
							<path
								d={path}
								fill="none"
								stroke={flow.correct ? overlayColors[i % overlayColors.length] : '#ef4444'}
								stroke-width="1"
								stroke-linejoin="round"
								opacity={flow.correct ? 0.3 : 0.2}
								stroke-dasharray={flow.correct ? 'none' : '3 2'}
							/>
							<!-- Error breakpoint marker -->
							{#if !flow.correct && interKey.length > 0}
								{@const breakIdx = interKey.length - 1}
								{@const breakX = padding.left + (breakIdx + 1) * overlayStepX}
								{@const breakY = padding.top + chartH - (interKey[breakIdx] / overlayMax) * chartH}
								<circle cx={breakX} cy={breakY} r="2" fill="#ef4444" opacity="0.6" />
							{/if}
						{/if}
					{/each}

					<!-- 100% budget line (only in % mode) -->
					{#if chartUnit === 'pct' && overlayMax > 0}
						{@const budgetY = padding.top + chartH - (100 / overlayMax) * chartH}
						{#if budgetY >= padding.top && budgetY <= padding.top + chartH}
							<line
								x1={padding.left}
								y1={budgetY}
								x2={padding.left + chartW}
								y2={budgetY}
								stroke="#ef4444"
								stroke-width="0.8"
								stroke-dasharray="6 3"
								opacity="0.5"
							/>
							<text
								x={padding.left + chartW + 2}
								y={budgetY + 3}
								fill="#ef4444"
								font-size="6"
								opacity="0.7"
							>
								100%
							</text>
						{/if}
					{/if}

					<!-- Average line (bold white) -->
					{#if overlayAvgPath}
						<path d={overlayAvgPath} fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" />
					{/if}

					<!-- Letter labels -->
					{#each word.split('') as letter, i}
						<text
							x={padding.left + i * overlayStepX}
							y={padding.top + chartH + 14}
							text-anchor="middle"
							fill="var(--theme-accent, #d4a574)"
							font-size="8"
							font-weight="bold"
						>
							{letter}
						</text>
					{/each}
				</svg>

				<!-- Legend -->
				<div class="mt-1.5 flex flex-wrap gap-3 text-[9px] text-base-text-muted">
					<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded bg-white"></span> average</span>
					<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded bg-red-500" style="border-bottom: 1px dashed #ef4444;"></span> error attempt</span>
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-red-500"></span> error breakpoint</span>
					<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded bg-green-500 opacity-40"></span> correct attempt</span>
				</div>

				<!-- Stats summary -->
				<div class="mt-1.5 flex flex-wrap gap-3 text-[10px] text-base-text-muted">
					<span>Attempts: <span class="text-accent">{flows.length}</span></span>
					<span>Correct: <span class="text-green-400">{correctFlows.length}</span></span>
					<span>Errors: <span class="text-red-400">{errorFlows.length}</span></span>
					<span>Avg: <span class="text-cyan-400">{formatMs(overallAvgSpeed)}</span></span>
					{#if fastestDuration > 0}
						<span>Best: <span class="text-green-400">{formatMs(fastestDuration)}</span></span>
					{/if}
					<span>React: <span class="{avgReactionTime > 3000 ? 'text-red-400' : avgReactionTime > 1500 ? 'text-amber-400' : 'text-green-400'}">{formatMs(avgReactionTime)}</span></span>
				</div>
			</div>

		<!-- ═══════ INSIGHTS VIEW ═══════ -->
		{:else}
			<div class="space-y-3 text-xs">

				<!-- Presence Score -->
				{#if presenceScore !== null}
					<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
						<div class="mb-1.5 flex items-center justify-between">
							<span class="text-[10px] font-bold uppercase tracking-wider text-base-text-muted">Presence</span>
							<span class="text-lg font-black {presenceScore >= 70 ? 'text-green-400' : presenceScore >= 40 ? 'text-amber-400' : 'text-red-400'}">
								{presenceScore}
							</span>
						</div>
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
							<div
								class="h-full rounded-full transition-all duration-500"
								style="width: {presenceScore}%; background: {presenceScore >= 70 ? '#22c55e' : presenceScore >= 40 ? '#f59e0b' : '#ef4444'};"
							></div>
						</div>
						<p class="mt-1.5 text-[10px] text-base-text-muted leading-relaxed">
							{#if presenceScore >= 70}
								Consistent rhythm. You're staying with each letter, not projecting ahead.
							{:else if presenceScore >= 40}
								Some fluctuation. Notice where your mind speeds up or freezes — those are beliefs surfacing.
							{:else}
								Erratic timing reveals a mind in reaction, not observation. The spikes are where you're caught.
							{/if}
						</p>
					</div>
				{/if}

				<!-- Hesitation Heatmap -->
				<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
					<span class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-base-text-muted">Hesitation Map</span>
					<div class="flex flex-wrap gap-0.5">
						{#each hotspots as spot}
							{@const intensity = Math.min(spot.ratio / 2, 1)}
							{@const hasErrors = errorBreakpoints[spot.idx] > 0}
							<div
								class="relative flex h-8 w-8 flex-col items-center justify-center rounded"
								style="background: {spot.isHot
									? `rgba(245, 158, 11, ${0.15 + intensity * 0.5})`
									: hasErrors
										? `rgba(239, 68, 68, ${0.1 + (errorBreakpoints[spot.idx] / Math.max(...errorBreakpoints, 1)) * 0.3})`
										: 'rgba(255,255,255,0.03)'};"
								title="{spot.letter}: avg {formatMs(spot.avg)}{hasErrors ? `, ${errorBreakpoints[spot.idx]} error(s)` : ''}"
							>
								<span class="text-[10px] font-bold {spot.isHot ? 'text-amber-400' : hasErrors ? 'text-red-400' : 'text-base-text'}">
									{spot.letter}
								</span>
								<span class="text-[7px] {spot.isHot ? 'text-amber-500' : 'text-base-text-muted'}">
									{formatMs(spot.avg)}
								</span>
								{#if hasErrors}
									<span class="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[6px] font-bold text-white">
										{errorBreakpoints[spot.idx]}
									</span>
								{/if}
							</div>
						{/each}
					</div>
					<p class="mt-2 text-[10px] text-base-text-muted leading-relaxed">
						Warm letters are where you hesitate. Red badges mark where errors happen — the letter your mind was projecting past.
					</p>
				</div>

				<!-- Trend -->
				{#if trend}
					<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
						<span class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-base-text-muted">Trend</span>
						<div class="flex gap-4">
							<div>
								<span class="text-[10px] text-base-text-muted">Speed</span>
								<div class="text-sm font-bold {trend.speedChange > 0 ? 'text-green-400' : trend.speedChange < -5 ? 'text-red-400' : 'text-base-text'}">
									{trend.speedChange > 0 ? '+' : ''}{Math.round(trend.speedChange)}%
								</div>
							</div>
							<div>
								<span class="text-[10px] text-base-text-muted">Accuracy</span>
								<div class="text-sm font-bold {trend.accuracyChange > 0 ? 'text-green-400' : trend.accuracyChange < -5 ? 'text-red-400' : 'text-base-text'}">
									{trend.accuracyChange > 0 ? '+' : ''}{Math.round(trend.accuracyChange)}%
								</div>
							</div>
							<div>
								<span class="text-[10px] text-base-text-muted">Direction</span>
								<div class="text-sm font-bold {trend.improving ? 'text-green-400' : 'text-amber-400'}">
									{trend.improving ? 'Deepening' : 'Resisting'}
								</div>
							</div>
						</div>
						<p class="mt-1.5 text-[10px] text-base-text-muted leading-relaxed">
							{#if trend.improving}
								Your later attempts are faster and more accurate. The pattern is being seen, not just repeated.
							{:else}
								Later attempts show struggle. This word may carry something — notice what arises when you see it.
							{/if}
						</p>
					</div>
				{/if}

				<!-- Stats row -->
				<div class="flex flex-wrap gap-3 rounded-lg border border-base-border bg-surface-hover/50 p-2">
					<div class="text-center">
						<div class="text-sm font-bold text-accent">{flows.length}</div>
						<div class="text-[9px] text-base-text-muted">attempts</div>
					</div>
					<div class="text-center">
						<div class="text-sm font-bold {successRate >= 70 ? 'text-green-400' : successRate >= 40 ? 'text-amber-400' : 'text-red-400'}">{successRate}%</div>
						<div class="text-[9px] text-base-text-muted">accuracy</div>
					</div>
					{#if consistency}
						<div class="text-center">
							<div class="text-sm font-bold text-cyan-400">{formatMs(consistency.mean)}</div>
							<div class="text-[9px] text-base-text-muted">avg/letter</div>
						</div>
						<div class="text-center">
							<div class="text-sm font-bold text-purple-400">&plusmn;{formatMs(consistency.stdDev)}</div>
							<div class="text-[9px] text-base-text-muted">variance</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
