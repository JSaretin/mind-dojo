<script lang="ts">
	let { duration, maxDuration: maxDur }: { duration: number; maxDuration: number } = $props();

	function formatDuration(sec: number): string {
		const seconds = Math.floor(sec);
		const milliseconds = Math.floor((sec % 1) * 100); // get two digits of ms
		return `${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
	}
</script>

<!-- <div
	class="font-montserrat rounded-md p-2 text-lg font-bold transition-colors duration-200 ease-linear"
	class:text-neutral-900={duration > maxDur * 0.6}
	class:text-yellow-500={duration <= maxDur * 0.6 && duration > maxDur * 0.3}
	class:text-red-500={duration <= maxDur * 0.3}
>
	<span
		class="transition-transform duration-100"
		style="transform: scale({duration <= maxDur * 0.3 ? 1.15 : 1});"
	>
		{formatDuration(duration)}
	</span>
</div> -->

<div
	class="font-montserrat rounded-md p-2 text-lg font-bold text-neutral-900 transition-colors duration-200 ease-linear"
>
	<span
		class="transition-transform duration-100"
		style="transform: scale({duration <= maxDur * 0.3 ? 1.15 : 1});"
	>
		{formatDuration(duration)}
	</span>
</div>
