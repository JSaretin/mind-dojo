import { browser } from "$app/environment";

export function getRandomChar(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return chars[Math.floor(Math.random() * chars.length)];
}


export function initializeAudio() {
    let audioMap: { [k: string]: HTMLAudioElement } = {};

    if (!browser) {
        return audioMap;
    }
    for (let i = 0; i < 26; i++) {
        const char = String.fromCharCode(97 + i);
        audioMap[char] = new Audio(`/alphabet/${char.toUpperCase()}.wav`);
    }
    for (let i = 0; i <= 9; i++) {
        audioMap[i.toString()] = new Audio(`/alphabet/${i}.wav`);
    }
    return audioMap;
}