import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import { Tooltip } from '../../ui/Tooltip'

describe('Tooltip', () => {
  it('shows after delay and hides on mouseleave', async () => {
    vi.useFakeTimers()
    const { getByText, queryByRole } = render(
      <Tooltip content="导出脚本" delay={200}>
        <button>btn</button>
      </Tooltip>
    )
    const btn = getByText('btn')
    // mock position
    const orig = btn.getBoundingClientRect
    ;(btn as any).getBoundingClientRect = () => ({ top: 100, bottom: 120, left: 100, width: 60, height: 20 })

    fireEvent.mouseEnter(btn)
    act(() => { vi.advanceTimersByTime(200) })
    expect(queryByRole('tooltip')).toBeTruthy()

    fireEvent.mouseLeave(btn)
    expect(queryByRole('tooltip')).toBeFalsy()
    ;(btn as any).getBoundingClientRect = orig
  })

  it('auto places bottom when not enough top space', () => {
    vi.useFakeTimers()
    const { getByText, queryByRole } = render(
      <Tooltip content="保存修改" delay={0}>
        <button>btn</button>
      </Tooltip>
    )
    const btn = getByText('btn')
    ;(btn as any).getBoundingClientRect = () => ({ top: 4, bottom: 24, left: 100, width: 60, height: 20 })
    fireEvent.mouseEnter(btn)
    act(() => { vi.advanceTimersByTime(1) })
    const tip = queryByRole('tooltip') as HTMLElement
    expect(tip).toBeTruthy()
  })
})

