<script lang="ts">
	let {
		timeline
	}: {
		timeline: { word: string; correct: boolean; duration: number; ts: number }[];
	} = $props();

	let showTimeline = $state(false);

	// Compute focus zones — sliding window of 5 words
	let zones = $derived.by(() => {
		if (timeline.length < 2) return [];
		const windowSize = 5;
		const result: { startIdx: number; endIdx: number; accuracy: number; avgDuration: number }[] = [];
		for (let i = 0; i <= timeline.length - windowSize; i++) {
			const window = timeline.slice(i, i + windowSize);
			const correct = window.filter(w => w.correct).length;
			const avgDur = window.reduce((s, w) => s + w.duration, 0) / windowSize;
			result.push({
				startIdx: i,
				endIdx: i + windowSize - 1,
				accuracy: correct / windowSize,
				avgDuration: avgDur,
			});
		}
		return result;
	});

	// Current streak type
	let currentZone = $derived.by(() => {
		if (timeline.length < 3) return null;
		const last5 = timeline.slice(-5);
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

	// Chart dimensions
	const width = 300;
	const height = 40;
</script>

{#if timeline.length > 0}
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
		{#if timeline.length >= 3}
			<button
				onclick={() => (showTimeline = !showTimeline)}
				class="flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-surface-hover"
				title="Focus timeline"
			>
				{#each timeline.slice(-20) as entry}
					<div
						class="h-2 w-1 rounded-sm"
						style="background: {entry.correct ? '#22c55e' : '#ef4444'}; opacity: 0.7;"
					></div>
				{/each}
			</button>
		{/if}
	</div>

	<!-- Expanded timeline -->
	{#if showTimeline && timeline.length >= 5}
		<div class="fixed top-10 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-base-border bg-surface p-4 shadow-xl">
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-bold text-accent">Session Focus Map</span>
				<button onclick={() => (showTimeline = false)} class="text-base-text-muted hover:text-accent">
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Zone accuracy chart -->
			{#if zones.length > 0}
				<svg viewBox="0 0 {width} {height}" class="w-80">
					{#each zones as zone, i}
						{@const x = (i / (zones.length - 1 || 1)) * width}
						{@const barH = zone.accuracy * height}
						<rect
							x={x - 2}
							y={height - barH}
							width="4"
							rx="1"
							height={barH}
							fill={zone.accuracy >= 0.8 ? '#22c55e' : zone.accuracy >= 0.5 ? '#f59e0b' : '#ef4444'}
							opacity="0.7"
						/>
					{/each}
				</svg>
			{/if}

			<!-- Word-by-word list (last 30) -->
			<div class="mt-2 flex max-w-[320px] flex-wrap gap-1">
				{#each timeline.slice(-30) as entry}
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
			<div class="mt-2 flex gap-3 text-[10px] text-base-text-muted">
				<span>{timeline.length} words</span>
				<span class="text-green-400">{timeline.filter(t => t.correct).length} correct</span>
				<span class="text-red-400">{timeline.filter(t => !t.correct).length} errors</span>
			</div>
		</div>
	{/if}
{/if}
