<script lang="ts">
	import { browser } from '$app/environment';
	import DisplaySavedWords from '$lib/componets/DisplaySavedWords.svelte';
	import ProgressBar from '$lib/componets/ProgressBar.svelte';
	import RenderWord from '$lib/componets/render_word/Word.svelte';
	import Setting from '$lib/componets/Setting.svelte';
	import Timer from '$lib/componets/Timer.svelte';
	import FocusTimeline from '$lib/componets/FocusTimeline.svelte';
	import JournalScreen from '$lib/componets/JournalScreen.svelte';
	import PhilosophyScreen from '$lib/componets/PhilosophyScreen.svelte';
	import { MindDojo } from '$lib/mind-dojo.svelte';
	import { Journal } from '$lib/journal.svelte';
	import { applyTheme, loadTheme } from '$lib/theme';
	import { loadWords } from '$lib/words';
	import type { SavedWord } from '$lib/structure';
	import { setContext } from 'svelte';

	// App states
	let appState: 'loading' | 'intro' | 'game' = $state('loading');
	let showSetting = $state(false);
	let showWordBank = $state(false);
	let showHowToPlay = $state(false);
	let showPhilosophy = $state(false);
	let showJournal = $state(false);
	let journal = new Journal();

	// Apply saved theme on load
	if (browser) applyTheme(loadTheme());
	let mindDojo: MindDojo | null = $state(null);
	let allowGame = $derived(mindDojo && !showSetting && !showWordBank && !showHowToPlay && !showPhilosophy && !showJournal && (appState as string) === 'game');

	// Set contexts synchronously (required by Svelte) — getter functions read from reactive state
	setContext('mindDojo', () => mindDojo);
	setContext('settings', () => mindDojo?.settings);

	// Load words async, then initialize MindDojo
	if (browser) {
		loadWords().then((dictWords) => {
			mindDojo = new MindDojo(dictWords);
			// Skip intro for returning users
			if (localStorage.getItem('hasPlayed')) {
				appState = 'game';
				mindDojo.startSessionTimer();
			} else {
				appState = 'intro';
			}
		});
	}

	function startGame() {
		appState = 'game';
		if (browser) localStorage.setItem('hasPlayed', 'true');
		mindDojo?.startSessionTimer();
	}

	// Flash effect
	let flashClass = $state('');
	let floatingText = $state<{ text: string; type: string } | null>(null);
	let lastEventId = 0;

	$effect(() => {
		if (!mindDojo) return;
		const evt = mindDojo.lastEvent;
		if (!evt || evt.id === lastEventId) return;
		lastEventId = evt.id;

		if (evt.type === 'error') {
			flashClass = 'flash-error';
			floatingText = null;
		} else if (evt.type === 'rank-up') {
			flashClass = 'flash-rankup';
			floatingText = { text: evt.text || '', type: 'rank-up' };
		} else {
			flashClass = 'flash-success';
			floatingText = { text: evt.text || '', type: 'success' };
		}

		setTimeout(() => { flashClass = ''; }, 300);
		setTimeout(() => { floatingText = null; }, 1200);
	});

	// Session timer
	let sessionSeconds = $state(0);
	if (browser) {
		setInterval(() => {
			if (mindDojo) sessionSeconds = Math.floor((Date.now() - mindDojo.sessionStartTime) / 1000);
		}, 1000);
	}

	function formatSessionTime(s: number) {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
	}

	const onkeydown = (e: KeyboardEvent) => {
		// Intro: any key starts
		if (appState === 'intro') { startGame(); return; }

		if (e.key === 'Escape') {
			if (showHowToPlay) { showHowToPlay = false; return; }
			if (showPhilosophy) { showPhilosophy = false; return; }
			if (showJournal) { showJournal = false; return; }
			if (showSetting) { toggleSettingPopup(); return; }
			if (showWordBank) { showWordBank = false; return; }
		}

		if (e.ctrlKey || e.metaKey) {
			if (e.key === 's') { e.preventDefault(); toggleSettingPopup(); return; }
			if (e.key === 'h') { e.preventDefault(); toggleWordBank(); return; }
			if (e.key === 'j') { e.preventDefault(); toggleJournal(); return; }
		}

		if (e.key === 'F1' || (e.key === '?' && !showJournal && !showWordBank && !showPhilosophy)) { e.preventDefault(); showHowToPlay = !showHowToPlay; return; }

		if (!allowGame) return;
		if (!mindDojo) return;
		mindDojo.onKeyDown(e);
	};
	const onkeyup = (e: KeyboardEvent) => {
		if (!allowGame) return;
		if (!mindDojo) return;
		mindDojo.onKeyUp(e);
	};
	const onkeypress = (e: KeyboardEvent) => {
		if (!allowGame) return;
		if (!mindDojo) return;
		mindDojo.onKeyPress(e);
	};

	$effect(() => {
		if (!browser || !mindDojo) return;
		localStorage.setItem('settings', JSON.stringify(mindDojo.settings));
	});

	function toggleSettingPopup() {
		if (showSetting) {
			mindDojo?.pickNextWord();
			mindDojo?.startSessionTimer();
			showSetting = false;
			return;
		}
		showSetting = true;
	}

	let words: SavedWord[] = $state([]);
	async function loadSavedWords() {
		if (!mindDojo) return;
		words = await mindDojo.database.getAllWords();
	}
	async function toggleWordBank() {
		if (!showWordBank) await loadSavedWords();
		showWordBank = !showWordBank;
	}
	async function toggleJournal() {
		if (!showJournal) await loadSavedWords();
		showJournal = !showJournal;
	}

	let xpProgress = $derived.by(() => {
		if (!mindDojo) return 0;
		const next = mindDojo.nextBelt;
		if (!next) return 100;
		const current = mindDojo.belt;
		const range = next.minXp - current.minXp;
		const progress = mindDojo.xp - current.minXp;
		return Math.min(Math.round((progress / range) * 100), 100);
	});
</script>

<svelte:window {onkeydown} {onkeypress} {onkeyup} />

<!-- ============ LOADING SCREEN ============ -->
{#if appState === 'loading'}
	<div class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-base">
		<div class="loading-pulse mb-6">
			<div class="h-16 w-16 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 shadow-lg shadow-accent/30">
				<svg class="h-full w-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
			</div>
		</div>
		<h1 class="mb-2 text-3xl font-black tracking-wider text-accent">MIND DOJO</h1>
		<div class="h-0.5 w-32 overflow-hidden rounded-full bg-surface-hover">
			<div class="loading-bar h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
		</div>
	</div>
{/if}

<!-- ============ INTRO SCREEN ============ -->
{#if mindDojo && appState === 'intro' && !showHowToPlay && !showPhilosophy}
	<div class="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-base intro-fade-in">
		<!-- Logo -->
		<div class="mb-8">
			<div class="mx-auto mb-4 h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 shadow-xl shadow-accent/20">
				<svg class="h-full w-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
			</div>
			<h1 class="text-center text-4xl font-black tracking-wider text-accent">MIND DOJO</h1>
			<p class="mt-1 text-center text-sm tracking-widest text-base-text-muted uppercase">Train your presence</p>
		</div>

		<!-- Philosophy -->
		<div class="mb-10 max-w-md space-y-4 px-6 text-center">
			<p class="text-base leading-relaxed text-base-text">
				Your mind constantly projects ahead — completing words before they're shown,
				rushing past the present into assumptions. This is how beliefs run unchecked.
			</p>
			<p class="text-sm leading-relaxed text-base-text-muted">
				Mind Dojo trains you to stay with what <span class="font-bold text-accent">is</span>,
				not what you <span class="italic text-base-text">think</span> will be.
				Every letter is a moment. Every error is a belief revealed.
			</p>
		</div>

		<!-- Belt display if returning player -->
		{#if mindDojo.xp > 0}
			<div class="mb-6 flex items-center gap-2 rounded-lg border border-base-border bg-surface px-4 py-2">
				<div class="h-3 w-3 rounded-full" style="background: {mindDojo.belt.color};"></div>
				<span class="text-sm font-bold" style="color: {mindDojo.belt.color};">{mindDojo.belt.name}</span>
				<span class="text-xs text-base-text-muted">{mindDojo.xp} XP</span>
			</div>
		{/if}

		<!-- CTA -->
		<button
			onclick={startGame}
			class="group rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3 text-lg font-bold text-black shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30 hover:scale-105"
		>
			{mindDojo.xp > 0 ? 'Continue Training' : 'Enter the Dojo'}
		</button>

		<p class="mt-4 text-xs text-base-text-muted">Press any key to start</p>

		<!-- Links -->
		<div class="mt-6 flex items-center gap-4">
			<button
				onclick={() => (showHowToPlay = true)}
				class="text-xs text-base-text-muted underline-offset-4 hover:text-accent hover:underline"
			>
				How to play
			</button>
			<button
				onclick={() => (showPhilosophy = true)}
				class="text-xs text-base-text-muted underline-offset-4 hover:text-accent hover:underline"
			>
				Philosophy
			</button>
		</div>
	</div>
{/if}

<!-- ============ HOW TO PLAY MODAL ============ -->
{#if showHowToPlay}
	<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm">
		<div class="relative max-h-[85vh] overflow-y-auto w-full max-w-2xl rounded-xl border border-base-border bg-surface shadow-2xl">
			<!-- Header -->
			<div class="sticky top-0 z-10 flex items-center justify-between border-b border-base-border bg-surface-hover px-6 py-4">
				<h2 class="text-xl font-bold text-accent">How to Play</h2>
				<button
					onclick={() => (showHowToPlay = false)}
					class="rounded-lg p-2 text-base-text-muted hover:bg-surface-hover hover:text-accent"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-8 p-6">
				<!-- The Game -->
				<section>
					<h3 class="mb-3 text-lg font-bold text-accent">The Game</h3>
					<div class="space-y-2 text-sm leading-relaxed text-base-text">
						<p>Letters appear on screen. Type exactly what you see — letter by letter, in order.</p>
						<p>Complete the word before the timer runs out. Each correct word advances your progress. Reach 100% to level up.</p>
						<p>Speed increases automatically as you progress. The dojo gets harder the better you become.</p>
					</div>
				</section>

				<!-- Rules -->
				<section>
					<h3 class="mb-3 text-lg font-bold text-accent">Rules of the Dojo</h3>
					<div class="grid gap-3">
						<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
							<span class="mb-1 block text-sm font-bold text-green-400">Type what IS, not what you THINK</span>
							<p class="text-xs text-base-text-muted">If you see "bless", don't assume "blessing". Stay with what's actually shown. The moment you project ahead, you error.</p>
						</div>
						<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
							<span class="mb-1 block text-sm font-bold text-red-400">Errors reveal beliefs</span>
							<p class="text-xs text-base-text-muted">If you stumble on certain words — "broke", "fail", "alone" — notice the hesitation. That emotional charge is a belief running underneath.</p>
						</div>
						<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
							<span class="mb-1 block text-sm font-bold text-accent">Combos reward presence</span>
							<p class="text-xs text-base-text-muted">Consecutive correct words build your combo. Errors break it instantly. Speed doesn't matter — accuracy does. Stay present.</p>
						</div>
						<div class="rounded-lg border border-base-border bg-surface-hover/50 p-3">
							<span class="mb-1 block text-sm font-bold text-purple-400">Chaos Mode</span>
							<p class="text-xs text-base-text-muted">Settings mutate randomly every word — display mode, styling, visibility. You can't predict what's next. Adaptability is the training.</p>
						</div>
					</div>
				</section>

				<!-- Belt System -->
				<section>
					<h3 class="mb-3 text-lg font-bold text-accent">Belt System</h3>
					<p class="mb-3 text-sm text-base-text-muted">Earn XP with each correct word. Longer words and higher combos give more XP. Progress through the belts:</p>
					<div class="grid grid-cols-2 gap-2">
						{#each [
							{ name: 'White Belt', color: '#e5e5e5', xp: '0' },
							{ name: 'Yellow Belt', color: '#facc15', xp: '100' },
							{ name: 'Orange Belt', color: '#f97316', xp: '300' },
							{ name: 'Green Belt', color: '#22c55e', xp: '600' },
							{ name: 'Blue Belt', color: '#3b82f6', xp: '1,000' },
							{ name: 'Purple Belt', color: '#a855f7', xp: '1,800' },
							{ name: 'Brown Belt', color: '#92400e', xp: '3,000' },
							{ name: 'Red Belt', color: '#ef4444', xp: '5,000' },
							{ name: 'Black Belt', color: '#171717', xp: '8,000' },
							{ name: 'Master', color: '#fbbf24', xp: '15,000' },
						] as belt}
							<div class="flex items-center gap-2 rounded border border-base-border px-3 py-1.5">
								<div class="h-2.5 w-2.5 rounded-full" style="background: {belt.color};"></div>
								<span class="text-xs font-medium" style="color: {belt.color};">{belt.name}</span>
								<span class="ml-auto font-mono text-[10px] text-base-text-muted">{belt.xp} XP</span>
							</div>
						{/each}
					</div>
				</section>

				<!-- Philosophy link -->
				<section>
					<button
						onclick={() => { showHowToPlay = false; showPhilosophy = true; }}
						class="w-full rounded-lg border border-base-border bg-surface-hover/50 p-4 text-left transition-colors hover:border-accent"
					>
						<h3 class="mb-1 text-lg font-bold text-accent">The Philosophy</h3>
						<p class="text-sm text-base-text-muted">
							Why this game exists, what the training really is, and the traps your mind will set along the way.
						</p>
						<span class="mt-2 inline-block text-xs text-accent">Read the full philosophy &rarr;</span>
					</button>
				</section>

				<!-- Controls -->
				<section>
					<h3 class="mb-3 text-lg font-bold text-accent">Controls</h3>
					<div class="grid grid-cols-2 gap-2 text-sm">
						{#each [
							{ key: 'Type', desc: 'Match the shown letters' },
							{ key: 'Backspace', desc: 'Delete last character' },
							{ key: 'Ctrl+S', desc: 'Open settings' },
							{ key: 'Ctrl+H', desc: 'Open word bank' },
							{ key: 'Ctrl+J', desc: 'Open journal' },
							{ key: '? or F1', desc: 'This help screen' },
							{ key: 'Esc', desc: 'Close any panel' },
						] as item}
							<div class="flex items-center gap-3 rounded border border-base-border px-3 py-2">
								<kbd class="rounded bg-surface-hover px-2 py-0.5 font-mono text-xs text-accent">{item.key}</kbd>
								<span class="text-xs text-base-text-muted">{item.desc}</span>
							</div>
						{/each}
					</div>
				</section>
			</div>
		</div>
	</div>
{/if}

<!-- ============ SETTINGS MODAL ============ -->
{#if mindDojo && showSetting}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
		<div
			class="relative max-h-[90vh] overflow-y-auto w-full max-w-2xl rounded-xl border border-base-border bg-surface shadow-2xl"
		>
			<div
				class="sticky top-0 z-10 flex items-center justify-between border-b border-base-border bg-surface-hover px-6 py-4"
			>
				<h2 class="text-xl font-bold text-accent">Settings</h2>
				<div class="flex items-center gap-3">
					<span class="text-xs text-base-text-muted">Ctrl+S or Esc</span>
					<button
						onclick={toggleSettingPopup}
						class="rounded-lg p-2 text-base-text-muted transition-colors hover:bg-surface-hover hover:text-accent"
						aria-label="Close settings"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
			<div class="p-6">
				<Setting bind:settings={mindDojo.settings} />
			</div>
		</div>
	</div>
{/if}

<!-- ============ PHILOSOPHY ============ -->
<PhilosophyScreen bind:show={showPhilosophy} />

<!-- ============ JOURNAL ============ -->
{#if mindDojo}
<JournalScreen
	bind:show={showJournal}
	{journal}
	database={mindDojo.database}
/>
{/if}

<!-- ============ WORD BANK ============ -->
{#if mindDojo && showWordBank}
	<DisplaySavedWords bind:showWordBank {mindDojo} {words} />
{/if}

<!-- ============ GAME SCREEN ============ -->
{#if mindDojo && appState === 'game'}
	<!-- Screen flash overlay -->
	<div class="pointer-events-none fixed inset-0 z-40 {flashClass}"></div>

	<!-- Floating XP text (hidden in zen mode) -->
	{#if floatingText && !mindDojo?.settings.zenMode}
		<div class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
			<div class="floating-text {floatingText.type === 'rank-up' ? 'text-3xl font-black text-accent' : 'text-xl font-bold text-green-400'}">
				{floatingText.text}
			</div>
		</div>
	{/if}

	<div class="relative min-h-screen w-full">
		<!-- Top HUD -->
		<div class="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2">
			{#if !mindDojo.settings.zenMode}
			<!-- Belt, XP & Timer (left) -->
			<div class="flex items-center gap-3">
				{#if !mindDojo.settings.hideTimer}
					<Timer
						duration={mindDojo.wordTimerDuration}
						maxDuration={mindDojo.wordMaxDuration}
						stealth={mindDojo.settings.stealthTimer}
					/>
				{/if}
				<!-- Reaction time indicator -->
				{#if mindDojo.reactionTimeMs !== null}
					<span class="font-mono text-[11px] {mindDojo.reactionTimeMs > 3000 ? 'text-red-400' : mindDojo.reactionTimeMs > 1500 ? 'text-amber-400' : 'text-base-text-muted'}">
						{(mindDojo.reactionTimeMs / 1000).toFixed(1)}s
					</span>
				{:else if mindDojo.lastReactionTime > 0}
					<span class="font-mono text-[10px] text-base-text-muted/50">
						{mindDojo.lastReactionTime < 1000 ? `${Math.round(mindDojo.lastReactionTime)}ms` : `${(mindDojo.lastReactionTime / 1000).toFixed(1)}s`}
					</span>
				{/if}
				<div class="flex items-center gap-2">
					<div class="h-3 w-3 rounded-full border border-base-border" style="background: {mindDojo.belt.color};"></div>
					<span class="text-xs font-bold" style="color: {mindDojo.belt.color};">{mindDojo.belt.name}</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-1.5 w-24 overflow-hidden rounded-full bg-surface-hover">
						<div
							class="h-full rounded-full transition-all duration-300"
							style="width: {xpProgress}%; background: {mindDojo.nextBelt?.color || mindDojo.belt.color};"
						></div>
					</div>
					<span class="font-mono text-[10px] text-base-text-muted">{mindDojo.xp} XP</span>
				</div>
			</div>

			<!-- Session stats + focus zone (center) -->
			<div class="flex flex-col items-center gap-0.5">
				<div class="flex items-center gap-4 text-[11px] text-base-text-muted">
					<span>{formatSessionTime(sessionSeconds)}</span>
					<span class="text-green-400">{mindDojo.sessionCorrect}</span>
					<span class="text-base-text-muted">/</span>
					<span class="text-red-400">{mindDojo.sessionErrors}</span>
					<span class="text-base-text-muted">{mindDojo.accuracy}%</span>
				</div>
				<FocusTimeline timeline={mindDojo.sessionTimeline} />
				{#if mindDojo.fatigueWarning}
					<div class="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[10px] text-amber-400">
						Focus fading — consider a break
					</div>
				{/if}
			</div>

			<!-- Combo + Actions (right) -->
			<div class="flex items-center gap-3">
				{#if mindDojo.combo > 0}
					<div class="flex items-center gap-1">
						<span class="font-mono text-lg font-black {mindDojo.combo >= 20 ? 'text-red-400' : mindDojo.combo >= 10 ? 'text-accent' : mindDojo.combo >= 5 ? 'text-green-400' : 'text-base-text'}">
							{mindDojo.combo}
						</span>
						<span class="text-[10px] font-bold {mindDojo.combo >= 5 ? 'text-accent' : 'text-base-text-muted'}">
							COMBO
						</span>
					</div>
				{/if}
				{#if mindDojo.combo >= 5}
					<span class="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-bold text-accent">
						x{(1 + Math.floor(mindDojo.combo / 5) * 0.5).toFixed(1)}
					</span>
				{/if}
				<button
					onclick={toggleJournal}
					class="rounded-lg p-1.5 text-base-text-muted transition-colors hover:bg-surface-hover hover:text-accent"
					title="Journal (Ctrl+J)"
					aria-label="Open journal"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
					</svg>
				</button>
				<button
					onclick={toggleSettingPopup}
					class="rounded-lg p-1.5 text-base-text-muted transition-colors hover:bg-surface-hover hover:text-accent"
					title="Settings (Ctrl+S)"
					aria-label="Open settings"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</button>
			</div>
			{:else}
			<!-- Zen mode: only show action buttons -->
			<div class="flex-1"></div>
			<div class="flex items-center gap-3">
				<button
					onclick={toggleJournal}
					class="rounded-lg p-1.5 text-base-text-muted/30 transition-colors hover:text-base-text-muted"
					title="Journal (Ctrl+J)"
					aria-label="Open journal"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
					</svg>
				</button>
				<button
					onclick={toggleSettingPopup}
					class="rounded-lg p-1.5 text-base-text-muted/30 transition-colors hover:text-base-text-muted"
					title="Settings (Ctrl+S)"
					aria-label="Open settings"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</button>
			</div>
			{/if}
		</div>

		<!-- Game Area -->
		<div class="relative flex min-h-screen items-center justify-center">
			<div class="relative">
				<RenderWord
					settings={mindDojo.settings}
					word={mindDojo.currentWord!}
					typedWord={mindDojo.typedWord}
					baseStyles={mindDojo.currentWordStyle}
					wordTransform={mindDojo.wordTransformStyle}
				/>
			</div>

			{#if !mindDojo.settings.hideProgressBar && !mindDojo.settings.zenMode}
				<div class="absolute right-0 bottom-0 left-0">
					<ProgressBar />
				</div>
			{/if}

			<!-- Rest / Fatigue overlay -->
			{#if mindDojo.sessionPhase === 'rest'}
				<div class="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm">
					<div class="w-full max-w-lg px-6">
						<!-- Header -->
						<div class="mb-6 text-center">
							{#if mindDojo.restReason === 'fatigue'}
								<h2 class="mb-1 text-3xl font-black text-amber-400">Focus Fading</h2>
								<p class="text-sm text-base-text-muted">
									Your accuracy dropped <span class="font-bold text-amber-400">{mindDojo.fatiguePeakAccuracy - mindDojo.sessionRollingAccuracy}%</span> below your peak.
									Take a break — your mind needs rest.
								</p>
							{:else}
								<h2 class="mb-1 text-3xl font-black text-accent">Rest</h2>
								{#if mindDojo.restSecondsLeft > 0}
									<p class="text-sm text-base-text-muted">
										Next session in <span class="font-mono font-bold text-accent">{Math.floor(mindDojo.restSecondsLeft / 60)}:{(mindDojo.restSecondsLeft % 60).toString().padStart(2, '0')}</span>
									</p>
								{/if}
							{/if}
						</div>

						<!-- Session stats -->
						<div class="mb-6 flex justify-center gap-6 text-center">
							<div>
								<div class="text-2xl font-bold text-green-400">{mindDojo.sessionCorrect}</div>
								<div class="text-[10px] text-base-text-muted">Correct</div>
							</div>
							<div>
								<div class="text-2xl font-bold text-red-400">{mindDojo.sessionErrors}</div>
								<div class="text-[10px] text-base-text-muted">Errors</div>
							</div>
							<div>
								<div class="text-2xl font-bold text-accent">{mindDojo.accuracy}%</div>
								<div class="text-[10px] text-base-text-muted">Accuracy</div>
							</div>
							<div>
								<div class="text-2xl font-bold text-cyan-400">{mindDojo.combo}</div>
								<div class="text-[10px] text-base-text-muted">Best Combo</div>
							</div>
						</div>

						<!-- Action buttons -->
						<div class="mb-4 flex justify-center gap-3">
							<button
								onclick={() => { showWordBank = true; }}
								class="flex items-center gap-2 rounded-lg border border-base-border bg-surface px-5 py-2.5 text-sm font-bold text-base-text transition-colors hover:border-accent hover:text-accent"
							>
								<span class="text-base">📊</span> Word Bank
							</button>
							<button
								onclick={() => {
									journal.createEntry('session', '', [], {
										correct: mindDojo!.sessionCorrect,
										errors: mindDojo!.sessionErrors,
										accuracy: mindDojo!.accuracy,
										bestCombo: mindDojo!.bestCombo,
										wordsTyped: mindDojo!.sessionCorrect + mindDojo!.sessionErrors,
									});
									showJournal = true;
								}}
								class="flex items-center gap-2 rounded-lg border border-base-border bg-surface px-5 py-2.5 text-sm font-bold text-base-text transition-colors hover:border-accent hover:text-accent"
							>
								<span class="text-base">📝</span> Journal
							</button>
						</div>

						<!-- Continue button -->
						<div class="text-center">
							{#if mindDojo!.restSecondsLeft > 0}
								<p class="text-[10px] text-base-text-muted">Use this time to reflect. The next round starts automatically.</p>
							{:else}
								<button
									onclick={() => mindDojo!.endRest()}
									class="rounded-lg bg-accent px-6 py-2 font-bold text-black transition-all hover:bg-accent"
								>
									Start Next Session
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			{#if !mindDojo.settings.zenMode}
			<div class="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-base-text-muted select-none">
				Ctrl+S settings &middot; Ctrl+H words &middot; Ctrl+J journal &middot; ? help
			</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Loading screen */
	.loading-pulse {
		animation: pulse-glow 1.5s ease-in-out infinite;
	}
	@keyframes pulse-glow {
		0%, 100% { transform: scale(1); opacity: 0.8; }
		50% { transform: scale(1.05); opacity: 1; }
	}
	.loading-bar {
		animation: loading-slide 1.5s ease-in-out;
		width: 100%;
	}
	@keyframes loading-slide {
		0% { width: 0%; }
		100% { width: 100%; }
	}

	/* Intro screen */
	.intro-fade-in {
		animation: fade-in 0.5s ease-out;
	}
	@keyframes fade-in {
		0% { opacity: 0; transform: translateY(10px); }
		100% { opacity: 1; transform: translateY(0); }
	}

	/* Game flash effects */
	.flash-error {
		animation: flash-red 0.3s ease-out;
	}
	.flash-success {
		animation: flash-green 0.2s ease-out;
	}
	.flash-rankup {
		animation: flash-gold 0.6s ease-out;
	}

	@keyframes flash-red {
		0% { background: rgba(239, 68, 68, 0.15); }
		100% { background: transparent; }
	}
	@keyframes flash-green {
		0% { background: rgba(34, 197, 94, 0.08); }
		100% { background: transparent; }
	}
	@keyframes flash-gold {
		0% { background: rgba(251, 191, 36, 0.2); }
		50% { background: rgba(251, 191, 36, 0.1); }
		100% { background: transparent; }
	}

	.floating-text {
		animation: float-up 1.2s ease-out forwards;
	}

	@keyframes float-up {
		0% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		70% {
			opacity: 0.8;
			transform: translateY(-40px) scale(1.1);
		}
		100% {
			opacity: 0;
			transform: translateY(-80px) scale(0.8);
		}
	}
</style>
