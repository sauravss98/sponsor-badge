// The salary path end to end, short of a browser: API client, background service, injector.
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { isSalaryFloors, salaryCheck } from '../src/api/client'
import { createLookupService, createSalaryService, type KeyValueStore } from '../src/background/service'
import { extractLinkedIn } from '../src/content/extract'
import { createInjector, HOST_ATTRIBUTE, PANEL_ATTRIBUTE } from '../src/content/inject'
import type { LookupOutcome, SalaryOutcome } from '../src/shared/messages'
import { floors, starling } from './fixtures'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function memoryStore(): KeyValueStore {
  const data = new Map<string, unknown>()
  return { get: async (key) => data.get(key), set: async (key, value) => void data.set(key, value) }
}

describe('salaryCheck client', () => {
  it('sends only the amount', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify(floors), { status: 200 }))
    expect(await salaryCheck(40000, { base: 'http://api.test', fetch })).toEqual({ kind: 'ok', data: floors })
    expect(fetch.mock.calls[0]![0]).toBe('http://api.test/v1/salary-check?amount=40000')
  })

  it('rejects a response from an older API without the basis fields', () => {
    const { weeks_per_year_basis: _omitted, ...older } = floors
    expect(isSalaryFloors(older)).toBe(false)
    expect(isSalaryFloors(floors)).toBe(true)
  })
})

describe('salary service', () => {
  it('caches by amount and skips invalid amounts', async () => {
    const salaryCheck = vi.fn().mockResolvedValue({ kind: 'ok', data: floors })
    const service = createSalaryService({ store: memoryStore(), salaryCheck })
    expect(await service(40000)).toEqual({ kind: 'ok', result: floors })
    expect(await service(40000)).toEqual({ kind: 'ok', result: floors })
    expect(await service(0)).toEqual({ kind: 'skipped' })
    expect(salaryCheck).toHaveBeenCalledTimes(1)
  })

  it('shares the rate-limit pause with name lookups', async () => {
    const store = memoryStore()
    const lookup = vi.fn().mockResolvedValue({ kind: 'rate_limited', retryAfterSeconds: 60 })
    const salaryCheck = vi.fn()
    await createLookupService({ store, lookup })('Starling Bank')
    expect(await createSalaryService({ store, salaryCheck })(40000)).toMatchObject({
      kind: 'unavailable', reason: 'rate_limited',
    })
    expect(salaryCheck).not.toHaveBeenCalled()
  })
})

describe('injector with a salary', () => {
  function setup(salary: { text: string | null }) {
    document.documentElement.innerHTML = new DOMParser()
      .parseFromString(readFileSync('fixtures/linkedin-3.html', 'utf8'), 'text/html')
      .documentElement.innerHTML
    const lookup = vi.fn<(name: string) => Promise<LookupOutcome>>()
      .mockResolvedValue({ kind: 'ok', result: starling })
    const checkSalary = vi.fn<(amount: number) => Promise<SalaryOutcome>>()
      .mockResolvedValue({ kind: 'ok', result: floors })
    const injector = createInjector({
      doc: document, extract: extractLinkedIn, lookup, checkSalary, extractSalary: () => salary.text,
    })
    return { injector, checkSalary }
  }

  async function openPanel(): Promise<ShadowRoot> {
    await flush()
    const host = document.querySelector<HTMLElement>(`[${HOST_ATTRIBUTE}]`)!
    host.shadowRoot!.querySelector<HTMLElement>('.badge')!.click()
    return document.querySelector<HTMLElement>(`[${PANEL_ATTRIBUTE}]`)!.shadowRoot!
  }

  it('sends only the lower figure and shows the comparison in the panel', async () => {
    const { injector, checkSalary } = setup({ text: '£40,000 - £45,000 a year' })
    injector.scan()
    expect(checkSalary).toHaveBeenCalledWith(40000)
    const text = (await openPanel()).textContent!
    expect(text).toContain('£40,000 a year, the lower figure')
    expect(text).toContain('Below it')
  })

  it('has no salary section when the ad shows no salary', async () => {
    const { injector, checkSalary } = setup({ text: null })
    injector.scan()
    expect(checkSalary).not.toHaveBeenCalled()
    expect((await openPanel()).querySelector('section.salary')).toBeNull()
  })

  it('updates the salary when another job at the same company is opened', () => {
    const salary = { text: '£40,000 a year' }
    const { injector, checkSalary } = setup(salary)
    injector.scan()
    salary.text = '£50,000 a year'
    injector.scan()
    expect(checkSalary).toHaveBeenLastCalledWith(50000)
  })

  it('refreshes an open panel when the salary answer arrives', async () => {
    const { injector, checkSalary } = setup({ text: '£45,000 a year' })
    let answer!: (o: SalaryOutcome) => void
    checkSalary.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    injector.scan()
    const root = await openPanel()
    expect(root.textContent).toContain('Checking...')
    answer({ kind: 'ok', result: floors })
    await flush()
    expect(root.textContent).toContain('Clears it')
  })
})
