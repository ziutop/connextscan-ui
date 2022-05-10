import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { useSelector, shallowEqual } from 'react-redux'
import { utils } from 'ethers'
import { FallingLines, TailSpin, Watch } from 'react-loader-spinner'
import { BiMessageError, BiMessageCheck } from 'react-icons/bi'

import Notification from '../notifications'
import Modal from '../modals'
import Wallet from '../wallet'
import Copy from '../copy'
import EnsProfile from '../ens-profile'
import { ellipse, loader_color } from '../../lib/utils'

export default ({ disabled = false }) => {
  const { preferences, chains, assets, dev, wallet } = useSelector(state => ({ preferences: state.preferences, chains: state.chains, assets: state.assets, dev: state.dev, wallet: state.wallet }), shallowEqual)
  const { theme } = { ...preferences }
  const { chains_data } = { ...chains }
  const { assets_data } = { ...assets }
  const { sdk } = { ...dev }
  const { wallet_data } = { ...wallet }
  const { chain_id, web3_provider, signer } = { ...wallet_data }
  const wallet_address = wallet_data?.address

  const router = useRouter()
  const { query } = { ...router }
  const { address } = { ...query }

  const [data, setData] = useState(null)
  const [adding, setAdding] = useState(null)
  const [addResponse, setAddResponse] = useState(null)

  useEffect(() => {
    if (chains_data && assets_data && !data?.chain) {
      setData({
        ...data,
        chain: chains_data?.[0]?.id,
        asset: assets_data?.filter(a => a?.contracts?.findIndex(c => c?.chain_id === chains_data?.[0]?.chain_id && c?.contract_address) > -1)?.[0]?.id,
      })
    }
  }, [chains_data, assets_data, data])

  const reset = () => {
    setData(null)
    setAdding(false)
    setAddResponse(null)
  }

  const addLiquidty = async () => {
    if (chains_data && sdk && signer && data) {
      setAdding(true)
      const { chain, asset, amount } = { ...data }
      const chain_data = chains_data?.find(c => c?.id === chain)
      const asset_data = assets_data?.find(a => a?.id === asset)
      const contract_data = asset_data?.contracts?.find(c => c?.chain_id === chain_data?.chain_id)
      const symbol = contract_data?.symbol || asset_data?.symbol
      const decimals = contract_data?.contract_decimals || 18
      try {
        const add_request = await sdk.nxtpSdkRouter.addLiquidityForRouter({
          domain: chain_data?.domain_id?.toString(),
          amount: utils.parseUnits(amount?.toString() || '0', decimals).toString(),
          assetId: contract_data?.contract_address,
          _router: address,
        })
        if (add_request) {
          const add_response = await signer.sendTransaction(add_request)
          const tx_hash = add_response?.hash
          setAddResponse({ status: 'pending', message: `Wait for adding ${symbol} liquidity`, tx_hash })
          const add_receipt = await signer.provider.waitForTransaction(tx_hash)
          setAddResponse({
            status: add_receipt?.status ? 'success' : 'failed',
            message: add_receipt?.status ? `add ${symbol} liquidity successful` : `Failed to add ${symbol} liquidity`,
            tx_hash,
          })
        }
      } catch (error) {
        setAddResponse({ status: 'failed', message: error?.data?.message || error?.message })
      }
      setAdding(false)
    }
  }

  const fields = [
    {
      label: 'Chain',
      name: 'chain',
      type: 'select',
      placeholder: 'Select chain',
      options: chains_data?.map(c => {
        return {
          value: c.id,
          title: c.name,
          name: c.name,
        }
      }) || [],
    },
    {
      label: 'Asset',
      name: 'asset',
      type: 'select',
      placeholder: 'Select asset',
      options: assets_data?.filter(a => !data?.chain || (a?.contracts?.findIndex(c => c?.chain_id === chains_data?.find(_c => _c?.id === data.chain)?.chain_id && c?.contract_address) > -1)).map(a => {
        const contract_data = a?.contracts?.find(c => c?.chain_id === chains_data?.find(_c => _c?.id === data?.chain)?.chain_id)
        return {
          value: a.id,
          title: a.name,
          name: `${contract_data?.symbol || a.symbol}${contract_data?.contract_address ? `: ${ellipse(contract_data?.contract_address, 16)}` : ''}`,
        }
      }) || [],
    },
    {
      label: 'Amount',
      name: 'amount',
      type: 'number',
      placeholder: 'Amount',
    },
  ]

  const chain_data = chains_data?.find(c => c?.id === data?.chain)
  const hasAllFields = fields.length === fields.filter(f => data?.[f.name]).length

  return (
    <>
      {addResponse && (
        <Notification
          hideButton={true}
          outerClassNames="w-full h-auto z-50 transform fixed top-0 left-0 p-0"
          innerClassNames={`${addResponse.status === 'failed' ? 'bg-red-500 dark:bg-red-600' : addResponse.status === 'success' ? 'bg-green-500 dark:bg-green-600' : 'bg-blue-600 dark:bg-blue-700'} text-white`}
          animation="animate__animated animate__fadeInDown"
          icon={addResponse.status === 'failed' ?
            <BiMessageError className="w-4 h-4 stroke-current mr-2" />
            :
            addResponse.status === 'success' ?
              <BiMessageCheck className="w-4 h-4 stroke-current mr-2" />
              :
              <Watch color="white" width="16" height="16" className="mr-2" />
          }
          content={<div className="flex flex-wrap items-center space-x-1.5">
            <span>
              {addResponse.message}
            </span>
            {chain_data?.explorer?.url && addResponse.tx_hash && (
              <a
                href={`${chain_data.explorer.url}${chain_data.explorer.transaction_path?.replace('{tx}', addResponse.tx_hash)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="font-semibold">
                  View on {chain_data.explorer.name}
                </span>
              </a>
            )}
          </div>}
        />
      )}
      <Modal
        disabled={disabled}
        buttonTitle={address ?
          <div className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-lg shadow flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-100 space-x-1.5 py-1.5 px-2">
            <span className="text-xs font-semibold">
              Manage Router
            </span>
          </div>
          :
          <FallingLines color={loader_color(theme)} width="24" height="24" />
        }
        buttonClassName={`min-w-max ${disabled ? 'cursor-not-allowed' : ''} flex items-center justify-center`}
        title="Add Router Liquidity"
        body={<div className="form mt-2">
          {fields.map((f, i) => (
            <div key={i} className="form-element">
              {f.label && (
                <div className="form-label text-slate-600 dark:text-slate-400 font-medium">
                  {f.label}
                </div>
              )}
              {f.type === 'select' ?
                <select
                  placeholder={f.placeholder}
                  value={data?.[f.name]}
                  onChange={e => setData({ ...data, [`${f.name}`]: e.target.value })}
                  className="form-select bg-slate-50 border-0 focus:ring-0 rounded-lg"
                >
                  {f.options?.map((o, i) => (
                    <option
                      key={i}
                      title={o.title}
                      value={o.value}
                    >
                      {o.name}
                    </option>
                  ))}
                </select>
                :
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={data?.[f.name]}
                  onChange={e => setData({ ...data, [`${f.name}`]: e.target.value })}
                  className="form-input border-0 focus:ring-0 rounded-lg"
                />
              }
            </div>
          ))}
          {hasAllFields && (
            <div className="w-full flex items-center justify-end space-x-3 pt-2">
              <EnsProfile
                address={wallet_address}
                fallback={wallet_address && (
                  <Copy
                    value={wallet_address}
                    title={<span className="text-sm text-slate-400 dark:text-slate-200">
                      <span className="xl:hidden">
                        {ellipse(wallet_address, 8)}
                      </span>
                      <span className="hidden xl:block">
                        {ellipse(wallet_address, 12)}
                      </span>
                    </span>}
                    size={18}
                  />
                )}
              />
              <Wallet connectChainId={chain_data?.chain_id} />
            </div>
          )}
        </div>}
        cancelDisabled={adding}
        onCancel={() => reset()}
        confirmDisabled={adding}
        onConfirm={() => addLiquidty()}
        onConfirmHide={false}
        confirmButtonTitle={<span className="flex items-center justify-center space-x-1.5">
          {adding && (
            <TailSpin color="white" width="18" height="18" />
          )}
          <span>
            {adding ? 'Adding' : 'Add'}
          </span>
        </span>}
        onClose={() => reset()}
        noButtons={!hasAllFields || !web3_provider || chain_data?.chain_id !== chain_id}
      />
    </>
  )
}