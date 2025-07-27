<script lang="ts">
	import type { MindDojoSettings, Word } from '$lib/structure';
	import { getContext } from 'svelte';
	import Letter from './Letter.svelte';
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
		<div class="relative flex flex-col">
			<div class="flex">
				{#each word.word as letter, index}
					<Letter
						{letter}
						letterIndex={index}
						typedLetter={typedWord.at(index)!}
						typedLetterIndex={typedWord.length}
						baseStyle={baseStyles[index]}
					/>
				{/each}
			</div>
			<div
				class="absolute bottom-0 left-0 flex w-full translate-y-[110%] place-items-center justify-center align-middle"
			>
				<div
					class="bg-opacity-70 no-scrollbar mx-auto h-fit max-h-[200px] w-full max-w-[400px] overflow-y-scroll rounded-xl bg-neutral-600 p-4 backdrop-blur-sm"
				>
					<div class="flex flex-col gap-1 text-neutral-400">
						{#each word.meanings as [partOfSpeech, definition, synonyms, examples]}
							<div class="border-b border-neutral-500 py-2 last:border-0">
								<span
									class="w-fit rounded-md border border-neutral-500 p-1 px-2 text-xs font-bold text-white"
								>
									{partOfSpeech}
								</span>
								<p class="mt-1 text-neutral-200">{definition}</p>

								{#if examples.length}
									<div class="mt-2 flex flex-col flex-wrap">
										{#each examples as example}
											<p class="text-sm font-medium text-neutral-300 italic">"{example}"</p>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Synonyms (per meaning) -->
							{#if synonyms.length}
								<div class="mt-2 flex flex-wrap gap-2">
									{#each synonyms as syn}
										<span class="rounded-md bg-green-500 p-1 text-sm font-medium text-white"
											>{syn}</span
										>
									{/each}
								</div>
							{/if}
						{/each}

						<!-- Antonyms (global) -->
						{#if word.antonyms.length}
							<div class="mt-2 flex flex-wrap gap-2">
								{#each word.antonyms as ant}
									<span class="rounded-md bg-red-500 p-1 text-sm font-medium text-white">{ant}</span
									>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
