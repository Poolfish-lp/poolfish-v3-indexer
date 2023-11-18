import {
    PoolContract_Initialize_loader,
    PoolContract_Initialize_handler,
    PoolContract_Mint_loader,
    PoolContract_Mint_handler,
} from '../generated/src/Handlers.gen'

import { PoolEntity } from '../generated/src/Types.gen'
import { ONE_BI, ZERO_BI } from './constants'
import { getPoolAddressToInfo } from './utils/getPoolAddressToInfo'
import bigInt from 'big-integer'
import { convertTokenToDecimal } from './utils/misc'
import Big from 'big.js'

// event Initialize(uint160 sqrtPriceX96, int24 tick)
PoolContract_Initialize_loader(({ event, context }) => {
    let poolAddress = event.srcAddress
    context.Pool.load(poolAddress, {})
})

PoolContract_Initialize_handler(({ event, context }) => {
    const poolInfo = getPoolAddressToInfo(event.srcAddress)
    if (!poolInfo) {
        return
    }
    let pool = context.Pool.get(event.srcAddress)

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
})

PoolContract_Mint_handler(({ event, context }) => {
    const poolInfo = getPoolAddressToInfo(event.srcAddress)
    if (!poolInfo) {
        return
    }

    let pool = context.Pool.get(event.srcAddress)
    // let bundle = Bundle.load("1") as Bundle;

    if (!pool) {
        // context.log.info("no pool for this mint: " + event.srcAddress);
        return
    }

    let token0 = context.Token.get(pool.token0)
    let token1 = context.Token.get(pool.token1)
    if (!token0 || !token1) {
        // context.log.error("no token0 or token1 for this mint: " + event.srcAddress);
        return
    }
    context.log.info('got tokens for this mint')
    let amount0 = convertTokenToDecimal(event.params.amount0, token0?.decimals)
    let amount1 = convertTokenToDecimal(event.params.amount1, token1?.decimals)

    // Pools liquidity tracks the currently active liquidity given pools current tick.
    // We only want to update it on mint if the new position includes the current tick.
    let liquidity = pool?.liquidity ?? ZERO_BI
    if (
        pool.tick !== null &&
        bigInt(event.params.tickLower).leq(bigInt(pool.tick)) &&
        bigInt(event.params.tickUpper).gt(bigInt(pool.tick))
    ) {
        liquidity = pool.liquidity + event.params.amount
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
            .times(2000) // derivedETH
            .plus(new Big(pool.totalValueLockedToken1).times(token1.derivedETH))
            .toString(),
        // totalValueLockedUSD: new Big(pool.totalValueLockedETH).times(bundle.ethPriceUSD).toString(),
    }
    context.Pool.set(poolObject)
})
