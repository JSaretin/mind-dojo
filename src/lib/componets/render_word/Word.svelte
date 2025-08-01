<script lang="ts">
	import type { MindDojoSettings, Word } from '$lib/structure';
	import Letter from './Letter.svelte';
	import { getBaseStyle } from '$lib/style';
	import WordMeaning from '../WordMeaning.svelte';

	let { word, typedWord, settings }: { typedWord: string; word: Word; settings: MindDojoSettings } =
		$props();

	let baseStyles = $derived(
		Array(word.word.length)
			.fill(null)
			.map(() => getBaseStyle(settings))
	);

	function generateRandomShiftOfWordPosition() {
		if (settings.displayMode === 'full-word') return '';
		if (!settings.randomlyMoveWordStarting) return '';
		if (word.word.length >= 25) return '';

		const possibleShifts = [0, 3, 5, 7, 8, 10, 12, 13, 16, 20, 24, 26, 30, 34, 35];
		const shift = possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
		const direction = Math.random() < 0.5 ? -1 : 1;

		return `transform: translateX(${direction * shift * 0.25}rem);`;
		// Tailwind spacing scale: 1 = 0.25rem
	}
</script>

<div class=" flex" style={generateRandomShiftOfWordPosition()}>
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
