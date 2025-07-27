<script lang="ts">
	import type { SavedWord } from '$lib/structure';

	let {
		saved = $bindable(),
		onsave
	}: { saved: SavedWord; onsave: (w: SavedWord) => Promise<void> } = $props();

	let showBack = $state(false);
	let showMore = $state(false);
	let showFullJournal = $state(false);
	let currentDescription = $derived(saved.jounal.description ?? '');
	let currentTags = $state(saved.jounal.tag.join(','));

	// Calculate journal display properties
	let journalLines = $derived(currentDescription.split('\n').length);
	let journalLength = $derived(currentDescription.length);
	let hasLongJournal = $derived(journalLength > 150 || journalLines > 3);

	function toggleCard() {
		showBack = !showBack;
		// Reset the editable content when opening edit mode
		if (showBack) {
			currentDescription = saved.jounal.description ?? '';
			currentTags = saved.jounal.tag?.join(', ') ?? '';
		}
	}

	function toggleMore() {
		showMore = !showMore;
	}

	function toggleJournal() {
		showFullJournal = !showFullJournal;
	}

	async function saveJournal() {
		// Ensure we save plain text, not HTML
		// const plainTextDescription = currentDescription;
		currentDescription = currentDescription.trim();
		if (currentDescription == '<br>') {
			currentDescription = '';
		}

		saved.jounal.description = currentDescription;
		saved.jounal.tag = currentTags
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);

		await onsave(JSON.parse(JSON.stringify(saved)));
		toggleCard();
	}

	// Get truncated journal text for preview
	function getTruncatedJournal(text: string, maxLength: number = 150): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength).trim() + '...';
	}

	// Handle wheel events for scrollable containers
	function handleWheel(event: WheelEvent) {
		const target = event.currentTarget as HTMLElement;
		const { scrollTop, scrollHeight, clientHeight } = target;

		// Check if we can scroll in the direction of the wheel
		const canScrollUp = scrollTop > 0;
		const canScrollDown = scrollTop < scrollHeight - clientHeight;

		if ((event.deltaY < 0 && canScrollUp) || (event.deltaY > 0 && canScrollDown)) {
			event.stopPropagation();
		}
	}
</script>

<div
	class="relative overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 p-3 shadow-sm transition hover:border-amber-500"
	style="min-height: fit-content;"
>
	<!-- Flip Container -->
	<div
		class="relative w-full transition-transform duration-500"
		style="transform: rotateY({showBack ? 180 : 0}deg); transform-style: preserve-3d;"
	>
		<!-- Front -->
		<div
			class:hidden={showBack}
			class="w-full backface-hidden"
			class:opacity-0={showBack}
			style="transform: rotateY(0deg);"
		>
			<!-- Word Header -->
			<div class="mb-1 flex items-start justify-between">
				<h3 class="text-base font-semibold text-amber-100">{saved.word.word}</h3>
				<div class="flex items-center gap-2">
					{#if saved.stats.starred}
						<span class="text-sm text-yellow-400">★</span>
					{/if}
					<button onclick={toggleCard} class="text-xs text-blue-400 hover:underline">✎</button>
				</div>
			</div>

			<!-- Main Meaning -->
			<p class="mb-2 text-sm text-neutral-400">
				{saved.word.meanings?.[0]?.[1] || 'No definition available'}
			</p>

			<!-- Journal Section -->
			{#if currentDescription}
				<div class="mt-3 border-t border-neutral-700 pt-3">
					<div class="mb-2 flex items-center justify-between">
						<h4 class="text-xs font-semibold tracking-wide text-amber-200 uppercase">Journal</h4>
						{#if hasLongJournal}
							<button onclick={toggleJournal} class="text-xs text-blue-400 hover:underline">
								{showFullJournal ? 'Show Less' : 'Show More'}
							</button>
						{/if}
					</div>

					<div class="journal-content text-xs leading-relaxed text-amber-100">
						{#if showFullJournal || !hasLongJournal}
							<div
								class="custom-scrollbar scroll-container max-h-32 overflow-y-auto pr-1"
								onwheel={handleWheel}
							>
								{@html saved.jounal.description ?? ''}
							</div>
						{:else}
							<p class="text-amber-100/90">
								{@html getTruncatedJournal(saved.jounal.description ?? '')}
							</p>
						{/if}
					</div>

					<!-- Tags -->
					{#if saved.jounal.tag && saved.jounal.tag.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each saved.jounal.tag as tag}
								<span
									class="rounded-full border border-amber-600/30 bg-amber-600/20 px-2 py-0.5 text-xs text-amber-300"
								>
									#{tag}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Show More / Less Button for Word Details -->
			<button class="mt-3 text-xs font-semibold text-blue-400 hover:underline" onclick={toggleMore}>
				{showMore ? 'Hide Details' : 'Show Details'}
			</button>

			<!-- Expanded Full Word Details -->
			{#if showMore}
				<div
					class="custom-scrollbar scroll-container mt-3 max-h-48 space-y-3 overflow-y-auto text-xs text-neutral-400"
					onwheel={handleWheel}
				>
					{#each saved.word.meanings as meaning (meaning[0] + meaning[1])}
						<div class="border-b border-neutral-700 pb-2 last:border-0">
							<span
								class="inline-block rounded-md border border-neutral-600 px-2 py-0.5 text-xs font-bold text-amber-200"
								>{meaning[0]}</span
							>
							<p class="mt-1">{meaning[1]}</p>

							{#if meaning[3]?.length > 0}
								<div class="mt-1 space-y-1 text-amber-400 italic">
									{#each meaning[3] as example}
										<p>"{example}"</p>
									{/each}
								</div>
							{/if}

							{#if meaning[2]?.length > 0}
								<div class="mt-2 flex flex-wrap gap-1">
									{#each meaning[2] as syn}
										<span class="rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white"
											>{syn}</span
										>
									{/each}
								</div>
							{/if}
						</div>
					{/each}

					<!-- Antonyms -->
					{#if saved.word.antonyms.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							<span class="font-bold text-amber-200">Antonyms:</span>
							{#each saved.word.antonyms as ant}
								<span class="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
									>{ant}</span
								>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Stats -->
			<div
				class="mt-3 flex justify-between border-t border-neutral-700 pt-2 text-[11px] text-neutral-500"
			>
				<span>Seen: {saved.stats.seen}</span>
				<span>✓ {saved.stats.correctlyTyped} / ✗ {saved.stats.wronglyTyped}</span>
			</div>
		</div>

		<!-- Back (Journal Edit) -->
		<div
			class="w-full backface-hidden"
			class:opacity-0={!showBack}
			style="transform: rotateY(180deg); {showBack
				? 'position: relative;'
				: 'position: absolute; top: 0; left: 0; right: 0;'}"
		>
			<div class="flex flex-col gap-3 rounded-lg border border-amber-500 bg-neutral-900 p-4">
				<h4 class="text-sm font-semibold text-amber-200">Edit Journal Entry</h4>

				<div
					contenteditable
					class="custom-scrollbar scroll-container max-h-[250px] min-h-[100px] overflow-y-auto rounded border border-neutral-700 bg-neutral-800 p-3 text-sm text-amber-100 outline-none focus:border-amber-500"
					placeholder="Write your thoughts about this word..."
					onwheel={handleWheel}
					bind:innerHTML={currentDescription}
				></div>

				<input
					type="text"
					bind:value={currentTags}
					placeholder="Tags (comma separated)"
					class="w-full rounded border border-neutral-700 bg-neutral-800 p-2 text-xs text-amber-100 outline-none focus:border-amber-500"
				/>

				<div class="flex justify-between text-xs">
					<button
						class="rounded px-3 py-1.5 text-red-400 transition-colors hover:bg-red-400/10 hover:underline"
						onclick={toggleCard}
					>
						Cancel
					</button>
					<button
						class="rounded px-3 py-1.5 text-green-400 transition-colors hover:bg-green-400/10 hover:underline"
						onclick={saveJournal}
					>
						Save Journal
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.backface-hidden {
		backface-visibility: hidden;
		transform-style: preserve-3d;
	}

	.journal-content {
		font-family: 'Georgia', serif;
		line-height: 1.5;
	}

	.scroll-container {
		/* Ensure the container can receive focus for keyboard navigation */
		outline: none;
	}

	.scroll-container:focus {
		/* Optional: add focus indicator */
		box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.3);
	}

	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #d97706 #374151;
		/* Ensure smooth scrolling */
		scroll-behavior: smooth;
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}

	.custom-scrollbar::-webkit-scrollbar-track {
		background: #374151;
		border-radius: 3px;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #d97706;
		border-radius: 3px;
		min-height: 20px;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #f59e0b;
	}

	[contenteditable]:empty:before {
		content: attr(placeholder);
		color: #6b7280;
		font-style: italic;
	}

	[contenteditable]:focus {
		outline: none;
	}

	/* Ensure proper line height for contenteditable */
	[contenteditable] {
		white-space: pre-wrap;
		word-wrap: break-word;
	}
</style>
