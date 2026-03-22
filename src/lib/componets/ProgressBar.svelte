<script lang="ts">
	import type { MindDojo } from '$lib/mind-dojo.svelte';
	import { getContext } from 'svelte';

	const getMindDojo: () => MindDojo = getContext('mindDojo');
	let mindDojo = $derived(getMindDojo());

	let isAuto = $derived(mindDojo.settings.autoSpeed);
	let progress = $derived(isAuto ? mindDojo.autoSpeedProgress : mindDojo.dojoState.progress);
	let speed = $derived(mindDojo.settings.speed || 0);
	let wpm = $derived(((speed || 0) * 12).toFixed(1));

	// Color based on zone in auto mode, or progress in manual
	let barColor = $derived(
		isAuto
			? (mindDojo.autoSpeedZone === 'challenge' ? '#ef4444'
				: mindDojo.autoSpeedZone === 'flow' ? '#22c55e'
				: '#3b82f6')
			: (progress >= 80 ? '#ef4444' : progress >= 50 ? '#f59e0b' : '#22c55e')
	);
	let glowColor = $derived(
		isAuto
			? (mindDojo.autoSpeedZone === 'challenge' ? 'rgba(239,68,68,0.4)'
				: mindDojo.autoSpeedZone === 'flow' ? 'rgba(34,197,94,0.3)'
				: 'rgba(59,130,246,0.3)')
			: (progress >= 80 ? 'rgba(239,68,68,0.4)' : progress >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.2)')
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
		<!-- Left: progress -->
		<div class="flex items-center gap-2">
			{#if isAuto}
				<span class="text-[10px] text-base-text-muted">Gate</span>
			{:else}
				<span class="text-[10px] text-base-text-muted">Level</span>
			{/if}
			<span class="font-mono text-xs font-bold" style="color: {barColor};">{progress}%</span>
		</div>

		<!-- Center: zone label (auto) or WPM (manual) -->
		<div class="flex items-center gap-1.5">
			{#if isAuto}
				<span class="rounded px-1.5 py-0.5 text-[10px] font-bold {
					mindDojo.autoSpeedZone === 'challenge' ? 'bg-red-500/20 text-red-400' :
					mindDojo.autoSpeedZone === 'flow' ? 'bg-green-500/20 text-green-400' :
					'bg-blue-500/20 text-blue-400'
				}">
					{mindDojo.autoSpeedZone === 'challenge' ? 'PUSH' : mindDojo.autoSpeedZone === 'flow' ? 'FLOW' : 'BASE'}
				</span>
			{:else}
				<span class="font-mono text-sm font-bold text-base-text">{wpm}</span>
				<span class="text-[10px] text-base-text-muted">WPM</span>
			{/if}
		</div>

		<!-- Right: auto label or speed multiplier -->
		<div class="flex items-center gap-1.5">
			{#if isAuto}
				<span class="text-[10px] text-base-text-muted">Auto</span>
			{:else}
				<span class="text-[10px] text-base-text-muted">Speed</span>
				<span class="font-mono text-xs text-base-text">{speed.toFixed(2)}x</span>
			{/if}
		</div>
	</div>
</div>
