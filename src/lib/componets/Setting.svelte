<script lang="ts">
	import type { MindDojoSettings } from '$lib/structure';
	import { themes, applyTheme, loadTheme } from '$lib/theme';
	import { getContext } from 'svelte';
	import type { MindDojo } from '$lib/mind-dojo.svelte';

	let { settings = $bindable() }: { settings: MindDojoSettings } = $props();
	const getMindDojo: () => MindDojo = getContext('mindDojo');
	let mindDojo = $derived(getMindDojo());
	let currentTheme = $state(loadTheme());

	const letterDisplayOptions = ['left-to-right', 'center'] as const;
	const numberModes = ['smart', 'random'] as const;

	let activeTab: 'core' | 'audio' | 'ui' | 'theme' = $state('core');

	const tabs = [
		{ key: 'core' as const, label: 'Core', icon: '&#9889;' },
		{ key: 'audio' as const, label: 'Audio', icon: '&#9835;' },
		{ key: 'ui' as const, label: 'UI', icon: '&#9881;' },
		{ key: 'theme' as const, label: 'Theme', icon: '&#9728;' },
	];

	type GameMode = 'letter-by-letter' | 'full-word' | 'chaos';
	let gameMode: GameMode = $derived(
		settings.franticMode ? 'chaos' : settings.displayMode === 'full-word' ? 'full-word' : 'letter-by-letter'
	);

	function setGameMode(mode: GameMode) {
		if (mode === 'chaos') {
			mindDojo.enableChaosMode();
			settings = mindDojo.settings;
		} else {
			if (settings.franticMode) {
				mindDojo.disableChaosMode();
				settings = mindDojo.settings;
			}
			settings.displayMode = mode === 'full-word' ? 'full-word' : 'letter-by-letter';
		}
	}
</script>

<!-- Tab bar -->
<div class="mb-6 flex gap-1 rounded-lg bg-surface-hover p-1">
	{#each tabs as tab}
		<button
			onclick={() => (activeTab = tab.key)}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all {activeTab === tab.key
				? 'bg-accent text-black shadow-lg shadow-accent/20'
				: 'text-base-text-muted hover:bg-surface-hover hover:text-accent'}"
		>
			<span class="text-base">{@html tab.icon}</span>
			<span>{tab.label}</span>
		</button>
	{/each}
</div>

<div class="space-y-5">
	<!-- CORE TAB -->
	{#if activeTab === 'core'}
		<!-- Auto Speed -->
		<div class="rounded-lg border {settings.autoSpeed ? 'border-green-500/50' : 'border-base-border'} bg-surface-hover/50 p-4">
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm font-bold text-accent">Auto Speed</span>
					<p class="mt-0.5 text-[10px] text-base-text-muted">
						{#if settings.autoSpeed}
							Cycling: Base ({settings.autoSpeedBase.toFixed(2)}x) → Flow ({(settings.autoSpeedBase * 1.1).toFixed(2)}x) → Challenge ({(settings.autoSpeedBase * 1.25).toFixed(2)}x)
						{:else}
							Automatically cycles through Base / Flow / Challenge zones. Calibrates to your performance.
						{/if}
					</p>
				</div>
				<label class="relative inline-flex cursor-pointer items-center">
					<input
						type="checkbox"
						checked={settings.autoSpeed}
						onchange={(e) => {
							if ((e.target as HTMLInputElement).checked) {
								mindDojo.enableAutoSpeed();
							} else {
								mindDojo.disableAutoSpeed();
							}
						}}
						class="peer sr-only"
					/>
					<div class="peer h-5 w-9 rounded-full bg-surface-hover after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-base-text-muted after:transition-all peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-checked:after:bg-black"></div>
				</label>
			</div>
			{#if settings.autoSpeed}
				<div class="mt-3 flex items-center gap-3">
					<div class="flex-1">
						<div class="mb-1 flex items-center justify-between text-[10px]">
							<span class="text-base-text-muted">Base speed</span>
							<span class="font-mono text-accent">{settings.autoSpeedBase.toFixed(2)}x</span>
						</div>
						<input
							type="number"
							min="0.5"
							step="0.1"
							bind:value={settings.autoSpeedBase}
							class="w-full rounded-md border border-base-border bg-surface px-2 py-1.5 font-mono text-sm text-base-text focus:border-accent focus:outline-none"
						/>
					</div>
					<div class="flex flex-col gap-1 text-[10px]">
						<span class="text-green-400">Flow: {(settings.autoSpeedBase * 1.1).toFixed(2)}x</span>
						<span class="text-red-400">Challenge: {(settings.autoSpeedBase * 1.25).toFixed(2)}x</span>
					</div>
				</div>
				<div class="mt-2 flex gap-1">
					{#each [
						{ label: 'Base', weight: 10, color: 'bg-blue-500' },
						{ label: 'Flow', weight: 20, color: 'bg-green-500' },
						{ label: 'Push', weight: 5, color: 'bg-red-500' },
						{ label: 'Rest', weight: 5, color: 'bg-blue-500' },
					] as phase, i}
						<div
							class="h-1.5 rounded-full {phase.color} {i === 0 ? 'opacity-100' : 'opacity-40'}"
							style="flex: {phase.weight};"
							title={phase.label}
						></div>
					{/each}
				</div>
				<div class="mt-1 flex justify-between text-[8px] text-base-text-muted">
					<span>Warm-up</span>
					<span>Flow</span>
					<span>Push</span>
					<span>Rest</span>
				</div>
			{/if}
		</div>

		<!-- Speed (manual) -->
		{#if !settings.autoSpeed}
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<div class="mb-3 flex items-center justify-between">
				<span class="text-sm font-bold text-accent">Typing Speed</span>
				<div class="flex items-center gap-2">
					{#if settings.lockedMinSpeed > 0}
						<span class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">min {settings.lockedMinSpeed.toFixed(2)}x</span>
					{/if}
					<span class="rounded-md bg-accent-muted px-2 py-0.5 font-mono text-sm font-bold text-accent">
						{((settings.speed || 0) * 12).toFixed(1)} WPM
					</span>
				</div>
			</div>
			<input
				type="number"
				min={settings.lockedMinSpeed > 0 ? settings.lockedMinSpeed : 0.1}
				step="0.1"
				bind:value={settings.speed}
				onchange={() => {
					if (settings.lockedMinSpeed > 0 && settings.speed < settings.lockedMinSpeed) {
						settings.speed = settings.lockedMinSpeed;
					}
				}}
				class="w-full rounded-md border border-base-border bg-surface px-3 py-2 font-mono text-base-text focus:border-accent focus:outline-none"
			/>
		</div>
		{/if}

		<!-- Same Letter Delay -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<div class="mb-2 flex items-center justify-between">
				<span class="text-sm font-bold text-accent">Same Letter Delay</span>
				<span class="font-mono text-sm text-base-text">{settings.sameLetterDelayPercent}%</span>
			</div>
			<input
				type="range" min="0" max="100"
				bind:value={settings.sameLetterDelayPercent}
				class="w-full accent-accent"
			/>
		</div>

		<!-- Game Mode -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Game Mode</span>
			<div class="flex gap-2">
				{#each [
					{ key: 'letter-by-letter' as GameMode, label: 'Letter by Letter' },
					{ key: 'full-word' as GameMode, label: 'Full Word' },
					{ key: 'chaos' as GameMode, label: 'Chaos' },
				] as mode}
					<button
						onclick={() => setGameMode(mode.key)}
						class="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-all {gameMode === mode.key
							? mode.key === 'chaos'
								? 'border-red-500 bg-red-500/15 text-red-400'
								: 'border-accent bg-accent-muted text-accent'
							: 'border-base-border text-base-text-muted hover:border-accent/50 hover:text-accent'}"
					>
						{mode.label}
					</button>
				{/each}
			</div>

			<!-- Letter-by-Letter settings -->
			{#if gameMode === 'letter-by-letter'}
				<div class="mt-4 space-y-4 border-t border-base-border pt-4">
					<div>
						<span class="mb-2 block text-xs font-bold text-base-text-muted uppercase tracking-wide">Letter Direction</span>
						<div class="flex gap-2">
							{#each letterDisplayOptions as dir}
								<button
									onclick={() => (settings.letterStyle.letterDisplayDirection = dir)}
									class="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-all {settings.letterStyle.letterDisplayDirection === dir
										? 'border-accent bg-accent-muted text-accent'
										: 'border-base-border text-base-text-muted hover:border-accent/50'}"
								>
									{dir === 'left-to-right' ? 'Left to Right' : 'Center'}
								</button>
							{/each}
						</div>
					</div>

					<div>
						<span class="mb-2 block text-xs font-bold text-base-text-muted uppercase tracking-wide">Letter Randomization</span>
						<div class="grid grid-cols-2 gap-2">
							{#each [
								{ label: 'Random size', bind: 'randomSize' },
								{ label: 'Random weight', bind: 'randomWeight' },
								{ label: 'Random font', bind: 'randomFont' },
								{ label: 'Random transform', bind: 'randomTransform' },
								{ label: 'Random color', bind: 'randomColor' },
							] as item}
								<label class="flex cursor-pointer items-center gap-2 rounded-md border border-base-border px-3 py-2 transition-colors hover:border-accent/30 hover:bg-accent-muted">
									<input
										type="checkbox"
										checked={settings.letterStyle[item.bind as keyof typeof settings.letterStyle] as boolean}
										onchange={(e) => {
											(settings.letterStyle as any)[item.bind] = (e.target as HTMLInputElement).checked;
											settings = settings;
										}}
										class="accent-accent"
									/>
									<span class="text-xs text-base-text">{item.label}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Chaos settings -->
			{#if gameMode === 'chaos'}
				<div class="mt-4 space-y-3 border-t border-red-500/20 pt-4">
					<p class="text-xs text-red-300">Settings mutate randomly every word. Choose what changes:</p>
					<div class="grid grid-cols-2 gap-2">
						{#each [
							{ label: 'Display mode', bind: 'shouldChangeDisplayMode' },
							{ label: 'Letter style', bind: 'shouldChangeLetterStyle' },
							{ label: 'Progress bar', bind: 'shouldChangeProgressBarVisibility' },
							{ label: 'Timer', bind: 'shouldChangeTimerVisibility' },
							{ label: 'Restart on error', bind: 'shouldChangeRestartOnError' },
							{ label: 'Word position', bind: 'shouldChangeRandomWordPosition' },
							{ label: 'Hide typed', bind: 'shouldChangeHideTypedLetter' },
							{ label: 'Word length', bind: 'shouldChangeWordLength' },
						] as item}
							<label class="flex cursor-pointer items-center gap-2 rounded-md border border-base-border px-3 py-2 transition-colors hover:border-red-500/30 hover:bg-red-500/5">
								<input
									type="checkbox"
									checked={settings.franticSettings[item.bind as keyof typeof settings.franticSettings]}
									onchange={(e) => {
										(settings.franticSettings as any)[item.bind] = (e.target as HTMLInputElement).checked;
										settings = settings;
									}}
									class="accent-red-500"
								/>
								<span class="text-xs text-base-text">{item.label}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Shared: uppercase toggle -->
			<div class="mt-4 border-t border-base-border pt-3">
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.displayLetterInUpperCase} class="accent-accent" />
					<span class="text-sm text-base-text">Display letters in uppercase</span>
				</label>
			</div>
		</div>

		<!-- Word Source -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Word Source</span>
			<div class="flex gap-2">
				{#each [
					{ key: 'dictionary' as const, label: 'All', desc: 'Full dictionary' },
					{ key: 'seen' as const, label: 'Seen', desc: 'Typed before' },
					{ key: 'unseen' as const, label: 'New', desc: 'Never typed' },
				] as src}
					<button
						onclick={() => {
							settings.wordSource = src.key;
							if (src.key === 'seen' || src.key === 'unseen') mindDojo.loadSeenWords();
						}}
						class="flex-1 rounded-md border px-3 py-2 text-left transition-all {settings.wordSource === src.key
							? 'border-accent bg-accent-muted text-accent'
							: 'border-base-border text-base-text-muted hover:border-accent/50 hover:text-accent'}"
					>
						<span class="block text-sm font-medium">{src.label}</span>
						<span class="block text-xs text-base-text-muted">{src.desc}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Word Settings -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Word Length</span>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<div class="mb-1 flex justify-between text-xs text-base-text-muted">
						<span>Min</span>
						<span class="font-mono text-accent">{settings.minWordLength}</span>
					</div>
					<input type="range" min="1" max="30" bind:value={settings.minWordLength} class="w-full accent-accent" />
				</div>
				<div>
					<div class="mb-1 flex justify-between text-xs text-base-text-muted">
						<span>Max</span>
						<span class="font-mono text-accent">{settings.maxWordLength}</span>
					</div>
					<input type="range" min="1" max="30" bind:value={settings.maxWordLength} class="w-full accent-accent" />
				</div>
			</div>

			<div class="mt-4 space-y-2">
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.joinRandomLetters} class="accent-accent" />
					<span class="text-sm text-base-text">Random letter words</span>
				</label>
				{#if settings.joinRandomLetters}
					<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 pl-8 transition-colors hover:bg-surface-hover/50">
						<input type="checkbox" bind:checked={settings.mixJoinRandomLetters} class="accent-accent" />
						<span class="text-sm text-base-text">Mix with real words</span>
					</label>
				{/if}
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.randomlyMoveWordStarting} class="accent-accent" />
					<span class="text-sm text-base-text">Random X position</span>
				</label>
			</div>
		</div>

		<!-- Exclude Letters -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-2 block text-sm font-bold text-accent">Exclude Letters</span>
			<input
				type="text"
				bind:value={settings.excludeLetters}
				placeholder="e.g. abcxyz"
				class="w-full rounded-md border border-base-border bg-surface px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-accent focus:outline-none"
			/>
		</div>

		<!-- Word Mix -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Word Mix</span>
			<div class="space-y-2">
				{#each [
					{ label: 'Include numbers', bind: () => settings.wordMix.includeNumbers, set: (v: boolean) => settings.wordMix.includeNumbers = v },
					{ label: 'Include uppercase', bind: () => settings.wordMix.includeUppercase, set: (v: boolean) => settings.wordMix.includeUppercase = v },
					{ label: 'Include lowercase', bind: () => settings.wordMix.includeLowercase, set: (v: boolean) => settings.wordMix.includeLowercase = v },
				] as item}
					<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
						<input type="checkbox" checked={item.bind()} onchange={(e) => item.set((e.target as HTMLInputElement).checked)} class="accent-accent" />
						<span class="text-sm text-base-text">{item.label}</span>
					</label>
				{/each}
			</div>
			<div class="mt-3 flex gap-2">
				{#each numberModes as mode}
					<button
						onclick={() => (settings.wordMix.numberMode = mode)}
						class="flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-all {settings.wordMix.numberMode === mode
							? 'border-accent bg-accent-muted text-accent'
							: 'border-base-border text-base-text-muted hover:border-accent/50'}"
					>
						{mode.charAt(0).toUpperCase() + mode.slice(1)}
					</button>
				{/each}
			</div>
		</div>

	<!-- AUDIO TAB -->
	{:else if activeTab === 'audio'}
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Voice</span>
			<div class="space-y-2">
				{#each [
					{ label: 'Say current word', bind: () => settings.voice.sayCurrentWord, set: (v: boolean) => settings.voice.sayCurrentWord = v },
					{ label: 'Focus on voice', bind: () => settings.voice.focusOnVoice, set: (v: boolean) => settings.voice.focusOnVoice = v },
					{ label: 'Focus on letter', bind: () => settings.voice.focusOnLetter, set: (v: boolean) => settings.voice.focusOnLetter = v },
				] as item}
					<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
						<input type="checkbox" checked={item.bind()} onchange={(e) => item.set((e.target as HTMLInputElement).checked)} class="accent-accent" />
						<span class="text-sm text-base-text">{item.label}</span>
					</label>
				{/each}
			</div>
		</div>

		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Sound Feedback</span>
			<div class="space-y-2">
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.noFeedbackSound} class="accent-accent" />
					<span class="text-sm text-base-text">Mute all feedback</span>
				</label>
				{#if settings.displayMode === 'letter-by-letter' && settings.letterStyle.letterDisplayDirection === 'center'}
					<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
						<input type="checkbox" bind:checked={settings.noSuccessFeedbackSound} class="accent-accent" />
						<span class="text-sm text-base-text">Mute success sound</span>
					</label>
				{/if}
			</div>
		</div>

	<!-- UI TAB -->
	{:else if activeTab === 'ui'}
		<!-- Timer -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Timer</span>
			<div class="space-y-2">
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.stealthTimer} class="accent-accent" />
					<div>
						<span class="text-sm text-base-text">Stealth timer</span>
						<p class="text-[10px] text-base-text-muted">Hides numbers and colors — can't predict word length</p>
					</div>
				</label>
			</div>
		</div>

		<!-- Session & Rest -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Session & Rest Cycle</span>
			<div class="space-y-4">
				<div>
					<div class="mb-1 flex items-center justify-between text-xs">
						<span class="text-base-text-muted">Training</span>
						<span class="font-mono text-base-text">
							{settings.sessionDuration > 0 ? `${settings.sessionDuration} min` : 'Unlimited'}
						</span>
					</div>
					<input
						type="range" min="0" max="120" step="5"
						bind:value={settings.sessionDuration}
						class="w-full accent-accent"
					/>
				</div>
				<div>
					<div class="mb-1 flex items-center justify-between text-xs">
						<span class="text-base-text-muted">Rest</span>
						<span class="font-mono text-base-text">
							{settings.restDuration > 0 ? `${settings.restDuration} min` : 'Skip'}
						</span>
					</div>
					<input
						type="range" min="0" max="30" step="1"
						bind:value={settings.restDuration}
						class="w-full accent-accent"
					/>
				</div>
				<p class="text-[10px] text-base-text-muted">
					{#if settings.sessionDuration > 0 && settings.restDuration > 0}
						Train for {settings.sessionDuration}min, rest for {settings.restDuration}min with a journal prompt, repeat.
					{:else if settings.sessionDuration > 0}
						Train for {settings.sessionDuration}min, then choose to continue or stop.
					{:else}
						Unlimited session. No automatic breaks.
					{/if}
				</p>

				<!-- Auto fatigue detection -->
				<div class="mt-3 flex items-center justify-between border-t border-base-border pt-3">
					<div>
						<span class="text-xs text-base-text">Auto fatigue detection</span>
						<p class="text-[10px] text-base-text-muted">Pause when your accuracy drops 20+ points below your session peak</p>
					</div>
					<button
						onclick={() => { settings.autoFatigueRest = !settings.autoFatigueRest; }}
						class="rounded-full px-3 py-1 text-[10px] font-bold transition-colors {settings.autoFatigueRest ? 'bg-green-500/20 text-green-400' : 'bg-surface-hover text-base-text-muted'}"
					>
						{settings.autoFatigueRest ? 'ON' : 'OFF'}
					</button>
				</div>
			</div>
		</div>

		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Visibility</span>
			<div class="grid grid-cols-2 gap-2">
				{#each [
					{ label: 'Hide progress bar', key: 'hideProgressBar' },
					{ label: 'Hide timer', key: 'hideTimer' },
					{ label: 'Hide typed letter', key: 'hideTypedLetter' },
				] as item}
					<label class="flex cursor-pointer items-center gap-2 rounded-md border border-base-border px-3 py-2 transition-colors hover:border-accent/30 hover:bg-accent-muted">
						<input
							type="checkbox"
							checked={settings[item.key as keyof MindDojoSettings] as boolean}
							onchange={(e) => {
								(settings as any)[item.key] = (e.target as HTMLInputElement).checked;
								settings = settings;
							}}
							class="accent-accent"
						/>
						<span class="text-xs text-base-text">{item.label}</span>
					</label>
				{/each}
			</div>
		</div>

		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Error Behavior</span>
			<div class="space-y-2">
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.restartLevelOnError} class="accent-accent" />
					<span class="text-sm text-base-text">Restart level on error</span>
				</label>
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.showNewWordOnError} class="accent-accent" />
					<span class="text-sm text-base-text">Show new word on error</span>
				</label>
				<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
					<input type="checkbox" bind:checked={settings.typeRestartLevelOnErrorOnLevelCompletion} class="accent-accent" />
					<span class="text-sm text-base-text">Toggle restart-on-error each level</span>
				</label>
			</div>
		</div>

		<!-- Session Goal -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Session Goal</span>
			<div class="flex gap-2 mb-3">
				{#each [
					{ key: 'none' as const, label: 'None' },
					{ key: 'words' as const, label: 'Word Count' },
					{ key: 'accuracy' as const, label: 'Accuracy' },
				] as goal}
					<button
						onclick={() => (settings.sessionGoalType = goal.key)}
						class="flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition-all {settings.sessionGoalType === goal.key
							? 'border-accent bg-accent-muted text-accent'
							: 'border-base-border text-base-text-muted hover:border-accent/50'}"
					>
						{goal.label}
					</button>
				{/each}
			</div>
			{#if settings.sessionGoalType === 'words'}
				<div class="flex items-center gap-3">
					<input
						type="number" min="10" max="500" step="10"
						bind:value={settings.sessionGoalValue}
						class="w-20 rounded-md border border-base-border bg-surface px-2 py-1.5 font-mono text-sm text-base-text focus:border-accent focus:outline-none"
					/>
					<span class="text-sm text-base-text-muted">words per session</span>
				</div>
			{:else if settings.sessionGoalType === 'accuracy'}
				<div class="flex items-center gap-3">
					<input
						type="number" min="40" max="100" step="5"
						bind:value={settings.sessionGoalValue}
						class="w-20 rounded-md border border-base-border bg-surface px-2 py-1.5 font-mono text-sm text-base-text focus:border-accent focus:outline-none"
					/>
					<span class="text-sm text-base-text-muted">% accuracy target (after 10+ words)</span>
				</div>
			{/if}
		</div>

		<!-- Breathe Delay -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<div class="mb-2 flex items-center justify-between">
				<span class="text-sm font-bold text-accent">Breathe Pause</span>
				<span class="font-mono text-sm text-base-text">
					{settings.breatheDelay > 0 ? `${(settings.breatheDelay / 1000).toFixed(1)}s` : 'Off'}
				</span>
			</div>
			<input
				type="range" min="0" max="5000" step="100"
				bind:value={settings.breatheDelay}
				class="w-full accent-accent"
			/>
			<p class="mt-1 text-[10px] text-base-text-muted">
				{settings.breatheDelay > 0
					? `After an error, pause ${(settings.breatheDelay / 1000).toFixed(1)}s before the next word. A moment to reset.`
					: 'No pause after errors. Next word appears immediately.'}
			</p>

			{#if settings.breatheDelay > 0}
				<div class="mt-3 space-y-2 border-t border-base-border pt-3">
					<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
						<input type="checkbox" bind:checked={settings.breathePrompts} class="accent-accent" />
						<span class="text-sm text-base-text">Show philosophy prompts</span>
					</label>
					{#if settings.breathePrompts}
						<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 pl-8 transition-colors hover:bg-surface-hover/50">
							<input type="checkbox" bind:checked={settings.breathePromptsAlways} class="accent-accent" />
							<span class="text-sm text-base-text">Show on every error</span>
							<span class="text-xs text-base-text-muted">{settings.breathePromptsAlways ? '' : '(60% random)'}</span>
						</label>
						<div class="pl-2">
							<span class="mb-1 block text-xs text-base-text-muted">Custom prompts (one per line, max 8 words each)</span>
							<textarea
								bind:value={settings.breatheCustomPrompts}
								placeholder="The letter is still there.&#10;Begin again.&#10;This is where you choose."
								rows="3"
								class="w-full rounded-md border border-base-border bg-surface px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted/50 focus:border-accent focus:outline-none"
							></textarea>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Data</span>
			<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
				<input type="checkbox" bind:checked={settings.saveTypedWord} class="accent-accent" />
				<span class="text-sm text-base-text">Save typed words to device</span>
			</label>
		</div>

		<!-- Zen Mode -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm font-bold text-accent">Zen Mode</span>
					<p class="mt-0.5 text-[10px] text-base-text-muted">Hide all stats — no XP, no combo, no belt, no progress. Just you and the letters.</p>
				</div>
				<label class="relative inline-flex cursor-pointer items-center">
					<input type="checkbox" bind:checked={settings.zenMode} class="peer sr-only" />
					<div class="peer h-5 w-9 rounded-full bg-surface-hover after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-base-text-muted after:transition-all peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:bg-black"></div>
				</label>
			</div>
		</div>

		<!-- Commitment Lock -->
		<div class="rounded-lg border {settings.lockedMinSpeed > 0 ? 'border-amber-500/50' : 'border-base-border'} bg-surface-hover/50 p-4">
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm font-bold text-accent">Commitment Lock</span>
					<p class="mt-0.5 text-[10px] text-base-text-muted">
						{#if settings.lockedMinSpeed > 0}
							Speed locked at minimum <span class="font-bold text-amber-400">{settings.lockedMinSpeed.toFixed(2)}x</span>. No retreat.
						{:else}
							Lock your current speed as the floor. You cannot go below it. Raises with each level-up.
						{/if}
					</p>
				</div>
				{#if settings.lockedMinSpeed > 0}
					<button
						onclick={() => mindDojo.unlockSpeed()}
						class="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20"
					>
						Unlock
					</button>
				{:else}
					<button
						onclick={() => mindDojo.lockSpeed()}
						class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
					>
						Lock at {settings.speed.toFixed(2)}x
					</button>
				{/if}
			</div>
		</div>
	<!-- THEME TAB -->
	{:else if activeTab === 'theme'}
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Theme</span>
			<div class="grid grid-cols-2 gap-3">
				{#each themes as theme}
					<button
						onclick={() => { currentTheme = theme.key; applyTheme(theme.key); }}
						class="flex items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all {currentTheme === theme.key
							? 'border-accent shadow-lg shadow-accent/20'
							: 'border-base-border hover:border-base-border'}"
						style="background: {theme.surface};"
					>
						<div class="flex gap-1">
							<div class="h-4 w-4 rounded-full" style="background: {theme.bg}; border: 1px solid {theme.border};"></div>
							<div class="h-4 w-4 rounded-full" style="background: {theme.accent};"></div>
							<div class="h-4 w-4 rounded-full" style="background: {theme.text}; opacity: 0.5;"></div>
						</div>
						<span class="text-sm font-medium" style="color: {theme.text};">{theme.name}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
