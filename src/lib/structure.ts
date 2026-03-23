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

export interface TypingFlow {
    letterIntervals: number[]; // ms between each keystroke (first entry is 0 for first key)
    reactionTime: number;      // ms from word shown to first keystroke
    totalDuration: number;     // total ms from first keystroke to last keystroke (excludes reaction)
    timestamp: number;         // when this attempt happened
    correct: boolean;          // whether the word was typed correctly
    speed?: number;            // speed setting when this attempt happened
    msPerLetter?: number;      // allowed ms per letter at this speed (1000 / speed)
    mode?: 'letter-by-letter' | 'full-word' | 'chaos'; // game mode when this attempt happened
    direction?: 'left-to-right' | 'center'; // letter display direction when typed
    errorType?: 'self' | 'timer'; // what caused the error: wrong key (self) or time ran out (timer)
}

/** Classify error: 'you' (wrong key, rushed, misclick) vs 'game' (timer ran out). */
export function getErrorType(flow: TypingFlow): 'you' | 'game' | null {
    if (flow.correct) return null;
    if (flow.errorType === 'timer') return 'game';
    if (flow.errorType === 'self') return 'you';
    // Infer from old data: if duration is close to full time budget, likely timer
    const budget = (flow.msPerLetter || 500) * (flow.letterIntervals.length || 1);
    const totalTime = (flow.reactionTime || 0) + (flow.totalDuration || 0);
    if (totalTime > budget * 0.85) return 'game';
    return 'you';
}

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
    typingFlows: TypingFlow[];
    createdAt: number;
}


/** Instant-fail: timeout/misclick — single [0] interval and incorrect. Exclude from accuracy stats. */
export function isInstantFail(flow: TypingFlow): boolean {
    return !flow.correct
        && flow.letterIntervals.length <= 1
        && (flow.letterIntervals.length === 0 || flow.letterIntervals[0] === 0)
        && (flow.totalDuration === 0 || flow.totalDuration === undefined);
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

export interface FranticSettings {
    shouldChangeDisplayMode: boolean;
    shouldChangeLetterStyle: boolean;
    shouldChangeProgressBarVisibility: boolean;
    shouldChangeTimerVisibility: boolean;
    shouldChangeRestartOnError: boolean;
    shouldChangeRandomWordPosition: boolean;
    shouldChangeHideTypedLetter: boolean;
    shouldChangeWordLength: boolean;   // ✅ new
}

export interface FocusKeys {
    excludeKeys: string;
    includeKeys: string;
}


export interface MindDojoSettings {
    speed: number;
    sameLetterDelayPercent: number;
    excludeLetters: string;
    joinRandomLetters: boolean;
    franticMode: boolean;
    franticSettings: FranticSettings;
    mixJoinRandomLetters: boolean;
    minWordLength: number;
    maxWordLength: number;
    displayMode: 'letter-by-letter' | 'full-word';
    letterStyle: LetterStyleSettings;
    voice: VoiceSettings;
    wordMix: WordMixSettings;
    noFeedbackSound: boolean;
    noSuccessFeedbackSound: boolean;
    hideProgressBar: boolean;
    hideTimer: boolean;
    restartLevelOnError: boolean;
    showNewWordOnError: boolean;
    hideTypedLetter: boolean;
    randomlyMoveWordStarting: boolean;
    saveTypedWord: boolean;
    typeRestartLevelOnErrorOnLevelCompletion: boolean;
    displayLetterInUpperCase: boolean;
    stealthTimer: boolean;
    sessionDuration: number; // minutes, 0 = unlimited
    restDuration: number;    // minutes, 0 = skip rest
    zenMode: boolean;        // hide all stats — just you and the letters
    focusUI: boolean;        // grayscale stats — info visible but quiet
    lockedMinSpeed: number;  // commitment lock — cannot go below this speed
    autoSpeed: boolean;      // automatic speed cycling (base/flow/challenge)
    autoSpeedBase: number;   // base speed for auto mode (auto-calibrated)
    savedManualSpeed: number; // manual speed saved when switching to auto
    autoFatigueRest: boolean; // auto-trigger rest when fatigue detected
    wordSource: 'dictionary' | 'seen' | 'unseen'; // word list source: full dictionary, previously seen, or never-seen-before
    breatheDelay: number; // ms to pause after error before next word (0 = off)
    breathePrompts: boolean; // show philosophy prompts during breathe
    breathePromptsAlways: boolean; // true = every breathe, false = ~60% random
    breatheCustomPrompts: string; // user custom prompts, one per line
    warmupWords: number; // number of warmup words (0 = off, doesn't count toward stats)
    sessionGoalType: 'none' | 'words' | 'accuracy'; // session goal type
    sessionGoalValue: number; // target: word count or accuracy %
    // focusKeys: FocusKeys
}