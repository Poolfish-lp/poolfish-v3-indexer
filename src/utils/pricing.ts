/* eslint-disable prefer-const */
import bigInt from 'big-integer'
import {
    BundleEntity,
    PoolContract_InitializeEvent_poolEntityHandlerContext,
    PoolEntity,
    TokenEntity,
} from '../../generated/src/Types.gen'
import {
    MINIMUM_ETH_LOCKED,
    NATIVE_ADDRESS,
    NATIVE_PRICE_POOL,
    ONE_BD,
    STABLE_TOKEN_ADDRESSES,
    ZERO_BD,
    ZERO_BD_STR,
    ZERO_BI,
} from '../constants'
import Big from 'big.js'
import { exponentToBig, safeDiv } from './misc'

const Q192 = bigInt(2).pow(bigInt(192)) // BigInt.fromI32(2).pow(BigInt.fromI32(192).toI32() as u8)

export function sqrtPriceX96ToTokenPrices(
    sqrtPriceX96: BigInt,
    token0: TokenEntity,
    token1: TokenEntity,
): Big[] {
    let num = new Big(
        bigInt(sqrtPriceX96.toString())
            .times(sqrtPriceX96.toString())
            .toString(),
    )
    let denom = new Big(Q192.toString())
    let price1 = num
        .div(denom)
        .times(exponentToBig(token0.decimals))
        .div(exponentToBig(token1.decimals))

    let price0 = safeDiv(new Big('1'), price1)
    return [price0, price1]
}

export function getEthPriceInUSD(
    nativeAndStablePool: PoolEntity | undefined,
): string {
    // fetch eth prices for each stablecoin
    // let nativeAndStablePool = Pool.load(NATIVE_PRICE_POOL)

    if (nativeAndStablePool !== undefined) {
        return nativeAndStablePool.token0.toLowerCase() ==
            NATIVE_ADDRESS.toLowerCase()
            ? nativeAndStablePool.token1Price
            : nativeAndStablePool.token0Price
    } else {
        return ZERO_BD_STR
    }
    // return '2080.712613442138485352331619073978'
}

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(
    token: TokenEntity,
    getWhitelistPools: (_token: TokenEntity) => PoolEntity[],
    getToken0: (_pool: PoolEntity) => TokenEntity,
    getToken1: (_pool: PoolEntity) => TokenEntity,
    bundle: BundleEntity,
): Big {
    if (token.id == NATIVE_ADDRESS.toLowerCase()) {
        return new Big(ONE_BD)
    }
    let whiteList = getWhitelistPools(token)

    // for now just take USD from pool with greatest TVL
    // need to update this to actually detect best rate based on liquidity distribution
    let largestLiquidityETH = ZERO_BD
    let priceSoFar = ZERO_BD

    // hardcoded fix for incorrect rates
    // if whitelist includes token - get the safe price
    if (STABLE_TOKEN_ADDRESSES.includes(token.id)) {
        priceSoFar = safeDiv(ONE_BD, new Big(bundle.ethPriceUSD))
    } else {
        for (let i = 0; i < whiteList.length; ++i) {
            let pool = whiteList[i]

            if (pool.liquidity > ZERO_BI) {
                if (pool.token0 == token.id) {
                    // whitelist token is token1
                    let token1 = getToken1(pool)
                    // get the derived ETH in pool
                    let ethLocked = new Big(pool.totalValueLockedToken1).times(
                        token1.derivedETH, // this is a string, but 'Big' seems to handle it.
                    )
                    if (
                        ethLocked.gt(largestLiquidityETH) &&
                        ethLocked.gt(MINIMUM_ETH_LOCKED)
                    ) {
                        largestLiquidityETH = ethLocked
                        // token1 per our token * Eth per token1
                        priceSoFar = Big(pool.token1Price).times(
                            token1.derivedETH,
                        )
                    }
                }
                if (pool.token1 == token.id) {
                    let token0 = getToken0(pool)
                    // get the derived ETH in pool
                    let ethLocked = Big(pool.totalValueLockedToken0).times(
                        token0.derivedETH,
                    )
                    if (
                        ethLocked.gt(largestLiquidityETH) &&
                        ethLocked.gt(MINIMUM_ETH_LOCKED)
                    ) {
                        largestLiquidityETH = ethLocked
                        // token0 per our token * ETH per token0
                        priceSoFar = Big(pool.token0Price).times(
                            token0.derivedETH,
                        )
                    }
                }
            }
        }
    }
    return priceSoFar // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
    tokenAmount0: Big,
    token0: TokenEntity,
    tokenAmount1: Big,
    token1: TokenEntity,
    bundle: BundleEntity,
): Big {
    let price0USD = new Big(token0.derivedETH).times(bundle.ethPriceUSD)
    let price1USD = new Big(token1.derivedETH).times(bundle.ethPriceUSD)

    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD))

    // both are whitelist tokens, return sum of both amounts
    // if (
    //     WHITELISTED_TOKEN_ADDRESSES.includes(token0.id) &&
    //     WHITELISTED_TOKEN_ADDRESSES.includes(token1.id)
    // ) {
    //     return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD))
    // }

    // // take double value of the whitelisted token amount
    // if (
    //     WHITELISTED_TOKEN_ADDRESSES.includes(token0.id) &&
    //     !WHITELISTED_TOKEN_ADDRESSES.includes(token1.id)
    // ) {
    //     return tokenAmount0.times(price0USD).times(BigDecimal.fromString('2'))
    // }

    // // take double value of the whitelisted token amount
    // if (
    //     !WHITELISTED_TOKEN_ADDRESSES.includes(token0.id) &&
    //     WHITELISTED_TOKEN_ADDRESSES.includes(token1.id)
    // ) {
    //     return tokenAmount1.times(price1USD).times(BigDecimal.fromString('2'))
    // }

    // // neither token is on white list, tracked amount is 0
    // return ZERO_BD
}
