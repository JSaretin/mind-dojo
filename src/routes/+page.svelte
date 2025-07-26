<script lang="ts">
	import { browser } from '$app/environment';
	import { initializeAudio } from '$lib';
	import ProgressBar from '$lib/componets/ProgressBar.svelte';
	import RenderWord from '$lib/componets/render_word/Word.svelte';
	import Setting from '$lib/componets/Setting.svelte';
	import Timer from '$lib/componets/Timer.svelte';
	import { MindDojo, type Words } from '$lib/mind-dojo.svelte';
	import { setContext } from 'svelte';

	let { data }: { data: { words: Words } } = $props();

	const onkeydown = (e: KeyboardEvent) => {
		if (showSetting) return;
		if (!mindDojo) return;
		mindDojo.onKeyDown(e);
	};
	const onkeyup = (e: KeyboardEvent) => {
		if (showSetting) return;
		if (!mindDojo) return;
		mindDojo.onKeyUp(e);
	};
	const onkeypress = (e: KeyboardEvent) => {
		if (showSetting) return;
		if (!mindDojo) return;
		mindDojo.onKeyPress(e);
	};

	let showSetting = $state(false);
	let audioMap = $derived(initializeAudio());
	let mindDojo: MindDojo = $state(new MindDojo(data.words));

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
</script>

<svelte:window {onkeydown} {onkeypress} {onkeyup} />

{#if showSetting}
	<div class="absolute inset-0 z-50 overflow-hidden bg-neutral-800/70 backdrop-blur-lg">
		<div class="relative h-full w-full overflow-y-scroll">
			<Setting bind:settings={mindDojo.settings} />
		</div>
	</div>
{/if}

<div class="flex h-full w-full place-items-center justify-center align-middle">
	<button
		class="fixed top-1 right-2 z-50 cursor-pointer text-neutral-700"
		onclick={toggleSettingPopup}>{showSetting ? 'hide' : 'show'} setting</button
	>
	<div class="relative flex flex-col place-items-center justify-center align-middle">
		{#if !mindDojo.settings.hideTimer}
			<Timer duration={mindDojo.wordTimerDuration} maxDuration={mindDojo.wordMaxDuration} />
		{/if}

		<RenderWord word={mindDojo.currentWord!} typedWord={mindDojo.typedWord}></RenderWord>
	</div>

	{#if !mindDojo.settings.hideProgressBar}
		<ProgressBar />
	{/if}
</div>
