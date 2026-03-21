<script lang="ts">
	import type { MindDojo } from '$lib/mind-dojo.svelte';
	import type { SavedWord } from '$lib/structure';
	import DailySpeedChart from './DailySpeedChart.svelte';
	import TypingFlowChart from './TypingFlowChart.svelte';

	let {
		mindDojo,
		showWordBank = $bindable(true),
		words
	}: { mindDojo: MindDojo; showWordBank: boolean; words: SavedWord[] } = $props();

	let searchQuery = $state('');
	let activeFilter: 'all' | 'dictionary' | 'practice' | 'starred' = $state('all');
	let sortMode: 'as-typed' | 'alpha-asc' | 'alpha-desc' | 'error-rate' = $state('as-typed');
	let selectedWord: SavedWord | null = $state(null);
	let collapsedRightWords: Set<string> = $state(new Set());

	function errorRate(w: SavedWord): number {
		const total = w.stats.correctlyTyped + w.stats.wronglyTyped;
		return total > 0 ? w.stats.wronglyTyped / total : 0;
	}

	function getFilteredWords() {
		let result = words;

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

	// Recent words — last 30 by lastSeen (words already arrive sorted by lastSeen from DB)
	let recentWords = $derived(words.slice(0, 30));

	function selectWord(w: SavedWord) {
		selectedWord = selectedWord?.word.word === w.word.word ? null : w;
	}

	function timeAgo(ts: number): string {
		if (!ts) return '';
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		return `${days}d ago`;
	}

	function toggleRightCollapse(wordStr: string) {
		if (collapsedRightWords.has(wordStr)) {
			collapsedRightWords.delete(wordStr);
		} else {
			collapsedRightWords.add(wordStr);
		}
		collapsedRightWords = new Set(collapsedRightWords);
	}

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
	<!-- LEFT: word list -->
	<div class="flex w-80 flex-shrink-0 flex-col border-r border-base-border">
		<div class="space-y-2 border-b border-base-border bg-surface px-3 py-3">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold text-accent">Word Bank</h2>
				<div class="flex items-center gap-2">
					<span class="text-[10px] text-base-text-muted">{filteredWords.length} words</span>
					<span class="text-[10px] text-base-text-muted">Esc</span>
				</div>
			</div>

			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search..."
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
								? 'text-accent'
								: 'text-base-text-muted hover:text-base-text-muted'}"
						>
							{btn.label}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if filteredWords.length === 0}
				<div class="flex items-center justify-center py-12">
					<p class="text-sm text-base-text-muted">{words.length === 0 ? 'No words yet' : 'No matches'}</p>
				</div>
			{:else}
				{#each filteredWords as word (word.word.word)}
					{@const rate = errorRate(word)}
					{@const isSelected = selectedWord?.word.word === word.word.word}
					<button
						onclick={() => selectWord(word)}
						class="flex w-full items-center gap-2 border-b border-base-border/50 px-3 py-2 text-left transition-colors {isSelected ? 'bg-accent-muted' : 'hover:bg-surface-hover/50'}"
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-1.5">
								<span class="truncate text-sm font-bold text-base-text">{word.word.word}</span>
								{#if word.stats.starred}
									<span class="flex-shrink-0 text-[10px] text-yellow-400">★</span>
								{/if}
							</div>
							<div class="text-[10px] text-base-text-muted truncate">{word.word.meanings?.[0]?.[1]?.slice(0, 30) || ''}</div>
						</div>
						<div class="flex flex-shrink-0 items-center gap-2 text-[10px]">
							<span class="font-mono {rate >= 0.4 ? 'font-bold text-red-400' : 'text-base-text-muted'}">{(rate * 100).toFixed(0)}%</span>
							<span class="text-green-500">{word.stats.correctlyTyped}</span>
							<span class="text-red-500">{word.stats.wronglyTyped}</span>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>

	<!-- CENTER: word detail -->
	<div class="flex flex-1 flex-col border-r border-base-border overflow-y-auto">
		{#if selectedWord}
			{@const sw = selectedWord}
			{@const rate = errorRate(sw)}

			<div class="border-b border-base-border bg-surface/95 px-6 py-4">
				<div class="flex items-center justify-between">
					<h2 class="text-2xl font-black text-base-text">{sw.word.word}</h2>
					<button
						onclick={() => { sw.stats.starred = !sw.stats.starred; handleWordSave(sw); }}
						class="text-lg transition-colors {sw.stats.starred ? 'text-yellow-400' : 'text-base-text-muted hover:text-yellow-400'}"
					>
						{sw.stats.starred ? '★' : '☆'}
					</button>
				</div>
			</div>

			<div class="space-y-5 p-6">
				{#if sw.word.meanings?.length > 0}
					<div>
						{#each sw.word.meanings as meaning, i}
							<div class="{i > 0 ? 'mt-3 border-t border-base-border pt-3' : ''}">
								<span class="rounded bg-accent-muted px-2 py-0.5 text-xs font-bold text-accent">{meaning[0]}</span>
								<p class="mt-1.5 text-base leading-relaxed text-base-text">{meaning[1]}</p>
								{#if meaning[3]?.length > 0}
									<div class="mt-1.5 space-y-0.5">
										{#each meaning[3] as example}
											<p class="text-sm italic text-base-text-muted">"{example}"</p>
										{/each}
									</div>
								{/if}
								{#if meaning[2]?.length > 0}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each meaning[2] as syn}
											<span class="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-400">{syn}</span>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if (sw.word.synonyms?.length || 0) > 0 || (sw.word.antonyms?.length || 0) > 0}
					<div class="flex gap-6">
						{#if sw.word.synonyms?.length > 0}
							<div class="flex-1">
								<h3 class="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-green-500">Synonyms</h3>
								<div class="flex flex-wrap gap-1">
									{#each sw.word.synonyms as syn}
										<span class="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-400">{syn}</span>
									{/each}
								</div>
							</div>
						{/if}
						{#if sw.word.antonyms?.length > 0}
							<div class="flex-1">
								<h3 class="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-red-500">Antonyms</h3>
								<div class="flex flex-wrap gap-1">
									{#each sw.word.antonyms as ant}
										<span class="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{ant}</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<div class="flex items-center gap-4 rounded-lg bg-surface/50 px-4 py-2.5">
					<span class="text-xs text-base-text-muted">Stats</span>
					<span class="font-mono text-sm font-bold {rate >= 0.4 ? 'text-red-400' : rate >= 0.2 ? 'text-accent' : 'text-green-400'}">{(rate * 100).toFixed(0)}% err</span>
					<span class="font-mono text-sm text-green-400">{sw.stats.correctlyTyped} <span class="text-[10px] text-base-text-muted">correct</span></span>
					<span class="font-mono text-sm text-red-400">{sw.stats.wronglyTyped} <span class="text-[10px] text-base-text-muted">wrong</span></span>
					<span class="font-mono text-sm text-base-text-muted">{sw.stats.seen} <span class="text-[10px] text-base-text-muted">seen</span></span>
				</div>

				{#if sw.typingFlows?.length > 0}
					<div class="rounded-lg border border-base-border bg-surface/30 p-3">
						<TypingFlowChart flows={sw.typingFlows} word={sw.word.word} />
					</div>
				{/if}

				<div>
					<h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-base-text-muted">Note</h3>
					{#if sw.jounal?.description}
						<p class="text-sm leading-relaxed text-base-text">{sw.jounal.description}</p>
						{#if sw.jounal.tag?.length > 0}
							<div class="mt-2 flex flex-wrap gap-1">
								{#each sw.jounal.tag as tag}
									<span class="text-[10px] text-accent">#{tag}</span>
								{/each}
							</div>
						{/if}
					{:else}
						<p class="text-xs text-base-text-muted">No notes yet</p>
					{/if}
				</div>
			</div>
		{:else}
			<div class="flex h-full flex-col items-center justify-center text-center">
				<p class="text-sm text-base-text-muted">Select a word to see details</p>
				<p class="mt-1 text-xs text-base-text-muted">Meanings, typing flow, and notes</p>
			</div>
		{/if}
	</div>

	<!-- RIGHT: recent words + chart -->
	<div class="flex w-96 flex-shrink-0 flex-col bg-surface">
		<div class="flex-1 overflow-y-auto">
			<!-- Daily speed chart -->
			{#if words.length > 0}
				<div class="border-b border-base-border px-3 py-3">
					<DailySpeedChart {words} />
				</div>
			{/if}

			<div class="border-b border-base-border px-3 py-2">
				<div class="flex items-center justify-between">
					<h3 class="text-[10px] font-bold uppercase tracking-wide text-base-text-muted">Recent Words</h3>
					<span class="text-[9px] text-base-text-muted">{recentWords.length} words</span>
				</div>
			</div>

			{#each recentWords as word, idx (word.word.word)}
				{@const isExpanded = !collapsedRightWords.has(word.word.word)}
				<div class="border-b border-base-border {idx % 2 === 0 ? 'bg-base' : 'bg-surface'}">
					<button
						onclick={() => toggleRightCollapse(word.word.word)}
						class="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-surface-hover/50"
					>
						<div class="min-w-0">
							<span class="text-sm font-bold text-accent">{word.word.word}</span>
							<span class="ml-1.5 text-[9px] text-base-text-muted">{timeAgo(word.stats.lastSeen)}</span>
						</div>
						<div class="flex items-center gap-2 text-[10px]">
							<span class="text-green-500">{word.stats.correctlyTyped}</span>
							<span class="text-base-text-muted">/</span>
							<span class="text-red-500">{word.stats.wronglyTyped}</span>
							<span class="text-base-text-muted">{isExpanded ? '▾' : '▸'}</span>
						</div>
					</button>

					{#if isExpanded && word.typingFlows?.length > 0}
						<div class="px-3 pb-2">
							<TypingFlowChart flows={word.typingFlows} word={word.word.word} defaultView="latest" />
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="border-t border-base-border px-3 py-2">
			<div class="flex items-center justify-between text-[10px] text-base-text-muted">
				<span>{words.length} total</span>
				<span>{words.filter(w => w.stats.starred).length} starred</span>
				<span class="text-green-400">{words.reduce((s, w) => s + w.stats.correctlyTyped, 0)} correct</span>
			</div>
		</div>
	</div>
</div>
