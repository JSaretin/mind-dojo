import { mergeAttributes, Node, InputRule } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'

export interface WikiLinkItem {
    id: string
    label: string
    type: 'entry' | 'word'
}

export const WikiLinkPluginKey = new PluginKey('wikiLink')

export const WikiLink = Node.create({
    name: 'wikiLink',
    group: 'inline',
    inline: true,
    selectable: false,
    atom: true,

    addAttributes() {
        return {
            id: { default: null },
            label: { default: null },
            linkType: { default: 'entry' },
        }
    },

    parseHTML() {
        return [{ tag: 'span[data-wiki-link]' }]
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(HTMLAttributes, {
                'data-wiki-link': '',
                'data-link-id': node.attrs.id,
                'data-link-type': node.attrs.linkType,
                class: `wiki-link wiki-link--${node.attrs.linkType}`,
            }),
            `${node.attrs.label}`,
        ]
    },

    renderText({ node }) {
        return `[[${node.attrs.label}]]`
    },

    // tiptap-markdown integration: serialize as [[label]], parse [[label]] back
    addStorage() {
        return {
            markdown: {
                serialize(state: any, node: any) {
                    state.write(`[[${node.attrs.label}]]`)
                },
                parse: {
                    // handled via inputRules below
                },
            },
        }
    },

    addInputRules() {
        // When user types [[something]] manually (e.g. from Obsidian paste), convert to wikiLink node
        return [
            new InputRule({
                find: /\[\[([^\]]+)\]\]$/,
                handler: ({ state, range, match, chain }) => {
                    const label = match[1]
                    chain().insertContentAt(range, {
                        type: 'wikiLink',
                        attrs: { id: label, label, linkType: 'word' },
                    }).run()
                },
            }),
        ]
    },

    addKeyboardShortcuts() {
        return {
            Backspace: () =>
                this.editor.commands.command(({ tr, state }) => {
                    let isMention = false
                    const { selection } = state
                    const { empty, anchor } = selection

                    if (!empty) return false

                    state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
                        if (node.type.name === this.name) {
                            isMention = true
                            tr.insertText('', pos, pos + node.nodeSize)
                            return false
                        }
                    })

                    return isMention
                }),
        }
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ]
    },
})

export function createWikiLinkConfig(
    getItems: (query: string) => WikiLinkItem[] | Promise<WikiLinkItem[]>,
    onSelect?: (item: WikiLinkItem) => void,
): Partial<SuggestionOptions<WikiLinkItem>> {
    return {
        char: '[[',
        pluginKey: WikiLinkPluginKey,
        items: ({ query }: { query: string }) => getItems(query),
        command: ({ editor, range, props }) => {
            const nodeAfter = editor.view.state.selection.$to.nodeAfter
            const overrideSpace = nodeAfter?.text?.startsWith(' ')

            if (overrideSpace) {
                range.to += 1
            }

            editor
                .chain()
                .focus()
                .insertContentAt(range, [
                    {
                        type: 'wikiLink',
                        attrs: {
                            id: props.id,
                            label: props.label,
                            linkType: props.type,
                        },
                    },
                    { type: 'text', text: ' ' },
                ])
                .run()

            onSelect?.(props)
        },
        render: () => {
            let popup: HTMLElement | null = null
            let items: WikiLinkItem[] = []
            let selectedIndex = 0
            let command: ((props: WikiLinkItem) => void) | null = null

            function updatePopup() {
                if (!popup) return
                popup.innerHTML = items.length === 0
                    ? '<div class="wiki-suggestion-empty">No results</div>'
                    : items.map((item, i) =>
                        `<button class="wiki-suggestion-item ${i === selectedIndex ? 'is-selected' : ''}" data-index="${i}">
                            <span class="wiki-suggestion-type">${item.type === 'word' ? 'W' : 'J'}</span>
                            <span class="wiki-suggestion-label">${item.label}</span>
                        </button>`
                    ).join('')

                popup.querySelectorAll('.wiki-suggestion-item').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt((btn as HTMLElement).dataset.index || '0')
                        if (command && items[idx]) command(items[idx])
                    })
                })
            }

            return {
                onStart(props: any) {
                    popup = document.createElement('div')
                    popup.className = 'wiki-suggestion-popup'
                    items = props.items
                    command = props.command
                    selectedIndex = 0
                    updatePopup()

                    const rect = props.clientRect?.()
                    if (rect && popup) {
                        popup.style.position = 'fixed'
                        popup.style.left = `${rect.left}px`
                        popup.style.top = `${rect.bottom + 4}px`
                        popup.style.zIndex = '100'
                    }

                    document.body.appendChild(popup)
                },

                onUpdate(props: any) {
                    items = props.items
                    command = props.command
                    selectedIndex = 0
                    updatePopup()

                    const rect = props.clientRect?.()
                    if (rect && popup) {
                        popup.style.left = `${rect.left}px`
                        popup.style.top = `${rect.bottom + 4}px`
                    }
                },

                onKeyDown(props: any) {
                    if (props.event.key === 'ArrowDown') {
                        selectedIndex = Math.min(selectedIndex + 1, items.length - 1)
                        updatePopup()
                        return true
                    }
                    if (props.event.key === 'ArrowUp') {
                        selectedIndex = Math.max(selectedIndex - 1, 0)
                        updatePopup()
                        return true
                    }
                    if (props.event.key === 'Enter') {
                        if (command && items[selectedIndex]) {
                            command(items[selectedIndex])
                        }
                        return true
                    }
                    if (props.event.key === 'Escape') {
                        popup?.remove()
                        popup = null
                        return true
                    }
                    return false
                },

                onExit() {
                    popup?.remove()
                    popup = null
                },
            }
        },
    }
}
