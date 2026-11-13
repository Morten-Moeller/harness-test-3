import { execFileSync } from 'node:child_process'

import { expect, type Locator, type Page, test } from '@playwright/test'

import entriesDe from '../src/features/entries/locales/de.json' with { type: 'json' }
import listsDe from '../src/features/lists/locales/de.json' with { type: 'json' }

function seedWithEntries(): boolean {
  const stdout = execFileSync('make', ['-C', '..', '--no-print-directory', 'seed', 'STATE=with-entries'], { encoding: 'utf8' })
  return (JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as { ok: boolean }).ok
}

function listCard(page: Page, title: string): Locator {
  return page.getByTestId('list-item').filter({ has: page.getByTestId('list-title').filter({ hasText: title }) })
}

function entryOf(card: Locator, title: string): Locator {
  return card.getByTestId('entry-item').filter({ has: card.page().getByTestId('entry-title').filter({ hasText: title }) })
}

test.beforeEach(() => {
  expect(seedWithEntries()).toBe(true)
})

test('opens the entry editor with a double click without checking it off', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  const item = entryOf(card, 'Brot')
  await expect(item.getByTestId('entry-done')).not.toBeChecked()
  await expect(item.getByRole('button', { name: /Bearbeiten|Löschen/ })).toHaveCount(0)
  await expect(item.getByTestId('entry-delete')).toHaveCount(0)

  await item.getByTestId('entry-title').dblclick()

  const input = card.getByTestId('entry-edit-form').getByTestId('entry-title-input')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('Brot')
  expect(await input.evaluate((element: HTMLInputElement) => (element.selectionEnd ?? 0) - (element.selectionStart ?? 0))).toBe(4)
  await expect(card.getByTestId('entry-done').nth(1)).not.toBeChecked()
})

test('opens the entry editor with Enter on the title', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  const title = entryOf(card, 'Brot').getByTestId('entry-title')
  await expect(title).toHaveAccessibleName('Eintrag bearbeiten: Brot')

  await title.focus()
  await page.keyboard.press('Enter')

  await expect(card.getByTestId('entry-edit-form').getByTestId('entry-title-input')).toBeFocused()
})

test('saves with Enter', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await entryOf(card, 'Brot').getByTestId('entry-title').dblclick()
  const input = card.getByTestId('entry-title-input')

  await input.fill('Vollkornbrot')
  await input.press('Enter')

  const renamed = entryOf(card, 'Vollkornbrot').getByTestId('entry-title')
  await expect(renamed).toBeVisible()
  await expect(renamed).toBeFocused()
  await page.reload()
  await expect(entryOf(listCard(page, 'Einkauf'), 'Vollkornbrot')).toBeVisible()
})

test('discards with Escape', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await entryOf(card, 'Brot').getByTestId('entry-title').dblclick()
  const input = card.getByTestId('entry-title-input')

  await input.fill('verworfen')
  await input.press('Escape')

  await expect(entryOf(card, 'Brot').getByTestId('entry-title')).toBeFocused()
  await expect(card.getByTestId('entry-edit-form')).toHaveCount(0)
})

test('saves when the field loses focus', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await entryOf(card, 'Brot').getByTestId('entry-title').dblclick()

  await card.getByTestId('entry-title-input').fill('Brötchen')
  await page.getByRole('heading', { name: 'Listen', level: 1 }).click()

  await expect(entryOf(card, 'Brötchen')).toBeVisible()
  await page.reload()
  await expect(entryOf(listCard(page, 'Einkauf'), 'Brötchen')).toBeVisible()
})

test('keeps editing when Tab moves to the delete icon and saves when Tab leaves', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await entryOf(card, 'Brot').getByTestId('entry-title').dblclick()
  const input = card.getByTestId('entry-title-input')
  await input.fill('Baguette')

  await page.keyboard.press('Tab')
  await expect(card.getByTestId('entry-edit-form').getByTestId('entry-delete')).toBeFocused()
  await expect(input).toHaveValue('Baguette')

  const saved = page.waitForResponse((response) => response.request().method() === 'PATCH')
  await page.keyboard.press('Tab')
  await saved
  await expect(entryOf(card, 'Baguette')).toBeVisible()
})

test('keeps the field open for an empty title', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await entryOf(card, 'Brot').getByTestId('entry-title').dblclick()
  const input = card.getByTestId('entry-title-input')

  await input.fill('   ')
  await input.press('Enter')

  await expect(card.getByTestId('entry-edit-error')).toHaveText(entriesDe.errors.validationFailed)
  await expect(input).toBeVisible()
})

test('shows the delete icon only while editing and deletes the entry', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Einkauf')
  await expect(card.getByTestId('entry-delete')).toHaveCount(0)
  await entryOf(card, 'Brot').getByTestId('entry-title').dblclick()
  await card.getByTestId('entry-title-input').fill('geändert')

  const icon = card.getByTestId('entry-edit-form').getByTestId('entry-delete')
  await expect(icon).toHaveAttribute('title', entriesDe.deleteEntry)
  await expect(icon).toHaveAccessibleName(entriesDe.deleteEntry)
  const patches: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH') {
      patches.push(request.url())
    }
  })
  const deleted = page.waitForResponse((response) => response.request().method() === 'DELETE')
  await icon.click()
  await deleted
  expect(patches).toEqual([])

  await expect(card.getByTestId('entry-title')).toHaveText(['Milch', 'Äpfel'])
  await page.reload()
  await expect(listCard(page, 'Einkauf').getByTestId('entry-title')).toHaveText(['Milch', 'Äpfel'])
})

test('renames a list with a double click and Enter', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('list-rename')).toHaveCount(0)
  await expect(page.getByTestId('list-delete')).toHaveCount(0)
  const title = listCard(page, 'Arbeit').getByTestId('list-title')
  await expect(title).toHaveAccessibleName('Liste bearbeiten: Arbeit')

  await title.dblclick()
  const input = page.getByTestId('list-edit-form').getByTestId('list-edit-input')
  await expect(input).toBeFocused()
  await input.fill('Büro')
  await input.press('Enter')

  await expect(listCard(page, 'Büro').getByTestId('list-title')).toBeFocused()
  await page.reload()
  await expect(listCard(page, 'Büro')).toBeVisible()
})

test('deletes a list through the icon and the confirmation', async ({ page }) => {
  await page.goto('/')
  const card = listCard(page, 'Haushalt')
  await card.getByTestId('list-title').dblclick()
  const icon = page.getByTestId('list-edit-form').getByTestId('list-delete')
  await expect(icon).toHaveAttribute('title', listsDe.deleteList)

  await icon.click()
  await expect(card.getByTestId('list-delete-confirm')).toContainText(listsDe.confirmDelete)
  await card.getByTestId('list-delete-confirm-button').click()

  await expect(listCard(page, 'Haushalt')).toHaveCount(0)
  await page.reload()
  await expect(listCard(page, 'Haushalt')).toHaveCount(0)
})
