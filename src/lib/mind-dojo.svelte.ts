import { browser } from "$app/environment"
import { getRandomChar, initializeAudio } from "$lib"
import { SavedWordDB } from "./database.svelte"
import type { MindDojoSettings, SavedWord, Word, Words } from "./structure"
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

export class MindDojo {
    private words: Words = []
    private currentIndex = 0

    database: SavedWordDB

    gameSound: {
        win: HTMLAudioElement
        wrong: HTMLAudioElement
    } = {} as any

    holdDelete = false

    settings: MindDojoSettings = $state(getSettings())

    dojoState = $state({
        progress: 0,
        lastOutcome: "" as "success" | "error" | "timeout" | "",
    })

    currentWord: Word | null = $state(null)
    typedWord: string = $state("")
    wordTimerDuration = $state(0)
    wordMaxDuration = $state(0)
    timer: number | null = null
    currentWordStyle: string[] = $state([])
    wordTransformStyle: string = $state('')

    lettersAudio: {
        [k: string]: HTMLAudioElement;
    } = {}



    constructor(words: Words) {
        this.words = this.shuffle(words)

        this.database = new SavedWordDB()
        this.loadGameSound()
        this.pickNextWord()
        if (browser) {
            this.lettersAudio = initializeAudio()
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

    private updateWordStatsInDb(wordStr: string, updateFn: (savedWord: SavedWord) => SavedWord): void {
        if (!browser) return
        setTimeout(async () => {
            let savedWord = await this.database.getWord(wordStr)
            const now = Date.now()

            if (!savedWord) {
                // If for some reason the word isn't in DB yet, create a base entry
                savedWord = {
                    word: this.currentWord!, // Assuming currentWord is not null here
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
                    createdAt: now,
                }
            }

            savedWord = updateFn(savedWord)
            savedWord.stats.lastSeen = now // Always update lastSeen on any interaction

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
        this.dojoState.progress = 0;
    }

    shouldSave() {
        if (!this.settings.saveTypedWord) return false
        if (this.settings.joinRandomLetters) return false;
        if ((this.settings.displayMode === 'letter-by-letter') &&
            (this.settings.letterStyle.letterDisplayDirection === 'center')) return false
        return true
    }

    handleError() {
        this.dojoState.progress = Math.max(this.settings.restartLevelOnError ? 0 : this.dojoState.progress - 1, 0)
        if (this.currentWord && this.shouldSave()) {
            this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                sw.stats.wronglyTyped = (sw.stats.wronglyTyped || 0) + 1
                return sw
            })
        }

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
            if (this.currentWord && this.shouldSave()) {
                this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                    sw.stats.correctlyTyped = (sw.stats.correctlyTyped || 0) + 1;
                    return sw;
                });
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

        this.typedWord += key
        this.validateTypedWord()
    }

    onKeyUp(event: KeyboardEvent): void {
        const key = event.key
        if (key !== "Backspace") return
        this.holdDelete = false
    }

    generateRandomSetting(): void {
        if (!this.settings.franticMode) return;

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
        this.generateRandomSetting();

        let isRandom = this.settings.joinRandomLetters && (!this.settings.mixJoinRandomLetters || Math.random() < 0.8)
        const pickedWord = (isRandom ? this.generateRandomLettersWord : this.generateWord).bind(this)()

        if (!this.settings.joinRandomLetters && this.settings.saveTypedWord && this.shouldSave()) {
            this.updateWordStatsInDb(pickedWord.word, (sw) => {
                sw.stats.seen = (sw.stats.seen || 0) + 1;
                return sw;
            });
        }

        this.currentWord = pickedWord;

        for (let i = 0; i < pickedWord.word.length; i++) {
            this.currentWordStyle[i] = getBaseStyle(this.currentWord.word[i], this.settings);
        }
        this.wordTransformStyle = generateRandomShiftOfWordPosition(pickedWord.word, this.settings)

        this.typedWord = "";

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
