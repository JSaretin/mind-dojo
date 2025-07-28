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


export interface SavedWord {
    word: Word;
    stats: {
        starred: boolean;
        seen: number;
        correctlyTyped: number;
        wronglyTyped: number;
        lastSeen: number;
    };
    jounal: {
        description: string;
        tag: string[]
    };
    createdAt: number;
}


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