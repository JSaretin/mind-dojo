import { browser } from "$app/environment"
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
    if (!browser) return defaultSetting
    return JSON.parse(localStorage.getItem("settings") || JSON.stringify(defaultSetting))
}

export class MindDojo {
    private words: Words = []
    private currentIndex = 0

    database: SavedWordDB

    gameSound: {
        win: HTMLAudioElement
        wrong: HTMLAudioElement
    } = {} as any

    specialKeyIsHeld = false
    holdDelete = false

    settings: MindDojoSettings = $state(getSettings())

    dojoState = $state({
        level: 1,
        progress: 0,
        lastOutcome: "" as "success" | "error" | "timeout" | "",
    })

    currentWord: Word | null = $state(null)
    typedWord: string = $state("")
    wordTimerDuration = $state(0)
    wordMaxDuration = $state(0)
    timer: number | null = null

    // savedWords: SavedWord[] = $state([])

    constructor(words: Words) {
        this.words = this.shuffle(words)

        this.database = new SavedWordDB()
        this.loadGameSound()
        this.pickNextWord()
        // setTimeout(
        //     (async () => {
        //         if (!browser) return
        //         this.savedWords = await this.database.getAllWords()
        //     }).bind(this),
        // )
    }

    private loadGameSound() {
        if (!browser) return
        this.gameSound.win = new Audio("/win.wav")
        this.gameSound.wrong = new Audio("/wrong.wav")
    }

    private shuffle<T>(array: T[]): T[] {
        const result = array.slice()
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
                ;[result[i], result[j]] = [result[j], result[i]]
        }
        return result
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
            // this.savedWords = await this.database.getAllWords() // Re-fetch all words to update UI
        })
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
            setTimeout((async () => {
                this.gameSound.wrong.currentTime = 0.2
                this.gameSound.wrong.play()
            }).bind(this), 0)
        }
        this.pickNextWord()
    }

    validateTypedWord() {
        if (!this.typedWord) {
            if (this.timer) {
                clearInterval(this.timer)
                this.timer = null
            }
            return
        }

        if (!this.timer) {
            this.timer = setInterval(() => {
                this.wordTimerDuration = Math.max(this.wordTimerDuration - 0.01, 0)

                if (this.wordTimerDuration <= 0) {
                    this.handleError()
                    clearInterval(this.timer!)
                    this.timer = null
                }
            }, 10)
        }

        if (this.currentWord?.word === this.typedWord) {
            if (this.currentWord) {
                this.updateWordStatsInDb(this.currentWord.word, (sw) => {
                    sw.stats.correctlyTyped = (sw.stats.correctlyTyped || 0) + 1
                    return sw
                })
            }

            setTimeout((async () => {
                if (!this.settings.noFeedbackSound) {
                    this.gameSound.win.currentTime = 0.3
                    this.gameSound.win.play()
                }
            }).bind(this), 0)


            this.dojoState.progress = Math.min(this.dojoState.progress + 1, 100)
            if (this.dojoState.progress >= 100) {
                let nextSpead = this.settings.speed;
                if (this.settings.typeRestartLevelOnErrorOnLevelCompletion) {
                    if (this.settings.restartLevelOnError) {
                        this.settings.restartLevelOnError = false;
                        nextSpead = this.settings.speed * 1.05;
                    } else {
                        this.settings.restartLevelOnError = true;
                    }
                } else {
                    nextSpead = this.settings.speed * 1.05;
                }

                this.settings.speed = Number.parseFloat((nextSpead).toFixed(4))
                this.dojoState.progress = 0
            }
            this.pickNextWord()
            return
        }

        if (this.currentWord?.word.startsWith(this.typedWord)) {
            return
        }

        if (!this.settings.showNewWordOnError) {
            return
        }

        this.handleError()
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
        // Reset index if we've reached the end
        if (this.currentIndex >= this.words.length) {
            this.currentIndex = 0
        }

        // Shuffle and pick a word
        const pickedWord = this.words[this.currentIndex]

        // Update seen count and lastSeen for the picked word
        this.updateWordStatsInDb(pickedWord.word, (sw) => {
            sw.stats.seen = (sw.stats.seen || 0) + 1
            return sw
        })

        this.currentWord = pickedWord

        this.typedWord = ""
        this.currentIndex++

        this.setTimer()
        this.validateTypedWord()
    }

    public reset(words: Words): void {
        this.words = this.shuffle(words)
        this.currentIndex = 0
        this.dojoState.level = 1
        this.dojoState.progress = 0
        this.dojoState.lastOutcome = ""
        this.pickNextWord()
    }
}
