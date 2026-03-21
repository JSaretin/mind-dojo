<script lang="ts">
	import type { MindDojo } from '$lib/mind-dojo.svelte';
	import { getContext } from 'svelte';

	const getMindDojo: () => MindDojo = getContext('mindDojo');
	let mindDojo = $derived(getMindDojo());

	let progress = $derived(mindDojo.dojoState.progress);
	let speed = $derived(mindDojo.settings.speed || 0);
	let wpm = $derived(((speed || 0) * 12).toFixed(1));

	// Color shifts as progress builds — green to amber to red
	let barColor = $derived(
		progress >= 80 ? '#ef4444' : progress >= 50 ? '#f59e0b' : '#22c55e'
	);
	let glowColor = $derived(
		progress >= 80 ? 'rgba(239,68,68,0.4)' : progress >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.2)'
	);
</script>

<div class="fixed bottom-0 left-0 z-20 w-full">
	<!-- Thin progress line -->
	<div class="relative h-1 w-full bg-surface-hover/50">
		<div
			class="h-full transition-all duration-200 ease-out"
			style="width: {progress}%; background: {barColor}; box-shadow: 0 0 8px {glowColor};"
		></div>
	</div>

	<!-- Stats row -->
	<div class="flex items-center justify-between bg-surface/80 px-4 py-1 backdrop-blur-sm">
		<!-- Progress -->
		<div class="flex items-center gap-2">
			<span class="text-[10px] text-base-text-muted">Level</span>
			<span class="font-mono text-xs font-bold" style="color: {barColor};">{progress}%</span>
		</div>

		<!-- WPM center -->
		<div class="flex items-center gap-1.5">
			<span class="font-mono text-sm font-bold text-base-text">{wpm}</span>
			<span class="text-[10px] text-base-text-muted">WPM</span>
		</div>

		<!-- Speed multiplier -->
		<div class="flex items-center gap-1.5">
			<span class="text-[10px] text-base-text-muted">Speed</span>
			<span class="font-mono text-xs text-base-text">{speed.toFixed(2)}x</span>
		</div>
	</div>
</div>
