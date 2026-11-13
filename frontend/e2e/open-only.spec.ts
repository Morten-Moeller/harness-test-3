import { execFileSync } from 'node:child_process'

import { expect, type Locator, type Page, test } from '@playwright/test'

import de from '../src/features/entries/locales/de.json' with { type: 'json' }

type Seed = { ok: boolean; data: { lists: { id: string; title: string }[] } }

function seedWithEntries(): Seed {
  const stdout = execFileSync('make', ['-C', '..', '--no-print-directory', 'seed', 'STATE=with-entries'], { encoding: 'utf8' })
  return JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as Seed
}

function listCard(page: Page, title: string): Locator {
  return page.getByTestId('list-item').filter({ has: page.getByTestId('list-title').filter({ hasText: title }) })
}

async function checkedCount(card: Locator): Promise<number> {
  return card.getByTestId('entry-done').evaluateAll((boxes) => boxes.filter((box) => (box as HTMLInputElement).checked).length)
}

const seededTitles = ['Einkauf', 'Arbeit', 'Haushalt']

test.beforeAll(() => {
  const seed = seedWithEntries()
  expect(seed.ok).toBe(true)
})

test('hides done entries in every list while the switch is set', async ({ page }) => {
  await page.goto('/')
  const toggle = page.getByTestId('open-only')
  await expect(toggle).not.toBeChecked()
  const counts = new Map<string, { total: number; done: number }>()
  for (const title of seededTitles) {
    const card = listCard(page, title)
    await expect(card.getByTestId('entry-item').first()).toBeVisible()
    const total = await card.getByTestId('entry-item').count()
    const done = await checkedCount(card)
    expect(done).toBeGreaterThan(0)
    counts.set(title, { total, done })
  }

  await toggle.check()
  for (const title of seededTitles) {
    const card = listCard(page, title)
    const { total, done } = counts.get(title) ?? { total: 0, done: 0 }
    await expect(card.getByTestId('entry-item')).toHaveCount(total - done)
    await expect(card.getByTestId('entry-done').and(page.locator(':checked'))).toHaveCount(0)
  }

  await toggle.uncheck()
  for (const title of seededTitles) {
    await expect(listCard(page, title).getByTestId('entry-item')).toHaveCount(counts.get(title)?.total ?? 0)
  }
})

test('keeps the switch after reload', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Arbeit')
  await expect(card.getByTestId('entry-item').first()).toBeVisible()
  const total = await card.getByTestId('entry-item').count()
  const done = await checkedCount(card)

  await page.getByTestId('open-only').check()
  await expect(card.getByTestId('entry-item')).toHaveCount(total - done)

  await page.reload()
  await expect(page.getByTestId('open-only')).toBeChecked()
  await expect(listCard(page, 'Arbeit').getByTestId('entry-item')).toHaveCount(total - done)
})

test('shows the open-empty text for a list whose entries are all done', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Haushalt')
  await expect(card.getByTestId('entry-item').first()).toBeVisible()
  const total = await card.getByTestId('entry-item').count()
  for (let i = 0; i < total; i++) {
    const box = card.getByTestId('entry-done').nth(i)
    if (!(await box.isChecked())) {
      await box.click()
      await expect(box).toBeChecked()
    }
  }

  await page.getByTestId('open-only').check()
  await expect(card.getByTestId('entries-empty-open')).toHaveText(de.emptyOpen)
  await expect(card.getByTestId('entry-item')).toHaveCount(0)

  const listTitle = `Leer ${Date.now()}`
  await page.getByTestId('list-title-input').fill(listTitle)
  await page.getByTestId('list-submit').click()
  const emptyCard = listCard(page, listTitle)
  await expect(emptyCard.getByTestId('entries-empty')).toHaveText(de.empty)
})

test('removes an entry from view when it is checked off', async ({ page }) => {
  const title = `Fenster ${Date.now()}`
  const newTitle = `Fenster putzen ${Date.now()}`
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await expect(card.getByTestId('entry-item').first()).toBeVisible()
  await page.getByTestId('open-only').check()

  await card.getByTestId('new-entry-input').fill(title)
  await card.getByTestId('new-entry-submit').click()
  const item = card.getByTestId('entry-item').filter({ hasText: title })
  await expect(item).toBeVisible()
  await expect(card.getByTestId('new-entry-input')).toHaveValue('')

  await item.getByTestId('entry-title').dblclick()
  const editForm = card.getByTestId('entry-edit-form')
  await editForm.getByTestId('entry-title-input').fill(newTitle)
  await editForm.getByTestId('entry-title-input').press('Enter')
  const renamed = card.getByTestId('entry-item').filter({ hasText: newTitle })
  await expect(renamed).toBeVisible()

  await renamed.getByTestId('entry-done').click()
  await expect(card.getByTestId('entry-item').filter({ hasText: newTitle })).toHaveCount(0)

  await page.getByTestId('open-only').uncheck()
  const shown = card.getByTestId('entry-item').filter({ hasText: newTitle })
  await expect(shown).toBeVisible()
  await expect(shown.getByTestId('entry-done')).toBeChecked()
})
