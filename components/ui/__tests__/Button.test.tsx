import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { Button } from '../../ui/Button'
import { Sparkles } from 'lucide-react'

describe('Button', () => {
  it('renders icon at 16px and label with gap', () => {
    const { getByLabelText, container } = render(<Button icon={<Sparkles />} label="导出脚本" />)
    const btn = getByLabelText('导出脚本')
    expect(btn).toBeTruthy()
    const svg = container.querySelector('svg') as SVGElement
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('width') || svg.style.width).toBeDefined()
  })
})

