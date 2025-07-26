export interface Word {
    word: string;
    synonyms: string[];
    antonyms: string[];
    meanings: Meaning[];
}

export type Words = Word[];

export type Meaning = [
    partOfSpeech: string,
    definition: string,
    synonyms: string[],
    examples: string[]
];
