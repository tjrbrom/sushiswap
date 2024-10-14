import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Transition } from '@headlessui/react'
import { SkeletonBox, classNames } from '@sushiswap/ui'
import React, { useMemo } from 'react'
import { formatUnits } from 'viem'
import { Modal } from '~aptos/(common)/components/Modal/Modal'
import { networkNameToNetwork } from '~aptos/(common)/config/chains'
import { formatNumberWithDecimals } from '~aptos/(common)/lib/common/format-number-with-decimals'
import { useNetwork } from '~aptos/(common)/lib/common/use-network'
import { useTokenBalance } from '~aptos/(common)/lib/common/use-token-balances'
import { useSwap } from '~aptos/swap/lib/use-swap'
import { useSwapNetworkFee } from '~aptos/swap/lib/use-swap-network-fee'
import {
  warningSeverity,
  warningSeverityClassName,
} from '~aptos/swap/lib/warning-severity'
import { useSimpleSwapState } from '~aptos/swap/ui/simple/simple-swap-provider/simple-swap-provider'
import { SwapRoute } from '../swap-route'

export const SimpleSwapTradeStats = () => {
  const { account } = useWallet()
  const {
    token0,
    token1,
    amount,
    bestRoutes,
    isLoadingPrice,
    isPriceFetching,
    outputAmount,
    slippageAmount,
  } = useSimpleSwapState()
  const { data: networkFee, isLoading: isLoadingNetworkFee } =
    useSwapNetworkFee()

  const { data: balance, isInitialLoading: isBalanceLoading } = useTokenBalance(
    {
      account: account?.address,
      currency: token0.address,
      refetchInterval: 2000,
    },
  )

  const hasInsufficientBalance = useMemo(() => {
    if (isBalanceLoading) return true
    return Number(formatUnits(balance ?? '0', token0.decimals)) < Number(amount)
  }, [balance, token0, amount, isBalanceLoading])

  const loading =
    Boolean(isLoadingPrice && Number(amount) > 0) ||
    isPriceFetching ||
    isLoadingNetworkFee

  const outputSwapTokenAmount = outputAmount
    ? formatNumberWithDecimals(
        parseFloat(outputAmount),
        token1 ? token1.decimals : 8,
      )
    : ''

  const { network } = useNetwork()

  const minOutput = slippageAmount
    ? formatNumberWithDecimals(slippageAmount, token1 ? token1.decimals : 8)
    : 0

  const { data: routes } = useSwap()

  return (
    <Transition
      show={
        Number(amount) > 0 && bestRoutes.length > 0 && !hasInsufficientBalance
      }
      enter="transition duration-300 ease-out"
      enterFrom="transform translate-y-[16px] opacity-0"
      enterTo="transform translate-y-0 opacity-100"
      leave="transition duration-300 ease-out"
      leaveFrom="transform translate-y-0 opacity-100"
      leaveTo="transform translate-y-[16px] opacity-0"
    >
      <div className="w-full px-2 flex flex-col gap-1">
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-slate-400">
            Price impact
          </span>
          <span
            className={classNames(
              warningSeverityClassName(warningSeverity(routes?.priceImpact)),
              'text-sm font-semibold text-gray-700 text-right dark:text-slate-400',
            )}
          >
            {loading ? (
              <SkeletonBox className="h-4 py-0.5 w-[120px] rounded-md" />
            ) : (
              <>{routes?.priceImpact ? -routes?.priceImpact.toFixed(2) : 0}%</>
            )}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-slate-400">
            Est. received
          </span>
          <span className="text-sm font-semibold text-gray-700 text-right dark:text-slate-400">
            {loading || !outputSwapTokenAmount ? (
              <SkeletonBox className="h-4 py-0.5 w-[120px] rounded-md" />
            ) : (
              `${outputSwapTokenAmount} ${token1.symbol}`
            )}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-slate-400">
            Min. received
          </span>
          <span className="text-sm font-semibold text-gray-700 text-right dark:text-slate-400">
            {loading || !minOutput ? (
              <SkeletonBox className="h-4 py-0.5 w-[120px] rounded-md" />
            ) : (
              `${minOutput} ${token1.symbol}`
            )}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-slate-400">
            Network fee
          </span>
          <span className="text-sm font-semibold text-gray-700 text-right dark:text-slate-400">
            {loading || !minOutput ? (
              <SkeletonBox className="h-4 py-0.5 w-[120px] rounded-md" />
            ) : (
              `${networkFee} APT`
            )}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-slate-400">
            Route
          </span>
          <span className="text-sm font-semibold text-gray-700 text-right dark:text-slate-400">
            {loading ? (
              <SkeletonBox className="h-4 py-0.5 w-[40px] rounded-md" />
            ) : (
              <Modal.Trigger tag={'trade-state-routes'}>
                {({ open }) => (
                  <button
                    type="button"
                    onClick={open}
                    className="text-sm text-blue font-semibold"
                  >
                    View
                  </button>
                )}
              </Modal.Trigger>
            )}
            <SwapRoute trade={bestRoutes} />
          </span>
        </div>
        {account?.address && (
          <div className="flex justify-between items-center border-t border-gray-200 dark:border-slate-200/5 mt-2 pt-2">
            <span className="font-medium text-sm text-gray-700 dark:text-slate-300">
              Recipient
            </span>
            <span className="font-semibold text-gray-700 text-right dark:text-slate-300">
              <a
                target="_blank"
                href={`https://explorer.aptoslabs.com/account/${
                  account?.address
                }?network=${networkNameToNetwork(network)}`}
                className={classNames('transition-all flex gap-1 items-center')}
                rel="noreferrer"
              >
                {`${account?.address.substring(
                  0,
                  6,
                )}...${account?.address.substring(66 - 4)}`}
              </a>
            </span>
          </div>
        )}
      </div>
    </Transition>
  )
}
