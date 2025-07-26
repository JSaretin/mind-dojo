import { browser } from "$app/environment";


export type Meaning = [
    partOfSpeech: string,
    definition: string,
    synonyms: string[],
    examples: string[]
];
export interface Word {
    word: string;
    synonyms: string[];
    antonyms: string[];
    meanings: Meaning[];
}

export type Words = Word[];



export interface LetterStyleSettings {
    randomSize: boolean;
    randomWeight: boolean;   // added
    randomFont: boolean;
    randomTransform: boolean; // added
    randomColor: boolean;
    letterDisplayDirection: 'left-to-right' | 'center';
}

export interface VoiceSettings {
    sayCurrentWord: boolean;
    focusOnVoice: boolean;
    focusOnLetter: boolean;
}

export interface WordMixSettings {
    includeNumbers: boolean;
    numberMode: 'smart' | 'random';
    includeUppercase: boolean;
    includeLowercase: boolean;
}

export interface MindDojoSettings {
    speed: number;
    sameLetterDelayPercent: number;
    excludeLetters: string;
    displayMode: 'letter-by-letter' | 'full-word';
    letterStyle: LetterStyleSettings;
    voice: VoiceSettings;
    wordMix: WordMixSettings;
    hideProgressBar: boolean;
    hideTimer: boolean;
    restartLevelOnError: boolean;
    showNewWordOnError: boolean;
    hideTypedLetter: boolean;
}


const defaultSetting: MindDojoSettings = {
    speed: 2,
    sameLetterDelayPercent: 60,
    excludeLetters: '',
    displayMode: 'letter-by-letter',
    letterStyle: {
        randomSize: true,
        randomWeight: true,      // added
        randomFont: true,
        randomTransform: true,   // added
        randomColor: true,
        letterDisplayDirection: 'center'
    },
    voice: {
        sayCurrentWord: false,
        focusOnVoice: false,
        focusOnLetter: true
    },
    wordMix: {
        includeNumbers: true,
        numberMode: 'random',
        includeUppercase: true,
        includeLowercase: true
    },
    hideProgressBar: false,
    hideTimer: false,
    restartLevelOnError: true,
    showNewWordOnError: true,
    hideTypedLetter: false,
};




function getSettings() {
    if (!browser) return defaultSetting;
    return JSON.parse(localStorage.getItem('settings') || JSON.stringify(defaultSetting));
}



export class MindDojo {
    private words: Words = [];
    private currentIndex: number = 0;

    gameSound: {
        win: HTMLAudioElement,
        wrong: HTMLAudioElement
    } = {} as any

    specialKeyIsHeld = false;
    holdDelete = false;

    settings: MindDojoSettings = $state(getSettings());

    dojoState = $state({
        level: 1,
        progress: 0,
        lastOutcome: '' as 'success' | 'error' | 'timeout' | ''
    });

    currentWord: Word | null = $state(null);
    typedWord: string = $state('');
    wordTimerDuration = $state(0);
    wordMaxDuration = $state(0);
    timer: number | null = null;


    constructor(words: Words) {
        this.words = this.shuffle(words);

        this.loadGameSound()
        this.pickNextWord();
    }

    private loadGameSound() {
        if (!browser) return
        this.gameSound.win = new Audio('/win.wav');
        this.gameSound.wrong = new Audio('/wrong.wav');
    }

    private shuffle<T>(array: T[]): T[] {
        const result = array.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    setTimer() {
        let lastLetter: string = '';
        let totalWait = 0;

        const word = this.currentWord!.word;
        const speed = Math.max(this.settings.speed, 1);

        const baseDelay = 1 / speed;
        const repeatMultiplier = (this.settings.sameLetterDelayPercent ?? 100) / 100;

        for (const letter of word) {
            if (lastLetter === letter) {
                totalWait += baseDelay * repeatMultiplier;
            } else {
                totalWait += baseDelay;
            }
            lastLetter = letter;
        }

        this.wordMaxDuration = totalWait
        this.wordTimerDuration = totalWait;
    }


    handleError() {
        this.dojoState.progress = Math.max(this.settings.restartLevelOnError ? 0 : this.dojoState.progress - 1, 0)
        this.gameSound.wrong.currentTime = 0.2;
        this.gameSound.wrong.play();
        this.pickNextWord()

    }

    validateTypedWord() {
        if (!this.typedWord) {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            return;
        }

        if (!this.timer) {
            this.timer = setInterval(() => {
                this.wordTimerDuration = Math.max(this.wordTimerDuration - 0.1, 0);

                if (this.wordTimerDuration <= 0) {
                    this.handleError();
                    clearInterval(this.timer!);
                    this.timer = null;
                }
            }, 100);
        }


        if (this.currentWord?.word === this.typedWord) {
            this.gameSound.win.currentTime = 0.3;
            this.gameSound.win.play();

            this.dojoState.progress = Math.min(this.dojoState.progress + 1, 100)
            if (this.dojoState.progress >= 100) {
                this.settings.speed = parseFloat((this.settings.speed * 1.05).toFixed(4));
                this.dojoState.progress = 0;
            }
            this.pickNextWord()
            return
        }

        if (this.currentWord?.word.startsWith(this.typedWord)) {
            // on track
            return
        }

        if (!this.settings.showNewWordOnError) {
            // sound error alart
            return
        }

        this.handleError()

    }


    onKeyDown(event: KeyboardEvent): void {
        const key = event.key
        if (key !== 'Backspace') return
        if (this.holdDelete) return;
        this.holdDelete = true

        this.typedWord = this.typedWord.slice(0, -1)
        this.validateTypedWord();
    }

    onKeyPress(event: KeyboardEvent): void {
        const key = event.key;
        event.preventDefault()
        if (this.currentWord?.word.length === this.typedWord.length) return

        this.typedWord += key;
        this.validateTypedWord()
    }

    onKeyUp(event: KeyboardEvent): void {
        const key = event.key
        if (key !== 'Backspace') return
        this.holdDelete = false
    }

    pickNextWord(): void {
        // Reset index if we've reached the end
        if (this.currentIndex >= this.words.length) {
            this.currentIndex = 0;
        }

        // Filter out single-letter words if display direction is 'center'
        let candidateWords = this.words;
        if (this.settings.letterStyle?.letterDisplayDirection === 'center') {
            candidateWords = this.words.filter(w => w.word.length > 1);
        }

        // If no valid words left (e.g., all were single-letter), fallback to original list
        if (candidateWords.length === 0) {
            candidateWords = this.words;
        }

        // Shuffle and pick a word
        const pickedWord = candidateWords[this.currentIndex % candidateWords.length];
        this.currentWord = pickedWord;

        this.typedWord = '';
        this.currentIndex++;

        this.setTimer()
        this.validateTypedWord()
    }


    public reset(words: Words): void {
        this.words = this.shuffle(words);
        this.currentIndex = 0;
        this.dojoState.level = 1;
        this.dojoState.progress = 0;
        this.dojoState.lastOutcome = '';
        this.pickNextWord();
    }
}
