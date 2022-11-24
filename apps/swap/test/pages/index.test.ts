import { AddressZero } from '@ethersproject/constants'
import { expect, Page, test } from '@playwright/test'
import { chainName } from '@sushiswap/chain'
import { Native, SUSHI_ADDRESS, USDC_ADDRESS } from '@sushiswap/currency'

if (!process.env.CHAIN_ID) {
  throw new Error('CHAIN_ID env var not set')
}

const CHAIN_ID = parseInt(process.env.CHAIN_ID)

const nativeToken = {
  address: AddressZero,
  symbol: Native.onChain(CHAIN_ID).symbol,
}
const wNativeToken = {
  address: Native.onChain(CHAIN_ID).wrapped.address.toLowerCase(),
  symbol: Native.onChain(CHAIN_ID).wrapped.symbol ?? 'WETH',
}
const usdc = { address: USDC_ADDRESS[CHAIN_ID].toLowerCase(), symbol: 'USDC' }
const sushi = { address: SUSHI_ADDRESS[CHAIN_ID].toLowerCase(), symbol: 'SUSHI' }

test.beforeEach(async ({ page }) => {
  await page.goto(process.env.PLAYWRIGHT_URL as string)
  await page.locator(`[testdata-id=network-selector-button]`).click()
  const networkList = page.locator(`[testdata-id=network-selector-list]`)
  const desiredNetwork = networkList.getByText(chainName[CHAIN_ID])
  expect(desiredNetwork).toBeVisible()
  await desiredNetwork.click()

  if (await desiredNetwork.isVisible()) {
    await page.locator(`[testdata-id=network-selector-button]`).click()
  }
})

test('Swap Native to USDC, then USDC to NATIVE', async ({ page }) => {
  test.slow()
  page.on('pageerror', (err) => {
    console.log(err.message)
  })
  const trade1: Trade = { input: nativeToken, output: usdc, amount: '10' }
  await swap(trade1, page)
  const trade2: Trade = { input: usdc, output: nativeToken }
  await swap(trade2, page, true)
})

test('Swap Native to SUSHI, then SUSHI to NATIVE', async ({ page }) => {
  test.slow()
  page.on('pageerror', (err) => {
    console.log(err.message)
  })
  const trade1: Trade = { input: nativeToken, output: sushi, amount: '10' }
  await swap(trade1, page)
  const trade2: Trade = { input: sushi, output: nativeToken }
  await swap(trade2, page, true)
})

test(`Wrap and unwrap`, async ({ page }) => {
  test.slow()
  page.on('pageerror', (err) => {
    console.log(err.message)
  })
  const nativeToWrapped = {
    input: nativeToken,
    output: wNativeToken,
    amount: '10',
  }
  const wrappedToNative = {
    input: wNativeToken,
    output: nativeToken,
    amount: '10',
  }
  await wrap(nativeToWrapped, page)
  await wrap(wrappedToNative, page)
})

async function wrap(trade: Trade, page: Page, useBalance?: boolean) {
  await handleToken(trade.input, page, InputType.INPUT, trade.amount, useBalance)
  await handleToken(trade.output, page, InputType.OUTPUT)

  const unwrapButton = page.locator('[testdata-id=open-wrap-review-modal-button]')
  await expect(unwrapButton).toBeEnabled()
  await unwrapButton.click()

  const confirmUnwrap = page.locator('[testdata-id=swap-wrap-review-modal-confirm-button]')
  await expect(confirmUnwrap).toBeEnabled()
  await confirmUnwrap.click()

  const expectedRegex = /Successfully wrapped|unwrapped /
  await expect(page.locator('div', { hasText: expectedRegex }).last()).toContainText(expectedRegex)
}

async function swap(trade: Trade, page: Page, useMaxBalances?: boolean) {
  await expect(page.locator('[id=amount-checker]')).not.toBeEnabled()

  await handleToken(trade.input, page, InputType.INPUT, trade.amount, useMaxBalances)
  await handleToken(trade.output, page, InputType.OUTPUT)

  const swapButton = page.locator('[testdata-id=swap-button]')
  await expect(swapButton).toBeEnabled()
  await swapButton.click()

  await timeout(500) // wait for rpc calls to figure out if approvals are needed

  await page
    .locator('[testdata-id=swap-review-approve-bentobox-button]')
    .click({ timeout: 10000 })
    .then(async () => {
      console.log(`BentoBox Approved`)
    })
    .catch(() => console.log('BentoBox already approved or not needed'))

  await page
    .locator('[testdata-id=swap-review-approve-token-button]')
    .click({ timeout: 10000 })
    .then(async () => {
      console.log(`Approved ${trade.input.symbol}`)
    })
    .catch(() => console.log(`${trade.input.symbol} already approved or not needed`))

  const confirmSwap = page.locator('[testdata-id=swap-review-confirm-button]')
  await confirmSwap.click()
  const expectedText = new RegExp(`(Successfully swapped .* ${trade.input.symbol} for .* ${trade.output.symbol})`)
  await expect(page.locator('div', { hasText: expectedText }).last()).toContainText(expectedText)
}

async function handleToken(token: Token, page: Page, type: InputType, amount?: string, useBalance?: boolean) {
  const selectorInfix = `${type === InputType.INPUT ? 'input' : 'output'}-currency${
    type === InputType.INPUT ? '0' : '1'
  }`

  // Open token list
  const tokenOutputList = page.getByTestId(`swap-${selectorInfix}-button`)
  expect(tokenOutputList).toBeVisible()
  await tokenOutputList.click()

  await page.fill(`[testdata-id=swap-${selectorInfix}-token-selector-dialog-address-input]`, token.symbol)
  await timeout(1000) // TODO: wait for the list to load instead of using timeout
  await page.locator(`[testdata-id=swap-${selectorInfix}-token-selector-dialog-row-${token.address}]`).click()

  if (useBalance && type === InputType.INPUT) {
    // TODO: refactor this later, cannot use max balance until we have separate accounts for each worker. For now, use 1/10 of the balance
    await timeout(3000) // wait for the balance to be set before continuing.
    const balanceButtonText = await page.getByTestId('swap-input-currency0-balance-button').innerText()
    const amount = balanceButtonText.split('Balance: ')[1]
    const formattedAmount = String((parseFloat(amount) / 10).toFixed(8))
    if (formattedAmount === '0.00000000') {
      throw new Error(`Balance is 0 for ${token.symbol}, cannot proceed.`)
    }

    const input0 = page.locator('[testdata-id="swap-input-currency0-input"]')
    await input0.fill(formattedAmount)
  } else if (amount && type === InputType.INPUT) {
    const input0 = page.locator('[testdata-id="swap-input-currency0-input"]')
    await expect(input0).toBeVisible()
    await input0.fill(amount)
  }
}

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

enum InputType {
  INPUT,
  OUTPUT,
}

interface Token {
  address: string
  symbol: string
}

interface Trade {
  input: Token
  output: Token
  amount?: string
}
