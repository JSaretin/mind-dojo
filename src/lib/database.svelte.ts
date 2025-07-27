import type { SavedWord } from "$lib/structure";

const DB_NAME = 'WordTypingGame';
const STORE_NAME = 'savedWords';
const DB_VERSION = 1;

export class SavedWordDB {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'word.word' });
                    store.createIndex('starred', 'stats.starred', { unique: false });
                    store.createIndex('lastSeen', 'stats.lastSeen', { unique: false });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private getStore(mode: IDBTransactionMode): IDBObjectStore {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
    }

    async saveWord(word: SavedWord): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.getStore('readwrite').put(word);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getWord(wordStr: string): Promise<SavedWord | undefined> {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.getStore('readonly').get(wordStr);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllWords(): Promise<SavedWord[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.getStore('readonly').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteWord(wordStr: string): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.getStore('readwrite').delete(wordStr);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll(): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.getStore('readwrite').clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
