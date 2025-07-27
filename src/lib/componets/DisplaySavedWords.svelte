<script lang="ts">
	import type { MindDojo } from '$lib/mind-dojo.svelte';
	import type { SavedWord } from '$lib/structure';
	import { onMount } from 'svelte';
	import DisplaySavedWord from './DisplaySavedWord.svelte';

	const { mindDojo, onclose }: { mindDojo: MindDojo; onclose: () => void } = $props();

	let words: SavedWord[] = $derived(mindDojo.savedWords);

	let searchQuery = $state('');
	let activeFilter: 'all' | 'starred' | 'journaled' = $state('all');
	let isLoading = $state(false);

	function getFilterredWords() {
		let result = words;

		// Apply filter first
		switch (activeFilter) {
			case 'starred':
				result = result.filter((word) => word.stats.starred);
				break;
			case 'journaled':
				result = result.filter(
					(word) => word.jounal?.description && word.jounal.description.trim().length > 0
				);
				break;
			case 'all':
			default:
				// No additional filtering needed
				break;
		}

		// Apply search if query exists
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			result = result.filter((word) => {
				// Search in word text
				if (word.word.word.toLowerCase().includes(query)) return true;

				// Search in meanings/definitions
				if (
					word.word.meanings?.some(
						(meaning) =>
							meaning[1]?.toLowerCase().includes(query) || // definition
							meaning[0]?.toLowerCase().includes(query) || // part of speech
							meaning[3]?.some((example) => example.toLowerCase().includes(query)) || // examples
							meaning[2]?.some((synonym) => synonym.toLowerCase().includes(query)) // synonyms
					)
				)
					return true;

				// Search in antonyms
				if (word.word.antonyms?.some((antonym) => antonym.toLowerCase().includes(query)))
					return true;

				// Search in journal description
				if (word.jounal?.description?.toLowerCase().includes(query)) return true;

				// Search in tags
				if (word.jounal?.tag?.some((tag) => tag.toLowerCase().includes(query))) return true;

				return false;
			});
		}

		// Sort by last seen (most recent first)
		return result.sort((a, b) => (b.stats.lastSeen || 0) - (a.stats.lastSeen || 0));
	}

	// Computed filtered and searched words

	// Filter button configurations
	const filterButtons = [
		{ key: 'all' as const, label: '📋 All', count: () => words.length },
		{
			key: 'starred' as const,
			label: '⭐ Starred',
			count: () => words.filter((w) => w.stats.starred).length
		},
		{
			key: 'journaled' as const,
			label: '📓 Journaled',
			count: () =>
				words.filter((w) => w.jounal?.description && w.jounal.description.trim().length > 0).length
		}
	];

	function setFilter(filter: typeof activeFilter) {
		activeFilter = filter;
	}

	function clearSearch() {
		searchQuery = '';
	}

	async function handleWordSave(updatedWord: SavedWord) {
		try {
			await mindDojo.database.saveWord(updatedWord);
			// Update the local words array
			const index = words.findIndex((w) => w.word.word === updatedWord.word.word);
			if (index !== -1) {
				words[index] = updatedWord;
			}
		} catch (error) {
			console.error('Failed to save word:', error);
		}
	}

	// Placeholder function for close - you'll implement the logic
	function handleClose() {
		onclose();
	}

	let filteredWords: SavedWord[] = $state([]);
	$effect(() => {
		filteredWords = getFilterredWords();
	});
</script>

<div
	class="fixed inset-y-0 right-0 z-50 w-full max-w-[360px] border-l border-neutral-700 bg-neutral-900 shadow-2xl"
>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="sticky top-0 z-10 border-b border-neutral-700 bg-neutral-800 px-4 py-3">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-bold text-amber-200">Saved Words</h2>
				<div class="flex items-center gap-2">
					<button
						onclick={loadWords}
						class="rounded p-1 text-amber-400 transition-colors hover:bg-amber-400/10"
						title="Refresh"
						aria-label="Refresh"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
					<button
						onclick={handleClose}
						class="rounded p-1 text-neutral-400 transition-colors hover:bg-red-400/10 hover:text-red-400"
						title="Close"
						aria-label="Close saved words panel"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Search + Filters -->
		<div class="space-y-3 border-b border-neutral-700 bg-neutral-800 px-4 py-3">
			<!-- Search Input -->
			<div class="relative">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search words, meanings, journal, tags..."
					class="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 pr-8 text-sm text-amber-100 placeholder:text-neutral-500 focus:ring-1 focus:ring-amber-400 focus:outline-none"
				/>
				{#if searchQuery}
					<button
						onclick={clearSearch}
						class="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-amber-400"
						title="Clear search"
						aria-label="Clear search"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				{/if}
			</div>

			<!-- Filter Buttons -->
			<div class="flex flex-wrap gap-2 text-xs font-medium">
				{#each filterButtons as button}
					<button
						onclick={() => setFilter(button.key)}
						class="flex items-center gap-1 rounded-md border px-2 py-1.5 transition-all duration-200"
						class:border-amber-500={activeFilter === button.key}
						class:bg-amber-500={activeFilter === button.key}
						class:text-black={activeFilter === button.key}
						class:border-neutral-700={activeFilter !== button.key}
						class:bg-neutral-700={activeFilter !== button.key}
						class:text-amber-200={activeFilter !== button.key}
						class:hover:bg-amber-500={activeFilter !== button.key}
						class:hover:text-black={activeFilter !== button.key}
						aria-label={button.label}
					>
						<span>{button.label}</span>
						<span class="rounded-full bg-black/20 px-1.5 py-0.5 text-xs font-bold">
							{button.count()}
						</span>
					</button>
				{/each}
			</div>

			<!-- Search Results Info -->
			{#if searchQuery || activeFilter !== 'all'}
				<div class="text-xs text-neutral-400">
					{#if searchQuery}
						Showing {filteredWords.length} result{filteredWords.length !== 1 ? 's' : ''} for "{searchQuery}"
					{:else}
						Showing {filteredWords.length}
						{activeFilter} word{filteredWords.length !== 1 ? 's' : ''}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Word List -->
		<div class="flex-1 overflow-y-auto bg-neutral-900">
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<div class="text-center">
						<div
							class="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-amber-400"
						></div>
						<p class="text-sm text-neutral-400">Loading words...</p>
					</div>
				</div>
			{:else if filteredWords.length === 0}
				<div class="flex items-center justify-center px-4 py-8">
					<div class="text-center">
						{#if words.length === 0}
							<div class="mb-2 text-4xl">📚</div>
							<p class="mb-1 text-sm text-neutral-400">No saved words yet</p>
							<p class="text-xs text-neutral-500">
								Words will appear here when you save them during gameplay
							</p>
						{:else if searchQuery}
							<div class="mb-2 text-4xl">🔍</div>
							<p class="mb-1 text-sm text-neutral-400">No results found</p>
							<p class="text-xs text-neutral-500">Try a different search term</p>
							<button
								onclick={clearSearch}
								class="mt-2 text-xs text-amber-400 hover:underline"
								aria-label="Clear search"
							>
								Clear search
							</button>
						{:else}
							<div class="mb-2 text-4xl">📋</div>
							<p class="mb-1 text-sm text-neutral-400">No {activeFilter} words</p>
							<p class="text-xs text-neutral-500">
								{#if activeFilter === 'starred'}
									Star some words to see them here
								{:else if activeFilter === 'journaled'}
									Add journal entries to words to see them here
								{/if}
							</p>
							<button
								onclick={() => setFilter('all')}
								class="mt-2 text-xs text-amber-400 hover:underline"
								aria-label="Show all words"
							>
								Show all words
							</button>
						{/if}
					</div>
				</div>
			{:else}
				<div class="space-y-4 px-4 py-4">
					{#each filteredWords as word, index (word.word.word)}
						<DisplaySavedWord bind:saved={filteredWords[index]} onsave={handleWordSave} />
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer Stats -->
		{#if !isLoading && words.length > 0}
			<div class="border-t border-neutral-700 bg-neutral-800 px-4 py-2">
				<div class="flex justify-between text-xs text-neutral-400">
					<span>Total: {words.length} words</span>
					<span>
						{words.filter((w) => w.stats.starred).length} starred,
						{words.filter((w) => w.jounal?.description?.trim()).length} journaled
					</span>
				</div>
			</div>
		{/if}
	</div>
</div>
