import { execFileSync } from 'node:child_process'

import { expect, type Locator, type Page, test } from '@playwright/test'

type SeededList = { id: string; title: string }
type Seed = { ok: boolean; data: { lists: SeededList[] } }

function seedWithEntries(): Seed {
  const stdout = execFileSync('make', ['-C', '..', '--no-print-directory', 'seed', 'STATE=with-entries'], { encoding: 'utf8' })
  return JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as Seed
}

function listCard(page: Page, title: string): Locator {
  return page.getByTestId('list-item').filter({ has: page.getByTestId('list-title').filter({ hasText: title }) })
}

async function listTitles(page: Page): Promise<string[]> {
  return page.getByTestId('list-title').allTextContents()
}

async function visibleListOrder(page: Page): Promise<string[]> {
  const items = await page.getByTestId('list-item').all()
  const rows = await Promise.all(
    items.map(async (item) => ({ y: (await item.boundingBox())?.y ?? 0, title: (await item.getByTestId('list-title').textContent()) ?? '' })),
  )
  return rows.sort((a, b) => a.y - b.y).map((row) => row.title)
}

function waitForListSave(page: Page): Promise<unknown> {
  return page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/api/lists/order'))
}

let seeded: SeededList[] = []

test.use({ viewport: { width: 1280, height: 1600 } })

test.beforeEach(() => {
  const seed = seedWithEntries()
  expect(seed.ok).toBe(true)
  seeded = seed.data.lists
})

test('moves a list down with the keyboard and keeps the order after reload', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => listTitles(page)).toEqual(['Einkauf', 'Arbeit', 'Haushalt'])

  const handle = listCard(page, 'Einkauf').getByTestId('list-handle')
  await expect(handle).toHaveAccessibleName('Liste verschieben')
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toContainText('Einkauf')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('status')).toContainText('Liste Einkauf ist über Position 2.')
  const saved = waitForListSave(page)
  await page.keyboard.press('Space')
  await saved

  await expect.poll(() => listTitles(page)).toEqual(['Arbeit', 'Einkauf', 'Haushalt'])
  await page.reload()
  await expect.poll(() => listTitles(page)).toEqual(['Arbeit', 'Einkauf', 'Haushalt'])
})

test('drags a list to the place shown while dragging', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => listTitles(page)).toEqual(['Einkauf', 'Arbeit', 'Haushalt'])
  const handle = listCard(page, 'Haushalt').getByTestId('list-handle')
  const target = listCard(page, 'Einkauf').getByTestId('list-title')
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (from === null || to === null) {
    throw new Error('handle or target is not visible')
  }

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 12, from.y - 12, { steps: 4 })
  await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 25 })
  await expect(page.getByTestId('list-overlay')).toHaveText('Haushalt')
  let previous = ''
  await expect
    .poll(async () => {
      const current = (await visibleListOrder(page)).join('|')
      const stable = current === previous
      previous = current
      return stable
    }, { intervals: [100] })
    .toBe(true)
  const shown = previous.split('|')
  const saved = waitForListSave(page)
  await page.mouse.up()
  await saved

  expect(shown[0]).toBe('Haushalt')
  await expect.poll(() => listTitles(page)).toEqual(shown)
  await page.reload()
  await expect.poll(() => listTitles(page)).toEqual(shown)
})

test('shows a conflict message when another tab added a list', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => listTitles(page)).toEqual(['Einkauf', 'Arbeit', 'Haushalt'])
  const created = await page.request.post('/api/lists', { data: { title: `Anderer Tab ${Date.now()}` } })
  expect(created.status()).toBe(201)

  const handle = listCard(page, 'Einkauf').getByTestId('list-handle')
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toContainText('Einkauf')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('status')).toContainText('Liste Einkauf ist über Position 2.')
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/lists/order'))
  await page.keyboard.press('Space')
  expect((await saved).status()).toBe(409)

  await expect(page.getByTestId('lists-dnd-error')).toContainText('inzwischen geändert')
  await expect.poll(() => listTitles(page)).toHaveLength(4)
  expect((await listTitles(page)).slice(0, 3)).toEqual(['Einkauf', 'Arbeit', 'Haushalt'])
  expect(seeded).toHaveLength(3)
})
