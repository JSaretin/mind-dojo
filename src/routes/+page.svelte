<script lang="ts">
	import { browser } from '$app/environment';
	import DisplaySavedWords from '$lib/componets/DisplaySavedWords.svelte';
	import NavBar from '$lib/componets/NavBar.svelte';
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
<DisplaySavedWords bind:showWordBank {mindDojo} />

<!-- Main Game Interface -->
<div class="relative min-h-screen w-full">
	<!-- Top Navigation Bar -->
	<NavBar {showSetting} {toggleSettingPopup} {toggleWordBank} bind:showWordBank />

	<!-- Game Area -->
	<div class="relative flex min-h-[calc(100vh-80px)] items-center justify-center">
		<!-- Game Content -->
		<div class="relative">
			<!-- Timer -->
			{#if !mindDojo.settings.hideTimer}
				<div
					class="absolute top-0 left-0 flex w-full -translate-y-[120%] place-items-center justify-center align-middle"
				>
					<div class="">
						<Timer duration={mindDojo.wordTimerDuration} maxDuration={mindDojo.wordMaxDuration} />
					</div>
				</div>
			{/if}

			<RenderWord
				settings={mindDojo.settings}
				word={mindDojo.currentWord!}
				typedWord={mindDojo.typedWord}
			/>

			<!-- Game Stats -->
		</div>

		<!-- Progress Bar -->
		{#if !mindDojo.settings.hideProgressBar}
			<div class="absolute right-0 bottom-0 left-0">
				<ProgressBar />
			</div>
		{/if}
	</div>
</div>
