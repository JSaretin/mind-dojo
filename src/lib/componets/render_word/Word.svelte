<script lang="ts">
	import type { MindDojoSettings, Word } from '$lib/structure';
	import Letter from './Letter.svelte';
	import WordMeaning from '../WordMeaning.svelte';

	let {
		word,
		typedWord,
		settings,
		baseStyles,
		wordTransform
	}: {
		typedWord: string;
		word: Word;
		settings: MindDojoSettings;
		baseStyles: string[];
		wordTransform: string;
	} = $props();
</script>

<div class={'flex ' + (word.word.length >= 25 ? 'scale-90' : '')} style={wordTransform}>
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
			{#if !settings.joinRandomLetters}
				<WordMeaning {word} />
			{/if}
		</div>
	{/if}
</div>
