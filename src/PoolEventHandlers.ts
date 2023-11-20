import {
    PoolContract_Initialize_loader,
    PoolContract_Initialize_handler,
    PoolContract_Mint_loader,
    PoolContract_Mint_handler,
    PoolContract_Burn_loader,
    PoolContract_Burn_handler,
} from '../generated/src/Handlers.gen'

import { PoolEntity, TokenEntity } from '../generated/src/Types.gen'
import { NATIVE_PRICE_POOL, ONE_BI, ZERO_BI } from './constants'
import { getPoolAddressToInfo } from './utils/getPoolAddressToInfo'
import bigInt, { BigInteger } from 'big-integer'
import { convertTokenToDecimal } from './utils/misc'
import Big from 'big.js'
import { getEthPriceInUSD } from './utils/pricing'

// event Initialize(uint160 sqrtPriceX96, int24 tick)
PoolContract_Initialize_loader(({ event, context }) => {
    let poolAddress = event.srcAddress
    context.Pool.load(poolAddress, {})

    context.Pool.load(NATIVE_PRICE_POOL, {
        loaders: {
            loadToken0: true,
            loadToken1: true,
        },
    })
})

PoolContract_Initialize_handler(({ event, context }) => {
    const poolInfo = getPoolAddressToInfo(event.srcAddress)
    if (!poolInfo) {
        return
    }
    let pool = context.Pool.get(event.srcAddress)

    let ethPool = context.Pool.get(NATIVE_PRICE_POOL)
    if (ethPool) {
        context.log.info('got eth pool')
        const price = getEthPriceInUSD(ethPool)
        context.log.info('got eth price: ' + price)
        context.Bundle.set({
            id: '1',
            ethPriceUSD: price,
        })
    }

    if (pool) {
        let poolObject: PoolEntity = {
            ...pool,
            tick: event.params.tick,
            sqrtPrice: event.params.sqrtPriceX96,
        }
        context.Pool.set(poolObject)
    } else {
        context.log.info('no pool: ' + event.srcAddress)
    }
})

PoolContract_Mint_loader(({ event, context }) => {
    let poolAddress = event.srcAddress
    const poolInfo = getPoolAddressToInfo(poolAddress)
    if (!poolInfo) {
        return
    }
    context.Pool.load(poolAddress, {
        loaders: {
            loadToken0: true,
            loadToken1: true,
        },
    })
    context.Token.load(poolInfo.token0.id)
    context.Token.load(poolInfo.token1.id)

    context.Bundle.load('1')
})

PoolContract_Mint_handler(({ event, context }) => {
    const poolInfo = getPoolAddressToInfo(event.srcAddress)
    if (!poolInfo) {
        return
    }

    let pool = context.Pool.get(event.srcAddress)

    if (!pool) {
        // context.log.info("no pool for this mint: " + event.srcAddress);
        return
    }
    const bundle = context.Bundle.get('1')
    if (!bundle) {
        return
    }

    let token0 = context.Token.get(pool.token0)
    let token1 = context.Token.get(pool.token1)
    if (!token0 || !token1) {
        // context.log.error("no token0 or token1 for this mint: " + event.srcAddress);
        return
    }
    let amount0 = convertTokenToDecimal(event.params.amount0, token0?.decimals)
    let amount1 = convertTokenToDecimal(event.params.amount1, token1?.decimals)

    let amountUSD = amount0
        .times(new Big(token0.derivedETH).times(bundle.ethPriceUSD))
        .plus(
            amount1.times(new Big(token1.derivedETH).times(bundle.ethPriceUSD)),
        )

    // update token0 data
    let token0Object: TokenEntity = {
        ...token0,
        txCount: BigInt(bigInt(token0.txCount).plus(ONE_BI).toString()),
        totalValueLocked: new Big(token0.totalValueLocked)
            .minus(amount0)
            .toString(),
        totalValueLockedUSD: new Big(token0.totalValueLocked)
            .times(new Big(token0.derivedETH).times(bundle.ethPriceUSD))
            .toString(),
    }
    context.Token.set(token0Object)

    // update token1 data
    let token1Object: TokenEntity = {
        ...token0,
        txCount: BigInt(bigInt(token1.txCount).plus(ONE_BI).toString()),
        totalValueLocked: new Big(token1.totalValueLocked)
            .minus(amount1)
            .toString(),
        totalValueLockedUSD: new Big(token1.totalValueLocked)
            .times(new Big(token1.derivedETH).times(bundle.ethPriceUSD))
            .toString(),
    }
    context.Token.set(token1Object)

    // Pools liquidity tracks the currently active liquidity given pools current tick.
    // We only want to update it on mint if the new position includes the current tick.
    let liquidity = pool?.liquidity ?? ZERO_BI
    if (
        pool.tick !== null &&
        bigInt(event.params.tickLower).leq(bigInt(pool.tick)) &&
        bigInt(event.params.tickUpper).gt(bigInt(pool.tick))
    ) {
        liquidity = BigInt(
            bigInt(pool.liquidity).plus(event.params.amount).toString(),
        )
    }

    let poolObject: PoolEntity = {
        ...pool,
        liquidity: liquidity,
        txCount: pool.txCount + ONE_BI,
        totalValueLockedToken0: new Big(pool.totalValueLockedToken0)
            .plus(amount0)
            .toString(),
        totalValueLockedToken1: new Big(pool.totalValueLockedToken1)
            .plus(amount1)
            .toString(),
        totalValueLockedETH: new Big(pool.totalValueLockedToken0)
            .times(token0.derivedETH)
            .plus(new Big(pool.totalValueLockedToken1).times(token1.derivedETH))
            .toString(),
        totalValueLockedUSD: new Big(pool.totalValueLockedETH)
            .times(bundle.ethPriceUSD)
            .toString(),
    }
    context.Pool.set(poolObject)
})

PoolContract_Burn_loader(({ event, context }) => {
    let poolAddress = event.srcAddress
    const poolInfo = getPoolAddressToInfo(poolAddress)
    if (!poolInfo) {
        return
    }
    context.Pool.load(poolAddress, {
        loaders: {
            loadToken0: true,
            loadToken1: true,
        },
    })
    context.Token.load(poolInfo.token0.id)
    context.Token.load(poolInfo.token1.id)

    context.Bundle.load('1')
})

PoolContract_Burn_handler(({ event, context }) => {
    const poolInfo = getPoolAddressToInfo(event.srcAddress)
    if (!poolInfo) {
        return
    }

    let pool = context.Pool.get(event.srcAddress)

    if (!pool) {
        // context.log.info("no pool for this mint: " + event.srcAddress);
        return
    }
    const bundle = context.Bundle.get('1')
    if (!bundle) {
        return
    }

    let token0 = context.Token.get(pool.token0)
    let token1 = context.Token.get(pool.token1)
    if (!token0 || !token1) {
        // context.log.error("no token0 or token1 for this mint: " + event.srcAddress);
        return
    }
    let amount0 = convertTokenToDecimal(event.params.amount0, token0?.decimals)
    let amount1 = convertTokenToDecimal(event.params.amount1, token1?.decimals)

    let amountUSD = amount0
        .times(new Big(token0.derivedETH).times(bundle.ethPriceUSD))
        .plus(
            amount1.times(new Big(token1.derivedETH).times(bundle.ethPriceUSD)),
        )

    // update token0 data
    let token0Object: TokenEntity = {
        ...token0,
        txCount: BigInt(bigInt(token0.txCount).minus(ONE_BI).toString()),
        totalValueLocked: new Big(token0.totalValueLocked)
            .minus(amount0)
            .toString(),
        totalValueLockedUSD: new Big(token0.totalValueLocked)
            .times(new Big(token0.derivedETH).times(bundle.ethPriceUSD))
            .toString(),
    }
    context.Token.set(token0Object)

    // update token1 data
    let token1Object: TokenEntity = {
        ...token0,
        txCount: BigInt(bigInt(token1.txCount).minus(ONE_BI).toString()),
        totalValueLocked: new Big(token1.totalValueLocked)
            .minus(amount1)
            .toString(),
        totalValueLockedUSD: new Big(token1.totalValueLocked)
            .times(new Big(token1.derivedETH).times(bundle.ethPriceUSD))
            .toString(),
    }
    context.Token.set(token1Object)

    // Pools liquidity tracks the currently active liquidity given pools current tick.
    // We only want to update it on mint if the new position includes the current tick.
    let liquidity = pool?.liquidity ?? ZERO_BI
    if (
        pool.tick !== null &&
        bigInt(event.params.tickLower).leq(bigInt(pool.tick)) &&
        bigInt(event.params.tickUpper).gt(bigInt(pool.tick))
    ) {
        liquidity = BigInt(
            bigInt(pool.liquidity).minus(event.params.amount).toString(),
        )
    }

    let poolObject: PoolEntity = {
        ...pool,
        liquidity: liquidity,
        txCount: pool.txCount + ONE_BI,
        totalValueLockedToken0: new Big(pool.totalValueLockedToken0)
            .minus(amount0)
            .toString(),
        totalValueLockedToken1: new Big(pool.totalValueLockedToken1)
            .minus(amount1)
            .toString(),
        totalValueLockedETH: new Big(pool.totalValueLockedToken0)
            .times(token0.derivedETH)
            .plus(new Big(pool.totalValueLockedToken1).times(token1.derivedETH))
            .toString(),
        totalValueLockedUSD: new Big(pool.totalValueLockedETH)
            .times(bundle.ethPriceUSD)
            .toString(),
    }
    context.Pool.set(poolObject)
})
