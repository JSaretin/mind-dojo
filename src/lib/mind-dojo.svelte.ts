import { browser } from "$app/environment"
import { getRandomChar, initializeAudio } from "$lib"
import { SavedWordDB } from "./database.svelte"
import { isInstantFail } from "./structure"
import type { MindDojoSettings, SavedWord, TypingFlow, Word, Words } from "./structure"
import { generateRandomShiftOfWordPosition, getBaseStyle } from "./style"

const defaultSetting: MindDojoSettings = {
    speed: 2,
    sameLetterDelayPercent: 100,
    excludeLetters: "",
    displayMode: "letter-by-letter",
    joinRandomLetters: true,
    mixJoinRandomLetters: true,
    franticMode: false, // stays false by default, but all frantic settings are ready
    franticSettings: {
        shouldChangeDisplayMode: true,
        shouldChangeLetterStyle: true,
        shouldChangeProgressBarVisibility: true,
        shouldChangeTimerVisibility: true,
        shouldChangeRestartOnError: true,
        shouldChangeRandomWordPosition: true,
        shouldChangeHideTypedLetter: true,
        shouldChangeWordLength: true,   // ✅ new flag defaults to true
    },
    minWordLength: 1,
    maxWordLength: 25,
    letterStyle: {
        randomSize: false,
        randomWeight: false,
        randomFont: false,
        randomTransform: false,
        randomColor: false,
        letterDisplayDirection: "left-to-right",
    },
    voice: {
        sayCurrentWord: false,
        focusOnVoice: false,
        focusOnLetter: false,
    },
    wordMix: {
        includeNumbers: true,
        numberMode: "random",
        includeUppercase: true,
        includeLowercase: true,
    },
    hideProgressBar: false,
    hideTimer: false,
    restartLevelOnError: false,
    showNewWordOnError: true,
    hideTypedLetter: false,
    noFeedbackSound: false,
    noSuccessFeedbackSound: false,
    randomlyMoveWordStarting: true,
    saveTypedWord: true,
    typeRestartLevelOnErrorOnLevelCompletion: true,
    displayLetterInUpperCase: false,
    stealthTimer: true,
    sessionDuration: 0,
    restDuration: 0,
    zenMode: false,
    lockedMinSpeed: 0,
    autoSpeed: false,
    autoSpeedBase: 0,
    savedManualSpeed: 2,
    autoFatigueRest: true,
    wordSource: 'dictionary',
    warmupWords: 0,
    breatheDelay: 0,
    breathePrompts: true,
    breathePromptsAlways: true,
    breatheCustomPrompts: '',
    sessionGoalType: 'none',
    sessionGoalValue: 50,
};


function getSettings() {
    if (!browser) return defaultSetting;
    try {
        const saved = JSON.parse(localStorage.getItem("settings") || "{}");
        return { ...defaultSetting, ...saved };
    } catch {
        return defaultSetting;
    }

}

// Belt ranks — the dojo progression
interface Belt {
    name: string
    minXp: number
    color: string
}

const BELTS: Belt[] = [
    { name: "White Belt", minXp: 0, color: "#e5e5e5" },
    { name: "Yellow Belt", minXp: 100, color: "#facc15" },
    { name: "Orange Belt", minXp: 300, color: "#f97316" },
    { name: "Green Belt", minXp: 600, color: "#22c55e" },
    { name: "Blue Belt", minXp: 1000, color: "#3b82f6" },
    { name: "Purple Belt", minXp: 1800, color: "#a855f7" },
    { name: "Brown Belt", minXp: 3000, color: "#92400e" },
    { name: "Red Belt", minXp: 5000, color: "#ef4444" },
    { name: "Black Belt", minXp: 8000, color: "#171717" },
    { name: "Master", minXp: 15000, color: "#fbbf24" },
]

function getBelt(xp: number) {
    let belt = BELTS[0]
    for (const b of BELTS) {
        if (xp >= b.minXp) belt = b
    }
    return belt
}

function getNextBelt(xp: number) {
    for (const b of BELTS) {
        if (xp < b.minXp) return b
    }
    return null
}

function loadDojo(): { xp: number; bestCombo: number; totalCorrect: number; totalErrors: number; levelProgress: number } {
    if (!browser) return { xp: 0, bestCombo: 0, totalCorrect: 0, totalErrors: 0, levelProgress: 0 }
    try {
        const saved = JSON.parse(localStorage.getItem("dojoProgress") || "{}")
        return {
            xp: saved.xp || 0,
            bestCombo: saved.bestCombo || 0,
            totalCorrect: saved.totalCorrect || 0,
            totalErrors: saved.totalErrors || 0,
            levelProgress: saved.levelProgress || 0,
        }
    } catch {
        return { xp: 0, bestCombo: 0, totalCorrect: 0, totalErrors: 0, levelProgress: 0 }
    }
}

export class MindDojo {
    private words: Words = []
    private currentIndex = 0
    private preChaosSettings: MindDojoSettings | null = null

    database: SavedWordDB

    gameSound: {
        win: HTMLAudioElement
        wrong: HTMLAudioElement
    } = {} as any

    holdDelete = false

    settings: MindDojoSettings = $state(getSettings())

    dojoState = $state({
        progress: loadDojo().levelProgress,
        lastOutcome: "" as "success" | "error" | "timeout" | "",
    })

    // Gamification state
    private _dojoProgress = loadDojo()
    xp = $state(this._dojoProgress.xp)
    bestCombo = $state(this._dojoProgress.bestCombo)
    totalCorrect = $state(this._dojoProgress.totalCorrect)
    totalErrors = $state(this._dojoProgress.totalErrors)
    combo = $state(browser ? parseInt(localStorage.getItem('sessionCombo') || '0') : 0)
    sessionCorrect = $state(browser ? parseInt(localStorage.getItem('sessionCorrect') || '0') : 0)
    sessionErrors = $state(browser ? parseInt(localStorage.getItem('sessionErrors') || '0') : 0)
    sessionStartTime = Date.now()
    sessionTimeline: { word: string; correct: boolean; duration: number; ts: number }[] = $state(
        browser ? (() => { try { return JSON.parse(localStorage.getItem("sessionTimeline") || "[]") } catch { return [] } })() : []
    )
    sessionPhase: 'active' | 'rest' | 'idle' = $state(
        browser ? (localStorage.getItem('sessionPhase') as 'active' | 'rest' | 'idle') || 'idle' : 'idle'
    )
    restSecondsLeft = $state(0)
    /** Active typing time in ms (sum of word durations + reaction times) */
    private sessionActiveTime = $state(0)
    /** Timestamp of last word completion — used for idle gap detection */
    private lastWordCompletedAt = $state(Date.now())
    restReason: 'timer' | 'fatigue' | null = $state(
        browser ? (localStorage.getItem('restReason') as 'timer' | 'fatigue') || null : null
    )
    private sessionTimer: ReturnType<typeof setTimeout> | null = null
    private restInterval: ReturnType<typeof setInterval> | null = null
    sessionJournals: { text: string; timestamp: number }[] = $state([])

    // ── Fatigue Detection ──
    private fatigueResults: boolean[] = $state([])
    fatiguePeakAccuracy = $state(0)
    private readonly FATIGUE_WINDOW = 30
    private readonly FATIGUE_DROP_THRESHOLD = 20 // percentage points

    // ── Live Presence State ──
    /** Live error type tracking — persisted for rest screen */
    sessionSelfErrors = $state(browser ? parseInt(localStorage.getItem('sessionSelfErrors') || '0') : 0)
    sessionTimerErrors = $state(browser ? parseInt(localStorage.getItem('sessionTimerErrors') || '0') : 0)
    get selfErrorPct(): number {
        const total = this.sessionSelfErrors + this.sessionTimerErrors;
        return total > 0 ? Math.round((this.sessionSelfErrors / total) * 100) : 50;
    }

    /** Warmup tracking */
    warmupRemaining = $state(0)
    get isWarmup(): boolean { return this.warmupRemaining > 0; }

    /** Session goal tracking */
    get sessionGoalProgress(): number {
        if (this.settings.sessionGoalType === 'words') {
            return Math.min(Math.round(((this.sessionCorrect + this.sessionErrors) / Math.max(this.settings.sessionGoalValue, 1)) * 100), 100);
        }
        if (this.settings.sessionGoalType === 'accuracy') {
            return Math.min(this.accuracy, 100);
        }
        return 0;
    }
    get sessionGoalReached(): boolean {
        if (this.settings.sessionGoalType === 'words') {
            return (this.sessionCorrect + this.sessionErrors) >= this.settings.sessionGoalValue;
        }
        if (this.settings.sessionGoalType === 'accuracy') {
            return this.accuracy >= this.settings.sessionGoalValue && (this.sessionCorrect + this.sessionErrors) >= 10;
        }
        return false;
    }


    /** Whether breathe pause is active (post-error delay) */
    breatheActive = $state(false)
    breathePromptText: string = $state('')
    private breatheTimer: ReturnType<typeof setTimeout> | null = null
    private lastErrorType: 'self' | 'timer' = 'self'
    private consecutiveErrors = 0

    // ── Breathe Prompt Pools ──
    private static readonly PROMPTS_PRESENCE = [
        'This letter. Nothing else.', 'Just this one.', 'What do you see right now?',
        'Here.', 'Only what is shown.', 'Stay with what is.',
    ];
    private static readonly PROMPTS_SURRENDER = [
        'Let go.', "You don't need to know what's next.", 'Stop holding. Start seeing.',
        'Release the grip.', 'Nothing to fix.', 'Allow.',
    ];
    private static readonly PROMPTS_NONJUDGMENT = [
        'Not good. Not bad. Just this.', "Notice. That's all.", 'No story needed.',
        'It happened. Now this.', 'Without opinion.',
    ];
    private static readonly PROMPTS_TRUST = [
        'Your fingers already know.', 'The next letter will appear.',
        "You don't need to prepare.", "It arrives when you're ready.", 'Trust the process.',
    ];
    private static readonly PROMPTS_LET_GO_PAST = [
        'That word is done.', 'Gone. This is new.', 'Begin here.',
        'Every letter is the first.', 'Clean slate.',
    ];
    private static readonly PROMPTS_LET_GO_FUTURE = [
        "Don't finish the word yet.", 'One letter. Not ten.',
        'The end takes care of itself.', 'Stop reaching ahead.', 'Arrive before you move.',
    ];

    private pickBreathePrompt(): string {
        if (!this.settings.breathePrompts) return '';
        if (!this.settings.breathePromptsAlways && Math.random() > 0.6) return '';

        // Build context-aware pool
        let pool: string[] = [];
        if (this.consecutiveErrors >= 2) {
            // Spiral — non-judgment + letting go of past
            pool = [...MindDojo.PROMPTS_NONJUDGMENT, ...MindDojo.PROMPTS_LET_GO_PAST];
        } else if (this.lastErrorType === 'timer') {
            // Timer error — surrender + letting go of future
            pool = [...MindDojo.PROMPTS_SURRENDER, ...MindDojo.PROMPTS_LET_GO_FUTURE];
        } else {
            // Self error — presence + trust
            pool = [...MindDojo.PROMPTS_PRESENCE, ...MindDojo.PROMPTS_TRUST];
        }

        // Add user custom prompts
        if (this.settings.breatheCustomPrompts) {
            const custom = this.settings.breatheCustomPrompts
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0 && l.length <= 50);
            pool.push(...custom);
        }

        return pool[Math.floor(Math.random() * pool.length)] || '';
    }

    /** Rolling inter-key intervals for real-time CV calculation */
    private presenceIntervals: number[] = []
    private readonly PRESENCE_WINDOW = 30
    /** Current live presence state: 'flow' | 'present' | 'distracted' | 'spiral' */
    presenceState: 'flow' | 'present' | 'distracted' | 'spiral' = $state('present')
    /** Current correct streak length */
    currentStreak = $state(0)
    /** Errors in last 5 words */
    private recentErrors = $state(0)
    private recentResults: boolean[] = []

    private updatePresenceState(flow: { letterIntervals: number[]; correct: boolean }) {
        // Track streak
        if (flow.correct) {
            this.currentStreak++
        } else {
            this.currentStreak = 0
        }

        // Track recent errors (last 5 results)
        this.recentResults.push(flow.correct)
        if (this.recentResults.length > 5) this.recentResults.shift()
        this.recentErrors = this.recentResults.filter(r => !r).length

        // Track rolling CV from inter-key intervals
        const interKey = flow.letterIntervals.slice(1).filter(v => v > 0)
        this.presenceIntervals.push(...interKey)
        while (this.presenceIntervals.length > this.PRESENCE_WINDOW) {
            this.presenceIntervals.shift()
        }

        // Compute state
        if (this.recentErrors >= 3) {
            this.presenceState = 'spiral'
        } else if (this.presenceIntervals.length >= 10) {
            const mean = this.presenceIntervals.reduce((a, b) => a + b, 0) / this.presenceIntervals.length
            const stdDev = Math.sqrt(this.presenceIntervals.reduce((s, v) => s + (v - mean) ** 2, 0) / this.presenceIntervals.length)
            const cv = mean > 0 ? stdDev / mean : 1
            if (cv < 0.08 && this.currentStreak >= 5) {
                this.presenceState = 'flow'
            } else if (cv < 0.15) {
                this.presenceState = 'present'
            } else {
                this.presenceState = 'distracted'
            }
        } else {
            this.presenceState = 'present'
        }
    }

    // ── Auto Speed ──
    autoSpeedZone: 'base' | 'flow' | 'challenge' = $state('base')
    private autoSpeedResults: boolean[] = $state([])
    private autoSpeedWordsInZone = $state(0)
    private autoSpeedChallengeTarget = $state(5)
    /** Gate score: +1 on correct, -2 on error, clamped to [0, gateTarget]. Graduate at 100%. */
    private autoSpeedGateScore = $state(0)

    // Rolling window: only the last N results count (used for drop detection)
    private readonly AUTO_SPEED_WINDOW = 15
    private readonly AUTO_SPEED_GATE_TARGET = 12  // correct words needed to graduate (100%)
    private readonly AUTO_SPEED_DROP_THRESHOLD = 0.60
    private readonly AUTO_SPEED_BUMP = 1.01     // +1% on Flow mastery
    private readonly AUTO_SPEED_DROP = 0.99      // -1% on Flow failure

    /** Progress toward next zone gate (0-100) */
    get autoSpeedProgress(): number {
        if (!this.settings.autoSpeed) return 0;

        // Challenge: progress = words done / target
        if (this.autoSpeedZone === 'challenge') {
            return Math.min(Math.round((this.autoSpeedWordsInZone / this.autoSpeedChallengeTarget) * 100), 100);
        }

        // Base/Flow: gate score tracks progress. +1 correct, -2 error. Graduate at target.
        return Math.min(Math.round((this.autoSpeedGateScore / this.AUTO_SPEED_GATE_TARGET) * 100), 100);
    }

    get autoSpeedFlowSpeed() { return parseFloat((this.settings.autoSpeedBase * 1.1).toFixed(4)); }
    get autoSpeedChallengeSpeed() { return parseFloat((this.settings.autoSpeedBase * 1.25).toFixed(4)); }

    private getAutoSpeedForZone(zone: 'base' | 'flow' | 'challenge'): number {
        switch (zone) {
            case 'base': return this.settings.autoSpeedBase;
            case 'flow': return this.autoSpeedFlowSpeed;
            case 'challenge': return this.autoSpeedChallengeSpeed;
        }
    }

    private get autoSpeedAccuracy(): number {
        if (this.autoSpeedResults.length === 0) return 0;
        return this.autoSpeedResults.filter(r => r).length / this.autoSpeedResults.length;
    }

    private get autoSpeedWindowFull(): boolean {
        return this.autoSpeedResults.length >= this.AUTO_SPEED_WINDOW;
    }

    private setAutoSpeedZone(zone: 'base' | 'flow' | 'challenge') {
        this.autoSpeedZone = zone;
        this.autoSpeedResults = [];
        this.autoSpeedWordsInZone = 0;
        this.autoSpeedGateScore = 0;
        this.settings.speed = this.getAutoSpeedForZone(zone);
        if (zone === 'challenge') {
            this.autoSpeedChallengeTarget = Math.floor(Math.random() * 6) + 3; // 3-8 words
        }
    }

    /** Track last known base to detect manual changes */
    private lastAutoSpeedBase = 0

    private advanceAutoSpeedZone() {
        if (!this.settings.autoSpeed) return

        // Detect manual base speed change — reset zone to respect new base
        if (this.lastAutoSpeedBase > 0 && this.settings.autoSpeedBase !== this.lastAutoSpeedBase) {
            this.setAutoSpeedZone('base');
        }
        this.lastAutoSpeedBase = this.settings.autoSpeedBase;

        // Apply current zone speed
        this.settings.speed = this.getAutoSpeedForZone(this.autoSpeedZone);
    }

    private recordAutoSpeedResult(correct: boolean) {
        if (!this.settings.autoSpeed) return

        // Rolling window — used for drop detection only
        this.autoSpeedResults.push(correct);
        while (this.autoSpeedResults.length > this.AUTO_SPEED_WINDOW) {
            this.autoSpeedResults.shift();
        }
        this.autoSpeedWordsInZone++;

        // Gate score: +1 correct, -2 error, clamped to [0, target]
        if (correct) {
            this.autoSpeedGateScore = Math.min(this.autoSpeedGateScore + 1, this.AUTO_SPEED_GATE_TARGET);
        } else {
            this.autoSpeedGateScore = Math.max(this.autoSpeedGateScore - 2, 0);
        }

        const acc = this.autoSpeedAccuracy;
        const enoughData = this.autoSpeedWindowFull;

        switch (this.autoSpeedZone) {
            case 'base':
                // Graduate to Flow: score hits target on a correct word
                if (correct && this.autoSpeedGateScore >= this.AUTO_SPEED_GATE_TARGET) {
                    this.setAutoSpeedZone('flow');
                }
                break;

            case 'flow':
                // Drop back to Base if rolling accuracy < 60%
                if (enoughData && acc < this.AUTO_SPEED_DROP_THRESHOLD) {
                    // Too hard — lower base speed
                    const newBase = parseFloat((this.settings.autoSpeedBase * this.AUTO_SPEED_DROP).toFixed(4));
                    this.settings.autoSpeedBase = Math.max(newBase, this.settings.lockedMinSpeed || 1);
                    this.setAutoSpeedZone('base');
                }
                // Graduate to Challenge: score hits target on a correct word
                else if (correct && this.autoSpeedGateScore >= this.AUTO_SPEED_GATE_TARGET) {
                    // Flow mastered — raise base speed
                    this.settings.autoSpeedBase = parseFloat((this.settings.autoSpeedBase * this.AUTO_SPEED_BUMP).toFixed(4));
                    this.setAutoSpeedZone('challenge');
                }
                break;

            case 'challenge':
                // Drop back to Base if rolling accuracy < 60%
                if (enoughData && acc < this.AUTO_SPEED_DROP_THRESHOLD) {
                    this.setAutoSpeedZone('base');
                }
                // Challenge is brief — after random target words, return to Base for recovery
                else if (this.autoSpeedWordsInZone >= this.autoSpeedChallengeTarget) {
                    this.setAutoSpeedZone('base');
                }
                break;
        }
    }

    // Level persistence — track the speed at which progress was earned
    private savedLevelSpeed: number = 0

    // Compat getter
    get sessionExpired() { return this.sessionPhase === 'rest' }
    private eventCounter = 0
    lastEvent: { type: "success" | "error" | "rank-up"; text?: string; id: number } | null = $state(null)

    get belt() { return getBelt(this.xp) }
    get nextBelt() { return getNextBelt(this.xp) }
    get accuracy() {
        const total = this.sessionCorrect + this.sessionErrors
        return total > 0 ? Math.round((this.sessionCorrect / total) * 100) : 100
    }

    get sessionRollingAccuracy(): number {
        if (this.fatigueResults.length === 0) return 100
        return Math.round((this.fatigueResults.filter(r => r).length / this.fatigueResults.length) * 100)
    }

    get fatigueWarning(): boolean {
        if (this.fatigueResults.length < this.FATIGUE_WINDOW) return false
        return this.fatiguePeakAccuracy - this.sessionRollingAccuracy >= this.FATIGUE_DROP_THRESHOLD
    }

    private recordFatigueResult(correct: boolean) {
        this.fatigueResults.push(correct)
        while (this.fatigueResults.length > this.FATIGUE_WINDOW) {
            this.fatigueResults.shift()
        }
        if (this.fatigueResults.length >= this.FATIGUE_WINDOW) {
            const acc = this.sessionRollingAccuracy
            if (acc > this.fatiguePeakAccuracy) {
                this.fatiguePeakAccuracy = acc
            }
            // Auto-trigger rest on fatigue if enabled
            if (this.settings.autoFatigueRest && this.sessionPhase === 'active' && this.fatigueWarning) {
                this.enterRest('fatigue')
            }
        }
    }

    private persistProgress() {
        if (!browser) return
        localStorage.setItem("dojoProgress", JSON.stringify({
            xp: this.xp,
            bestCombo: this.bestCombo,
            totalCorrect: this.totalCorrect,
            totalErrors: this.totalErrors,
            levelProgress: this.dojoState.progress,
        }))
    }

    private persistTimeline() {
        if (!browser) return
        localStorage.setItem("sessionTimeline", JSON.stringify(this.sessionTimeline))
    }

    startSessionTimer() {
        // Don't overwrite persisted rest state on reload
        if (this.sessionPhase === 'rest') return
        this.clearTimers()
        this.sessionPhase = 'active'
        this.sessionActiveTime = 0
        this.warmupRemaining = this.settings.warmupWords
        if (browser) localStorage.setItem('sessionPhase', 'active')
    }

    /** Track active typing time and trigger rest when session duration exceeded */
    private checkSessionTime(wordDurationMs: number) {
        const duration = this.settings.sessionDuration
        if (!duration || duration <= 0) return
        this.sessionActiveTime += wordDurationMs
        if (this.sessionActiveTime >= duration * 60 * 1000) {
            this.enterRest()
        }
    }

    private enterRest(reason: 'timer' | 'fatigue' = 'timer') {
        this.sessionPhase = 'rest'
        this.restReason = reason
        if (browser) {
            localStorage.setItem('sessionPhase', 'rest')
            localStorage.setItem('restReason', reason)
            localStorage.setItem('sessionCorrect', String(this.sessionCorrect))
            localStorage.setItem('sessionErrors', String(this.sessionErrors))
            localStorage.setItem('sessionCombo', String(this.combo))
            localStorage.setItem('sessionSelfErrors', String(this.sessionSelfErrors))
            localStorage.setItem('sessionTimerErrors', String(this.sessionTimerErrors))
        }
        // Stop the word timer
        if (this.timer) {
            cancelAnimationFrame(this.timer)
            this.timer = null
        }
        const restMins = this.settings.restDuration
        if (restMins > 0) {
            const restEndAt = Date.now() + restMins * 60 * 1000
            if (browser) localStorage.setItem('restEndAt', String(restEndAt))
            this.startRestCountdown(restEndAt)
        }
    }

    /** Start or resume a rest countdown from a target end timestamp */
    private startRestCountdown(restEndAt: number) {
        this.restSecondsLeft = Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000))
        if (this.restSecondsLeft <= 0) return
        this.restInterval = setInterval(() => {
            this.restSecondsLeft = Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000))
            if (this.restSecondsLeft <= 0) {
                if (this.restInterval) { clearInterval(this.restInterval); this.restInterval = null }
                if (browser) localStorage.removeItem('restEndAt')
            }
        }, 1000)
    }

    endRest() {
        this.clearTimers()
        this.sessionPhase = 'active'
        this.sessionActiveTime = 0
        this.restReason = null
        this.fatigueResults = []
        this.fatiguePeakAccuracy = 0
        if (browser) {
            localStorage.setItem('sessionPhase', 'active')
            localStorage.removeItem('restReason')
            localStorage.removeItem('restEndAt')
            localStorage.removeItem('sessionCorrect')
            localStorage.removeItem('sessionErrors')
            localStorage.removeItem('sessionCombo')
            localStorage.removeItem('sessionSelfErrors')
            localStorage.removeItem('sessionTimerErrors')
        }
        this.sessionCorrect = 0
        this.sessionErrors = 0
        this.sessionSelfErrors = 0
        this.sessionTimerErrors = 0
        this.sessionTimeline = []
        this.persistTimeline()
        this.sessionStartTime = Date.now()
        this.combo = 0
        this.startSessionTimer()
        this.pickNextWord()
    }

    /** Minimum idle gap (ms) that triggers a session boundary. Uses rest duration or 5 min default. */
    private get idleThresholdMs(): number {
        const restMins = this.settings.restDuration
        return Math.max(restMins > 0 ? restMins : 5, 5) * 60 * 1000
    }

    /** Check for idle gap and reset session state if user was away too long */
    private checkIdleGap() {
        const now = Date.now()
        const gap = now - this.lastWordCompletedAt
        if (gap >= this.idleThresholdMs) {
            // Mark a session boundary in the timeline
            this.sessionTimeline.push({
                word: '---',
                correct: true,
                duration: 0,
                ts: now,
            })
            // Reset session state for a fresh start
            this.sessionCorrect = 0
            this.sessionErrors = 0
            this.sessionSelfErrors = 0
            this.sessionTimerErrors = 0
            this.sessionActiveTime = 0
            this.sessionStartTime = now
            this.combo = 0
            if (browser) {
                localStorage.removeItem('sessionCorrect')
                localStorage.removeItem('sessionErrors')
                localStorage.removeItem('sessionCombo')
                localStorage.removeItem('sessionSelfErrors')
                localStorage.removeItem('sessionTimerErrors')
            }
            this.fatigueResults = []
            this.fatiguePeakAccuracy = 0
            this.restReason = null
            // If we were in rest (persisted), go back to active
            if (this.sessionPhase === 'rest') {
                this.clearTimers()
                this.sessionPhase = 'active'
                this.restReason = null
                if (browser) {
                    localStorage.setItem('sessionPhase', 'active')
                    localStorage.removeItem('restReason')
                    localStorage.removeItem('restEndAt')
                }
            }
            this.persistTimeline()
        }
    }

    stopSessionTimer() {
        this.clearTimers()
        this.sessionPhase = 'active'
    }

    private clearTimers() {
        if (this.sessionTimer) { clearTimeout(this.sessionTimer); this.sessionTimer = null }
        if (this.restInterval) { clearInterval(this.restInterval); this.restInterval = null }
    }

    saveSessionJournal(text: string) {
        if (!text.trim()) return
        this.sessionJournals.push({
            text: text.trim(),
            timestamp: Date.now(),
        })
        if (browser) {
            localStorage.setItem("sessionJournals", JSON.stringify(this.sessionJournals))
        }
    }

    // Level persistence — reset progress if speed was manually changed
    checkLevelReset() {
        // Auto mode manages its own progress — skip manual level reset
        if (this.settings.autoSpeed) return
        const currentSpeed = parseFloat(this.settings.speed.toFixed(4))
        if (this.savedLevelSpeed !== 0 && currentSpeed !== this.savedLevelSpeed) {
            this.dojoState.progress = 0
        }
        this.savedLevelSpeed = currentSpeed
    }

    currentWord: Word | null = $state(null)
    currentWordIsRandom = false
    typedWord: string = $state("")
    wordTimerDuration = $state(0)
    wordMaxDuration = $state(0)
    timer: number | null = null
    currentWordStyle: string[] = $state([])
    wordTransformStyle: string = $state('')

    lettersAudio: {
        [k: string]: HTMLAudioElement;
    } = {}

    private keystrokeTimestamps: number[] = []
    private wordShownAt: number = 0
    /** Live reaction time in ms — time since word appeared, resets to null on first keystroke */
    reactionTimeMs: number | null = $state(null)
    private reactionTimer: number | null = null
    /** Last completed reaction time for display */
    lastReactionTime: number = $state(0)



    /** Cached seen/unseen words for word source modes */
    private seenWords: Words = []
    private unseenWords: Words = []
    private seenWordsLoaded = false

    /** Load seen words from IndexedDB for practice mode */
    async loadSeenWords() {
        const saved = await this.database.getAllWords()
        const seenSet = new Set(saved.filter(w => w.stats.seen > 0).map(w => w.word.word))
        this.seenWords = this.shuffle(saved.filter(w => w.stats.seen > 0).map(w => w.word))
        this.unseenWords = this.shuffle(this.words.filter(w => !seenSet.has(w.word)))
        this.seenWordsLoaded = true
    }

    constructor(words: Words) {
        this.words = this.shuffle(words)

        this.database = new SavedWordDB()
        this.loadGameSound()

        // Pre-load seen/unseen words if in those modes
        if (this.settings.wordSource === 'seen' || this.settings.wordSource === 'unseen') {
            this.loadSeenWords()
        }

        // Restore auto speed zone on reload
        if (this.settings.autoSpeed && this.settings.autoSpeedBase > 0) {
            this.autoSpeedZone = 'base'
            this.settings.speed = this.settings.autoSpeedBase
        }

        // Resume rest countdown if we were in rest with a timer
        if (browser && this.sessionPhase === 'rest') {
            const restEndAt = parseInt(localStorage.getItem('restEndAt') || '0')
            if (restEndAt > Date.now()) {
                this.startRestCountdown(restEndAt)
            } else if (restEndAt > 0) {
                // Timer already expired while closed
                localStorage.removeItem('restEndAt')
                this.restSecondsLeft = 0
            }
        }

        this.pickNextWord()
        if (browser) {
            this.lettersAudio = initializeAudio()
            try {
                this.sessionJournals = JSON.parse(localStorage.getItem("sessionJournals") || "[]")
            } catch { /* ignore */ }
        }
    }

    private loadGameSound() {
        if (!browser) return
        const win = new Audio("/win.wav")
        const wrong = new Audio("/wrong.wav")
        // Force preload so audio is ready to play immediately
        win.preload = 'auto'
        wrong.preload = 'auto'
        win.load()
        wrong.load()
        this.gameSound.win = win
        this.gameSound.wrong = wrong
    }

    private shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private startTimer() {
        if (this.timer) cancelAnimationFrame(this.timer);

        let start = performance.now();
        let pausedAt: number | null = null;
        const max = this.wordMaxDuration * 1000; // ms

        const tick = (now: number) => {
            if (this.typedWord === "") {
                // ⏸ pause if user cleared typedWord
                pausedAt = now;
                this.timer = requestAnimationFrame(tick);
                return;
            }

            if (pausedAt !== null) {
                // ▶ resume
                start += now - pausedAt;
                pausedAt = null;
            }

            const elapsed = now - start;
            this.wordTimerDuration = Math.max((max - elapsed) / 1000, 0);

            if (this.wordTimerDuration <= 0) {
                this.handleError('timer');
                this.timer = null;
            } else {
                this.timer = requestAnimationFrame(tick);
            }
        };

        this.timer = requestAnimationFrame(tick);
    }

    setTimer() {
        let lastLetter = ""
        let totalWait = 0

        const word = this.currentWord!.word
        const speed = Math.max(this.settings.speed || 0, 1)

        const baseDelay = 1 / speed
        const repeatMultiplier = (this.settings.sameLetterDelayPercent ?? 100) / 100

        for (const letter of word) {
            if (lastLetter === letter) {
                totalWait += baseDelay * repeatMultiplier
            } else {
                totalWait += baseDelay
            }
            lastLetter = letter
        }

        // Warmup: 50% more time
        const warmupBonus = this.isWarmup ? 1.5 : 1;
        this.wordMaxDuration = totalWait * warmupBonus
        this.wordTimerDuration = totalWait * warmupBonus
    }

    private buildTypingFlow(correct: boolean, errorType?: 'self' | 'timer'): TypingFlow {
        const intervals: number[] = []
        const reactionTime = this.keystrokeTimestamps.length > 0
            ? this.keystrokeTimestamps[0] - this.wordShownAt
            : 0
        // First letter interval is 0 (reaction time is tracked separately)
        if (this.keystrokeTimestamps.length > 0) {
            intervals.push(0)
        }
        for (let i = 1; i < this.keystrokeTimestamps.length; i++) {
            intervals.push(this.keystrokeTimestamps[i] - this.keystrokeTimestamps[i - 1])
        }
        const firstKeystroke = this.keystrokeTimestamps.length > 0
            ? this.keystrokeTimestamps[0]
            : this.wordShownAt
        const lastKeystroke = this.keystrokeTimestamps.length > 0
            ? this.keystrokeTimestamps[this.keystrokeTimestamps.length - 1]
            : this.wordShownAt
        const speed = Math.max(this.settings.speed || 0, 1)
        return {
            letterIntervals: intervals,
            reactionTime,
            totalDuration: lastKeystroke - firstKeystroke,
            timestamp: Date.now(),
            correct,
            speed: this.settings.speed,
            msPerLetter: 1000 / speed,
            mode: this.settings.franticMode ? 'chaos' : this.settings.displayMode === 'full-word' ? 'full-word' : 'letter-by-letter',
            direction: this.settings.letterStyle.letterDisplayDirection,
            ...(!correct && errorType ? { errorType } : {}),
        }
    }

    private updateWordStatsInDb(wordStr: string, updateFn: (savedWord: SavedWord) => SavedWord, flow?: TypingFlow): void {
        if (!browser) return
        // Capture current word NOW before setTimeout, since pickNextWord() changes it
        const capturedWord = this.currentWord!
        setTimeout(async () => {
            let savedWord = await this.database.getWord(wordStr)
            const now = Date.now()

            if (!savedWord) {
                savedWord = {
                    word: capturedWord,
                    stats: {
                        starred: false,
                        seen: 0,
                        correctlyTyped: 0,
                        wronglyTyped: 0,
                        lastSeen: 0,
                    },
                    jounal: {
                        description: "",
                        tag: [],
                    },
                    typingFlows: [],
                    createdAt: now,
                }
            }

            savedWord = updateFn(savedWord)
            savedWord.stats.seen = (savedWord.stats.seen || 0) + 1
            savedWord.stats.lastSeen = now // Always update lastSeen on any interaction

            if (flow && flow.letterIntervals.length > 0) {
                if (!savedWord.typingFlows) savedWord.typingFlows = []
                savedWord.typingFlows.push(flow)
                if (savedWord.typingFlows.length > 50) {
                    savedWord.typingFlows = savedWord.typingFlows.slice(-50)
                }
            }

            await this.database.saveWord(savedWord)
        })
    }

    private advanceLevel() {
        if (this.settings.autoSpeed) {
            // In auto mode: ratchet the base speed up permanently
            this.settings.autoSpeedBase = parseFloat((this.settings.autoSpeedBase * this.AUTO_SPEED_BUMP).toFixed(4));
            if (this.settings.lockedMinSpeed > 0) {
                this.settings.lockedMinSpeed = this.settings.autoSpeedBase;
            }
            this.dojoState.progress = 0;
            return;
        }

        let nextSpeed = this.settings.speed;

        if (this.settings.typeRestartLevelOnErrorOnLevelCompletion) {
            this.settings.restartLevelOnError = !this.settings.restartLevelOnError;
            if (!this.settings.restartLevelOnError) {
                nextSpeed *= 1.05;
            }
        } else {
            nextSpeed *= 1.05;
        }

        this.settings.speed = parseFloat(nextSpeed.toFixed(4));
        this.savedLevelSpeed = this.settings.speed

        // Commitment lock: update the floor speed on level-up
        if (this.settings.lockedMinSpeed > 0) {
            this.settings.lockedMinSpeed = this.settings.speed;
        }

        this.dojoState.progress = 0;
    }

    /** Activate commitment lock at current speed */
    lockSpeed() {
        this.settings.lockedMinSpeed = this.settings.autoSpeed ? this.settings.autoSpeedBase : this.settings.speed;
    }

    /** Release commitment lock */
    unlockSpeed() {
        this.settings.lockedMinSpeed = 0;
    }

    /** Enable auto speed mode — takes over speed control */
    enableAutoSpeed() {
        // Save current manual speed before switching
        this.settings.savedManualSpeed = this.settings.speed;
        this.settings.autoSpeed = true;
        if (!this.settings.autoSpeedBase || this.settings.autoSpeedBase <= 0) {
            this.settings.autoSpeedBase = this.settings.speed || 2;
        }
        this.setAutoSpeedZone('base');
    }

    /** Disable auto speed — return to saved manual speed */
    disableAutoSpeed() {
        this.settings.autoSpeed = false;
        // Restore saved manual speed (respect commitment lock)
        const restored = this.settings.savedManualSpeed || this.settings.speed;
        this.settings.speed = this.settings.lockedMinSpeed > 0
            ? Math.max(restored, this.settings.lockedMinSpeed)
            : restored;
    }

    /** Copy auto speed base to manual speed (respect commitment lock) */
    useAutoSpeedAsManual() {
        const speed = this.settings.lockedMinSpeed > 0
            ? Math.max(this.settings.autoSpeedBase, this.settings.lockedMinSpeed)
            : this.settings.autoSpeedBase;
        this.settings.savedManualSpeed = speed;
        this.settings.speed = speed;
    }

    /** Copy current manual speed to auto speed base and reset zone */
    useManualSpeedAsAuto() {
        const speed = this.settings.lockedMinSpeed > 0
            ? Math.max(this.settings.speed, this.settings.lockedMinSpeed)
            : this.settings.speed;
        this.settings.autoSpeedBase = speed;
        this.setAutoSpeedZone('base');
    }

    handleError(errorType: 'self' | 'timer' = 'self') {
        // Warmup: skip stats, just pick next word
        if (this.isWarmup) {
            this.warmupRemaining--;
            if (!this.settings.noFeedbackSound) this.playSound(this.gameSound.wrong, 0.2)
            this.lastEvent = { type: "error", id: ++this.eventCounter }
            this.pickNextWord()
            return
        }

        if (errorType === 'self') this.sessionSelfErrors++;
        else this.sessionTimerErrors++;
        this.lastErrorType = errorType;
        this.consecutiveErrors++;
        const flow = this.currentWord ? this.buildTypingFlow(false, errorType) : null
        if (!flow || !isInstantFail(flow)) {
            this.recordAutoSpeedResult(false)
            this.recordFatigueResult(false)
        }
        if (flow) this.updatePresenceState(flow)
        if (!this.settings.autoSpeed) {
            this.dojoState.progress = Math.max(this.settings.restartLevelOnError ? 0 : this.dojoState.progress - 1, 0)
        }
        if (this.currentWord && flow) {
            this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                sw.stats.wronglyTyped = (sw.stats.wronglyTyped || 0) + 1
                return sw
            }, flow)
        }

        // Gamification — error breaks combo
        this.combo = 0
        this.sessionErrors++
        this.totalErrors++
        const errorDuration = performance.now() - this.wordShownAt
        this.lastWordCompletedAt = Date.now()
        this.sessionTimeline.push({
            word: this.currentWord?.word || '',
            correct: false,
            duration: errorDuration,
            ts: Date.now(),
        })
        this.persistTimeline()
        this.checkSessionTime(errorDuration)
        this.lastEvent = { type: "error", id: ++this.eventCounter }
        this.persistProgress()

        if (!this.settings.noFeedbackSound) {
            this.playSound(this.gameSound.wrong, 0.2)
        }

        // Breathe delay after error — hide word, stop timer, show animation, then pick next word
        const delay = this.settings.breatheDelay
        if (delay > 0 && this.settings.showNewWordOnError) {
            // Clear the current word so nothing is displayed during breathe
            this.currentWord = null
            this.typedWord = ''
            // Stop the word timer
            if (this.timer) { cancelAnimationFrame(this.timer); this.timer = null; }
            // Stop reaction timer
            if (this.reactionTimer) { cancelAnimationFrame(this.reactionTimer); this.reactionTimer = null; }
            this.reactionTimeMs = null

            this.breatheActive = true
            this.breathePromptText = this.pickBreathePrompt()
            if (this.breatheTimer) clearTimeout(this.breatheTimer)
            this.breatheTimer = setTimeout(() => {
                this.breatheActive = false
                this.breatheTimer = null
                this.pickNextWord() // word appears here — reaction timer starts fresh
            }, delay)
        } else {
            this.pickNextWord()
        }
    }

    playSound(audio: HTMLAudioElement, start: number = 0.0) {
        try {
            audio.currentTime = start
        } catch {
            // Seeking may fail on custom protocols — play from beginning
            audio.currentTime = 0
        }
        audio.play().catch(() => {})
    }

    playLetter(letter: string, start = 0.0) {
        const audio = this.lettersAudio[letter.toLowerCase()];
        if (audio) this.playSound(audio, start);
    }


    processLetterAudio() {
        const letter = this.currentWord?.word.at(this.typedWord.length);
        if (!letter) return;

        const { sayCurrentWord, focusOnLetter, focusOnVoice } = this.settings.voice;

        if (sayCurrentWord || focusOnVoice) {
            this.playLetter(letter);
        } else if (focusOnLetter) {
            this.playLetter(getRandomChar());
        }
    }

    validateTypedWord() {
        if (!this.typedWord) {
            this.processLetterAudio();
            return; // ⏸ timer pause handled in startTimer()
        }

        if (!this.timer) {
            this.startTimer();
        }

        if (this.currentWord?.word === this.typedWord) {
            // Warmup: skip all stats, just play sound and continue
            if (this.isWarmup) {
                this.warmupRemaining--
                if (!this.settings.noFeedbackSound) this.playSound(this.gameSound.win, 0.3)
                this.lastEvent = { type: "success", text: `warmup ${this.warmupRemaining}`, id: ++this.eventCounter }
                this.pickNextWord()
                return
            }

            this.recordAutoSpeedResult(true)
            this.recordFatigueResult(true)
            if (this.currentWord) {
                const flow = this.buildTypingFlow(true)
                this.updatePresenceState(flow)

                this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                    sw.stats.correctlyTyped = (sw.stats.correctlyTyped || 0) + 1;
                    return sw;
                }, flow)
            }

            // Gamification — combo + XP
            this.combo++
            this.consecutiveErrors = 0
            this.sessionCorrect++
            this.totalCorrect++
            const successDuration = performance.now() - this.wordShownAt
            this.lastWordCompletedAt = Date.now()
            this.sessionTimeline.push({
                word: this.currentWord?.word || '',
                correct: true,
                duration: successDuration,
                ts: Date.now(),
            })
            this.persistTimeline()
            this.checkSessionTime(successDuration)
            if (this.combo > this.bestCombo) this.bestCombo = this.combo

            const wordLen = this.currentWord?.word.length || 1
            const comboMultiplier = 1 + Math.floor(this.combo / 5) * 0.5 // +0.5x every 5 combo
            const xpGain = Math.round(wordLen * comboMultiplier)
            const prevBelt = this.belt
            this.xp += xpGain

            if (this.belt.name !== prevBelt.name) {
                this.lastEvent = { type: "rank-up", text: this.belt.name, id: ++this.eventCounter }
            } else {
                this.lastEvent = { type: "success", text: `+${xpGain}`, id: ++this.eventCounter }
            }

            if (!this.settings.noFeedbackSound) {
                if ((this.settings.displayMode === 'full-word') ||
                    (this.settings.letterStyle.letterDisplayDirection === 'left-to-right') ||
                    !this.settings.noSuccessFeedbackSound) {
                    this.playSound(this.gameSound.win, 0.3);
                }
            }

            if (!this.settings.autoSpeed) {
                this.dojoState.progress = Math.min(this.dojoState.progress + 1, 100);
                if (this.dojoState.progress >= 100) {
                    this.advanceLevel();
                }
            }
            this.persistProgress()

            this.pickNextWord();
            return;
        }

        this.processLetterAudio();

        if (this.currentWord?.word.startsWith(this.typedWord)) {
            return; // still valid partial input
        }

        if (this.settings.showNewWordOnError) {
            this.handleError();
        }
    }

    onKeyDown(event: KeyboardEvent): void {
        if (this.breatheActive) return
        const key = event.key
        if (key !== "Backspace") return
        if (this.holdDelete) return
        this.holdDelete = true

        this.typedWord = this.typedWord.slice(0, -1)
        this.validateTypedWord()
    }

    onKeyPress(event: KeyboardEvent): void {
        if (this.breatheActive) return
        const key = event.key
        event.preventDefault()
        if (this.currentWord?.word.length === this.typedWord.length) return

        // Stop reaction timer on first keystroke
        if (this.keystrokeTimestamps.length === 0 && this.reactionTimeMs !== null) {
            this.lastReactionTime = this.reactionTimeMs;
            this.reactionTimeMs = null;
            if (this.reactionTimer) {
                cancelAnimationFrame(this.reactionTimer);
                this.reactionTimer = null;
            }
        }

        this.keystrokeTimestamps.push(performance.now())
        this.typedWord += key
        this.validateTypedWord()
    }

    onKeyUp(event: KeyboardEvent): void {
        const key = event.key
        if (key !== "Backspace") return
        this.holdDelete = false
    }

    enableChaosMode(): void {
        if (this.preChaosSettings === null) {
            this.preChaosSettings = JSON.parse(JSON.stringify(this.settings));
        }
        this.settings.franticMode = true;
    }

    disableChaosMode(): void {
        if (this.preChaosSettings !== null) {
            const snapshot = this.preChaosSettings;
            snapshot.franticMode = false;
            snapshot.franticSettings = { ...this.settings.franticSettings };
            this.settings = snapshot;
            this.preChaosSettings = null;
        }
    }

    generateRandomSetting(): void {
        if (!this.settings.franticMode) return;

        if (this.preChaosSettings === null) {
            this.preChaosSettings = JSON.parse(JSON.stringify(this.settings));
        }

        const flags = this.settings.franticSettings;
        let newSettings: MindDojoSettings = { ...this.settings };

        // helper
        const randBool = () => Math.random() < 0.5;
        const randInt = (min: number, max: number) =>
            Math.floor(Math.random() * (max - min + 1)) + min;

        // Change display mode
        if (flags.shouldChangeDisplayMode) {
            newSettings.displayMode = randBool() ? 'letter-by-letter' : 'full-word';
        }

        // Letter style randomization
        if (flags.shouldChangeLetterStyle && newSettings.displayMode === 'letter-by-letter') {
            newSettings.letterStyle = {
                ...newSettings.letterStyle,
                letterDisplayDirection: randBool() ? 'left-to-right' : 'center',
                randomColor: randBool(),
                randomFont: randBool(),
                randomWeight: randBool(),
                randomSize: randBool(),
                randomTransform: randBool(),
            };
        }

        // Progress bar
        if (flags.shouldChangeProgressBarVisibility) {
            newSettings.hideProgressBar = randBool();
        }

        // Timer
        if (flags.shouldChangeTimerVisibility) {
            newSettings.hideTimer = randBool();
        }

        // Restart on error
        if (flags.shouldChangeRestartOnError) {
            newSettings.restartLevelOnError = randBool();
        }

        // Word positioning
        if (flags.shouldChangeRandomWordPosition) {
            newSettings.randomlyMoveWordStarting = randBool();
        }

        // Hide typed letter
        if (flags.shouldChangeHideTypedLetter) {
            newSettings.hideTypedLetter = randBool();
        }

        // ✅ Word length randomization
        if (flags.shouldChangeWordLength) {
            // Get the lengths of the filtered words

            const randomMin = randInt(3, 30);
            const randomMax = randInt(randomMin, 30); // ensure max >= min

            const isZero = this.words.filter((w) => {
                const l = w.word.length
                return (l >= randomMin) && (l <= randomMax)
            }).length == 0;

            if (isZero) {
                newSettings.minWordLength = 1;
                newSettings.maxWordLength = 30;
            }
            else {
                newSettings.minWordLength = randomMin;
                newSettings.maxWordLength = randomMax;
            }


        }

        // Finally assign back
        this.settings = newSettings;
    }

    generateRandomLettersWord() {
        const { maxWordLength = 1, minWordLength = 30 } = this.settings

        let pickedWord: Word = {
            antonyms: [],
            meanings: [],
            synonyms: [],
            word: ''
        }
        const wordLength = Math.floor(Math.random() * (maxWordLength - minWordLength + 1)) + minWordLength
        for (let i = 0; i < wordLength; i++) {
            pickedWord.word += getRandomChar(false, Math.random() > 0.85, this.settings.excludeLetters)
        }
        return pickedWord
    }

    generateWord() {
        let pickedWord: Word = {
            antonyms: [],
            meanings: [],
            synonyms: [],
            word: ''
        }
        const { maxWordLength = 1, minWordLength = 30 } = this.settings

        // Select word source based on setting
        let sourceWords = this.words;
        if (this.seenWordsLoaded) {
            if (this.settings.wordSource === 'seen' && this.seenWords.length > 0) sourceWords = this.seenWords;
            else if (this.settings.wordSource === 'unseen' && this.unseenWords.length > 0) sourceWords = this.unseenWords;
        }

        const tempWords = sourceWords.filter(w => {
            for (const l of this.settings.excludeLetters) {
                if (w.word.includes(l)) return false
            }
            return true;
        }).filter((w) => {
            if (minWordLength > w.word.length) return false
            if (maxWordLength < w.word.length) return false
            return true
        })
        if (this.currentIndex >= tempWords.length) {
            this.currentIndex = 0;
        }
        pickedWord = tempWords[this.currentIndex];
        this.currentIndex++;
        return pickedWord
    }

    pickNextWord(): void {
        if (this.sessionExpired) return
        this.checkIdleGap()
        this.checkLevelReset()
        this.advanceAutoSpeedZone()
        this.generateRandomSetting();

        let isRandom = this.settings.joinRandomLetters && (!this.settings.mixJoinRandomLetters || Math.random() < 0.8)
        this.currentWordIsRandom = isRandom
        const pickedWord = (isRandom ? this.generateRandomLettersWord : this.generateWord).bind(this)()

        this.currentWord = pickedWord;

        for (let i = 0; i < pickedWord.word.length; i++) {
            this.currentWordStyle[i] = getBaseStyle(this.currentWord.word[i], this.settings);
        }
        this.wordTransformStyle = generateRandomShiftOfWordPosition(pickedWord.word, this.settings)

        this.typedWord = "";
        this.keystrokeTimestamps = [];
        this.wordShownAt = performance.now();

        // Start reaction time counter
        this.reactionTimeMs = 0;
        if (this.reactionTimer) cancelAnimationFrame(this.reactionTimer);
        const reactionStart = this.wordShownAt;
        const tickReaction = (now: number) => {
            if (this.reactionTimeMs === null) return; // stopped on first key
            this.reactionTimeMs = now - reactionStart;
            this.reactionTimer = requestAnimationFrame(tickReaction);
        };
        this.reactionTimer = requestAnimationFrame(tickReaction);

        // ✅ reset durations
        this.setTimer();

        // ✅ fully stop old timer loop
        if (this.timer) {
            cancelAnimationFrame(this.timer);
            this.timer = null;
        }

        this.processLetterAudio()
    }



    public reset(words: Words): void {
        this.words = this.shuffle(words)
        this.currentIndex = 0
        this.dojoState.progress = 0
        this.dojoState.lastOutcome = ""
        this.pickNextWord()
    }
}
