<script lang="ts">
	import '../app.css';

	let { children } = $props();

	const fonts = [
		{ family: 'Montserrat', weights: 'wght@400;700', cssVar: '--font-montserrat' },
		{ family: 'Roboto', weights: 'wght@400;700', cssVar: '--font-roboto' },
		{ family: 'Fira+Code', weights: '', cssVar: '--font-fira' },
		{ family: 'Pacifico', weights: '', cssVar: '--font-pacifico' },
		{ family: 'Indie+Flower', weights: '', cssVar: '--font-indie' },
		{ family: 'Rubik+Moonrocks', weights: '', cssVar: '--font-rubik' },
		{ family: 'Press+Start+2P', weights: '', cssVar: '--font-press' },
		{ family: 'Monoton', weights: '', cssVar: '--font-monoton' },
		{ family: 'Oi', weights: '', cssVar: '--font-oi' }
	];

	// Function to build Google Fonts URL
	function buildFontUrl(family: string, weights: string) {
		return `https://fonts.googleapis.com/css2?family=${family}${weights ? ':' + weights : ''}&display=swap`;
	}

	const cssVariables = fonts
		.map(({ family, cssVar }) => `${cssVar}: '${family.replace(/\+/g, ' ')}', sans-serif;`)
		.join('\n');

	let isDarkMode = $state(Boolean(localStorage.getItem('mode') || ''));
</script>

<svelte:head>
	{#each fonts as { family, weights }}
		<link href={buildFontUrl(family, weights)} rel="stylesheet" />
	{/each}
	<style>
		:root {
		  {@html cssVariables}
		}
	</style>
</svelte:head>

<div class={'relative h-screen w-full ' + (isDarkMode ? 'bg-neutral-800' : 'bg-amber-50')}>
	<div class="absolute right-4 bottom-8 z-50 w-5 object-contain">
		<button
			class="cursor-pointer"
			onclick={() => {
				isDarkMode = !isDarkMode;
				localStorage.setItem('mode', isDarkMode ? '1' : '');
			}}
		>
			<img src="/on.webp" alt="On" class={'' + (!isDarkMode ? 'hidden' : '')} />
			<img src="/off.png" alt="Dark" class={'' + (!isDarkMode ? '' : 'hidden')} />
		</button>
	</div>
	{@render children()}
</div>
