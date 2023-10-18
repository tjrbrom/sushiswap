'use client'

import { ThemeProvider } from '@sushiswap/ui'
import { CheckerProvider } from '../../../../packages/wagmi/src/systems/Checker/Provider'
import { DeferUntilWalletReady } from 'ui/swap/defer-until-wallet-ready'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DeferUntilWalletReady>
        <CheckerProvider>{children}</CheckerProvider>
      </DeferUntilWalletReady>
    </ThemeProvider>
  )
}
