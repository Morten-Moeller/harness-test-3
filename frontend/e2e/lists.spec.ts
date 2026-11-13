import { expect, test } from '@playwright/test'

import de from '../src/features/lists/locales/de.json' with { type: 'json' }

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
