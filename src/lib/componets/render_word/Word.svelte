<script lang="ts">
	import type { MindDojoSettings, Word } from '$lib/structure';
	import { getContext } from 'svelte';
	import Letter from './Letter.svelte';
	import { getBaseStyle } from '$lib/style';
	import { getRandomChar } from '$lib';
	import type { MindDojo } from '$lib/mind-dojo.svelte'; // Import MindDojo type
	import WordMeaning from '../WordMeaning.svelte';

	let { word, typedWord }: { typedWord: string; word: Word } = $props();

	const mindDojo: MindDojo = getContext('mindDojo'); // Get mindDojo directly
	const audioMapFunction: () => { [k: string]: HTMLAudioElement } = getContext('audioMapFuction');

	const settings: MindDojoSettings = $derived(mindDojo.settings); // Access settings from mindDojo
	const audioMap = $derived(audioMapFunction());

	function processAudio() {
		const letter = word.word.at(typedWord.length); // Use .at() for safety, it returns undefined if out of bounds
		if (!letter) return; // Exit if no letter to process

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

	function generateRandomShiftOfWordPosition() {
		if (settings.displayMode === 'full-word') return '';
		if (word.word.length >= 20) return '';
		let position: string[] = [
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-0',
			'-translate-x-3',
			'-translate-x-5',
			'-translate-x-7',
			'-translate-x-8',
			'-translate-x-10',
			'-translate-x-12',
			'-translate-x-13',
			'-translate-x-16',
			'-translate-x-20',
			'-translate-x-24',
			'-translate-x-26',
			'-translate-x-30',
			'-translate-x-34',
			'-translate-x-35'
		];

		return position[Math.floor(Math.random() * position.length)];
	}
</script>

<div class={' flex ' + generateRandomShiftOfWordPosition()}>
	{#if settings.displayMode === 'letter-by-letter'}
		{#if settings.letterStyle?.letterDisplayDirection === 'left-to-right'}
			{#each word.word as letter, index}
				<Letter
					{letter}
					letterIndex={index}
					typedLetter={typedWord.at(index) ?? ''}
					typedLetterIndex={typedWord.length}
					baseStyle={baseStyles[index]}
				/>
			{/each}
		{:else}
			<Letter
				letter={word.word.at(typedWord.length) ?? ''}
				letterIndex={typedWord.length}
				typedLetter={typedWord.at(typedWord.length - 1) ?? ''}
				typedLetterIndex={typedWord.length}
				baseStyle={baseStyles[typedWord.length] ?? ''}
				isSingleLetterMode={true}
			/>
		{/if}
	{:else}
		<div class="relative flex flex-col">
			<div class="flex">
				{#each word.word as letter, index}
					<Letter
						{letter}
						letterIndex={index}
						typedLetter={typedWord.at(index) ?? ''}
						typedLetterIndex={typedWord.length}
						baseStyle={baseStyles[index]}
					/>
				{/each}
			</div>
			<!-- Word Meanings Popup for Full Word Mode -->
			<WordMeaning {word} />
		</div>
	{/if}
</div>
