import type { Address, Event } from '../types'
import type { TokenEntity as Token } from '../../generated/src/Types.gen'
import { Cache, CacheCategory, framework } from '../async'
import { fromHex } from 'viem'
import { ZERO_BI, ZERO_BD } from '../constants'

export function getToken(
    address: Address,
    loader: (id: string) => Token | undefined,
) {
    const id = address.toLowerCase()
    const loaded = loader(id)

    if (!loaded) {
        let errMsg = 'Non existent token'
        console.log(errMsg)
        throw new Error(errMsg)
    }

    return loaded
}

export async function getToken_async(
    address: Address,
    loader: (id: string) => Promise<Token | undefined>,
) {
    const id = address.toLowerCase()
    const loaded = await loader(id)

    if (!loaded) {
        let errMsg = 'Non existent token'
        console.log(errMsg)
        throw new Error(errMsg)
    }

    return loaded
}

export async function getOrCreateToken_async(
    event: Event,
    address: Address,
    loader: (id: string) => Promise<Token | undefined>,
) {
    const id = address.toLowerCase()
    const loaded = await loader(id)

    if (!loaded) {
        return createToken(event, address.toLowerCase())
    }

    return loaded
}

async function createToken(event: Event, address: Address) {
    const { decimals, name, symbol } = await details(address, event.chainId)

    const entity: Token = {
        id: address.toLowerCase(),
        chainId: event.chainId.toString(),
        symbol,
        name,
        decimals: BigInt(decimals),
        totalSupply: ZERO_BI, // todo: fetch in details request
        derivedETH: ZERO_BD,
        volume: ZERO_BD,
        volumeUSD: ZERO_BD,
        feesUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        totalValueLocked: ZERO_BD,
        totalValueLockedUSD: ZERO_BD,
        totalValueLockedUSDUntracked: ZERO_BD,
        txCount: ZERO_BI,
        poolCount: ZERO_BI, // should this start as 1
    }

    return entity
}

/** --------------------------------------------------------------------------------------------------------- */
/** --------------------------------------------------------------------------------------------------------- */
/** --------------------------------------------------------------------------------------------------------- */

async function details(address: Address, chainId: number) {
    const cache = Cache.init(CacheCategory.Token, chainId)
    const token = cache.read(address.toLowerCase())

    if (token) {
        return {
            address,
            decimals: BigInt(token.decimals),
            name: token.name,
            symbol: token.symbol,
            totalSupply: token.totalSupply,
        }
    }

    const client = framework.getClient(chainId)

    try {
        const erc20 = framework.getERC20Contract(address, client)
        const [decimals, name, symbol, totalSupply] = await Promise.all([
            erc20.read.decimals(),
            erc20.read.name(),
            erc20.read.symbol(),
            erc20.read.totalSupply(),
        ])

        const entry = {
            decimals: decimals?.toString() || '',
            name: name?.toString() || '',
            symbol: symbol?.toString() || '',
            totalSupply: totalSupply?.toString() || '',
        } as const

        cache.add({ [address.toLowerCase()]: entry })

        return {
            decimals: BigInt(entry.decimals || 0),
            name: entry.name,
            symbol: entry.symbol,
            totalSupply: BigInt(entry.totalSupply),
        }
    } catch (_error) {
        /** Some tokens store their parameters as bytes not strings */
        try {
            const erc20Bytes = framework.getERC20BytesContract(address, client)
            const [decimals, name, symbol, totalSupply] = await Promise.all([
                erc20Bytes.read.decimals(),
                erc20Bytes.read.name(),
                erc20Bytes.read.symbol(),
                erc20Bytes.read.totalSupply(),
            ])

            const entry = {
                decimals: decimals?.toString() || '',
                name: fromHex(
                    (name?.toString() || '') as `0x${string}`,
                    'string',
                ),
                symbol: fromHex(
                    (symbol?.toString() || '') as `0x${string}`,
                    'string',
                ),
                totalSupply: totalSupply?.toString() || '',
            } as const

            cache.add({ [address.toLowerCase()]: entry })

            return {
                decimals: BigInt(entry.decimals || 0),
                name: entry.name,
                symbol: entry.symbol,
                totalSupply: BigInt(entry.totalSupply),
            }
        } catch (__error) {
            console.error(_error, __error)
            return {
                decimals: 0n,
                symbol: address,
                name: address,
                totalSupply: 0n,
            }
        }
    }
}
