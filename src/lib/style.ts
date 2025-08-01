import type { MindDojoSettings } from "./structure";

export function getRandomColor(): string {
    const colors = [
        'text-black', // strong bias
        'text-red-500',
        'text-blue-500',
        'text-green-500',
        'text-yellow-500',
        'text-purple-500',
        'text-pink-500',
        'text-orange-500',
        'text-emerald-500',
        'text-cyan-500',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

export function getRandomSize(): string {
    const sizes = [
        'text-7xl', // base size bias
        'text-7xl',
        'text-7xl',
        'text-6xl',
        'text-5xl',
        'text-9xl',
    ];
    return sizes[Math.floor(Math.random() * sizes.length)];
}

export function getRandomWeight(): string {
    const weights = [
        'font-bold', // strong bias
        'font-bold',
        'font-bold',
        'font-medium',
        'font-semibold',
        'font-black',
    ];
    return weights[Math.floor(Math.random() * weights.length)];
}

export function getRandomFont(): string {
    const fonts = [
        'font-montserrat', // strong bias
        'font-montserrat',
        'font-montserrat',
        'font-sans',
        'font-serif',
        'font-mono',
        'font-display',
        'font-handwriting',
    ];
    return fonts[Math.floor(Math.random() * fonts.length)];
}

export function getRandomTransform(): string {
    const transforms = [
        'rotate-0',
        'rotate-0',
        'rotate-0',
        'rotate-0',
        'rotate-1',
        'rotate-1',
        'rotate-6',
        'rotate-12',
        'rotate-45',
    ];
    return transforms[Math.floor(Math.random() * transforms.length)];
}

/** Compose a full random letter style string */
export function getRandomLetterStyle(): string {
    return [
        getRandomSize(),
        getRandomWeight(),
        getRandomFont(),
        getRandomTransform(),
    ].join(' ');
}

/** Compose style based on settings toggles for each attribute */
export function getBaseStyle(settings: MindDojoSettings): string {
    const isFullWord = settings.displayMode === 'full-word'
    if (isFullWord) return `text-8xl font-bold font-montserrat rotate-0`

    const size = settings.letterStyle?.randomSize ? getRandomSize() : 'text-8xl';
    const weight = settings.letterStyle?.randomWeight ? getRandomWeight() : 'font-bold';
    const font = settings.letterStyle?.randomFont ? getRandomFont() : 'font-montserrat';
    const transform = settings.letterStyle?.randomTransform ? getRandomTransform() : 'rotate-0';

    return `${size} ${weight} ${font} ${transform}`;
}

export function generateRandomShiftOfWordPosition(word: string, settings: MindDojoSettings) {
    if (settings.displayMode === 'full-word') return '';
    if (!settings.randomlyMoveWordStarting) return '';
    if (word.length >= 25) return '';

    const possibleShifts = [0, 3, 5, 7, 8, 10, 12, 13, 16, 20, 24, 26, 30, 34, 35];
    const shift = possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
    const direction = Math.random() < 0.5 ? -1 : 1;

    return `transform: translateX(${direction * shift * 0.25}rem);`;
}
