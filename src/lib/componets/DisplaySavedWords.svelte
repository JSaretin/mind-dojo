<script lang="ts">
	import type { MindDojo } from '$lib/mind-dojo.svelte';
	import type { SavedWord } from '$lib/structure';
	import DisplaySavedWord from './DisplaySavedWord.svelte';
	import DailySpeedChart from './DailySpeedChart.svelte';

	let {
		mindDojo,
		showWordBank = $bindable(true),
		words
	}: { mindDojo: MindDojo; showWordBank: boolean; words: SavedWord[] } = $props();

	let searchQuery = $state('');
	let activeFilter: 'all' | 'dictionary' | 'practice' | 'starred' = $state('all');
	let sortMode: 'as-typed' | 'alpha-asc' | 'alpha-desc' | 'error-rate' = $state('as-typed');

	function errorRate(w: SavedWord): number {
		const total = w.stats.correctlyTyped + w.stats.wronglyTyped;
		return total > 0 ? w.stats.wronglyTyped / total : 0;
	}

	function getFilteredWords() {
		let result = [...words];

		switch (activeFilter) {
			case 'dictionary':
				result = result.filter((w) => w.word.meanings?.length > 0);
				break;
			case 'practice':
				result = result.filter((w) => !w.word.meanings?.length);
				break;
			case 'starred':
				result = result.filter((w) => w.stats.starred);
				break;
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter((w) => {
				if (w.word.word.toLowerCase().includes(q)) return true;
				if (w.word.meanings?.some((m) => m[1]?.toLowerCase().includes(q))) return true;
				if (w.jounal?.description?.toLowerCase().includes(q)) return true;
				if (w.jounal?.tag?.some((t) => t.toLowerCase().includes(q))) return true;
				return false;
			});
		}

		switch (sortMode) {
			case 'as-typed':
				result.sort((a, b) => (b.stats.lastSeen || 0) - (a.stats.lastSeen || 0));
				break;
			case 'alpha-asc':
				result.sort((a, b) => a.word.word.localeCompare(b.word.word));
				break;
			case 'alpha-desc':
				result.sort((a, b) => b.word.word.localeCompare(a.word.word));
				break;
			case 'error-rate':
				result.sort((a, b) => errorRate(b) - errorRate(a));
				break;
		}
		return result;
	}

	let filteredWords: SavedWord[] = $state([]);
	$effect(() => { filteredWords = getFilteredWords(); });

	async function handleWordSave(updatedWord: SavedWord) {
		try {
			await mindDojo.database.saveWord(updatedWord);
			const index = words.findIndex((w) => w.word.word === updatedWord.word.word);
			if (index !== -1) words[index] = updatedWord;
		} catch (error) {
			console.error('Failed to save word:', error);
		}
	}
</script>

<div class="fixed inset-0 z-50 flex bg-base">
	<!-- LEFT: word cards (full view) -->
	<div class="flex flex-1 flex-col">
		<!-- Header / controls -->
		<div class="space-y-2 border-b border-base-border bg-surface px-4 py-3">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold text-accent">Word Bank</h2>
				<div class="flex items-center gap-3">
					<span class="text-[10px] text-base-text-muted">{filteredWords.length} words</span>
					<button
						onclick={() => (showWordBank = false)}
						class="rounded-lg p-1 text-base-text-muted transition-colors hover:text-accent"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search words, meanings, tags..."
				class="w-full rounded border border-base-border bg-surface-hover px-2.5 py-1.5 text-sm text-base-text placeholder:text-base-text-muted focus:border-accent focus:outline-none"
			/>

			<div class="flex items-center justify-between">
				<div class="flex gap-1">
					{#each [
						{ key: 'all', label: 'All' },
						{ key: 'dictionary', label: 'Words' },
						{ key: 'practice', label: 'Drills' },
						{ key: 'starred', label: 'Starred' },
					] as btn}
						<button
							onclick={() => (activeFilter = btn.key as typeof activeFilter)}
							class="rounded px-2 py-0.5 text-[10px] font-medium {activeFilter === btn.key
								? 'bg-accent-muted text-accent'
								: 'text-base-text-muted hover:text-base-text'}"
						>
							{btn.label}
						</button>
					{/each}
				</div>
				<div class="flex gap-1">
					{#each [
						{ key: 'as-typed', label: 'Recent' },
						{ key: 'error-rate', label: 'Errors' },
						{ key: 'alpha-asc', label: 'A-Z' },
						{ key: 'alpha-desc', label: 'Z-A' },
					] as btn}
						<button
							onclick={() => (sortMode = btn.key as typeof sortMode)}
							class="rounded px-1.5 py-0.5 text-[10px] {sortMode === btn.key
								? 'text-accent font-bold'
								: 'text-base-text-muted hover:text-base-text'}"
						>
							{btn.label}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Word cards grid -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if filteredWords.length === 0}
				<div class="flex items-center justify-center py-12">
					<p class="text-sm text-base-text-muted">{words.length === 0 ? 'No words typed yet — start training' : 'No matches'}</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each filteredWords as word (word.word.word)}
						<DisplaySavedWord saved={word} onsave={handleWordSave} />
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer stats -->
		<div class="border-t border-base-border px-4 py-2">
			<div class="flex items-center justify-between text-[10px] text-base-text-muted">
				<span>{words.length} total words</span>
				<span>{words.filter(w => w.stats.starred).length} starred</span>
				<span class="text-green-400">{words.reduce((s, w) => s + w.stats.correctlyTyped, 0)} correct</span>
				<span class="text-red-400">{words.reduce((s, w) => s + w.stats.wronglyTyped, 0)} errors</span>
			</div>
		</div>
	</div>

	<!-- RIGHT: daily chart -->
	<div class="flex w-[420px] flex-shrink-0 flex-col border-l border-base-border bg-surface">
		<div class="flex-1 overflow-y-auto px-3 py-3">
			{#if words.length > 0}
				<DailySpeedChart {words} />
			{:else}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-base-text-muted">Type some words to see daily stats</p>
				</div>
			{/if}
		</div>
	</div>
</div>
