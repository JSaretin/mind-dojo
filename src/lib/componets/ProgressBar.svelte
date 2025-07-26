<script lang="ts">
	import type { MindDojo } from '$lib/mind-dojo.svelte';
	import { getContext } from 'svelte';

	const mindDojo: MindDojo = getContext('mindDojo');

	let progress = $derived(mindDojo.dojoState.progress);
	let speed = $derived(mindDojo.settings.speed);

	let progressColor = $derived(
		progress >= 80 ? 'bg-red-500' : progress >= 50 ? 'bg-yellow-400' : 'bg-green-400'
	);

	let pulseClass = $derived(progress >= 80 ? 'animate-[pulse-speed_1s_infinite]' : '');
</script>

<div class="absolute bottom-0 left-0 w-full bg-neutral-900">
	<div class="relative h-6 w-full overflow-hidden rounded-sm">
		<!-- Progress Fill -->
		<div
			class={`h-full transition-all duration-200 ease-linear ${progressColor}`}
			style:width={`${progress}%`}
		></div>

		<!-- Speed Display -->
		<div
			class={`absolute inset-0 flex items-center justify-center text-sm font-bold text-amber-50 transition-transform duration-200 ${pulseClass}`}
		>
			{speed.toFixed(1)}
		</div>
	</div>
</div>

<style>
	@keyframes pulse-speed {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.15);
		}
	}
</style>
