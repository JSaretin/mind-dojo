<script lang="ts">
	import type { Word } from '$lib/structure';

	let { word }: { word: Word } = $props();
</script>

<div
	class="absolute bottom-0 left-1/2 flex w-full max-w-[400px] -translate-x-1/2 translate-y-[110%] place-items-center justify-center align-middle"
>
	<div
		class="mx-auto h-full w-full rounded-xl border border-accent/50 bg-surface-hover/70 p-4 shadow-lg backdrop-blur-sm"
	>
		<div class="flex flex-col gap-1 text-base-text-muted">
			{#each word.meanings as [partOfSpeech, definition, synonyms, examples]}
				<div class="border-b border-base-border py-2 last:border-0">
					<span
						class="w-fit rounded-md border border-accent/50 bg-accent-muted p-1 px-2 text-xs font-bold text-accent"
					>
						{partOfSpeech}
					</span>
					<p class="mt-1 text-base-text">{definition}</p>

					{#if examples.length}
						<div class="mt-2 flex flex-col flex-wrap">
							{#each examples as example}
								<p class="text-sm font-medium text-accent italic">"{example}"</p>
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
					<span class="font-bold text-accent">Antonyms:</span>
					{#each word.antonyms as ant}
						<span class="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white">{ant}</span
						>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
