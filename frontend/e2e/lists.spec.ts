import { execFileSync } from 'node:child_process'

import { expect, type Locator, type Page, test } from '@playwright/test'

import de from '../src/features/lists/locales/de.json' with { type: 'json' }

type Seed = { ok: boolean; data: { lists: { id: string; title: string; entries: { title: string }[] }[] } }

function seedWithEntries(): Seed {
  const stdout = execFileSync('make', ['-C', '..', '--no-print-directory', 'seed', 'STATE=with-entries'], { encoding: 'utf8' })
  return JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as Seed
}

function listCard(page: Page, title: string): Locator {
  return page.getByTestId('list-item').filter({ has: page.getByTestId('list-title').getByText(title, { exact: true }) })
}

let seed: Seed

test.beforeAll(() => {
  seed = seedWithEntries()
  expect(seed.ok).toBe(true)
})

test('creates a list and shows it after reload', async ({ page }) => {
  const title = `Einkauf ${Date.now()}`
  await page.goto('/')
  await expect(page.getByTestId('list-form')).toBeVisible()

  await page.getByTestId('list-title-input').fill(title)
  await page.getByTestId('list-submit').click()

  const item = page.getByTestId('list-item').filter({ hasText: title })
  await expect(item).toBeVisible()
  await expect(page.getByTestId('list-title-input')).toHaveValue('')

  await page.reload()
  await expect(page.getByTestId('list-item').filter({ hasText: title })).toBeVisible()
})

test('shows the validation message for an empty title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('list-form')).toBeVisible()

  await page.getByTestId('list-submit').click()

  await expect(page.getByTestId('form-error')).toHaveText(de.errors.validationFailed)
})

test('renames a list', async ({ page }) => {
  const newTitle = `Wochenmarkt ${Date.now()}`
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await expect(card).toBeVisible()

  await card.getByTestId('list-rename').click()
  const editForm = page.getByTestId('list-edit-form')
  const input = editForm.getByTestId('list-edit-input')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('Einkauf')
  await input.fill(newTitle)
  await input.press('Enter')

  const renamed = listCard(page, newTitle)
  await expect(renamed).toBeVisible()
  await expect(editForm).toHaveCount(0)
  await expect(listCard(page, 'Einkauf')).toHaveCount(0)

  await renamed.getByTestId('list-rename').click()
  await input.fill('verworfen')
  await input.press('Escape')
  await expect(editForm).toHaveCount(0)
  await expect(renamed).toBeVisible()

  await renamed.getByTestId('list-rename').click()
  await input.fill('verworfen')
  await editForm.getByTestId('list-cancel').click()
  await expect(editForm).toHaveCount(0)
  await expect(renamed).toBeVisible()

  await page.reload()
  await expect(listCard(page, newTitle)).toBeVisible()
})

test('shows the validation message for an empty list title', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Arbeit')
  await expect(card).toBeVisible()

  await card.getByTestId('list-rename').click()
  const editForm = page.getByTestId('list-edit-form')
  await editForm.getByTestId('list-edit-input').fill('   ')
  await editForm.getByTestId('list-save').click()

  await expect(editForm.getByTestId('list-error')).toHaveText(de.errors.validationFailed)
  await expect(editForm.getByTestId('list-edit-input')).toBeVisible()
})

test('keeps the list after cancel', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Haushalt')
  await expect(card).toBeVisible()

  await card.getByTestId('list-delete').click()
  await expect(card.getByTestId('list-delete-confirm')).toContainText(de.confirmDelete)
  await card.getByTestId('list-delete-cancel').click()

  await expect(card.getByTestId('list-delete-confirm')).toHaveCount(0)
  await expect(listCard(page, 'Haushalt')).toBeVisible()
  await page.reload()
  await expect(listCard(page, 'Haushalt')).toBeVisible()
})

test('deletes a list with its entries after confirmation', async ({ page }) => {
  const haushalt = seed.data.lists.find((list) => list.title === 'Haushalt')
  const entryTitle = haushalt?.entries[0]?.title ?? ''
  expect(entryTitle).not.toBe('')
  await page.goto('/')
  const card = listCard(page, 'Haushalt')
  await expect(card).toBeVisible()
  await expect(card.getByTestId('entry-item').filter({ hasText: entryTitle })).toBeVisible()

  await card.getByTestId('list-delete').click()
  await card.getByTestId('list-delete-confirm-button').click()

  await expect(listCard(page, 'Haushalt')).toHaveCount(0)
  await expect(page.getByTestId('entry-item').filter({ hasText: entryTitle })).toHaveCount(0)
  await expect(listCard(page, 'Arbeit')).toBeVisible()

  await page.reload()
  await expect(listCard(page, 'Arbeit')).toBeVisible()
  await expect(listCard(page, 'Haushalt')).toHaveCount(0)
})
