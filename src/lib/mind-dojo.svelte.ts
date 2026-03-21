import { browser } from "$app/environment"
import { getRandomChar, initializeAudio } from "$lib"
import { SavedWordDB } from "./database.svelte"
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
    combo = $state(0)
    sessionCorrect = $state(0)
    sessionErrors = $state(0)
    sessionStartTime = Date.now()
    sessionTimeline: { word: string; correct: boolean; duration: number; ts: number }[] = $state(
        browser ? (() => { try { return JSON.parse(localStorage.getItem("sessionTimeline") || "[]") } catch { return [] } })() : []
    )
    sessionPhase: 'active' | 'rest' | 'idle' = $state('idle')
    restSecondsLeft = $state(0)
    private sessionTimer: ReturnType<typeof setTimeout> | null = null
    private restInterval: ReturnType<typeof setInterval> | null = null
    sessionJournals: { text: string; timestamp: number }[] = $state([])

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
        this.clearTimers()
        const duration = this.settings.sessionDuration
        if (!duration || duration <= 0) {
            this.sessionPhase = 'active'
            return
        }
        this.sessionPhase = 'active'
        this.sessionTimer = setTimeout(() => {
            this.enterRest()
        }, duration * 60 * 1000)
    }

    private enterRest() {
        this.sessionPhase = 'rest'
        // Stop the word timer
        if (this.timer) {
            cancelAnimationFrame(this.timer)
            this.timer = null
        }
        const restMins = this.settings.restDuration
        if (restMins > 0) {
            this.restSecondsLeft = restMins * 60
            this.restInterval = setInterval(() => {
                this.restSecondsLeft--
                if (this.restSecondsLeft <= 0) {
                    this.endRest()
                }
            }, 1000)
        }
    }

    endRest() {
        this.clearTimers()
        this.sessionPhase = 'active'
        this.sessionCorrect = 0
        this.sessionErrors = 0
        this.sessionTimeline = []
        this.persistTimeline()
        this.sessionStartTime = Date.now()
        this.combo = 0
        this.startSessionTimer()
        this.pickNextWord()
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



    constructor(words: Words) {
        this.words = this.shuffle(words)

        this.database = new SavedWordDB()
        this.loadGameSound()
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
        this.gameSound.win = new Audio("/win.wav")
        this.gameSound.wrong = new Audio("/wrong.wav")
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
                this.handleError();
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

        this.wordMaxDuration = totalWait
        this.wordTimerDuration = totalWait
    }

    private buildTypingFlow(correct: boolean): TypingFlow {
        const intervals: number[] = []
        if (this.keystrokeTimestamps.length > 0) {
            intervals.push(this.keystrokeTimestamps[0] - this.wordShownAt)
        }
        for (let i = 1; i < this.keystrokeTimestamps.length; i++) {
            intervals.push(this.keystrokeTimestamps[i] - this.keystrokeTimestamps[i - 1])
        }
        const lastKeystroke = this.keystrokeTimestamps.length > 0
            ? this.keystrokeTimestamps[this.keystrokeTimestamps.length - 1]
            : this.wordShownAt
        return {
            letterIntervals: intervals,
            totalDuration: lastKeystroke - this.wordShownAt,
            timestamp: Date.now(),
            correct,
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
        this.dojoState.progress = 0;
    }

    handleError() {
        this.dojoState.progress = Math.max(this.settings.restartLevelOnError ? 0 : this.dojoState.progress - 1, 0)
        if (this.currentWord) {
            const flow = this.buildTypingFlow(false)

            this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                sw.stats.wronglyTyped = (sw.stats.wronglyTyped || 0) + 1
                return sw
            }, flow)
        }

        // Gamification — error breaks combo
        this.combo = 0
        this.sessionErrors++
        this.totalErrors++
        this.sessionTimeline.push({
            word: this.currentWord?.word || '',
            correct: false,
            duration: performance.now() - this.wordShownAt,
            ts: Date.now(),
        })
        this.persistTimeline()
        this.lastEvent = { type: "error", id: ++this.eventCounter }
        this.persistProgress()

        if (!this.settings.noFeedbackSound) {
            this.playSound(this.gameSound.wrong, 0.2)
        }
        this.pickNextWord()
    }

    playSound(audio: HTMLAudioElement, start: number = 0.0) {
        audio.currentTime = start
        audio.play()
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
            if (this.currentWord) {
                const flow = this.buildTypingFlow(true)

                this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                    sw.stats.correctlyTyped = (sw.stats.correctlyTyped || 0) + 1;
                    return sw;
                }, flow)
            }

            // Gamification — combo + XP
            this.combo++
            this.sessionCorrect++
            this.totalCorrect++
            this.sessionTimeline.push({
                word: this.currentWord?.word || '',
                correct: true,
                duration: performance.now() - this.wordShownAt,
                ts: Date.now(),
            })
            this.persistTimeline()
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

            this.dojoState.progress = Math.min(this.dojoState.progress + 1, 100);
            if (this.dojoState.progress >= 100) {
                this.advanceLevel();
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
        const key = event.key
        if (key !== "Backspace") return
        if (this.holdDelete) return
        this.holdDelete = true

        this.typedWord = this.typedWord.slice(0, -1)
        this.validateTypedWord()
    }

    onKeyPress(event: KeyboardEvent): void {
        const key = event.key
        event.preventDefault()
        if (this.currentWord?.word.length === this.typedWord.length) return

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

        const tempWords = this.words.filter(w => {
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
        this.checkLevelReset()
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
