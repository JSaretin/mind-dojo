<script lang="ts">
	let { duration, maxDuration: maxDur, stealth = false }: { duration: number; maxDuration: number; stealth?: boolean } = $props();

	let pct = $derived(maxDur > 0 ? (duration / maxDur) * 100 : 100);

	let barColor = $derived(
		stealth ? '#525252' : pct <= 20 ? '#ef4444' : pct <= 50 ? '#f59e0b' : '#22c55e'
	);
	let glowStyle = $derived(
		stealth ? '' : `box-shadow: 0 0 4px ${pct <= 20 ? 'rgba(239,68,68,0.5)' : pct <= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.15)'};`
	);

	function formatDuration(sec: number): string {
		const seconds = Math.floor(sec);
		const ms = Math.floor((sec % 1) * 100);
		return `${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
	}
</script>

<div class="flex items-center gap-1.5">
	<div class="h-1.5 w-20 overflow-hidden rounded-full bg-surface-hover">
		<div
			class="h-full rounded-full transition-all duration-100 ease-linear"
			style="width: {pct}%; background: {barColor}; {glowStyle}"
		></div>
	</div>
	{#if !stealth}
		<span class="font-mono text-[10px] text-base-text-muted">{formatDuration(duration)}</span>
	{/if}
</div>
