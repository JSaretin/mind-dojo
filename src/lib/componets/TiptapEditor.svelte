<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Markdown } from 'tiptap-markdown';
	import TaskList from '@tiptap/extension-task-list';
	import TaskItem from '@tiptap/extension-task-item';
	import Link from '@tiptap/extension-link';
	import { Table } from '@tiptap/extension-table';
	import { TableRow } from '@tiptap/extension-table-row';
	import { TableCell } from '@tiptap/extension-table-cell';
	import { TableHeader } from '@tiptap/extension-table-header';
	import { WikiLink, createWikiLinkConfig, type WikiLinkItem } from '$lib/wikilink';

	let {
		content = '',
		placeholder = 'Write your thoughts...',
		onUpdate = (_md: string) => {},
		getLinkItems = (_query: string): WikiLinkItem[] | Promise<WikiLinkItem[]> => [],
		onLinkSelect = (_item: WikiLinkItem) => {},
	}: {
		content?: string;
		placeholder?: string;
		onUpdate?: (md: string) => void;
		getLinkItems?: (query: string) => WikiLinkItem[] | Promise<WikiLinkItem[]>;
		onLinkSelect?: (item: WikiLinkItem) => void;
	} = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();

	onMount(() => {
		if (!element) return;
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3] },
				}),
				Markdown.configure({
					html: true,
					transformPastedText: true,
					transformCopiedText: true,
				}),
				TaskList,
				TaskItem.configure({ nested: true }),
				Link.configure({
					openOnClick: false,
					autolink: true,
				}),
				Table.configure({ resizable: false }),
				TableRow,
				TableCell,
				TableHeader,
				WikiLink.configure({
					suggestion: createWikiLinkConfig(
						(query) => getLinkItems(query),
						(item) => onLinkSelect(item),
					),
				}),
			],
			content: content || '',
			editorProps: {
				attributes: {
					class: 'prose-editor focus:outline-none min-h-full',
					spellcheck: 'true',
				},
			},
			onUpdate: ({ editor: e }) => {
				// Output markdown via tiptap-markdown
				const md = (e.storage as any).markdown?.getMarkdown?.() ?? e.getHTML();
				onUpdate(md);
			},
			onTransaction: () => {
				editor = editor;
			},
		});
	});

	onDestroy(() => {
		editor?.destroy();
	});

	// Update content from outside
	$effect(() => {
		if (editor && content !== undefined) {
			const currentMd = (editor.storage as any).markdown?.getMarkdown?.() ?? editor.getHTML();
			if (currentMd !== content) {
				editor.commands.setContent(content || '');
			}
		}
	});

	export function getMarkdown(): string {
		return (editor?.storage as any)?.markdown?.getMarkdown?.() ?? editor?.getHTML() ?? '';
	}

	export function getHTML(): string {
		return editor?.getHTML() || '';
	}

	export function getText(): string {
		return editor?.getText() || '';
	}
</script>

<!-- Toolbar -->
{#if editor}
	<div class="flex flex-wrap items-center gap-0.5 border-b border-base-border px-2 py-1.5">
		<button
			onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
			class="rounded px-2 py-0.5 text-xs font-bold transition-colors {editor.isActive('heading', { level: 2 }) ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			H2
		</button>
		<button
			onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
			class="rounded px-2 py-0.5 text-xs font-bold transition-colors {editor.isActive('heading', { level: 3 }) ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			H3
		</button>

		<span class="mx-1 h-4 w-px bg-surface-hover"></span>

		<button
			onclick={() => editor?.chain().focus().toggleBold().run()}
			class="rounded px-2 py-0.5 text-xs font-bold transition-colors {editor.isActive('bold') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			B
		</button>
		<button
			onclick={() => editor?.chain().focus().toggleItalic().run()}
			class="rounded px-2 py-0.5 text-xs italic transition-colors {editor.isActive('italic') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			I
		</button>
		<button
			onclick={() => editor?.chain().focus().toggleStrike().run()}
			class="rounded px-2 py-0.5 text-xs line-through transition-colors {editor.isActive('strike') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			S
		</button>

		<span class="mx-1 h-4 w-px bg-surface-hover"></span>

		<button
			onclick={() => editor?.chain().focus().toggleBulletList().run()}
			class="rounded px-2 py-0.5 text-xs transition-colors {editor.isActive('bulletList') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			List
		</button>
		<button
			onclick={() => editor?.chain().focus().toggleOrderedList().run()}
			class="rounded px-2 py-0.5 text-xs transition-colors {editor.isActive('orderedList') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			1.
		</button>
		<button
			onclick={() => editor?.chain().focus().toggleTaskList().run()}
			class="rounded px-2 py-0.5 text-xs transition-colors {editor.isActive('taskList') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			[ ]
		</button>
		<button
			onclick={() => editor?.chain().focus().toggleBlockquote().run()}
			class="rounded px-2 py-0.5 text-xs transition-colors {editor.isActive('blockquote') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			Quote
		</button>
		<button
			onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
			class="rounded px-2 py-0.5 font-mono text-[10px] transition-colors {editor.isActive('codeBlock') ? 'bg-accent-muted text-accent' : 'text-base-text-muted hover:text-base-text'}"
		>
			Code
		</button>

		<span class="mx-1 h-4 w-px bg-surface-hover"></span>

		<button
			onclick={() => editor?.chain().focus().setHorizontalRule().run()}
			class="rounded px-2 py-0.5 text-xs text-base-text-muted transition-colors hover:text-base-text"
		>
			---
		</button>
	</div>
{/if}

<!-- Editor area -->
<div bind:this={element} class="flex-1 overflow-y-auto px-5 py-4"></div>

<style>
	:global(.prose-editor) {
		font-size: 15px;
		line-height: 1.7;
		color: var(--theme-text, #e5e5e5);
		min-height: 100%;
	}

	:global(.prose-editor p) {
		margin-bottom: 0.5em;
	}

	:global(.prose-editor h1) {
		font-size: 1.75em;
		font-weight: 800;
		color: var(--theme-accent, #fbbf24);
		margin: 0.8em 0 0.4em;
	}

	:global(.prose-editor h2) {
		font-size: 1.4em;
		font-weight: 700;
		color: var(--theme-accent, #f59e0b);
		margin: 0.7em 0 0.3em;
	}

	:global(.prose-editor h3) {
		font-size: 1.15em;
		font-weight: 600;
		color: var(--theme-accent, #d97706);
		margin: 0.6em 0 0.3em;
	}

	:global(.prose-editor strong) {
		font-weight: 700;
		color: var(--theme-text, #fef3c7);
	}

	:global(.prose-editor em) {
		font-style: italic;
		color: var(--theme-text-muted, #d4d4d8);
	}

	:global(.prose-editor s) {
		text-decoration: line-through;
		color: var(--theme-text-muted, #737373);
	}

	:global(.prose-editor ul) {
		list-style: disc;
		padding-left: 1.5em;
		margin-bottom: 0.5em;
	}

	:global(.prose-editor ol) {
		list-style: decimal;
		padding-left: 1.5em;
		margin-bottom: 0.5em;
	}

	:global(.prose-editor li) {
		margin-bottom: 0.2em;
	}

	:global(.prose-editor li p) {
		margin-bottom: 0;
	}

	/* Task list styling */
	:global(.prose-editor ul[data-type="taskList"]) {
		list-style: none;
		padding-left: 0;
	}

	:global(.prose-editor ul[data-type="taskList"] li) {
		display: flex;
		align-items: flex-start;
		gap: 0.5em;
	}

	:global(.prose-editor ul[data-type="taskList"] li label) {
		flex-shrink: 0;
		margin-top: 0.25em;
	}

	:global(.prose-editor ul[data-type="taskList"] li label input[type="checkbox"]) {
		accent-color: var(--theme-accent, #fbbf24);
		width: 1em;
		height: 1em;
		cursor: pointer;
	}

	:global(.prose-editor ul[data-type="taskList"] li div) {
		flex: 1;
	}

	:global(.prose-editor ul[data-type="taskList"] li[data-checked="true"] > div > p) {
		text-decoration: line-through;
		color: var(--theme-text-muted, #737373);
	}

	/* Table styling */
	:global(.prose-editor table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0.5em 0;
	}

	:global(.prose-editor th),
	:global(.prose-editor td) {
		border: 1px solid var(--theme-border, #333);
		padding: 0.4em 0.8em;
		text-align: left;
	}

	:global(.prose-editor th) {
		background: var(--theme-surface-hover, #262626);
		font-weight: 600;
		color: var(--theme-accent, #fbbf24);
	}

	/* Link styling */
	:global(.prose-editor a) {
		color: var(--theme-accent, #fbbf24);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	:global(.prose-editor blockquote) {
		border-left: 3px solid var(--theme-accent, #f59e0b);
		padding-left: 1em;
		margin: 0.5em 0;
		color: var(--theme-text-muted, #a3a3a3);
		font-style: italic;
	}

	:global(.prose-editor code) {
		background: var(--theme-surface-hover, #262626);
		color: var(--theme-accent, #fbbf24);
		padding: 0.15em 0.4em;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.9em;
	}

	:global(.prose-editor pre) {
		background: var(--theme-surface, #171717);
		border: 1px solid var(--theme-border, #262626);
		border-radius: 8px;
		padding: 0.8em 1em;
		margin: 0.5em 0;
		overflow-x: auto;
	}

	:global(.prose-editor pre code) {
		background: none;
		padding: 0;
		color: var(--theme-text, #d4d4d4);
		font-size: 0.85em;
	}

	:global(.prose-editor hr) {
		border: none;
		border-top: 1px solid var(--theme-border, #333);
		margin: 1em 0;
	}

	:global(.prose-editor p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--theme-text-muted, #525252);
		pointer-events: none;
		height: 0;
		font-style: italic;
	}
</style>
