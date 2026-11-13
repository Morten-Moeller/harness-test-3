import { execFileSync } from 'node:child_process'

import { expect, type Locator, type Page, test } from '@playwright/test'

type Seed = { ok: boolean }

function seedWithEntries(): Seed {
  const stdout = execFileSync('make', ['-C', '..', '--no-print-directory', 'seed', 'STATE=with-entries'], { encoding: 'utf8' })
  return JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as Seed
}

function listCard(page: Page, title: string): Locator {
  return page.getByTestId('list-item').filter({ has: page.getByTestId('list-title').filter({ hasText: title }) })
}

function entryOf(card: Locator, title: string): Locator {
  return card.getByTestId('entry-item').filter({ has: card.page().getByTestId('entry-title').filter({ hasText: title }) })
}

async function titlesOf(card: Locator): Promise<string[]> {
  return card.getByTestId('entry-title').allTextContents()
}

function waitForSave(page: Page): Promise<unknown> {
  return page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/entries/order'))
}

async function visibleOrder(card: Locator): Promise<string[]> {
  const items = await card.getByTestId('entry-item').all()
  const rows = await Promise.all(
    items.map(async (item) => ({ y: (await item.boundingBox())?.y ?? 0, title: (await item.getByTestId('entry-title').textContent()) ?? '' })),
  )
  return rows.sort((a, b) => a.y - b.y).map((row) => row.title)
}

async function dragAndCapture(page: Page, handle: Locator, target: Locator, card: Locator): Promise<string[]> {
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (from === null || to === null) {
    throw new Error('handle or target is not visible')
  }
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
  await expect(page.getByTestId('entry-overlay')).toBeVisible()
  let previous = ''
  await expect
    .poll(async () => {
      const current = (await visibleOrder(card)).join('|')
      const stable = current === previous
      previous = current
      return stable
    }, { intervals: [100] })
    .toBe(true)
  const shown = previous.split('|')
  const saved = waitForSave(page)
  await page.mouse.up()
  await saved
  return shown
}

test.use({ viewport: { width: 1280, height: 1400 } })

test.beforeEach(() => {
  expect(seedWithEntries().ok).toBe(true)
})

test('moves an entry down with the keyboard and keeps the order after reload', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await expect(card).toBeVisible()
  expect(await titlesOf(card)).toEqual(['Milch', 'Brot', 'Äpfel'])

  const handle = entryOf(card, 'Brot').getByTestId('entry-handle')
  await expect(handle).toHaveAccessibleName('Eintrag verschieben')
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toContainText('Brot')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('status')).toContainText('Brot ist über Position 3.')
  const saved = waitForSave(page)
  await page.keyboard.press('Space')
  await saved
  await expect(page.getByRole('status')).toContainText('Brot an Position 3 abgelegt.')

  await expect.poll(() => titlesOf(card)).toEqual(['Milch', 'Äpfel', 'Brot'])
  await page.reload()
  await expect.poll(() => titlesOf(listCard(page, 'Einkauf'))).toEqual(['Milch', 'Äpfel', 'Brot'])
})

test('drags an entry into another list with the mouse', async ({ page }) => {
  await page.goto('/')
  const arbeit = listCard(page, 'Arbeit')
  const haushalt = listCard(page, 'Haushalt')
  await expect(haushalt).toBeVisible()

  const shown = await dragAndCapture(page, entryOf(arbeit, 'Rechnung prüfen').getByTestId('entry-handle'), entryOf(haushalt, 'Staubsaugen'), haushalt)

  expect(shown).toContain('Rechnung prüfen')
  expect(shown).toHaveLength(4)
  await expect.poll(() => titlesOf(haushalt)).toEqual(shown)
  await expect.poll(() => titlesOf(arbeit)).toEqual(['Bericht schreiben', 'Termin planen'])
  await page.reload()
  await expect.poll(() => titlesOf(listCard(page, 'Haushalt'))).toEqual(shown)
})

test('shows the place in the target list while dragging and drops it there', async ({ page }) => {
  await page.goto('/')
  const arbeit = listCard(page, 'Arbeit')
  const haushalt = listCard(page, 'Haushalt')
  await expect(haushalt).toBeVisible()

  const shown = await dragAndCapture(page, entryOf(arbeit, 'Termin planen').getByTestId('entry-handle'), entryOf(haushalt, 'Wäsche waschen'), haushalt)

  expect(shown.indexOf('Termin planen')).toBeGreaterThan(0)
  expect(shown.indexOf('Termin planen')).toBeLessThan(3)
  await expect.poll(() => titlesOf(haushalt)).toEqual(shown)
  await page.reload()
  await expect.poll(() => titlesOf(listCard(page, 'Haushalt'))).toEqual(shown)
})

test('moves an entry down inside its list to the place shown while dragging', async ({ page }) => {
  await page.goto('/')
  const einkauf = listCard(page, 'Einkauf')
  await expect(einkauf).toBeVisible()

  const shown = await dragAndCapture(page, entryOf(einkauf, 'Milch').getByTestId('entry-handle'), entryOf(einkauf, 'Brot'), einkauf)

  expect(shown).toEqual(['Brot', 'Milch', 'Äpfel'])
  await expect.poll(() => titlesOf(einkauf)).toEqual(shown)
  await page.reload()
  await expect.poll(() => titlesOf(listCard(page, 'Einkauf'))).toEqual(shown)
})

test('drags an entry into an empty list', async ({ page }) => {
  const title = `Leer ${Date.now()}`
  await page.goto('/')
  await page.getByTestId('list-title-input').fill(title)
  await page.getByTestId('list-submit').click()
  const empty = listCard(page, title)
  await expect(empty.getByTestId('entries-empty')).toBeVisible()
  const arbeit = listCard(page, 'Arbeit')

  const shown = await dragAndCapture(page, entryOf(arbeit, 'Termin planen').getByTestId('entry-handle'), empty.getByTestId('entry-list'), empty)

  expect(shown).toEqual(['Termin planen'])
  await expect.poll(() => titlesOf(empty)).toEqual(['Termin planen'])
  await expect.poll(() => titlesOf(arbeit)).toEqual(['Bericht schreiben', 'Rechnung prüfen'])
  await page.reload()
  await expect.poll(() => titlesOf(listCard(page, title))).toEqual(['Termin planen'])
})

test('keeps checkbox, edit and delete working with the handle present', async ({ page }) => {
  await page.goto('/')
  const haushalt = listCard(page, 'Haushalt')
  const item = entryOf(haushalt, 'Blumen gießen')
  await expect(item.getByTestId('entry-handle')).toBeVisible()

  await item.getByTestId('entry-done').click()
  await expect(item.getByTestId('entry-done')).toBeChecked()

  await item.getByTestId('entry-title').dblclick()
  const editForm = haushalt.getByTestId('entry-edit-form')
  await expect(editForm.getByTestId('entry-title-input')).toBeFocused()
  await editForm.getByTestId('entry-title-input').press('Escape')
  await expect(item.getByTestId('entry-title')).toHaveText('Blumen gießen')

  await item.getByTestId('entry-title').dblclick()
  await editForm.getByTestId('entry-delete').click()
  await expect(haushalt.getByTestId('entry-item').filter({ hasText: 'Blumen gießen' })).toHaveCount(0)
})
