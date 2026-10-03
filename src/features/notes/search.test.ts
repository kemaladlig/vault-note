import { describe, expect, it } from 'vitest'

import type { DecryptedNote } from './model'
import { filterNotes } from './search'

function note(partial: Partial<DecryptedNote>): DecryptedNote {
  return {
    id: partial.id ?? 'id',
    title: '',
    body: '',
    tags: [],
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

const NOTES: DecryptedNote[] = [
  note({ id: 'a', title: 'Alışveriş', body: 'süt ve yumurta', tags: ['ev'] }),
  note({ id: 'b', title: 'İş', body: 'toplantı notları', tags: ['proje'] }),
  note({ id: 'c', title: 'Fikirler', body: 'YENİ bir uygulama fikri', tags: [] }),
]

describe('filterNotes', () => {
  it('returns everything for an empty query', () => {
    expect(filterNotes(NOTES, '')).toHaveLength(3)
    expect(filterNotes(NOTES, '   ')).toHaveLength(3)
  })

  it('matches title, body and tags', () => {
    expect(filterNotes(NOTES, 'süt').map((n) => n.id)).toEqual(['a'])
    expect(filterNotes(NOTES, 'toplantı').map((n) => n.id)).toEqual(['b'])
    expect(filterNotes(NOTES, 'proje').map((n) => n.id)).toEqual(['b'])
  })

  it('is case-insensitive', () => {
    expect(filterNotes(NOTES, 'yeni').map((n) => n.id)).toEqual(['c'])
    expect(filterNotes(NOTES, 'ALIŞVERİŞ').map((n) => n.id)).toEqual(['a'])
  })

  it('returns nothing when there is no match', () => {
    expect(filterNotes(NOTES, 'zzzz')).toEqual([])
  })
})
