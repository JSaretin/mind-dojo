// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface ElectronAPI {
		pickDirectory: () => Promise<string | null>;
		readDir: (dirPath: string) => Promise<{ ok: boolean; files?: string[]; error?: string }>;
		readFile: (filePath: string) => Promise<{ ok: boolean; content?: string; error?: string }>;
		writeFile: (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
		deleteFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
		fileExists: (dirPath: string) => Promise<boolean>;
	}

	interface Window {
		electronAPI?: ElectronAPI;
	}
}

export {};
