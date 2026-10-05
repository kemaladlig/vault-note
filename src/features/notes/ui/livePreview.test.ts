import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

import { activeFormatsAt, inlineUnwrapTarget } from './livePreview'

function stateAt(doc: string, cursor: number) {
  return EditorState.create({ doc, selection: { anchor: cursor }, extensions: [markdown()] })
}

describe('activeFormatsAt', () => {
  it('detects line markers at the caret', () => {
    expect(activeFormatsAt(stateAt('# Başlık', 5))).toEqual(new Set(['heading']))
    expect(activeFormatsAt(stateAt('> alıntı', 4))).toEqual(new Set(['quote']))
    expect(activeFormatsAt(stateAt('- madde', 4))).toEqual(new Set(['list']))
    expect(activeFormatsAt(stateAt('- [ ] iş', 6))).toEqual(new Set(['task']))
    expect(activeFormatsAt(stateAt('düz metin', 3))).toEqual(new Set())
  })

  it('detects inline marks from the parsed tree', () => {
    expect(activeFormatsAt(stateAt('**kalın** metin', 5))).toEqual(new Set(['bold']))
    expect(activeFormatsAt(stateAt('*italik* metin', 5))).toEqual(new Set(['italic']))
    expect(activeFormatsAt(stateAt('`kod` metin', 2))).toEqual(new Set(['code']))
    expect(activeFormatsAt(stateAt('[[Hedef]] metin', 1))).toEqual(new Set(['link']))
  })

  it('treats an already wrapped selection as active', () => {
    const state = EditorState.create({
      doc: 'bir **kalın** iki',
      selection: { anchor: 4, head: 13 },
      extensions: [markdown()],
    })
    expect(activeFormatsAt(state).has('bold')).toBe(true)
  })
})

describe('inlineUnwrapTarget', () => {
  it('finds the marker pair the caret sits inside', () => {
    expect(inlineUnwrapTarget(stateAt('**kalın** metin', 5), 'bold')).toEqual({ from: 0, to: 9, len: 2 })
    expect(inlineUnwrapTarget(stateAt('`kod` metin', 2), 'code')).toEqual({ from: 0, to: 5, len: 1 })
  })

  it('does not offer a different format that is not there', () => {
    expect(inlineUnwrapTarget(stateAt('**kalın** metin', 5), 'italic')).toBeNull()
    expect(inlineUnwrapTarget(stateAt('düz metin', 3), 'bold')).toBeNull()
  })

  it('anchors wikilinks from the raw line at any offset', () => {
    expect(inlineUnwrapTarget(stateAt('bir [[Hedef]] iki', 6), 'link')).toEqual({ from: 4, to: 13, len: 2 })
    expect(inlineUnwrapTarget(stateAt('[[Hedef]] iki', 0), 'link')).toBeNull()
  })

  it('ignores formats without a node for the requested kind', () => {
    expect(inlineUnwrapTarget(stateAt('> alıntı', 4), 'heading')).toBeNull()
  })
})
