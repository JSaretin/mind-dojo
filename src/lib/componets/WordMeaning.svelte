<script lang="ts">
	import type { Word } from '$lib/structure';

	let { word }: { word: Word } = $props();
</script>

<div
	class="absolute bottom-0 left-1/2 flex w-full max-w-[400px] -translate-x-1/2 translate-y-[110%] place-items-center justify-center align-middle"
>
	<div
		class="no-scrollbar mx-auto h-full max-h-[200px] w-full overflow-y-scroll rounded-xl border border-amber-700/50 bg-neutral-800/70 p-4 shadow-lg backdrop-blur-sm"
	>
		<div class="flex flex-col gap-1 text-neutral-400">
			{#each word.meanings as [partOfSpeech, definition, synonyms, examples]}
				<div class="border-b border-neutral-700 py-2 last:border-0">
					<span
						class="w-fit rounded-md border border-amber-600/50 bg-amber-600/20 p-1 px-2 text-xs font-bold text-amber-200"
					>
						{partOfSpeech}
					</span>
					<p class="mt-1 text-amber-100">{definition}</p>

					{#if examples.length}
						<div class="mt-2 flex flex-col flex-wrap">
							{#each examples as example}
								<p class="text-sm font-medium text-amber-300 italic">"{example}"</p>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Synonyms (per meaning) -->
				{#if synonyms.length}
					<div class="mt-2 flex flex-wrap gap-2">
						{#each synonyms as syn}
							<span class="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white"
								>{syn}</span
							>
						{/each}
					</div>
				{/if}
			{/each}

			<!-- Antonyms (global) -->
			{#if word.antonyms.length}
				<div class="mt-2 flex flex-wrap gap-2">
					<span class="font-bold text-amber-200">Antonyms:</span>
					{#each word.antonyms as ant}
						<span class="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white">{ant}</span
						>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
