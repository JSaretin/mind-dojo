<script lang="ts">
	import { browser } from '$app/environment';
	import { initializeAudio } from '$lib';
	import DisplaySavedWords from '$lib/componets/DisplaySavedWords.svelte';
	import ProgressBar from '$lib/componets/ProgressBar.svelte';
	import RenderWord from '$lib/componets/render_word/Word.svelte';
	import Setting from '$lib/componets/Setting.svelte';
	import Timer from '$lib/componets/Timer.svelte';
	import { MindDojo } from '$lib/mind-dojo.svelte';
	import type { Words } from '$lib/structure';
	import { setContext } from 'svelte';

	let { data }: { data: { words: Words } } = $props();

	let showSetting = $state(false);
	let showWordBank = $state(false);
	let audioMap = $derived(initializeAudio());
	let mindDojo: MindDojo = $state(new MindDojo(data.words));

	let allowGame = $derived(!showSetting && !showWordBank);

	const onkeydown = (e: KeyboardEvent) => {
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

	setContext('mindDojo', mindDojo);
	setContext('settings', () => mindDojo.settings);
	setContext('audioMapFuction', () => audioMap);

	$effect(() => {
		if (!browser) return;
		localStorage.setItem('settings', JSON.stringify(mindDojo.settings));
	});

	function toggleSettingPopup() {
		if (showSetting) {
			mindDojo.pickNextWord();
			showSetting = false;
			return;
		}
		showSetting = true;
	}

	function toggleWordBank() {
		showWordBank = !showWordBank;
	}

	// Get word bank count for display
	let wordBankCount = $derived(mindDojo.savedWords.length);
</script>

<svelte:window {onkeydown} {onkeypress} {onkeyup} />

<!-- Settings Modal -->
{#if showSetting}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
		<div
			class="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
		>
			<div
				class="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-700 bg-neutral-800 px-6 py-4"
			>
				<h2 class="text-xl font-bold text-amber-200">Game Settings</h2>
				<button
					onclick={toggleSettingPopup}
					class="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-amber-400"
					aria-label="Close settings"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
			<div class="p-6">
				<Setting bind:settings={mindDojo.settings} />
			</div>
		</div>
	</div>
{/if}

<!-- Word Bank Panel -->
{#if showWordBank}
	<DisplaySavedWords
		{mindDojo}
		onclose={() => {
			showWordBank = false;
		}}
	/>
{/if}

<!-- Main Game Interface -->
<div
	class={'relative min-h-screen w-full ' +
		(false ? '' : ' from-neutral-900 via-neutral-800 to-neutral-900')}
>
	<!-- Background Pattern -->
	<div class="absolute inset-0 opacity-5">
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.1),transparent_50%)]"
		></div>
		<div
			class="absolute inset-0 bg-[linear-gradient(45deg,transparent_49%,rgba(251,191,36,0.03)_50%,transparent_51%)] bg-[length:20px_20px]"
		></div>
	</div>

	<!-- Top Navigation Bar -->
	<nav class="relative z-30 flex items-center justify-between p-4">
		<!-- Logo/Title -->
		<div class="flex items-center gap-3">
			<div class="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 p-2">
				<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 10V3L4 14h7v7l9-11h-7z"
					/>
				</svg>
			</div>
			<div>
				<h1 class="text-xl font-bold text-amber-100">MindDojo</h1>
				<p class="text-xs text-neutral-400">Typing Mastery</p>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center gap-3">
			<!-- Word Bank Button -->
			<button
				onclick={toggleWordBank}
				class={'group relative flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-800/80 px-4 py-2 text-sm font-medium text-amber-100 backdrop-blur-sm transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-lg ' +
					(showWordBank ? 'bg-amber-500/10' : '')}
				class:border-amber-500={showWordBank}
				aria-label="Toggle word bank"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
					/>
				</svg>
				<span>Word Bank</span>
				{#if wordBankCount > 0}
					<span class="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
						{wordBankCount}
					</span>
				{/if}
			</button>

			<!-- Settings Button -->
			<button
				onclick={toggleSettingPopup}
				class={'group relative flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-800/80 px-4 py-2 text-sm font-medium text-amber-100 backdrop-blur-sm transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-lg ' +
					(showSetting ? 'bg-amber-500/10' : '')}
				class:border-amber-500={showSetting}
				aria-label="Toggle settings"
			>
				<svg
					class="h-4 w-4 transition-transform group-hover:rotate-90"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
				<span>Settings</span>
			</button>
		</div>
	</nav>

	<!-- Game Area -->
	<div class="relative flex min-h-[calc(100vh-80px)] items-center justify-center">
		<!-- Game Content -->
		<div class="relative">
			<!-- Timer -->
			{#if !mindDojo.settings.hideTimer}
				<div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full">
					<Timer duration={mindDojo.wordTimerDuration} maxDuration={mindDojo.wordMaxDuration} />
				</div>
			{/if}

			<!-- Main Word Display -->
			<!-- <div
				class="rounded-2xl border border-neutral-700/50 bg-neutral-800/30 p-8 shadow-2xl backdrop-blur-sm"
			>
				<div class="flex items-center justify-center"> -->
			<RenderWord word={mindDojo.currentWord!} typedWord={mindDojo.typedWord} />
			<!-- </div>
			</div> -->

			<!-- Game Stats -->
			<!-- <div class="mt-6 flex justify-center">
				<div
					class="flex items-center gap-6 rounded-lg border border-neutral-700/50 bg-neutral-800/50 px-6 py-3 backdrop-blur-sm"
				>
					<div class="text-center">
						<div class="text-lg font-bold text-amber-400">{mindDojo.dojoState.level}</div>
						<div class="text-xs text-neutral-400">Level</div>
					</div>
					<div class="h-8 w-px bg-neutral-600"></div>
					<div class="text-center">
						<div class="text-lg font-bold text-green-400">{mindDojo.settings.speed.toFixed(1)}</div>
						<div class="text-xs text-neutral-400">Speed</div>
					</div>
					<div class="h-8 w-px bg-neutral-600"></div>
					<div class="text-center">
						<div class="text-lg font-bold text-blue-400">{mindDojo.dojoState.progress}%</div>
						<div class="text-xs text-neutral-400">Progress</div>
					</div>
				</div>
			</div> -->
		</div>

		<!-- Progress Bar -->
		{#if !mindDojo.settings.hideProgressBar}
			<div class="absolute right-0 bottom-0 left-0">
				<ProgressBar />
			</div>
		{/if}
	</div>

	<!-- Keyboard Hint -->
	<!-- {#if allowGame}
		<div class="absolute bottom-4 left-1/2 -translate-x-1/2">
			<div
				class="rounded-lg border border-neutral-700/50 bg-neutral-800/50 px-4 py-2 backdrop-blur-sm"
			>
				<p class="text-xs text-neutral-400">
					{#if mindDojo.settings.displayMode === 'letter-by-letter'}
						Type each letter as it appears
					{:else}
						Type the complete word
					{/if}
				</p>
			</div>
		</div>
	{/if} -->
</div>
