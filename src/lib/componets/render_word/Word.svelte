<script lang="ts">
	import type { Word } from '$lib/structure';
	import { getContext } from 'svelte';
	import Letter from './Letter.svelte';
	import type { MindDojoSettings } from '$lib/mind-dojo.svelte';
	import { getBaseStyle } from '$lib/style';
	import { getRandomChar } from '$lib';

	let { word, typedWord }: { typedWord: string; word: Word } = $props();

	const settingFunction: () => MindDojoSettings = getContext('settings');
	const audioMapFuction: () => { [k: string]: HTMLAudioElement } = getContext('audioMapFuction');

	const settings: MindDojoSettings = $derived(settingFunction());
	const audioMap = $derived(audioMapFuction());

	function processAudio() {
		const letter = word.word.at(typedWord.length)!;
		const voice = settings.voice;

		if (voice.sayCurrentWord) {
			const letterAudio = audioMap[letter.toLowerCase()];
			if (letterAudio) {
				letterAudio.currentTime = 0;
				letterAudio.play().catch(() => {});
			}
			return;
		}

		if (voice.focusOnLetter) {
			const expectedLetter = getRandomChar();
			const audio = audioMap[expectedLetter];
			if (audio) {
				audio.currentTime = 0;
				audio.play().catch(() => {});
			}
			return;
		}

		if (voice.focusOnVoice) {
			const letterAudio = audioMap[letter];
			if (letterAudio) {
				letterAudio.currentTime = 0;
				letterAudio.play().catch(() => {});
			}
			return;
		}
	}

	$effect(processAudio);

	let baseStyles = $derived(
		Array(word.word.length)
			.fill(null)
			.map(() => getBaseStyle(settings))
	);
</script>

<div class="flex">
	{#if settings.displayMode === 'letter-by-letter'}
		{#if settings.letterStyle?.letterDisplayDirection === 'left-to-right'}
			{#each word.word as letter, index}
				<Letter
					{letter}
					letterIndex={index}
					typedLetter={typedWord.at(index)!}
					typedLetterIndex={typedWord.length}
					baseStyle={baseStyles[index]}
				/>
			{/each}
		{:else}
			<Letter
				letter={word.word.at(typedWord.length) ?? ''}
				letterIndex={typedWord.length}
				typedLetter={typedWord.at(typedWord.length - 1)!}
				typedLetterIndex={typedWord.length}
				baseStyle={baseStyles[typedWord.length]}
				isSigleLetterMode={true}
			/>
		{/if}
	{:else}
		{#each word.word as letter, index}
			<Letter
				{letter}
				letterIndex={index}
				typedLetter={typedWord.at(index)!}
				typedLetterIndex={typedWord.length}
				baseStyle={baseStyles[index]}
			/>
		{/each}
	{/if}
</div>
