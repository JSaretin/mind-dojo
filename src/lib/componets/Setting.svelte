<script lang="ts">
	import type { MindDojoSettings } from '$lib/structure';
	import { themes, applyTheme, loadTheme } from '$lib/theme';
	import { getContext } from 'svelte';
	import type { MindDojo } from '$lib/mind-dojo.svelte';

	let { settings = $bindable() }: { settings: MindDojoSettings } = $props();
	const getMindDojo: () => MindDojo = getContext('mindDojo');
	let mindDojo = $derived(getMindDojo());
	let currentTheme = $state(loadTheme());

	const displayModes = ['letter-by-letter', 'full-word'] as const;
	const letterDisplayOptions = ['left-to-right', 'center'] as const;
	const numberModes = ['smart', 'random'] as const;

	let activeTab: 'core' | 'chaos' | 'style' | 'audio' | 'ui' | 'theme' = $state('core');

	const tabs = [
		{ key: 'core' as const, label: 'Core', icon: '&#9889;' },
		{ key: 'chaos' as const, label: 'Chaos', icon: '&#127918;' },
		{ key: 'style' as const, label: 'Style', icon: '&#9998;' },
		{ key: 'audio' as const, label: 'Audio', icon: '&#9835;' },
		{ key: 'ui' as const, label: 'UI', icon: '&#9881;' },
		{ key: 'theme' as const, label: 'Theme', icon: '&#9728;' },
	];
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
		<!-- Speed -->
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

		<!-- Display Mode -->
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<span class="mb-3 block text-sm font-bold text-accent">Display Mode</span>
			<div class="flex gap-2">
				{#each displayModes as mode}
					<button
						onclick={() => (settings.displayMode = mode)}
						class="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-all {settings.displayMode === mode
							? 'border-accent bg-accent-muted text-accent'
							: 'border-base-border text-base-text-muted hover:border-accent/50 hover:text-accent'}"
					>
						{mode === 'letter-by-letter' ? 'Letter by Letter' : 'Full Word'}
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

	<!-- CHAOS TAB -->
	{:else if activeTab === 'chaos'}
		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<label class="flex cursor-pointer items-center gap-3">
				<input type="checkbox" checked={settings.franticMode} onchange={(e) => {
					const checked = (e.target as HTMLInputElement).checked;
					if (checked) {
						mindDojo.enableChaosMode();
						settings = mindDojo.settings;
					} else {
						mindDojo.disableChaosMode();
						settings = mindDojo.settings;
					}
				}} class="h-5 w-5 accent-red-500" />
				<div>
					<span class="text-sm font-bold text-red-400">Enable Chaos Mode</span>
					<p class="text-xs text-base-text-muted">Randomly mutates settings every word</p>
				</div>
			</label>
		</div>

		{#if settings.franticMode}
			<div class="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
				<span class="mb-3 block text-sm font-bold text-red-300">Chaos Parameters</span>
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
		{:else}
			<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-base-border py-12 text-center">
				<span class="mb-2 text-4xl">&#127918;</span>
				<p class="text-sm text-base-text-muted">Enable Chaos Mode to unlock random mutations</p>
				<p class="text-xs text-base-text-muted">Every word changes the rules</p>
			</div>
		{/if}

	<!-- STYLE TAB -->
	{:else if activeTab === 'style'}
		{#if settings.displayMode === 'letter-by-letter'}
			<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
				<span class="mb-3 block text-sm font-bold text-accent">Letter Randomization</span>
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

			<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
				<span class="mb-3 block text-sm font-bold text-accent">Letter Direction</span>
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
		{:else}
			<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-base-border py-12 text-center">
				<span class="mb-2 text-4xl">&#9998;</span>
				<p class="text-sm text-base-text-muted">Switch to Letter-by-Letter mode</p>
				<p class="text-xs text-base-text-muted">to unlock letter styling options</p>
			</div>
		{/if}

		<div class="rounded-lg border border-base-border bg-surface-hover/50 p-4">
			<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/50">
				<input type="checkbox" bind:checked={settings.displayLetterInUpperCase} class="accent-accent" />
				<span class="text-sm text-base-text">Display letters in uppercase</span>
			</label>
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
