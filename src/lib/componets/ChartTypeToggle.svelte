<script lang="ts">
	import { chartPrefs, type ChartType } from '$lib/chartPrefs.svelte';

	const types: { key: ChartType; label: string; icon: string }[] = [
		{ key: 'line', label: 'Line', icon: '⌇' },
		{ key: 'bar', label: 'Bar', icon: '▥' },
		{ key: 'scatter', label: 'Scatter', icon: '⁙' },
	];
</script>

<div class="flex gap-0.5">
	{#each types as t}
		<button
			onclick={() => { chartPrefs.type = t.key; }}
			class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {chartPrefs.type === t.key
				? 'bg-accent-muted text-accent'
				: 'text-base-text-muted hover:text-base-text'}"
			title="{t.label} chart"
		>
			{t.icon}
		</button>
	{/each}
</div>
