import type { SavedWord } from "./structure";

const DB_NAME = 'WordTypingGame'; // Changed from WordTypingGame to MindDojoDB for consistency
const STORE_NAME = 'savedWords';
const DB_VERSION = 2; // Increment DB version to trigger upgrade

export class SavedWordDB {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                let store: IDBObjectStore;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    store = db.createObjectStore(STORE_NAME, { keyPath: 'word.word' });
                } else {
                    store = (event.currentTarget as IDBRequest).transaction!.objectStore(STORE_NAME);
                }

                // Create 'starred' and 'lastSeen' indexes if they don't exist
                if (!store.indexNames.contains('starred')) {
                    store.createIndex('starred', 'stats.starred', { unique: false });
                }
                if (!store.indexNames.contains('lastSeen')) {
                    store.createIndex('lastSeen', 'stats.lastSeen', { unique: false });
                }
                // Create 'createdAt' index if it doesn't exist
                if (!store.indexNames.contains('createdAt')) {
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // If upgrading from a version without createdAt, populate existing records
                if (event.oldVersion < 2) {
                    const transaction = (event.target as IDBOpenDBRequest).transaction!;
                    const objectStore = transaction.objectStore(STORE_NAME);
                    objectStore.openCursor().onsuccess = (cursorEvent) => {
                        const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
                        if (cursor) {
                            const record = cursor.value as SavedWord;
                            if (record.createdAt === undefined) {
                                record.createdAt = Date.now(); // Set a default timestamp for existing records
                                cursor.update(record);
                            }
                            cursor.continue();
                        }
                    };
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
        word = JSON.parse(JSON.stringify(word))
        await this.init();
        return new Promise((resolve, reject) => {
            const store = this.getStore('readwrite');
            const getRequest = store.get(word.word.word);

            getRequest.onsuccess = () => {
                const existingWord = getRequest.result as SavedWord | undefined;
                if (!existingWord || existingWord.createdAt === undefined) {
                    // If it's a new word or an old word without createdAt, set it
                    word.createdAt = Date.now();
                } else {
                    // Preserve existing createdAt for updates
                    word.createdAt = existingWord.createdAt;
                }
                const putRequest = store.put(word);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
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

    async getAllWords(sortBy: 'lastSeen' | 'createdAt' = 'lastSeen'): Promise<SavedWord[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            const store = this.getStore('readonly');
            const index = store.index(sortBy);
            const request = index.openCursor(null, 'prev'); // 'prev' for descending order (newest first)
            const words: SavedWord[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    words.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(words);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getRecentWords(limit = 12, dictionaryOnly = false): Promise<string[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            const store = this.getStore('readonly');
            const index = store.index('lastSeen');
            const request = index.openCursor(null, 'prev');
            const results: string[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && results.length < limit) {
                    const record = cursor.value;
                    const word: string = record.word?.word || '';
                    if (word && (!dictionaryOnly || record.word?.meanings?.length > 0)) {
                        results.push(word);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async searchWords(query: string, limit = 12, dictionaryOnly = false): Promise<string[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            const store = this.getStore('readonly');
            const request = store.openCursor();
            const results: string[] = [];
            const q = query.toLowerCase();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && results.length < limit) {
                    const record = cursor.value;
                    const word: string = record.word?.word || '';
                    if (word.toLowerCase().includes(q) && (!dictionaryOnly || record.word?.meanings?.length > 0)) {
                        results.push(word);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getWordCount(): Promise<number> {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.getStore('readonly').count();
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
