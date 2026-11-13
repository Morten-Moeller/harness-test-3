import { execFileSync } from 'node:child_process'

import { expect, type Locator, type Page, test } from '@playwright/test'

type Seed = { ok: boolean; data: { lists: { id: string; title: string }[] } }

function seedWithLists(): Seed {
  const stdout = execFileSync('make', ['-C', '..', '--no-print-directory', 'seed', 'STATE=with-lists'], { encoding: 'utf8' })
  return JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as Seed
}

function listCard(page: Page, title: string): Locator {
  return page.getByTestId('list-item').filter({ has: page.getByTestId('list-title').filter({ hasText: title }) })
}

async function addEntry(card: Locator, title: string): Promise<Locator> {
  await card.getByTestId('new-entry-input').fill(title)
  await card.getByTestId('new-entry-submit').click()
  const item = card.getByTestId('entry-item').filter({ hasText: title })
  await expect(item).toBeVisible()
  return item
}

test.beforeAll(() => {
  const seed = seedWithLists()
  expect(seed.ok).toBe(true)
})

test('adds an entry, checks it off and keeps it after reload', async ({ page }) => {
  const title = `Milch ${Date.now()}`
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await expect(card).toBeVisible()

  const item = await addEntry(card, title)
  await expect(card.getByTestId('new-entry-input')).toHaveValue('')
  await item.getByTestId('entry-done').click()
  await expect(item.getByTestId('entry-done')).toBeChecked()

  await page.reload()
  const after = listCard(page, 'Einkauf').getByTestId('entry-item').filter({ hasText: title })
  await expect(after).toBeVisible()
  await expect(after.getByTestId('entry-done')).toBeChecked()
  await expect(after.getByTestId('entry-title')).toHaveCSS('text-decoration-line', 'line-through')
})

test('edits and deletes an entry', async ({ page }) => {
  const title = `Brot ${Date.now()}`
  const newTitle = `Käse ${Date.now()}`
  await page.goto('/')
  const card = listCard(page, 'Arbeit')
  await expect(card).toBeVisible()

  const item = await addEntry(card, title)
  await item.getByTestId('entry-title').dblclick()
  const editForm = card.getByTestId('entry-edit-form')
  await expect(editForm.getByTestId('entry-title-input')).toBeFocused()
  await editForm.getByTestId('entry-title-input').fill(newTitle)
  await editForm.getByTestId('entry-title-input').press('Enter')
  const renamed = card.getByTestId('entry-item').filter({ hasText: newTitle })
  await expect(renamed).toBeVisible()
  await expect(card.getByTestId('entry-item').filter({ hasText: title })).toHaveCount(0)

  await renamed.getByTestId('entry-title').dblclick()
  await card.getByTestId('entry-edit-form').getByTestId('entry-delete').click()
  await expect(card.getByTestId('entry-item').filter({ hasText: newTitle })).toHaveCount(0)
})

test('shows the validation message for an empty entry title', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Haushalt')
  await expect(card).toBeVisible()

  await card.getByTestId('new-entry-submit').click()

  await expect(card.getByTestId('entry-form-error')).toBeVisible()
})
