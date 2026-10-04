import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo, type MouseEvent } from 'react'

import { cn } from '@/lib/utils'

import { wikiLinksToMarkdown } from '../links'

marked.setOptions({ gfm: true, breaks: true })

// External links open in a new tab and never hand the opener over. Runs once per session.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

// DOMPurify's default scheme allow-list plus our internal `vaultnote:` links.
const SAFE_URI =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|vaultnote):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

const NOTE_PREFIX = 'vaultnote:note/'
const BROKEN_PREFIX = 'vaultnote:broken/'

/**
 * Turn the sanitized `vaultnote:` anchors into in-app triggers: internal links carry
 * `data-note-id` (and no longer open a tab), broken ones are flagged for styling.
 */
function decorateLinks(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  for (const anchor of template.content.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href') ?? ''
    if (href.startsWith(NOTE_PREFIX)) {
      anchor.setAttribute('data-note-id', decodeURIComponent(href.slice(NOTE_PREFIX.length)))
      anchor.setAttribute('href', '#')
      anchor.removeAttribute('target')
    } else if (href.startsWith(BROKEN_PREFIX)) {
      anchor.setAttribute('href', '#')
      anchor.setAttribute('data-broken', 'true')
      anchor.setAttribute('title', decodeURIComponent(href.slice(BROKEN_PREFIX.length)))
      anchor.removeAttribute('target')
    }
  }
  return template.innerHTML
}

interface MarkdownPreviewProps {
  source: string
  className?: string
  /** Maps a wiki-link target to a note id; undefined marks the link broken. */
  resolveLink?: (target: string) => string | undefined
  /** Called when a resolved wiki link is clicked. */
  onOpenNote?: (id: string) => void
}

/**
 * Render decrypted Markdown for the read-only preview. Everything is sanitized with
 * DOMPurify before it reaches the DOM, so a note body can never inject markup or scripts.
 * Wiki links are resolved to in-app navigation instead of navigations to nowhere.
 */
export function MarkdownPreview({ source, className, resolveLink, onOpenNote }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const md = resolveLink ? wikiLinksToMarkdown(source, resolveLink) : source
    const raw = marked.parse(md, { async: false }) as string
    const clean = DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ALLOWED_URI_REGEXP: SAFE_URI,
      ADD_ATTR: ['data-note-id', 'data-broken'],
    })
    return decorateLinks(clean)
  }, [source, resolveLink])

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-note-id]')
    if (!anchor) return
    event.preventDefault()
    const id = anchor.dataset.noteId
    if (id) onOpenNote?.(id)
  }

  return (
    <div
      className={cn('md-preview', className)}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
