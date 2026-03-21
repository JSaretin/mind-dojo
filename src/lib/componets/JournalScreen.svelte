<script lang="ts">
	import type { Journal, JournalEntry } from '$lib/journal.svelte';
	import type { SavedWordDB } from '$lib/database.svelte';
	import type { SavedWord } from '$lib/structure';
	import type { WikiLinkItem } from '$lib/wikilink';
	import TiptapEditor from './TiptapEditor.svelte';

	let {
		journal,
		show = $bindable(false),
		database,
	}: {
		journal: Journal;
		show: boolean;
		database: SavedWordDB;
	} = $props();

	async function getLinkItems(query: string): Promise<WikiLinkItem[]> {
		const q = query.toLowerCase();
		const items: WikiLinkItem[] = [];

		// Journal entries
		for (const entry of journal.entries) {
			const preview = stripHtml(entry.text).slice(0, 50);
			if (!q || preview.toLowerCase().includes(q)) {
				items.push({ id: entry.id, label: preview || 'Untitled', type: 'entry' });
			}
			if (items.length >= 12) return items;
		}

		// Words from IndexedDB — dictionary words only (no random letter combos)
		const dbWords = q
			? await database.searchWords(q, 12 - items.length, true)
			: await database.getRecentWords(12 - items.length, true);
		for (const word of dbWords) {
			items.push({ id: word, label: word, type: 'word' });
		}

		return items;
	}

	function onLinkSelect(_item: WikiLinkItem) {
		// Link is embedded by the wikilink command — no navigation needed
	}

	let searchQuery = $state('');
	let activeEntryId: string | null = $state(null);
	let editorText = $state('');
	let editorTags = $state('');
	let isNewEntry = $state(false);
	let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
	}

	function autoSave() {
		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		autoSaveTimer = setTimeout(() => {
			saveEntry();
		}, 800);
	}

	let dayGroups = $derived(searchQuery ? [] : journal.getEntriesByDay());
	let searchResults = $derived(searchQuery ? journal.search(searchQuery) : []);

	let activeEntry = $derived(activeEntryId ? journal.entries.find(e => e.id === activeEntryId) || null : null);

	function selectEntry(entry: JournalEntry) {
		activeEntryId = entry.id;
		editorText = entry.text;
		editorTags = entry.tags.join(', ');
		isNewEntry = false;
	}

	function startNewEntry() {
		isNewEntry = true;
		activeEntryId = null;
		editorText = '';
		editorTags = '';
	}

	function saveEntry() {
		if (!editorText.trim()) return;
		const tags = editorTags.split(',').map(t => t.trim()).filter(Boolean);

		if (isNewEntry) {
			const entry = journal.createEntry('free', editorText, [], undefined);
			entry.tags = tags;
			journal.updateEntry(entry.id, editorText, tags);
			activeEntryId = entry.id;
			isNewEntry = false;
		} else if (activeEntryId) {
			journal.updateEntry(activeEntryId, editorText, tags);
		}
	}

	function deleteActive() {
		if (!activeEntryId) return;
		journal.deleteEntry(activeEntryId);
		activeEntryId = null;
		editorText = '';
		editorTags = '';
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	// Link hover popup
	let hoveredWord: SavedWord | null = $state(null);
	let hoveredEntry: JournalEntry | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0 });
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;

	function clearHover() {
		if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
		hoveredWord = null;
		hoveredEntry = null;
	}

	function onEditorMouseOver(e: MouseEvent) {
		const wordTarget = (e.target as HTMLElement).closest('.wiki-link--word') as HTMLElement | null;
		const entryTarget = (e.target as HTMLElement).closest('.wiki-link--entry') as HTMLElement | null;
		const target = wordTarget || entryTarget;

		if (!target) { clearHover(); return; }

		const linkId = target.dataset.linkId;
		if (!linkId) return;

		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(async () => {
			const rect = target.getBoundingClientRect();
			hoverPos = { x: rect.left, y: rect.bottom + 4 };

			if (wordTarget) {
				if (hoveredWord?.word.word === linkId) return;
				hoveredEntry = null;
				const sw = await database.getWord(linkId);
				if (sw) hoveredWord = sw;
			} else {
				if (hoveredEntry?.id === linkId) return;
				hoveredWord = null;
				const entry = journal.entries.find(e => e.id === linkId);
				if (entry) hoveredEntry = entry;
			}
		}, 200);
	}

	function onEditorMouseOut(e: MouseEvent) {
		const related = e.relatedTarget as HTMLElement | null;
		if (related?.closest('.wiki-link--word') || related?.closest('.wiki-link--entry') || related?.closest('.link-hover-popup')) return;
		clearHover();
	}

	function onEditorClick(e: MouseEvent) {
		const entryLink = (e.target as HTMLElement).closest('.wiki-link--entry') as HTMLElement | null;
		if (!entryLink) return;
		const entryId = entryLink.dataset.linkId;
		if (!entryId) return;
		const entry = journal.entries.find(en => en.id === entryId);
		if (entry) {
			selectEntry(entry);
			clearHover();
		}
	}

	function formatMs(ms: number): string {
		return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
	}

	// Context menu state
	let contextMenu: { x: number; y: number; entryId: string } | null = $state(null);

	function onEntryContextMenu(e: MouseEvent, entryId: string) {
		e.preventDefault();
		contextMenu = { x: e.clientX, y: e.clientY, entryId };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function contextMenuDelete() {
		if (!contextMenu) return;
		const id = contextMenu.entryId;
		if (activeEntryId === id) {
			activeEntryId = null;
			editorText = '';
			editorTags = '';
		}
		journal.deleteEntry(id);
		contextMenu = null;
	}

	// Delete empty entry on close
	$effect(() => {
		if (!show) {
			if (activeEntryId && !stripHtml(editorText).trim()) {
				journal.deleteEntry(activeEntryId);
				activeEntryId = null;
				editorText = '';
				editorTags = '';
			}
		}
	});

	// Close context menu on Escape or click outside
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && contextMenu) {
			contextMenu = null;
		}
	}

	function onWindowClick() {
		if (contextMenu) contextMenu = null;
	}
</script>

<svelte:window onkeydown={onWindowKeydown} onclick={onWindowClick} />

{#if show}
	<div class="fixed inset-0 z-50 flex bg-base">
		<!-- Left: Entry list -->
		<div class="flex w-80 flex-shrink-0 flex-col border-r border-base-border bg-surface">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-base-border px-4 py-3">
				<h2 class="text-base font-bold text-accent">Journal</h2>
				<span class="text-[10px] text-base-text-muted">Esc to close</span>
			</div>

			<!-- New entry + search -->
			<div class="space-y-2 border-b border-base-border px-3 py-3">
				<button
					onclick={startNewEntry}
					class="w-full rounded-md bg-accent-muted px-3 py-2 text-sm font-bold text-accent transition-colors hover:bg-accent-muted"
				>
					+ New Entry
				</button>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search entries..."
					class="w-full rounded border border-base-border bg-surface-hover px-3 py-1.5 text-sm text-base-text placeholder:text-base-text-muted focus:border-accent focus:outline-none"
				/>
			</div>

			<!-- Entry list -->
			<div class="flex-1 overflow-y-auto">
				{#if searchQuery}
					<div class="px-3 py-2 text-[10px] text-base-text-muted">{searchResults.length} results</div>
					{#each searchResults as entry}
						<button
							onclick={() => selectEntry(entry)}
							oncontextmenu={(e) => onEntryContextMenu(e, entry.id)}
							class="w-full border-b border-base-border/50 px-3 py-2.5 text-left transition-colors {activeEntryId === entry.id ? 'bg-accent-muted' : 'hover:bg-surface-hover'}"
						>
							<div class="flex items-center gap-2">
								<span class="h-1.5 w-1.5 rounded-full {entry.type === 'session' ? 'bg-cyan-400' : 'bg-amber-400'}"></span>
								<span class="text-[10px] text-base-text-muted">{formatTime(entry.timestamp)}</span>
							</div>
							<p class="mt-0.5 line-clamp-2 text-xs text-base-text">{stripHtml(entry.text).slice(0, 100)}</p>
						</button>
					{/each}
				{:else}
					{#each dayGroups as day}
						<div class="sticky top-0 z-10 border-b border-base-border bg-surface/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-base-text-muted backdrop-blur-sm">
							{day.label}
						</div>
						{#each day.entries as entry}
							<button
								onclick={() => selectEntry(entry)}
								oncontextmenu={(e) => onEntryContextMenu(e, entry.id)}
								class="w-full border-b border-base-border/50 px-3 py-2.5 text-left transition-colors {activeEntryId === entry.id ? 'bg-accent-muted' : 'hover:bg-surface-hover'}"
							>
								<div class="flex items-center gap-2">
									<span class="h-1.5 w-1.5 rounded-full {entry.type === 'session' ? 'bg-cyan-400' : 'bg-amber-400'}"></span>
									<span class="text-[10px] text-base-text-muted">{formatTime(entry.timestamp)}</span>
									{#if entry.type === 'session'}
										<span class="text-[9px] text-cyan-500">session</span>
									{/if}
									</div>
								<p class="mt-0.5 line-clamp-2 text-xs text-base-text">{stripHtml(entry.text).slice(0, 100)}</p>
								{#if entry.tags.length > 0}
									<div class="mt-1 flex gap-1">
										{#each entry.tags.slice(0, 3) as tag}
											<span class="text-[9px] text-accent">#{tag}</span>
										{/each}
									</div>
								{/if}
							</button>
						{/each}
					{/each}

					{#if dayGroups.length === 0}
						<div class="flex flex-col items-center justify-center py-12 text-center">
							<p class="text-sm text-base-text-muted">No entries yet</p>
							<p class="mt-1 text-xs text-base-text-muted">Click "+ New Entry" or train to generate session reflections</p>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Stats footer -->
			<div class="border-t border-base-border px-3 py-2 text-[10px] text-base-text-muted">
				{journal.entries.length} entries &middot;
				{journal.entries.filter(e => e.type === 'session').length} sessions &middot;
				{journal.entries.filter(e => e.type === 'free').length} free
			</div>
		</div>

		<!-- Right: Editor -->
		<div class="flex flex-1 flex-col">
			{#if isNewEntry || activeEntry}
				<!-- Editor header -->
				<div class="flex items-center justify-between border-b border-base-border bg-surface/50 px-6 py-3">
					<div class="flex items-center gap-3">
						{#if activeEntry}
							<span class="h-2 w-2 rounded-full {activeEntry.type === 'session' ? 'bg-cyan-400' : 'bg-amber-400'}"></span>
							<span class="text-xs text-base-text-muted">
								{new Date(activeEntry.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
							</span>
						{:else}
							<span class="h-2 w-2 rounded-full bg-amber-400"></span>
							<span class="text-xs text-base-text-muted">New entry</span>
						{/if}
					</div>
					<span class="text-[10px] text-base-text-muted">auto-saved</span>
				</div>

				<!-- Session stats (if session entry) -->
				{#if activeEntry?.sessionStats}
					<div class="flex gap-4 border-b border-base-border bg-surface/30 px-6 py-2 text-xs">
						<span class="text-green-400">{activeEntry.sessionStats.correct} correct</span>
						<span class="text-red-400">{activeEntry.sessionStats.errors} errors</span>
						<span class="text-accent">{activeEntry.sessionStats.accuracy}% acc</span>
						<span class="text-cyan-400">{activeEntry.sessionStats.bestCombo} best combo</span>
					</div>
				{/if}

				<!-- Editor -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="flex flex-1 flex-col overflow-hidden" onmouseover={onEditorMouseOver} onmouseout={onEditorMouseOut} onclick={onEditorClick}>
					<TiptapEditor
						content={editorText}
						placeholder="Write your thoughts... Type [[ to link entries or words"
						onUpdate={(html) => { editorText = html; autoSave(); }}
						{getLinkItems}
						{onLinkSelect}
					/>
				</div>

				<!-- Tags -->
				<div class="border-t border-base-border px-6 py-2">
					<input
						type="text"
						bind:value={editorTags}
						placeholder="Tags (comma separated)"
						class="w-full bg-transparent text-xs text-base-text-muted placeholder:text-base-text-muted focus:outline-none"
					/>
				</div>
			{:else}
				<!-- Empty state -->
				<div class="flex flex-1 flex-col items-center justify-center text-center">
					<p class="mb-2 text-lg font-bold text-base-text-muted">Select an entry or create a new one</p>
					<p class="text-sm text-base-text-muted">Your reflections shape your practice</p>
					<button
						onclick={startNewEntry}
						class="mt-4 rounded-lg bg-accent-muted px-6 py-2 text-sm font-bold text-accent transition-colors hover:bg-accent-muted"
					>
						+ New Entry
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Word hover popup -->
	{#if hoveredWord}
		{@const sw = hoveredWord}
		{@const total = sw.stats.correctlyTyped + sw.stats.wronglyTyped}
		{@const errRate = total > 0 ? sw.stats.wronglyTyped / total : 0}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="link-hover-popup fixed z-[200] w-80 rounded-lg border border-base-border bg-surface p-4 shadow-2xl"
			style="left: {hoverPos.x}px; top: {hoverPos.y}px;"
			onmouseleave={() => { hoveredWord = null; }}
		>
			<!-- Header -->
			<div class="mb-2 flex items-center justify-between">
				<h3 class="text-lg font-bold text-base-text">{sw.word.word}</h3>
				<div class="flex items-center gap-2 text-[10px]">
					<span class="text-green-400">{sw.stats.correctlyTyped} correct</span>
					<span class="text-red-400">{sw.stats.wronglyTyped} wrong</span>
					<span class="font-bold {errRate >= 0.4 ? 'text-red-400' : 'text-base-text-muted'}">{(errRate * 100).toFixed(0)}%</span>
				</div>
			</div>

			<!-- Meanings -->
			{#if sw.word.meanings?.length > 0}
				<div class="mb-2 space-y-1.5">
					{#each sw.word.meanings.slice(0, 3) as meaning}
						<div>
							<span class="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-bold text-accent">{meaning[0]}</span>
							<p class="mt-0.5 text-xs leading-relaxed text-base-text">{meaning[1]}</p>
							{#if meaning[2]?.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each meaning[2].slice(0, 5) as syn}
										<span class="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">{syn}</span>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Synonyms & Antonyms -->
			{#if sw.word.synonyms?.length > 0}
				<div class="mb-1.5 flex flex-wrap gap-1">
					<span class="text-[9px] font-bold uppercase text-green-500">Syn:</span>
					{#each sw.word.synonyms.slice(0, 6) as syn}
						<span class="text-[10px] text-green-400">{syn}</span>
					{/each}
				</div>
			{/if}
			{#if sw.word.antonyms?.length > 0}
				<div class="mb-1.5 flex flex-wrap gap-1">
					<span class="text-[9px] font-bold uppercase text-red-500">Ant:</span>
					{#each sw.word.antonyms.slice(0, 6) as ant}
						<span class="text-[10px] text-red-400">{ant}</span>
					{/each}
				</div>
			{/if}

			<!-- Typing flow mini chart -->
			{#if sw.typingFlows?.length > 0}
				{@const lastFlow = sw.typingFlows[sw.typingFlows.length - 1]}
				<div class="mt-2 border-t border-base-border pt-2">
					<div class="flex items-center justify-between text-[10px] text-base-text-muted">
						<span>{sw.typingFlows.length} attempts</span>
						<span>Last: {formatMs(lastFlow.totalDuration || lastFlow.letterIntervals.reduce((a, b) => a + b, 0))}</span>
						<span class={lastFlow.correct ? 'text-green-400' : 'text-red-400'}>{lastFlow.correct ? 'correct' : 'error'}</span>
					</div>
					<!-- Mini sparkline -->
					<svg viewBox="0 0 200 24" class="mt-1 w-full">
						{#each sw.typingFlows.slice(-20) as flow, i}
							{@const x = (i / Math.max(Math.min(sw.typingFlows.length, 20) - 1, 1)) * 196 + 2}
							<circle cx={x} cy="12" r="3" fill={flow.correct ? '#22c55e' : '#ef4444'} opacity="0.7" />
						{/each}
					</svg>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Entry hover popup -->
	{#if hoveredEntry}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="link-hover-popup fixed z-[200] w-80 rounded-lg border border-base-border bg-surface p-4 shadow-2xl"
			style="left: {hoverPos.x}px; top: {hoverPos.y}px;"
			onmouseleave={() => { hoveredEntry = null; }}
		>
			<div class="mb-2 flex items-center gap-2">
				<span class="h-2 w-2 rounded-full {hoveredEntry.type === 'session' ? 'bg-cyan-400' : 'bg-amber-400'}"></span>
				<span class="text-[10px] text-base-text-muted">
					{new Date(hoveredEntry.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
				</span>
				{#if hoveredEntry.type === 'session'}
					<span class="text-[9px] text-cyan-500">session</span>
				{/if}
			</div>
			<p class="text-xs leading-relaxed text-base-text">{stripHtml(hoveredEntry.text).slice(0, 200)}{stripHtml(hoveredEntry.text).length > 200 ? '...' : ''}</p>
			{#if hoveredEntry.sessionStats}
				<div class="mt-2 flex gap-3 text-[10px]">
					<span class="text-green-400">{hoveredEntry.sessionStats.correct} correct</span>
					<span class="text-red-400">{hoveredEntry.sessionStats.errors} errors</span>
					<span class="text-accent">{hoveredEntry.sessionStats.accuracy}%</span>
				</div>
			{/if}
			{#if hoveredEntry.tags.length > 0}
				<div class="mt-1.5 flex gap-1">
					{#each hoveredEntry.tags.slice(0, 5) as tag}
						<span class="text-[9px] text-accent">#{tag}</span>
					{/each}
				</div>
			{/if}
			<p class="mt-2 text-[9px] text-base-text-muted">Click to open</p>
		</div>
	{/if}

	<!-- Context menu -->
	{#if contextMenu}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed z-[300] min-w-[120px] rounded-lg border border-base-border bg-surface py-1 shadow-2xl"
			style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
			onclick={(e) => e.stopPropagation()}
		>
			<button
				onclick={contextMenuDelete}
				class="w-full px-4 py-1.5 text-left text-sm text-red-400 transition-colors hover:bg-surface-hover"
			>
				Delete
			</button>
		</div>
	{/if}
{/if}
