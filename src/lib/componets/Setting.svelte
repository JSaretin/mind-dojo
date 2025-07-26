<script lang="ts">
	export interface LetterStyleSettings {
		randomSize: boolean;
		randomWeight: boolean;
		randomFont: boolean;
		randomTransform: boolean;
		randomColor: boolean;
		letterDisplayDirection: 'left-to-right' | 'center';
	}

	export interface VoiceSettings {
		sayCurrentWord: boolean;
		focusOnVoice: boolean;
		focusOnLetter: boolean;
	}

	export interface WordMixSettings {
		includeNumbers: boolean;
		numberMode: 'smart' | 'random';
		includeUppercase: boolean;
		includeLowercase: boolean;
	}

	export interface MindDojoSettings {
		speed: number;
		sameLetterDelayPercent: number;
		excludeLetters: string;
		displayMode: 'letter-by-letter' | 'full-word';
		letterStyle: LetterStyleSettings;
		voice: VoiceSettings;
		wordMix: WordMixSettings;
		hideProgressBar: boolean;
		hideTimer: boolean;
		restartLevelOnError: boolean;
		showNewWordOnError: boolean;
		hideTypedLetter: boolean;
	}

	let { settings = $bindable() }: { settings: MindDojoSettings } = $props();

	const displayModes = ['letter-by-letter', 'full-word'] as const;
	const letterDisplayOptions = ['left-to-right', 'center'] as const;
	const numberModes = ['smart', 'random'] as const;
</script>

<section class="mx-auto max-w-2xl space-y-6 rounded-md p-4 text-neutral-500 shadow">
	<h2 class="text-xl font-bold text-neutral-950">MindDojo Settings</h2>

	<!-- Speed -->
	<div>
		<label class="mb-1 block font-semibold" for="speed">Typing Speed (higher = faster)</label>
		<input
			type="number"
			min="0.1"
			step="0.1"
			bind:value={settings.speed}
			class="w-full rounded border p-2"
			id="speed"
		/>
	</div>

	<!-- Same Letter Delay -->
	<div>
		<label class="mb-1 block font-semibold" for="sameLetterDelayPercent">Same Letter Delay %</label>
		<input
			type="range"
			min="0"
			max="100"
			bind:value={settings.sameLetterDelayPercent}
			class="w-full"
			id="sameLetterDelayPercent"
		/>
		<p class="text-sm text-neutral-600">{settings.sameLetterDelayPercent}%</p>
	</div>

	<!-- Exclude Letters -->
	<div>
		<label class="mb-1 block font-semibold" for="excludeLetters">Exclude Letters</label>
		<input
			type="text"
			bind:value={settings.excludeLetters}
			placeholder="e.g. abcxyz"
			class="w-full rounded border p-2"
			id="excludeLetters"
		/>
	</div>

	<!-- Display Mode -->
	<div>
		<label class="mb-1 block font-semibold" for="displayMode">Display Mode</label>
		<select bind:value={settings.displayMode} class="w-full rounded border p-2" id="displayMode">
			{#each displayModes as mode}
				<option value={mode}>{mode}</option>
			{/each}
		</select>
	</div>

	<!-- Letter Style Settings (only if letter-by-letter) -->
	{#if settings.displayMode === 'letter-by-letter'}
		<div class="space-y-2">
			<p class="font-semibold">Letter Style</p>
			<label>
				<input type="checkbox" bind:checked={settings.letterStyle.randomSize} /> Random Size
			</label>
			<br />
			<label>
				<input type="checkbox" bind:checked={settings.letterStyle.randomWeight} /> Random Weight
			</label>
			<br />
			<label>
				<input type="checkbox" bind:checked={settings.letterStyle.randomFont} /> Random Font
			</label>
			<br />
			<label>
				<input type="checkbox" bind:checked={settings.letterStyle.randomTransform} /> Random Transform
			</label>
			<br />
			<label>
				<input type="checkbox" bind:checked={settings.letterStyle.randomColor} /> Random Color
			</label>
			<div class="mt-2">
				<label class="mb-1 block font-semibold" for="letterDisplayDirection"
					>Letter Display Direction</label
				>
				<select
					bind:value={settings.letterStyle.letterDisplayDirection}
					class="w-full rounded border p-2"
					id="letterDisplayDirection"
				>
					{#each letterDisplayOptions as dir}
						<option value={dir}>{dir}</option>
					{/each}
				</select>
			</div>
		</div>
	{/if}

	<!-- Voice Settings -->
	<div class="space-y-2">
		<p class="font-semibold">Voice</p>
		<label>
			<input type="checkbox" bind:checked={settings.voice.sayCurrentWord} /> Say Current Word
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.voice.focusOnVoice} /> Focus on Voice
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.voice.focusOnLetter} /> Focus on Letter
		</label>
	</div>

	<!-- Word Mix -->
	<div class="space-y-2">
		<p class="font-semibold">Word Mix</p>
		<label>
			<input type="checkbox" bind:checked={settings.wordMix.includeNumbers} /> Include Numbers
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.wordMix.includeUppercase} /> Include Uppercase
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.wordMix.includeLowercase} /> Include Lowercase
		</label>
		<div class="mt-2">
			<label class="mb-1 block font-semibold" for="numberMode">Number Mode</label>
			<select
				bind:value={settings.wordMix.numberMode}
				class="w-full rounded border p-2"
				id="numberMode"
			>
				{#each numberModes as mode}
					<option value={mode}>{mode}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- UI / Logic Toggles -->
	<div class="space-y-2">
		<p class="font-semibold">UI & Behavior</p>
		<label>
			<input type="checkbox" bind:checked={settings.hideProgressBar} /> Hide Progress Bar
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.hideTimer} /> Hide Timer
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.restartLevelOnError} /> Restart Level on Error
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.showNewWordOnError} /> Show New Word on Error
		</label>
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.hideTypedLetter} /> Hide Typed Letter
		</label>
	</div>
</section>
