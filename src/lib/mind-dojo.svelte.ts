import { browser } from "$app/environment"
import { getRandomChar, initializeAudio } from "$lib"
import { SavedWordDB } from "./database.svelte"
import type { MindDojoSettings, SavedWord, Word, Words } from "./structure"

const defaultSetting: MindDojoSettings = {
    speed: 2,
    sameLetterDelayPercent: 60,
    excludeLetters: "",
    displayMode: "letter-by-letter",
    letterStyle: {
        randomSize: true,
        randomWeight: true, // added
        randomFont: true,
        randomTransform: true, // added
        randomColor: true,
        letterDisplayDirection: "center",
    },
    voice: {
        sayCurrentWord: false,
        focusOnVoice: false,
        focusOnLetter: true,
    },
    wordMix: {
        includeNumbers: true,
        numberMode: "random",
        includeUppercase: true,
        includeLowercase: true,
    },
    hideProgressBar: false,
    hideTimer: false,
    restartLevelOnError: true,
    showNewWordOnError: true,
    hideTypedLetter: false,
    noFeedbackSound: false,
    randomlyMoveWordStarting: true,
    typeRestartLevelOnErrorOnLevelCompletion: true
}

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
        const speed = Math.max(this.settings.speed, 1)

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

    handleError() {
        this.dojoState.progress = Math.max(this.settings.restartLevelOnError ? 0 : this.dojoState.progress - 1, 0)
        if (this.currentWord) {
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
            if (this.currentWord) {
                this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                    sw.stats.correctlyTyped = (sw.stats.correctlyTyped || 0) + 1;
                    return sw;
                });
            }

            if (!this.settings.noFeedbackSound) {
                this.playSound(this.gameSound.win, 0.3);
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

    pickNextWord(): void {
        if (this.currentIndex >= this.words.length) {
            this.currentIndex = 0;
        }

        const pickedWord = this.words[this.currentIndex];

        this.updateWordStatsInDb(pickedWord.word, (sw) => {
            sw.stats.seen = (sw.stats.seen || 0) + 1;
            return sw;
        });

        this.currentWord = pickedWord;
        this.typedWord = "";
        this.currentIndex++;

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
