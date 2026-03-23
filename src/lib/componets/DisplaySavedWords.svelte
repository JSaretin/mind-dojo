<script lang="ts">
	import type { MindDojo } from '$lib/mind-dojo.svelte';
	import type { SavedWord } from '$lib/structure';
	import { isInstantFail } from '$lib/structure';
	import ChartTypeToggle from './ChartTypeToggle.svelte';
	import DailySpeedChart from './DailySpeedChart.svelte';
	import SessionInsightsChart from './SessionInsightsChart.svelte';
	import TypingFlowChart from './TypingFlowChart.svelte';

	let {
		mindDojo,
		showWordBank = $bindable(true),
		words
	}: { mindDojo: MindDojo; showWordBank: boolean; words: SavedWord[] } = $props();

	let searchQuery = $state('');
	let activeFilter: 'all' | 'dictionary' | 'practice' | 'starred' | 'problem' | 'mastered' = $state('all');
	let sortMode: 'as-typed' | 'alpha-asc' | 'alpha-desc' | 'error-rate' = $state('as-typed');
	let selectedWord: SavedWord | null = $state(null);
	let collapsedRightWords: Set<string> = $state(new Set());
	let rightTab: 'overview' | 'words' | 'insights' = $state('overview');
	let showCenter = $state(true);
	let showRight = $state(true);

	// Progressive loading
	const PAGE_SIZE = 50;
	let leftVisible = $state(PAGE_SIZE);
	let rightVisible = $state(PAGE_SIZE);

	function errorRate(w: SavedWord): number {
		const total = w.stats.correctlyTyped + w.stats.wronglyTyped;
		return total > 0 ? w.stats.wronglyTyped / total : 0;
	}

	/** Error rate excluding instant-fail flows (timeout before typing) */
	function realErrorRate(w: SavedWord): number {
		const flows = w.typingFlows || [];
		const instantFails = flows.filter(f => !f.correct && isInstantFail(f)).length;
		const totalAttempts = w.stats.correctlyTyped + w.stats.wronglyTyped;
		const realErrors = Math.max(w.stats.wronglyTyped - instantFails, 0);
		const realTotal = totalAttempts - instantFails;
		return realTotal > 0 ? realErrors / realTotal : 0;
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
			case 'problem':
				result = result.filter((w) => {
					const attempts = w.stats.correctlyTyped + w.stats.wronglyTyped;
					return attempts >= 3 && realErrorRate(w) > 0.5;
				});
				break;
			case 'mastered':
				result = result.filter((w) => {
					const attempts = w.stats.correctlyTyped + w.stats.wronglyTyped;
					return attempts >= 3 && realErrorRate(w) === 0;
				});
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
	$effect(() => { filteredWords = getFilteredWords(); leftVisible = PAGE_SIZE; });

	// Recent words — all words by lastSeen (words already arrive sorted by lastSeen from DB)
	let recentWords = $derived(words);

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

	let exportStatus = $state('');
	let showExportDialog = $state(false);
	let exportOptions = $state({
		words: true,
		typingFlows: true,
		journals: true,
		stats: true,
		settings: true,
		dojoProgress: true,
		journalEntries: true,
		onlyStarred: false,
		onlyFiltered: false,
		dateFilter: 'all' as 'all' | 'today' | 'custom',
		customDate: new Date().toISOString().slice(0, 10),
	});

	async function exportData() {
		try {
			const fullData = await mindDojo.database.exportData();
			const data: Record<string, unknown> = {
				exportedAt: fullData.exportedAt,
				version: fullData.version,
			};

			if (exportOptions.settings) data.settings = fullData.settings;
			if (exportOptions.dojoProgress) data.dojoProgress = fullData.dojoProgress;
			if (exportOptions.journalEntries) data.journal = fullData.journal;

			if (exportOptions.words) {
				let wordsToExport = fullData.words;

				if (exportOptions.onlyFiltered) {
					const filteredSet = new Set(filteredWords.map(w => w.word.word));
					wordsToExport = wordsToExport.filter(w => filteredSet.has(w.word.word));
				}
				if (exportOptions.onlyStarred) {
					wordsToExport = wordsToExport.filter(w => w.stats.starred);
				}

				// Date filter: filter typing flows to only include matching day
				let dateStart = 0;
				let dateEnd = Infinity;
				if (exportOptions.dateFilter !== 'all') {
					const targetDate = exportOptions.dateFilter === 'today'
						? new Date().toISOString().slice(0, 10)
						: exportOptions.customDate;
					dateStart = new Date(targetDate + 'T00:00:00').getTime();
					dateEnd = dateStart + 86400000; // +24h
				}

				data.words = wordsToExport.map(w => {
					const word: Record<string, unknown> = { word: w.word, createdAt: w.createdAt };
					if (exportOptions.stats) word.stats = w.stats;
					if (exportOptions.typingFlows) {
						if (exportOptions.dateFilter !== 'all') {
							word.typingFlows = (w.typingFlows || []).filter(
								f => f.timestamp >= dateStart && f.timestamp < dateEnd
							);
						} else {
							word.typingFlows = w.typingFlows;
						}
					}
					if (exportOptions.journals) word.jounal = w.jounal;
					return word;
				}).filter(w => {
					// If date-filtering, exclude words with no flows on that day
					if (exportOptions.dateFilter !== 'all' && exportOptions.typingFlows) {
						return (w.typingFlows as unknown[])?.length > 0;
					}
					return true;
				});
			}

			const json = JSON.stringify(data, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `mind-dojo-export-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			showExportDialog = false;
			exportStatus = 'Exported';
			setTimeout(() => exportStatus = '', 2000);
		} catch (e) {
			exportStatus = 'Export failed';
			setTimeout(() => exportStatus = '', 3000);
		}
	}

	async function importData() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				const result = await mindDojo.database.importData(data);
				exportStatus = `Imported ${result.imported} words${result.skipped ? `, ${result.skipped} skipped` : ''}`;
				// Reload words
				words = await mindDojo.database.getAllWords();
				setTimeout(() => exportStatus = '', 3000);
			} catch {
				exportStatus = 'Import failed — invalid file';
				setTimeout(() => exportStatus = '', 3000);
			}
		};
		input.click();
	}

	// IntersectionObserver action for infinite scroll sentinels
	function loadMore(node: HTMLElement, onIntersect: () => void) {
		const observer = new IntersectionObserver(
			(entries) => { if (entries[0].isIntersecting) onIntersect(); },
			{ rootMargin: '200px' }
		);
		observer.observe(node);
		return {
			destroy() { observer.disconnect(); }
		};
	}
</script>

<div class="fixed inset-0 z-50 grid grid-rows-[1fr_auto] bg-base">
	<div class="flex min-h-0 overflow-hidden">
	<!-- LEFT: word list -->
	<div class="flex w-80 flex-shrink-0 flex-col border-r border-base-border">
		<div class="space-y-2 border-b border-base-border bg-surface px-3 py-3">
			<div class="flex items-center justify-between">
				<h2 class="text-base font-bold text-accent">Word Bank</h2>
				<div class="flex items-center gap-1.5">
					<span class="text-xs text-base-text-muted">{filteredWords.length}</span>
					<button
						onclick={() => { showCenter = !showCenter; }}
						class="rounded p-1 text-[10px] transition-colors {showCenter ? 'text-accent' : 'text-base-text-muted hover:text-accent'}"
						title="Toggle word detail"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
					</button>
					<button
						onclick={() => { showRight = !showRight; }}
						class="rounded p-1 text-[10px] transition-colors {showRight ? 'text-accent' : 'text-base-text-muted hover:text-accent'}"
						title="Toggle charts"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
					</button>
					<button
						onclick={() => (showWordBank = false)}
						class="rounded-lg p-1 text-base-text-muted transition-colors hover:bg-surface-hover hover:text-accent"
						aria-label="Close word bank"
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
				placeholder="Search..."
				class="w-full rounded border border-base-border bg-surface-hover px-2.5 py-1.5 text-sm text-base-text placeholder:text-base-text-muted focus:border-accent focus:outline-none"
			/>

			<div class="flex flex-wrap gap-1">
				{#each [
					{ key: 'all', label: 'All', active: 'bg-accent-muted/80 text-accent ring-1 ring-accent/30', inactive: 'bg-surface-hover/50 text-base-text-muted hover:bg-surface-hover' },
					{ key: 'dictionary', label: 'Words', active: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30', inactive: 'bg-surface-hover/50 text-base-text-muted hover:bg-blue-500/10 hover:text-blue-400' },
					{ key: 'practice', label: 'Drills', active: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30', inactive: 'bg-surface-hover/50 text-base-text-muted hover:bg-purple-500/10 hover:text-purple-400' },
					{ key: 'starred', label: '★ Starred', active: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30', inactive: 'bg-surface-hover/50 text-base-text-muted hover:bg-yellow-500/10 hover:text-yellow-400' },
					{ key: 'problem', label: 'Problem', active: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30', inactive: 'bg-surface-hover/50 text-base-text-muted hover:bg-red-500/10 hover:text-red-400' },
					{ key: 'mastered', label: 'Mastered', active: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30', inactive: 'bg-surface-hover/50 text-base-text-muted hover:bg-green-500/10 hover:text-green-400' },
				] as btn}
					<button
						onclick={() => (activeFilter = btn.key as typeof activeFilter)}
						class="rounded-full px-2.5 py-1 text-xs font-medium transition-all {activeFilter === btn.key
							? btn.active
							: btn.inactive}"
					>
						{btn.label}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-0.5">
				<span class="mr-1 text-xs text-base-text-muted">Sort:</span>
				{#each [
					{ key: 'as-typed', label: 'Recent' },
					{ key: 'error-rate', label: 'Errors' },
					{ key: 'alpha-asc', label: 'A-Z' },
					{ key: 'alpha-desc', label: 'Z-A' },
				] as btn}
					<button
						onclick={() => (sortMode = btn.key as typeof sortMode)}
						class="px-1.5 py-0.5 text-xs transition-colors {sortMode === btn.key
							? 'text-accent border-b border-accent'
							: 'text-base-text-muted hover:text-base-text'}"
					>
						{btn.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if filteredWords.length === 0}
				<div class="flex items-center justify-center py-12">
					<p class="text-sm text-base-text-muted">{words.length === 0 ? 'No words yet' : 'No matches'}</p>
				</div>
			{:else}
				{#each filteredWords.slice(0, leftVisible) as word (word.word.word)}
					{@const rate = errorRate(word)}
					{@const attempts = word.stats.correctlyTyped + word.stats.wronglyTyped}
					{@const accuracy = attempts > 0 ? (word.stats.correctlyTyped / attempts) * 100 : 0}
					{@const isSelected = selectedWord?.word.word === word.word.word}
					{@const dotColor = attempts < 2 ? '' : rate === 0 ? 'bg-green-400' : rate > 0.5 ? 'bg-red-400' : 'bg-amber-400'}
					<button
						onclick={() => selectWord(word)}
						title="{word.word.word} — {accuracy.toFixed(0)}% accuracy, {attempts} attempts, {word.stats.seen} seen{word.word.meanings?.[0]?.[1] ? '\n' + word.word.meanings[0][1].slice(0, 80) : ''}"
						class="flex w-full items-center gap-1.5 border-b border-base-border/50 pl-1 pr-3 py-2 text-left transition-colors {isSelected ? 'bg-accent-muted' : 'hover:bg-surface-hover/50'}"
					>
						<!-- Status dot -->
						<div class="flex-shrink-0 w-1 self-stretch rounded-full {dotColor}"></div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-1.5">
								<span class="truncate text-sm font-bold text-base-text">{word.word.word}</span>
								{#if word.stats.starred}
									<span class="flex-shrink-0 text-[10px] text-yellow-400">★</span>
								{/if}
							</div>
							<div class="text-xs text-base-text-muted truncate">{word.word.meanings?.[0]?.[1]?.slice(0, 30) || ''}</div>
						</div>
						<div class="flex flex-shrink-0 items-center gap-1.5 text-xs">
							<!-- Mini accuracy bar -->
							<div class="w-12 h-1.5 rounded-full bg-red-500/30 overflow-hidden" title="{accuracy.toFixed(0)}% accuracy">
								<div class="h-full rounded-full {accuracy === 100 ? 'bg-green-400' : accuracy >= 50 ? 'bg-amber-400' : 'bg-red-400'}" style="width: {accuracy}%"></div>
							</div>
							<span class="font-mono text-base-text-muted w-5 text-right">{attempts}</span>
						</div>
					</button>
				{/each}
				{#if leftVisible < filteredWords.length}
					<div use:loadMore={() => { leftVisible += PAGE_SIZE; }} class="py-2 text-center text-[10px] text-base-text-muted">Loading more...</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- CENTER: word detail -->
	{#if showCenter}
	<div class="flex {showRight ? 'max-w-[850px]' : ''} flex-1 flex-col border-r border-base-border overflow-y-auto">
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
								<h3 class="mb-1.5 text-xs font-bold uppercase tracking-wide text-green-500">Synonyms</h3>
								<div class="flex flex-wrap gap-1">
									{#each sw.word.synonyms as syn}
										<span class="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-400">{syn}</span>
									{/each}
								</div>
							</div>
						{/if}
						{#if sw.word.antonyms?.length > 0}
							<div class="flex-1">
								<h3 class="mb-1.5 text-xs font-bold uppercase tracking-wide text-red-500">Antonyms</h3>
								<div class="flex flex-wrap gap-1">
									{#each sw.word.antonyms as ant}
										<span class="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{ant}</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<div class="flex items-center gap-4 rounded-lg bg-surface/50 px-4 py-3">
					<span class="text-sm text-base-text-muted">Stats</span>
					<span class="font-mono text-sm font-bold {rate >= 0.4 ? 'text-red-400' : rate >= 0.2 ? 'text-accent' : 'text-green-400'}">{(rate * 100).toFixed(0)}% err</span>
					<span class="font-mono text-sm text-green-400">{sw.stats.correctlyTyped} <span class="text-xs text-base-text-muted">correct</span></span>
					<span class="font-mono text-sm text-red-400">{sw.stats.wronglyTyped} <span class="text-xs text-base-text-muted">wrong</span></span>
					<span class="font-mono text-sm text-base-text-muted">{sw.stats.seen} <span class="text-xs text-base-text-muted">seen</span></span>
				</div>

				{#if sw.typingFlows?.length > 0}
					<div class="rounded-lg border border-base-border bg-surface/30 p-3">
						<TypingFlowChart flows={sw.typingFlows} word={sw.word.word} />
					</div>
				{/if}

				<div>
					<h3 class="mb-2 text-sm font-bold uppercase tracking-wide text-base-text-muted">Note</h3>
					{#if sw.jounal?.description}
						<p class="text-sm leading-relaxed text-base-text">{sw.jounal.description}</p>
						{#if sw.jounal.tag?.length > 0}
							<div class="mt-2 flex flex-wrap gap-1">
								{#each sw.jounal.tag as tag}
									<span class="text-xs text-accent">#{tag}</span>
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
	{/if}

	<!-- RIGHT: tabbed sidebar -->
	{#if showRight}
	<div class="flex min-w-0 flex-1 flex-col bg-surface overflow-hidden">
		<!-- Tabs + chart type toggle -->
		<div class="flex items-center border-b border-base-border">
			<div class="flex flex-1">
				{#each [
					{ key: 'overview', label: 'Daily' },
					{ key: 'words', label: 'Words' },
					{ key: 'insights', label: 'Insights' },
				] as tab}
					<button
						onclick={() => { rightTab = tab.key as typeof rightTab; }}
						class="flex-1 px-2 py-2.5 text-sm font-medium transition-colors {rightTab === tab.key
							? 'border-b-2 border-accent text-accent'
							: 'text-base-text-muted hover:text-base-text'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
			<div class="px-2">
				<ChartTypeToggle />
			</div>
		</div>

		<div class="flex-1 overflow-y-auto">
			<!-- OVERVIEW TAB -->
			{#if rightTab === 'overview'}
				{#if words.length > 0}
					<div class="px-3 py-3">
						<DailySpeedChart {words} />
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<p class="text-sm text-base-text-muted">No typing data yet</p>
					</div>
				{/if}

			<!-- WORD FLOW TAB -->
			{:else if rightTab === 'words'}
				<div class="border-b border-base-border px-3 py-2">
					<div class="flex items-center justify-between">
						<h3 class="text-xs font-bold uppercase tracking-wide text-base-text-muted">Recent Words</h3>
						<span class="text-xs text-base-text-muted">{recentWords.length} words</span>
					</div>
				</div>

				{#each recentWords.slice(0, rightVisible) as word, idx (word.word.word)}
					{@const isExpanded = !collapsedRightWords.has(word.word.word)}
					<div class="border-b border-base-border {idx % 2 === 0 ? 'bg-base' : 'bg-surface'}">
						<button
							onclick={() => toggleRightCollapse(word.word.word)}
							class="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-surface-hover/50"
						>
							<div class="min-w-0">
								<span class="text-sm font-bold text-accent">{word.word.word}</span>
								<span class="ml-1.5 text-xs text-base-text-muted">{timeAgo(word.stats.lastSeen)}</span>
							</div>
							<div class="flex items-center gap-2 text-xs">
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
				{#if rightVisible < recentWords.length}
					<div use:loadMore={() => { rightVisible += PAGE_SIZE; }} class="py-2 text-center text-[10px] text-base-text-muted">Loading more...</div>
				{/if}

			<!-- DAY INSIGHTS TAB -->
			{:else if rightTab === 'insights'}
				<div class="px-3 py-3">
					{#if words.length > 0}
						<SessionInsightsChart {words} />
					{:else}
						<p class="py-8 text-center text-xs text-base-text-muted">No typing data yet</p>
					{/if}
				</div>
			{/if}
		</div>

		<div class="border-t border-base-border px-3 py-2">
			<div class="flex items-center justify-between text-xs text-base-text-muted">
				<span>{words.length} total</span>
				<span>{words.filter(w => w.stats.starred).length} starred</span>
				<span class="text-green-400">{words.reduce((s, w) => s + w.stats.correctlyTyped, 0)} correct</span>
			</div>
		</div>
	</div>
	{/if}

	</div><!-- close inner flex row -->

	<!-- Footer with export/import -->
	<div class="flex items-center justify-between border-t border-base-border bg-surface px-4 py-2">
		<div class="flex items-center gap-2">
			<button
				onclick={() => showExportDialog = true}
				class="rounded border border-base-border px-3 py-1.5 text-xs text-base-text-muted transition-colors hover:border-accent hover:text-accent"
			>
				Export
			</button>
			<button
				onclick={importData}
				class="rounded border border-base-border px-3 py-1.5 text-xs text-base-text-muted transition-colors hover:border-accent hover:text-accent"
			>
				Import
			</button>
			{#if exportStatus}
				<span class="text-xs text-green-400">{exportStatus}</span>
			{/if}
		</div>
		<div class="text-xs text-base-text-muted">
			{words.length} words &middot; {words.reduce((s, w) => s + (w.typingFlows?.length || 0), 0)} typing flows
		</div>
	</div>

	<!-- Export dialog -->
	{#if showExportDialog}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onclick={(e) => { if (e.target === e.currentTarget) showExportDialog = false; }}
		>
			<div class="w-full max-w-sm rounded-xl border border-base-border bg-surface p-5 shadow-2xl">
				<h3 class="mb-4 text-sm font-bold text-accent">Export Data</h3>

				<div class="space-y-2">
					<span class="text-[10px] font-bold uppercase tracking-wider text-base-text-muted">Include</span>

					{#each [
						{ key: 'words', label: 'Words & meanings' },
						{ key: 'stats', label: 'Typing stats (correct, errors, seen)' },
						{ key: 'typingFlows', label: 'Typing flows (per-letter timing data)' },
						{ key: 'journals', label: 'Word notes & tags' },
						{ key: 'journalEntries', label: 'Journal entries' },
						{ key: 'settings', label: 'Settings' },
						{ key: 'dojoProgress', label: 'Progress (XP, belt, level)' },
					] as opt}
						<label class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
							<input
								type="checkbox"
								checked={exportOptions[opt.key as keyof typeof exportOptions] as boolean}
								onchange={(e) => { (exportOptions as any)[opt.key] = (e.target as HTMLInputElement).checked; }}
								class="accent-accent"
							/>
							<span class="text-xs text-base-text">{opt.label}</span>
						</label>
					{/each}
				</div>

				<div class="mt-4 space-y-2">
					<span class="text-[10px] font-bold uppercase tracking-wider text-base-text-muted">Filter</span>

					<label class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
						<input type="checkbox" bind:checked={exportOptions.onlyStarred} class="accent-accent" />
						<span class="text-xs text-base-text">Starred words only</span>
					</label>
					<label class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
						<input type="checkbox" bind:checked={exportOptions.onlyFiltered} class="accent-accent" />
						<span class="text-xs text-base-text">Current filter/search only <span class="text-base-text-muted">({filteredWords.length} words)</span></span>
					</label>
				</div>

				<div class="mt-4 space-y-2">
					<span class="text-[10px] font-bold uppercase tracking-wider text-base-text-muted">Date Range</span>
					<div class="flex gap-1">
						{#each [
							{ key: 'all', label: 'All time' },
							{ key: 'today', label: 'Today' },
							{ key: 'custom', label: 'Pick day' },
						] as opt}
							<button
								onclick={() => exportOptions.dateFilter = opt.key as typeof exportOptions.dateFilter}
								class="flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all {exportOptions.dateFilter === opt.key
									? 'border-accent bg-accent-muted text-accent'
									: 'border-base-border text-base-text-muted hover:border-accent/50'}"
							>
								{opt.label}
							</button>
						{/each}
					</div>
					{#if exportOptions.dateFilter === 'custom'}
						<input
							type="date"
							bind:value={exportOptions.customDate}
							class="w-full rounded-md border border-base-border bg-surface-hover px-3 py-1.5 text-xs text-base-text focus:border-accent focus:outline-none"
						/>
					{/if}
					{#if exportOptions.dateFilter !== 'all'}
						<p class="text-[10px] text-base-text-muted">
							Only typing flows from {exportOptions.dateFilter === 'today' ? 'today' : exportOptions.customDate} will be exported. Words with no activity on that day are excluded.
						</p>
					{/if}
				</div>

				<div class="mt-5 flex items-center justify-between">
					<button
						onclick={() => showExportDialog = false}
						class="rounded px-3 py-1.5 text-xs text-base-text-muted hover:text-base-text"
					>
						Cancel
					</button>
					<button
						onclick={exportData}
						class="rounded-md bg-accent px-4 py-1.5 text-xs font-bold text-black transition-colors hover:bg-accent/90"
					>
						Export JSON
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
