<script lang="ts">
	import { getContext } from 'svelte';
	import { getRandomColor } from '$lib/style';
	import { getRandomChar } from '$lib';
	import type { MindDojoSettings } from '$lib/structure';

	let {
		letter,
		letterIndex,
		typedLetterIndex,
		typedLetter,
		baseStyle,
		isSigleLetterMode = $bindable(false)
	}: {
		letter: string;
		letterIndex: number;
		typedLetterIndex: number;
		typedLetter: string;
		baseStyle: string;
		isSigleLetterMode?: boolean;
	} = $props();

	let displayLetter = $derived(letter);

	const settingFunction: () => MindDojoSettings = getContext('settings');

	const settings: MindDojoSettings = $derived(settingFunction());

	// Generate stable base classes per letter, but consider settings to control randomness

	function getStyleAndInline(baseClass: string): { cls: string; inline: string } {
		const isFullWord = settings.displayMode === 'full-word';

		// Current letter being typed
		if (letterIndex === typedLetterIndex) {
			if (!isFullWord && settings.letterStyle?.randomColor) {
				const color = getRandomColor();
				return { cls: `${baseClass} ${color}`, inline: `filter: drop-shadow(0 0 12px var(--theme-letter-glow, rgba(251,191,36,0.4)));` };
			}
			return {
				cls: baseClass,
				inline: `color: var(--theme-letter-active, #fef3c7); filter: drop-shadow(0 0 12px var(--theme-letter-glow, rgba(251,191,36,0.4)));`,
			};
		}

		// Letter not yet typed
		if (!typedLetter) {
			if (isFullWord) {
				// Remaining letters: visible but subdued so you can see what's ahead
				return { cls: baseClass, inline: `color: var(--theme-letter-untyped, #6b7280);` };
			}
			return { cls: `${baseClass} opacity-0`, inline: '' };
		}

		// Letter has been typed
		const isCorrect = typedLetter === letter;
		let visibility = 'opacity-40';
		if (isFullWord) {
			// Full-word mode: typed letters fade out so focus stays on the current letter
			visibility = 'opacity-20';
		} else if (settings.hideTypedLetter) {
			visibility = 'opacity-0';
		}
		if (!isCorrect) {
			return { cls: `${baseClass} text-red-400 ${visibility}`, inline: '' };
		}
		return { cls: `${baseClass} ${visibility}`, inline: `color: var(--theme-letter-typed, #525252);` };
	}

	let style = $state('');
	let inlineStyle = $state('');

	$effect(() => {
		const result = getStyleAndInline(baseStyle);
		style = result.cls;
		inlineStyle = result.inline;

		if (letterIndex !== typedLetterIndex) return;
		if (!settings.voice.focusOnVoice) return;

		displayLetter = getRandomChar();
	});
</script>

<div class="flex place-items-center justify-center align-middle">
	<h1 class={style} style={inlineStyle}>
		{displayLetter}
	</h1>
</div>
