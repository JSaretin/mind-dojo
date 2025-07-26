<script lang="ts">
	import { getContext } from 'svelte';
	import type { MindDojoSettings } from '$lib/mind-dojo.svelte';
	import { getRandomColor } from '$lib/style';
	import { getRandomChar } from '$lib';

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

	function getStyle(baseClass: string) {
		const isFullWord = settings.displayMode === 'full-word';

		// Current letter being typed
		if (letterIndex === typedLetterIndex) {
			const color = isFullWord
				? 'text-neutral-100'
				: settings.letterStyle?.randomColor
					? getRandomColor()
					: 'text-black';
			return `${baseClass} ${color}`;
		}

		// Letter not yet typed
		if (!typedLetter) {
			const style = isFullWord ? 'text-neutral-600' : 'opacity-0';
			return `${baseClass} ${style}`;
		}

		// Letter has been typed
		const isCorrect = typedLetter === letter;
		const color = isCorrect ? (isFullWord ? 'text-green-400' : 'text-neutral-700') : 'text-red-400';
		let visibility = 'opacity-40';
		if (settings.hideTypedLetter && !isFullWord) {
			visibility = 'opacity-0';
		}

		return `${baseClass} ${color} ${visibility}`;
	}

	let style = $state('');

	$effect(() => {
		style = getStyle(baseStyle);

		if (letterIndex !== typedLetterIndex) return;
		if (!settings.voice.focusOnVoice) return;

		displayLetter = getRandomChar();
	});
</script>

<div class="flex place-items-center justify-center align-middle">
	<h1 class={style}>
		{displayLetter}
	</h1>
</div>
