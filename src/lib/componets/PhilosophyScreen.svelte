<script lang="ts">
	let {
		show = $bindable(false),
	}: {
		show: boolean;
	} = $props();
</script>

{#if show}
	<div class="fixed inset-0 z-[80] flex bg-base">
		<!-- Sidebar: table of contents -->
		<div class="flex w-64 flex-shrink-0 flex-col border-r border-base-border bg-surface">
			<div class="flex items-center justify-between border-b border-base-border px-4 py-3">
				<h2 class="text-base font-bold text-accent">Philosophy</h2>
				<span class="text-[10px] text-base-text-muted">Esc</span>
			</div>
			<nav class="flex-1 overflow-y-auto p-3">
				{#each [
					{ id: 'why', label: 'Why This Game Exists' },
					{ id: 'timer', label: 'The Timer Trap' },
					{ id: 'audience', label: 'The Phantom Audience' },
					{ id: 'progress', label: 'The Fear of Progress' },
					{ id: 'plateau', label: 'The Plateau' },
					{ id: 'level-up', label: 'The Quiet Level-Up' },
					{ id: 'emotional', label: 'Words That Move You' },
					{ id: 'emotion-control', label: 'Emotion Is Not a Strategy' },
					{ id: 'comfort', label: 'The Comfort Trap' },
					{ id: 'unknown', label: 'The Fear of the Unknown' },
					{ id: 'familiar', label: 'The Familiarity Trap' },
				] as item}
					<a
						href="#{item.id}"
						class="block rounded px-3 py-1.5 text-sm text-base-text-muted transition-colors hover:bg-surface-hover hover:text-accent"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>

		<!-- Content -->
		<div class="flex flex-1 flex-col overflow-y-auto">
			<div class="mx-auto max-w-2xl space-y-12 px-8 py-10">

				<!-- Why This Game Exists -->
				<section id="why">
					<h3 class="mb-4 text-2xl font-black text-accent">Why This Game Exists</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							Most people live from beliefs they never chose. These beliefs were installed through repetition
							and emotional conditioning — not through conscious decision. They run automatically, shaping
							every action, reaction, and perception.
						</p>
						<p>
							The gap between <span class="font-bold text-accent">knowing</span> something and
							<span class="font-bold text-accent">living</span> from it is the gap between
							intellectual understanding and deep installation. You can understand "stay present" perfectly
							and still live from autopilot.
						</p>
						<p>
							Mind Dojo attacks this gap from the active side. It forces presence by making the future
							unpredictable. You cannot rely on assumptions. You cannot project. You can only respond to
							what is actually in front of you, right now, letter by letter.
						</p>
						<p>
							Every time you catch yourself rushing ahead and correct back to the present moment,
							you're building the same muscle that meditation builds — but with immediate, measurable feedback.
						</p>
						<p class="border-l-2 border-accent/50 pl-4 italic text-base-text-muted">
							The person who types each letter as it appears — without projecting, without fearing,
							without assuming — is practicing the same skill as the person who meets each moment of life
							without resistance.
						</p>
					</div>
				</section>

				<!-- The Timer Trap -->
				<section id="timer">
					<h3 class="mb-4 text-2xl font-black text-accent">The Timer Trap</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							You will feel the urge to type faster because the timer is running.
							This is fear disguised as urgency — the belief that rushing gives you control.
							It doesn't. You have no control over whether the timer runs out.
						</p>
						<p>
							What you <span class="font-bold text-accent">do</span> control is your attention.
							You can choose to stay with each letter as it appears and type what you
							<span class="font-bold text-accent">see</span>, not what you <span class="italic">think</span> comes next.
						</p>
						<p>
							It is better to type accurately and run out of time than to rush out of fear and make errors.
							One trains presence. The other reinforces panic.
						</p>
						<p>
							If you keep focusing on what you can control — seeing clearly, typing precisely —
							your speed will rise naturally until you outpace the timer.
							Then the timer will catch up again. And you will adapt again.
							That cycle <span class="italic">is</span> the training.
						</p>
					</div>
				</section>

				<!-- The Phantom Audience -->
				<section id="audience">
					<h3 class="mb-4 text-2xl font-black text-accent">The Phantom Audience</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							At some point, your mind will conjure an audience. You'll imagine someone watching
							over your shoulder — a friend, a stranger, someone you want to impress.
							Suddenly the letters aren't just letters anymore. They're a performance.
							You start typing for <span class="italic">them</span> instead of for you.
						</p>
						<p>
							The moment you try to look good, you stop seeing clearly.
							Your attention splits — half on the letter, half on the imaginary spectator.
							You abandon the process and chase the result, because results are what impress people.
							But the process is the only thing that produces results.
						</p>
						<p>
							No one is watching. And even if they were, their opinion wouldn't type the next letter for you.
							This is not a performance. There is no scoreboard that matters to anyone but you.
							The only person you are competing with is the version of you that wants to look good
							instead of <span class="font-bold text-accent">be</span> good.
						</p>
						<p class="border-l-2 border-accent/50 pl-4 italic text-base-text-muted">
							Let the result take care of itself. Your only job is the next letter.
						</p>
					</div>
				</section>

				<!-- The Fear of Progress -->
				<section id="progress">
					<h3 class="mb-4 text-2xl font-black text-accent">The Fear of Progress</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							With restart-on-error enabled, your progress will climb — 70%, 80%, 90%.
							And as it climbs, a new fear appears: the fear of losing what you've built.
							Each letter now carries the weight of everything before it.
							Your hands tighten. Your mind races ahead. You stop seeing the letter in front of you
							and start seeing the progress bar instead.
						</p>
						<p>
							But you didn't reach 90% by worrying about 90%. You got there one letter at a time,
							by staying with the process. The game hasn't changed — it's still one letter, one moment.
							<span class="font-bold text-accent">Your mind</span> is what changed.
						</p>
						<p>
							Notice this: whether you complete the level or fail it, you get the same release of tension.
							Failing feels like relief — the pressure is gone. Winning feels like relief — the pressure is gone.
							The outcome is different, but the sensation is the same.
							Don't get addicted to the relief that comes from failing. It is a trap that teaches you
							to sabotage yourself for comfort.
						</p>
						<p>
							It is just as possible to win as it is to fail.
							The next level will feel exactly like this one felt when it was new — unfamiliar, then familiar, then conquered.
							You have already proven you can do this. Keep your eyes on the current letter.
							The process is the only thing that has ever worked.
						</p>
					</div>
				</section>

				<!-- The Plateau -->
				<section id="plateau">
					<h3 class="mb-4 text-2xl font-black text-accent">The Plateau</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							There will come a point where the errors pile up and everything in you wants to quit.
							You might actually quit. And when you do, the game will sit exactly where you left it.
							Nothing changes. Your speed doesn't improve on its own. The errors don't resolve themselves.
						</p>
						<p>
							Nobody is coming to save you.
							The game never changes — it keeps presenting one letter at a time, the same way it always has.
							<span class="font-bold text-accent">You</span> are the one who has to change.
						</p>
						<p>
							Every error is a mirror. It's not the game fighting you — it's you fighting yourself.
							The frustration, the impatience, the desire to be better without doing the work —
							those are the real opponents.
						</p>
						<p>
							When you hit that wall: stop. Breathe. Recognise that there is no competition.
							There is only you, one letter, and this moment.
							You are fully responsible for the result you get — or fail to get.
							That responsibility is not a burden. It is freedom.
						</p>
					</div>
				</section>

				<!-- The Quiet Level-Up -->
				<section id="level-up">
					<h3 class="mb-4 text-2xl font-black text-accent">The Quiet Level-Up</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							You'll notice there is no fanfare when you level up. No fireworks, no achievement screen,
							no moment of glory. The game simply continues. The next word appears. The rules don't change.
						</p>
						<p>
							This is deliberate. Growth is a continuous process — there is no summit where you arrive
							and stop climbing. The level you just conquered was once impossible. The level ahead
							will feel the same way. And one day it too will feel ordinary.
						</p>
						<p>
							Levelling up is not fundamentally different from failing. In both cases, the game resets
							and presents you with the same thing: one letter. The only difference is the number
							on the screen. If you attach your identity to that number, you will suffer when it drops
							and crave when it rises. Both reactions pull you out of the present.
						</p>
						<p class="border-l-2 border-accent/50 pl-4 italic text-base-text-muted">
							There is nothing special about levelling up. There is nothing tragic about failing.
							There is only the next letter, and whether you are present for it.
						</p>
					</div>
				</section>

				<!-- Words That Move You -->
				<section id="emotional">
					<h3 class="mb-4 text-2xl font-black text-accent">Words That Move You</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							Pay attention to the words that make you stumble — not because they're long or difficult,
							but because they make you <span class="italic">feel</span> something.
							When you type "sluggard" and your chest tightens, or "failure" and your fingers hesitate,
							or "worthy" and you suddenly rush — that is not a typing problem.
							That is a belief surfacing.
						</p>
						<p>
							The word itself is neutral. It's just letters. But somewhere inside, you've attached meaning to it —
							a story about who you are. "Procrastinator" doesn't just describe a behaviour.
							For some, it describes an <span class="font-bold text-accent">identity</span>.
							And when identity is threatened, the body reacts before the mind can intervene.
						</p>
						<p>
							When this happens, don't push through. Open your journal — or step away and open your own.
							Ask yourself: <span class="italic">"What does this word mean to me? Why did it move me?"</span>
							Then ask: <span class="italic">"What do I want it to mean?"</span>
						</p>
						<p>
							You can reframe any word. "Lack" doesn't have to mean absence —
							it can mean <span class="font-bold text-accent">desire</span>: something you don't have yet
							and would love to have. "Alone" doesn't have to mean abandoned —
							it can mean <span class="font-bold text-accent">sovereign</span>: complete without needing permission.
						</p>
						<p>
							The words that shake you are the ones most worth sitting with.
							They are the doorway to the beliefs that run your life.
						</p>
					</div>
				</section>

				<!-- Emotion Is Not a Strategy -->
				<section id="emotion-control">
					<h3 class="mb-4 text-2xl font-black text-accent">Emotion Is Not a Strategy</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							In letter-by-letter mode, you cannot type ahead. You cannot let excitement carry you
							to the end of the word in one burst. You are forced to see each letter, one at a time,
							and respond to it — not to the feeling it gives you.
						</p>
						<p>
							This is the core training. Emotion wants to skip steps. Excitement says "I know what comes next"
							and rushes forward. Anxiety says "I'm going to fail" and freezes. Both are projections —
							stories about a future that hasn't happened yet. Neither one types the current letter correctly.
						</p>
						<p>
							The game forces you to separate <span class="font-bold text-accent">what you feel</span>
							from <span class="font-bold text-accent">what you do</span>.
							You can feel excited and still type slowly. You can feel anxious and still type accurately.
							The emotion is allowed to exist. It just doesn't get to decide the outcome.
						</p>
						<p class="border-l-2 border-accent/50 pl-4 italic text-base-text-muted">
							Presence is not the absence of emotion. It is the refusal to let emotion
							become the author of your next action.
						</p>
					</div>
				</section>

				<!-- The Comfort Trap -->
				<section id="comfort">
					<h3 class="mb-4 text-2xl font-black text-accent">The Comfort Trap</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							You've levelled up. The speed is faster now and the errors are mounting.
							A voice in your head says: <span class="italic">"Lower the speed. Go back to where it was manageable."</span>
							That voice sounds reasonable. It sounds like strategy. It is neither.
							It is comfort calling — disguised as wisdom.
						</p>
						<p>
							Remember: the level you want to retreat to was once the level that terrified you.
							You stood in it, made the same errors, felt the same frustration — and you adapted.
							Not because the game got easier, but because <span class="font-bold text-accent">you</span> got sharper.
							That will happen again. But only if you stay.
						</p>
						<p>
							Reducing the speed because you're failing is training your mind to flee discomfort.
							Every time you retreat, you reinforce the belief that you can't handle what's in front of you.
							The errors aren't the problem. Your interpretation of the errors is the problem.
							An error at a higher level is worth more than a perfect run at a level you've outgrown.
						</p>
						<p>
							Go back to a previous level because you <span class="font-bold text-accent">choose</span> to —
							to refine your fundamentals, to practice deliberately, to warm up.
							Never go back because you're <span class="italic">running</span> from the current one.
							The difference is intention. One is training. The other is retreat.
						</p>
						<p class="border-l-2 border-accent/50 pl-4 italic text-base-text-muted">
							Growth lives on the other side of the errors you're tempted to avoid.
							Stay with the process. The speed will come.
						</p>
					</div>
				</section>

				<!-- The Familiarity Trap -->
				<section id="familiar">
					<h3 class="mb-4 text-2xl font-black text-accent">The Familiarity Trap</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							It's not the word you don't know that will trip you up.
							It's the one you <span class="font-bold text-accent">think</span> you already know.
						</p>
						<p>
							When an unfamiliar word appears — a long, strange sequence of letters you've never seen —
							you have no choice but to stay present. You read each letter carefully. You type what you see.
							The process works perfectly because you never left it.
						</p>
						<p>
							But when a familiar word appears — "because", "through", "something" —
							your mind leaps ahead. You stop reading and start remembering.
							You type the word you <span class="italic">expect</span> instead of the word you're being <span class="italic">shown</span>.
							And that is where the error lives. Not in ignorance, but in assumed knowledge.
						</p>
						<p>
							This is how beliefs operate in life. The situations that blindside you are rarely the ones
							you've never encountered. They're the ones you thought you understood — the relationship
							you took for granted, the routine you stopped paying attention to,
							the assumption you never questioned because it felt obvious.
						</p>
						<p>
							The game might show you "bless" and you type "blessing".
							It might show you "read" and you type "ready".
							The letters were right there, but you weren't looking at them anymore.
							You were looking at your idea of them.
						</p>
						<p class="border-l-2 border-accent/50 pl-4 italic text-base-text-muted">
							Beware of what you think you know. Make your assumption — then stay open
							to what is actually in front of you. The game is not always giving you
							what you think it's giving you.
						</p>
					</div>
				</section>

				<!-- The Fear of the Unknown -->
				<section id="unknown">
					<h3 class="mb-4 text-2xl font-black text-accent">The Fear of the Unknown</h3>
					<div class="space-y-4 text-sm leading-relaxed text-base-text">
						<p>
							Between letters, there is a gap. You don't know what comes next.
							Your body tenses. Your fingers hover. Your mind scrambles to predict — to fill the void
							with certainty before the next letter arrives. This is the fear of the unknown,
							and it is the most fundamental anxiety the game exposes.
						</p>
						<p>
							But consider this: every letter that will ever appear is one you already know.
							A through Z. Perhaps a hyphen. That's it. There are no surprises in the alphabet.
							The next letter is not a threat — it is something you have handled thousands of times before.
							The fear isn't about the letter. It's about the <span class="font-bold text-accent">gap</span> —
							the moment of not-knowing between what just was and what comes next.
						</p>
						<p>
							This is the same fear that stops people from starting a business, moving to a new city,
							or having a difficult conversation. Not fear of the thing itself — fear of the space before the thing.
							The need to know everything before you act. The refusal to move until the path is fully visible.
						</p>
						<p>
							Think of travelling to a place you've never been. You don't know every turn in advance.
							You don't see the destination from the starting point. But you trust the road.
							You drive the stretch you can see, and when you round the corner, the next stretch reveals itself.
							That trust — that willingness to act on what's visible without demanding to see what isn't —
							is exactly what this game trains.
						</p>
						<p>
							You don't need to know how long the word is. You don't need to predict the next letter.
							You only need to type the one in front of you right now, trusting that when the next one appears,
							you will handle it — because you always have.
						</p>
						<p class="border-l-2 border-accent/50 pl-4 italic text-base-text-muted">
							Embrace the not-knowing. The process doesn't need your prediction to work.
							It only needs your presence.
						</p>
					</div>
				</section>

			</div>
		</div>
	</div>
{/if}
