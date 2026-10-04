import { describe, expect, it } from 'vitest'

import {
  contentHash,
  parseImportFile,
  parseJsonExport,
  parseMarkdown,
  planImport,
} from './import'
import type { DecryptedNote } from './model'

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

describe('parseMarkdown', () => {
  it('reads title and tags from frontmatter', () => {
    const result = parseMarkdown('a.md', '---\ntitle: Toplantı\ntags: iş, plan\n---\nGövde')
    expect(result.title).toBe('Toplantı')
    expect(result.tags).toEqual(['iş', 'plan'])
    expect(result.body).toBe('Gövde')
  })

  it('uses a leading H1 as the title and strips it', () => {
    const result = parseMarkdown('a.md', '# Notlar\n\ngövde satırı')
    expect(result.title).toBe('Notlar')
    expect(result.body).toBe('gövde satırı')
  })

  it('lifts a standalone #tag line out of the body', () => {
    const result = parseMarkdown('a.md', '# Alışveriş\n\n#ev #market\n\nsüt')
    expect(result.title).toBe('Alışveriş')
    expect(result.tags).toEqual(['ev', 'market'])
    expect(result.body).toBe('süt')
  })

  it('falls back to the file name when there is no title', () => {
    expect(parseMarkdown('benim-notum.md', 'sadece gövde').title).toBe('benim-notum')
  })
})

describe('parseJsonExport', () => {
  it('reads the app export envelope', () => {
    const text = JSON.stringify({
      app: 'vaultnote',
      version: 1,
      notes: [{ title: 'Bir', body: 'gövde', tags: ['x'], pinned: true }],
    })
    const [candidate] = parseJsonExport('export.json', text)
    expect(candidate).toMatchObject({ title: 'Bir', body: 'gövde', tags: ['x'], pinned: true })
  })

  it('accepts a bare array and rejects junk', () => {
    expect(parseJsonExport('a.json', '[{"title":"T","body":"B"}]')).toHaveLength(1)
    expect(() => parseJsonExport('a.json', 'not json')).toThrow('invalid-json')
  })
})

describe('parseImportFile', () => {
  it('routes by extension', () => {
    expect(parseImportFile('a.md', '# T\nb')[0].title).toBe('T')
    expect(parseImportFile('a.json', '{"notes":[{"title":"T","body":"b"}]}')[0].title).toBe('T')
  })
})

describe('contentHash', () => {
  it('is stable and ignores tag order', () => {
    const a = contentHash({ title: 'T', body: 'b', tags: ['x', 'y'] })
    const b = contentHash({ title: 'T', body: 'b', tags: ['y', 'x'] })
    expect(a).toBe(b)
    expect(a).not.toBe(contentHash({ title: 'T', body: 'b2', tags: ['x', 'y'] }))
  })
})

describe('planImport', () => {
  it('separates fresh notes from duplicates and de-dupes within the batch', () => {
    const existing = [note({ id: 'n1', title: 'Var', body: 'gövde', tags: [] })]
    const candidates = [
      { source: 'a.md', title: 'Var', body: 'gövde', tags: [] },
      { source: 'b.md', title: 'Yeni', body: 'başka', tags: [] },
      { source: 'c.md', title: 'Yeni', body: 'başka', tags: [] },
    ]
    const plan = planImport(existing, candidates)
    expect(plan.total).toBe(3)
    expect(plan.fresh.map((c) => c.source)).toEqual(['b.md'])
    expect(plan.duplicates.map((c) => c.source)).toEqual(['a.md', 'c.md'])
  })

  it('does not treat a trashed note as a duplicate', () => {
    const existing = [note({ id: 'n1', title: 'Var', body: 'b', deleted: true })]
    const plan = planImport(existing, [{ source: 'a.md', title: 'Var', body: 'b', tags: [] }])
    expect(plan.fresh).toHaveLength(1)
  })
})
