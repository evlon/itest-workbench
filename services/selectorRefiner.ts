import { Step, StepTarget } from '../types'

const tailwindLike = (c: string) => /^(m[trblxy]?|p[trblxy]?|text|bg|border|rounded|flex|grid|items|justify|gap|space|w|h|min|max|shadow|ring|z|top|left|right|bottom|inset|opacity|overflow|object|cursor|select|leading|tracking|font|underline|decoration|list|place|content|whitespace|break|truncate|align|justify|order|grow|shrink|basis|transition|duration|ease|delay|animate|skew|scale|rotate|translate)/.test(c)

const stripUnstableClasses = (selector: string) => {
  return selector.replace(/\.[A-Za-z0-9_-]+/g, (m) => {
    const name = m.slice(1)
    if (tailwindLike(name)) return ''
    if (/\b[a-f0-9]{6,}\b/.test(name)) return ''
    return m
  })
}

const stripRandomIds = (selector: string) => {
  return selector.replace(/#[A-Za-z0-9_-]{10,}/g, '')
}

const normalize = (s: string) => s.trim().replace(/\s+/g, ' ')

export const refineStepTarget = (target: StepTarget): StepTarget => {
  const precise = normalize(stripUnstableClasses(stripRandomIds(target.selectors.precise || '')))
  let xpath = target.selectors.xpath
  let text = target.selectors.text
  if (!xpath) {
    const idMatch = precise.match(/#([A-Za-z0-9_-]+)/)
    const testidMatch = precise.match(/\[data-testid=['"]?([^'"\]]+)['"]?\]/)
    const ariaLabelMatch = precise.match(/\[aria-label=['"]?([^'"\]]+)['"]?\]/)
    if (idMatch) xpath = `//*[@id='${idMatch[1]}']`
    else if (testidMatch) xpath = `//*[@data-testid='${testidMatch[1]}']`
    else if (ariaLabelMatch) xpath = `//*[@aria-label='${ariaLabelMatch[1]}']`
  }
  if (!text && target.description) {
    const t = target.description
    if (t && t.length <= 64) text = t
  }
  return {
    description: target.description,
    selectors: {
      precise,
      semantic: target.selectors.semantic,
      xpath,
      text,
    },
  }
}

export const getBestStaticSelectorForStep = (step: Step): string => {
  if (!step.target) return ''
  const refined = refineStepTarget(step.target)
  const p = refined.selectors.precise || ''
  const idMatch = p.match(/#([A-Za-z0-9_-]+)/)
  const testidMatch = p.match(/\[data-testid=['"]?([^'"\]]+)['"]?\]/)
  const ariaLabelMatch = p.match(/\[aria-label=['"]?([^'"\]]+)['"]?\]/)
  if (idMatch) return `#${idMatch[1]}`
  if (testidMatch) return `[data-testid='${testidMatch[1]}']`
  if (ariaLabelMatch) return `[aria-label='${ariaLabelMatch[1]}']`
  if (refined.selectors.text) return `text=${refined.selectors.text}`
  return p || refined.selectors.xpath || ''
}