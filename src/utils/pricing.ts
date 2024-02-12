/* eslint-disable prefer-const */
import bigInt from 'big-integer'
import {
    BundleEntity as Bundle,
    PoolEntity as Pool,
    TokenEntity as Token,
} from '../../generated/src/Types.gen'
import {
    NATIVE_ADDRESS,
    NATIVE_PRICE_POOL,
    ONE_BD,
    ZERO_BD,
    ZERO_BI,
} from '../constants'
import Big from 'big.js'
import { exponentToBig, safeDiv } from './misc'
import { ethereumSushiswapConfig } from '../config'

const Q192 = bigInt(2).pow(bigInt(192)) // BigInt.fromI32(2).pow(BigInt.fromI32(192).toI32() as u8)

export function sqrtPriceX96ToTokenPrices(
    sqrtPriceX96: BigInt,
    token0: Token,
    token1: Token,
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

export function getNativeTokenPriceInUSD(nativeAndStablePool: Pool): string {
    // fetch eth prices for each stablecoin
    // let nativeAndStablePool = Pool.load(NATIVE_PRICE_POOL)

    if (nativeAndStablePool !== null) {
        return nativeAndStablePool.token0 == NATIVE_ADDRESS.toLowerCase()
            ? nativeAndStablePool.token1Price
            : nativeAndStablePool.token0Price
    } else {
        return ZERO_BD
    }
}

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
// export function findEthPerToken(
//     token: Token,
//     pool: Pool,
//     bundle: Bundle,
// ): Big {
//     if (token.id == NATIVE_ADDRESS.toLowerCase()) {
//         return new Big(ONE_BD)
//     }
//     let whiteList = token.whitelistPools
//     // for now just take USD from pool with greatest TVL
//     // need to update this to actually detect best rate based on liquidity distribution
//     let largestLiquidityETH = ZERO_BD
//     let priceSoFar = new Big(ZERO_BD)

//     // hardcoded fix for incorrect rates
//     // if whitelist includes token - get the safe price
//     if (STABLE_TOKEN_ADDRESSES.includes(token.id)) {
//         priceSoFar = safeDiv(new Big(ONE_BD), new Big(bundle.nativeTokenPriceUSD))
//     } else {
//         for (let i = 0; i < whiteList.length; ++i) {
//             let poolAddress = whiteList[i]

//             if (pool.liquidity.gt(ZERO_BI)) {
//                 if (pool.token0 == token.id) {
//                     // whitelist token is token1
//                     let token1 = Token.load(pool.token1) as Token
//                     // get the derived ETH in pool
//                     let ethLocked = pool.totalValueLockedToken1.times(
//                         token1.derivedETH,
//                     )
//                     if (
//                         ethLocked.gt(largestLiquidityETH) &&
//                         ethLocked.gt(MINIMUM_ETH_LOCKED)
//                     ) {
//                         largestLiquidityETH = ethLocked
//                         // token1 per our token * Eth per token1
//                         priceSoFar = pool.token1Price.times(
//                             token1.derivedETH as BigDecimal,
//                         )
//                     }
//                 }
//                 if (pool.token1 == token.id) {
//                     let token0 = Token.load(pool.token0) as Token
//                     // get the derived ETH in pool
//                     let ethLocked = pool.totalValueLockedToken0.times(
//                         token0.derivedETH,
//                     )
//                     if (
//                         ethLocked.gt(largestLiquidityETH) &&
//                         ethLocked.gt(MINIMUM_ETH_LOCKED)
//                     ) {
//                         largestLiquidityETH = ethLocked
//                         // token0 per our token * ETH per token0
//                         priceSoFar = pool.token0Price.times(
//                             token0.derivedETH as BigDecimal,
//                         )
//                     }
//                 }
//             }
//         }
//     }
//     return priceSoFar // nothing was found return 0
// }

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export const findEthPerToken = async (
    token: Token,
    chainId: string,
    bundleLoader: (id: string) => Promise<Bundle | undefined>,
    poolLoader: (id: string) => Promise<Pool | undefined>,
    tokenLoader: (id: string) => Promise<Token | undefined>,
): Promise<string> => {
    if (token.id.toLowerCase() == NATIVE_ADDRESS.toLowerCase()) {
        return ONE_BD
    }

    let whiteList = token.whitelistPools
    // for now just take USD from pool with greatest TVL
    // need to update this to actually detect best rate based on liquidity distribution
    let largestLiquidityETH = new Big(ZERO_BD)
    let priceSoFar = ZERO_BD
    let bundle = await bundleLoader(chainId)

    if (!bundle) {
        let errMsg = 'Non existent bundle'
        console.error(errMsg)
        throw new Error(errMsg)
    }

    // hardcoded fix for incorrect rates
    // if whitelist includes token - get the safe price
    if (ethereumSushiswapConfig.stableTokenAddresses.includes(token.id)) {
        priceSoFar = safeDiv(
            new Big(ONE_BD),
            new Big(bundle.nativeTokenPriceUSD),
        ).toString()
    } else {
        for (let i = 0; i < whiteList.length; ++i) {
            let poolAddress = whiteList[i]
            let pool = await poolLoader(poolAddress)

            if (!pool) {
                let errMsg = 'Non existent pool'
                console.error(errMsg)
                throw new Error(errMsg)
            }

            if (pool.liquidity > ZERO_BI) {
                if (pool.token0 == token.id) {
                    // whitelist token is token1
                    let token1 = await tokenLoader(pool.token1)

                    if (!token1) {
                        let errMsg = 'Non existent token'
                        console.error(errMsg)
                        throw new Error(errMsg)
                    }

                    // get the derived ETH in pool
                    let ethLocked = new Big(pool.totalValueLockedToken1).times(
                        token1.derivedETH,
                    )
                    if (
                        ethLocked.gt(largestLiquidityETH) &&
                        ethLocked.gt(
                            new Big(ethereumSushiswapConfig.minimumEthLocked),
                        )
                    ) {
                        largestLiquidityETH = ethLocked
                        // token1 per our token * Eth per token1
                        priceSoFar = new Big(pool.token1Price)
                            .times(new Big(token1.derivedETH))
                            .toString()
                    }
                }
                if (pool.token1 == token.id) {
                    // whitelist token is token1
                    let token0 = await tokenLoader(pool.token0)

                    if (!token0) {
                        let errMsg = 'Non existent token'
                        console.error(errMsg)
                        throw new Error(errMsg)
                    }

                    // get the derived ETH in pool
                    let ethLocked = new Big(pool.totalValueLockedToken1).times(
                        token0.derivedETH,
                    )
                    if (
                        ethLocked.gt(largestLiquidityETH) &&
                        ethLocked.gt(
                            new Big(ethereumSushiswapConfig.minimumEthLocked),
                        )
                    ) {
                        largestLiquidityETH = ethLocked
                        // token1 per our token * Eth per token1
                        priceSoFar = new Big(pool.token1Price)
                            .times(new Big(token0.derivedETH))
                            .toString()
                    }
                }
            }
        }
    }
    return priceSoFar
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
    tokenAmount0: Big,
    token0: Token,
    tokenAmount1: Big,
    token1: Token,
    bundle: Bundle,
): Big {
    let price0USD = new Big(token0.derivedETH).times(bundle.nativeTokenPriceUSD)
    let price1USD = new Big(token1.derivedETH).times(bundle.nativeTokenPriceUSD)

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
