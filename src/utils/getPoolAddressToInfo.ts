import poolAddressToInfo from './poolAddressToInfo.json'

type PoolInfo = {
    dexKey: string
    token0: {
        id: string
        symbol: string
        name: string
        decimals: string
        totalSupply: string
    }
    token1: {
        id: string
        symbol: string
        name: string
        decimals: string
        totalSupply: string
    }
}

type JSON = { [key: string]: PoolInfo }

export function getPoolAddressToInfo(srcAddress: string): PoolInfo | null {
    return (poolAddressToInfo as JSON)[srcAddress.toLowerCase()]
}
