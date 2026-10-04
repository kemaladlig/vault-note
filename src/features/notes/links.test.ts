import { describe, expect, it } from 'vitest'

import type { DecryptedNote } from './model'
import {
  backlinksFor,
  buildLinkIndex,
  parseWikiLinks,
  resolveTarget,
  resolveLinks,
  wikiLinksToMarkdown,
} from './links'

function note(partial: Partial<DecryptedNote> & Pick<DecryptedNote, 'id' | 'title'>): DecryptedNote {
  return {
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    deleted: false,
    body: '',
    tags: [],
    ...partial,
  }
}

const alpha = note({ id: 'n-alpha', title: 'Alfa Notu' })
const beta = note({ id: 'n-beta', title: 'Beta', body: '[[Alfa Notu]] ve [[Alfa Notu|kısaca]]' })
const gamma = note({ id: 'n-gamma', title: 'Gama', body: '[[n-alpha]] ile [[Kayıp Not]]' })

describe('parseWikiLinks', () => {
  it('reads target, alias, offset and length', () => {
    const links = parseWikiLinks('baş [[Alfa Notu|A]] son [[Beta]]')
    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ target: 'Alfa Notu', alias: 'A', index: 4, length: 15 })
    expect(links[1]).toMatchObject({ target: 'Beta', index: 24 })
    expect(links[1].alias).toBeUndefined()
  })

  it('ignores empty and multiline brackets', () => {
    expect(parseWikiLinks('[[]] [[ ]]')).toHaveLength(0)
    expect(parseWikiLinks('[[a\nb]]')).toHaveLength(0)
  })
})

describe('resolveTarget', () => {
  const index = buildLinkIndex([alpha, beta, gamma])

  it('matches by title, case- and diacritic-insensitively', () => {
    expect(resolveTarget('alfa notu', index)?.id).toBe('n-alpha')
    expect(resolveTarget('ALFA NOTU', index)?.id).toBe('n-alpha')
  })

  it('falls back to an exact id when no title matches', () => {
    expect(resolveTarget('n-alpha', index)?.id).toBe('n-alpha')
  })

  it('returns undefined for unknown targets', () => {
    expect(resolveTarget('Kayıp Not', index)).toBeUndefined()
  })
})

describe('resolveLinks', () => {
  const index = buildLinkIndex([alpha, beta, gamma])

  it('marks broken links instead of dropping them', () => {
    const links = resolveLinks(gamma.body, index)
    expect(links).toHaveLength(2)
    expect(links[0].note?.id).toBe('n-alpha')
    expect(links[1].note).toBeUndefined()
    expect(links[1].target).toBe('Kayıp Not')
  })
})

describe('backlinksFor', () => {
  const notes = [alpha, beta, gamma]
  const index = buildLinkIndex(notes)

  it('lists notes that link to the target, with their links', () => {
    const backlinks = backlinksFor(alpha, notes, index)
    const sources = backlinks.map((entry) => entry.note.id).sort()
    expect(sources).toEqual(['n-beta', 'n-gamma'])
    const fromBeta = backlinks.find((entry) => entry.note.id === 'n-beta')!
    expect(fromBeta.links).toHaveLength(2)
  })

  it('never counts a note as its own backlink', () => {
    const self = note({ id: 'n-self', title: 'Kendi', body: '[[Kendi]]' })
    expect(backlinksFor(self, [self], buildLinkIndex([self]))).toHaveLength(0)
  })
})

describe('wikiLinksToMarkdown', () => {
  const index = buildLinkIndex([alpha, beta, gamma])
  const resolve = (target: string) => resolveTarget(target, index)?.id

  it('turns resolved links into vaultnote anchors and keeps aliases', () => {
    expect(wikiLinksToMarkdown('[[Alfa Notu|A]]', resolve)).toBe(
      '[A](vaultnote:note/n-alpha)',
    )
  })

  it('marks unresolved links as broken', () => {
    expect(wikiLinksToMarkdown('[[Kayıp]]', resolve)).toBe(
      '[Kayıp](vaultnote:broken/Kay%C4%B1p)',
    )
  })

  it('leaves bodies without links untouched', () => {
    expect(wikiLinksToMarkdown('düz metin', resolve)).toBe('düz metin')
  })
})
