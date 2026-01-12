<script lang="ts">
	import type { MindDojoSettings } from '$lib/structure';

	let { settings = $bindable() }: { settings: MindDojoSettings } = $props();

	const displayModes = ['letter-by-letter', 'full-word'] as const;
	const letterDisplayOptions = ['left-to-right', 'center'] as const;
	const numberModes = ['smart', 'random'] as const;
</script>

<section class="mx-auto max-w-2xl space-y-6 rounded-md p-4 text-neutral-500 shadow">
	<h2 class="text-xl font-bold text-neutral-950">MindDojo Settings</h2>

	<!-- Speed -->
	<div>
		<label class="mb-1 block font-semibold" for="speed"
			>Typing Speed (higher = faster) ({((settings.speed || 0) * 12).toFixed(2)} WPM)</label
		>
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

	<!-- Game Mode Setting -->
	<div class="space-y-2">
		<p class="font-semibold">Chaos Mode Settings</p>

		<label>
			<input type="checkbox" bind:checked={settings.franticMode} /> Enable Chaos Mode
		</label>
		<br />

		{#if settings.franticMode}
			<!-- Select / Deselect All -->
			<label>
				<input type="checkbox" bind:checked={settings.franticSettings.shouldChangeDisplayMode} />
				Toggle Word Display Mode
			</label>
			<br />

			<label>
				<input type="checkbox" bind:checked={settings.franticSettings.shouldChangeLetterStyle} />
				Randomize Letter Style
			</label>
			<br />

			<label>
				<input
					type="checkbox"
					bind:checked={settings.franticSettings.shouldChangeProgressBarVisibility}
				/>
				Toggle Progress Bar Visibility
			</label>
			<br />

			<label>
				<input
					type="checkbox"
					bind:checked={settings.franticSettings.shouldChangeTimerVisibility}
				/>
				Toggle Timer Visibility
			</label>
			<br />

			<label>
				<input type="checkbox" bind:checked={settings.franticSettings.shouldChangeRestartOnError} />
				Toggle Restart on Error
			</label>
			<br />

			<label>
				<input
					type="checkbox"
					bind:checked={settings.franticSettings.shouldChangeRandomWordPosition}
				/>
				Randomize Word Position
			</label>
			<br />

			<label>
				<input
					type="checkbox"
					bind:checked={settings.franticSettings.shouldChangeHideTypedLetter}
				/>
				Toggle Hide Typed Letter
			</label>
			<br />

			<label>
				<input type="checkbox" bind:checked={settings.franticSettings.shouldChangeWordLength} />
				Randomize Word Length
			</label>
			<br />
		{/if}
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

	<!-- Level Setting / Toggle -->
	<div class="space-y-2">
		<p class="font-semibold">Word Setting</p>
		<div>
			<label class="mb-1 block font-semibold" for="minWordLenth">Min Word Length</label>
			<input
				type="range"
				min="1"
				max="30"
				bind:value={settings.minWordLength}
				class="w-full"
				id="minWordLenth"
			/>
			<p class="text-sm text-neutral-600">{settings.minWordLength}</p>
		</div>
		<div>
			<label class="mb-1 block font-semibold" for="maxWordLenth">Max Word Length</label>
			<input
				type="range"
				min="1"
				max="30"
				bind:value={settings.maxWordLength}
				class="w-full"
				id="maxWordLenth"
			/>
			<p class="text-sm text-neutral-600">{settings.maxWordLength}</p>
		</div>
		<label>
			<input type="checkbox" bind:checked={settings.joinRandomLetters} /> Join Random Letter To Make
			A Word
		</label>
		<br />
		{#if settings.joinRandomLetters}
			<label>
				<input type="checkbox" bind:checked={settings.mixJoinRandomLetters} /> Mix Random Word With Normal
				Word
			</label>
			<br />
		{/if}
		<label>
			<input type="checkbox" bind:checked={settings.randomlyMoveWordStarting} /> Position Word Randomly
			On X Axis
		</label>
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

	<!-- Game Memory Setting -->
	<div class="space-y-2">
		<p class="font-semibold">Game Memory Setting</p>
		<label>
			<input type="checkbox" bind:checked={settings.saveTypedWord} /> Save Shown Words On Device
		</label>
	</div>

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

	<!-- Feedback Setting / Toggle -->
	<div class="space-y-2">
		<p class="font-semibold">Feedback Setting</p>
		<label>
			<input type="checkbox" bind:checked={settings.noFeedbackSound} /> No Feedback Sound
		</label>
		{#if settings.displayMode === 'letter-by-letter' && settings.letterStyle.letterDisplayDirection === 'center'}
			<br />
			<label>
				<input type="checkbox" bind:checked={settings.noSuccessFeedbackSound} /> No success feedback
			</label>
		{/if}
	</div>

	<!-- Level Setting / Toggle -->
	<div class="space-y-2">
		<p class="font-semibold">Level Setting</p>
		<label>
			<input type="checkbox" bind:checked={settings.typeRestartLevelOnErrorOnLevelCompletion} /> Type
			Restart Leve On Error After Level Completion
		</label>
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
		<br />
		<label>
			<input type="checkbox" bind:checked={settings.displayLetterInUpperCase} /> Display Letter In Upper
			Case
		</label>
	</div>

	<!-- Focus Area -->
	<!-- <div class="space-y-2">
		<p class="font-semibold">Focus Area</p>
		<label>
			Exclude Keys
			<input type="text" bind:value={settings.focusKeys.excludeKeys} />
		</label>
	</div> -->
</section>
