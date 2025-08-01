<script lang="ts">
	let {
		showWordBank = $bindable(),
		toggleWordBank,
		wordBankCount,
		toggleSettingPopup,
		showSetting
	} = $props();
</script>

<nav class="relative z-30 flex items-center justify-between p-4">
	<!-- Logo/Title -->
	<div class="flex items-center gap-3">
		<div class="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 p-2">
			<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 10V3L4 14h7v7l9-11h-7z"
				/>
			</svg>
		</div>
		<div>
			<h1 class="text-xl font-bold text-amber-100">MindDojo</h1>
			<p class="text-xs text-neutral-400">Typing Mastery</p>
		</div>
	</div>

	<!-- Action Buttons -->
	<div class="flex items-center gap-3">
		<!-- Word Bank Button -->
		<button
			onclick={toggleWordBank}
			class={'group relative flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-800/80 px-4 py-2 text-sm font-medium text-amber-100 backdrop-blur-sm transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-lg ' +
				(showWordBank ? 'bg-amber-500/10' : '')}
			class:border-amber-500={showWordBank}
			aria-label="Toggle word bank"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
				/>
			</svg>
			<span>Word Bank</span>
			{#if wordBankCount > 0}
				<span class="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
					{wordBankCount}
				</span>
			{/if}
		</button>

		<!-- Settings Button -->
		<button
			onclick={toggleSettingPopup}
			class={'group relative flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-800/80 px-4 py-2 text-sm font-medium text-amber-100 backdrop-blur-sm transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-lg ' +
				(showSetting ? 'bg-amber-500/10' : '')}
			class:border-amber-500={showSetting}
			aria-label="Toggle settings"
		>
			<svg
				class="h-4 w-4 transition-transform group-hover:rotate-90"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
			<span>Settings</span>
		</button>
	</div>
</nav>
