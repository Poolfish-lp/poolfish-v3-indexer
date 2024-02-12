import {
    PoolContract_Initialize_handlerAsync,
    PoolContract_Mint_handlerAsync,
    PoolContract_Burn_handlerAsync,
    PoolContract_Swap_handlerAsync,
} from '../generated/src/Handlers.gen'

import {
    PoolEntity as Pool,
    TokenEntity as Token,
    FactoryEntity as Factory,
} from '../generated/src/Types.gen'
import { NATIVE_PRICE_POOL, ONE_BI, ZERO_BD, ZERO_BI } from './constants' // todo: generalize native price pool
import bigInt, { BigInteger } from 'big-integer'
import {
    convertTokenToDecimal,
    getFeeGrowthGlobal0X128,
    getFeeGrowthGlobal1X128,
    safeDiv,
} from './utils/misc'
import Big from 'big.js'
import {
    getNativeTokenPriceInUSD,
    findEthPerToken,
    getTrackedAmountUSD,
    sqrtPriceX96ToTokenPrices,
} from './utils/pricing'
import { get } from 'http'
import { Hash } from 'viem'

import {
    getPool_async,
    getBundle_async,
    getFactory_async,
    getToken_async,
} from './helpers'

// Initialize(uint160 sqrtPriceX96, int24 tick)
PoolContract_Initialize_handlerAsync(async ({ event, context }) => {
    let pool = await getPool_async(event.srcAddress, context.Pool.get)

    let poolObject: Pool = {
        ...pool,
        tick: event.params.tick,
        sqrtPrice: event.params.sqrtPriceX96,
    }

    context.Pool.set(poolObject)

    let token0 = await getToken_async(pool.token0, context.Token.get)
    let token1 = await getToken_async(pool.token0, context.Token.get)

    let derivedETH0 = await findEthPerToken(
        token0,
        event.chainId.toString(),
        context.Bundle.get,
        context.Pool.get,
        context.Token.get,
    )
    // update token prices
    let updatedToken0 = {
        ...token0,
        derivedEth: derivedETH0,
    }

    await context.Token.set(updatedToken0)

    let derivedETH1 = await findEthPerToken(
        token1,
        event.chainId.toString(),
        context.Bundle.get,
        context.Pool.get,
        context.Token.get,
    )

    let updateToken1 = {
        ...token1,
        derivedEth: derivedETH1,
    }

    await context.Token.set(updateToken1)

    let nativeAssetPool = NATIVE_PRICE_POOL //todo: make this a function that takes the pool.dexKey && event.chainId

    let nativeTokenPool = await context.Pool.get(nativeAssetPool)

    if (nativeTokenPool) {
        const price = getNativeTokenPriceInUSD(nativeTokenPool)

        context.Bundle.set({
            id: event.chainId.toString(),
            nativeTokenPriceUSD: price,
        })
    }

    // todo: update pool data intervals file - utils/intervalUpdate.ts
    // updatePoolDayData(event)
    // updatePoolHourData(event)
})

// Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)
PoolContract_Mint_handlerAsync(async ({ event, context }) => {
    let pool = await getPool_async(event.srcAddress, context.Pool.get)
    let bundle = await getBundle_async(
        event.chainId.toString(),
        context.Bundle.get,
    )
    let factory = await getFactory_async(pool.factory, context.Factory.get)
    let token0 = await getToken_async(pool.token0, context.Token.get)
    let token1 = await getToken_async(pool.token1, context.Token.get)

    // context.log.info(new Big(factory.totalValueLockedETH).toString())
    // context.log.info(pool.totalValueLockedETH)
    // context.log.info(bundle.nativeTokenPriceUSD)

    const updatedFactory: Factory = {
        ...factory,
        totalValueLockedETH: new Big(factory.totalValueLockedETH)
            .minus(pool.totalValueLockedETH)
            .toString(), // reset tvl aggregates until new amounts calculated
        txCount: factory.txCount + 1, // update globals
        totalValueLockedUSD: new Big(factory.totalValueLockedETH)
            .times(bundle.nativeTokenPriceUSD)
            .toString(), // reset aggregates with new amounts
    }

    await context.Factory.set(updatedFactory)

    let amount0: Big = convertTokenToDecimal(
        event.params.amount0,
        token0?.decimals,
    )
    let amount1: Big = convertTokenToDecimal(
        event.params.amount1,
        token1?.decimals,
    )

    let amountUSD = amount0
        .times(new Big(token0.derivedETH).times(bundle.nativeTokenPriceUSD))
        .plus(
            amount1.times(
                new Big(token1.derivedETH).times(bundle.nativeTokenPriceUSD),
            ),
        )

    // update token0 data
    let updatedToken0: Token = {
        ...token0,
        txCount: BigInt(BigInt(token0.txCount) + ONE_BI),
        totalValueLocked: new Big(token0.totalValueLocked)
            .plus(amount0)
            .toString(),
        totalValueLockedUSD: new Big(token0.totalValueLocked)
            .times(new Big(token0.derivedETH).times(bundle.nativeTokenPriceUSD))
            .toString(),
    }
    context.Token.set(updatedToken0)

    // update token1 data
    let updatedToken1: Token = {
        ...token1,
        txCount: BigInt(bigInt(token1.txCount).plus(ONE_BI).toString()),
        totalValueLocked: new Big(token1.totalValueLocked)
            .plus(amount1)
            .toString(),
        totalValueLockedUSD: new Big(token1.totalValueLocked)
            .times(new Big(token1.derivedETH).times(bundle.nativeTokenPriceUSD))
            .toString(),
    }
    context.Token.set(updatedToken1)

    // Pools liquidity tracks the currently active liquidity given pools current tick.
    // We only want to update it on mint if the new position includes the current tick.
    let poolLiquidity = pool.liquidity
    if (
        pool.tick &&
        BigInt(event.params.tickLower) <= BigInt(pool.tick) &&
        BigInt(event.params.tickUpper) > BigInt(pool.tick)
    ) {
        poolLiquidity = BigInt(pool.liquidity) + BigInt(event.params.amount)
    }

    let poolObject: Pool = {
        ...pool,
        liquidity: poolLiquidity,
        txCount: pool.txCount + 1,
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
            .times(bundle.nativeTokenPriceUSD)
            .toString(),
    }
    context.Pool.set(poolObject)

    // todo: remainder of mint
    //   let transaction = loadTransaction(event)
    //   let mint = new Mint(transaction.id.toString() + '#' + pool.txCount.toString())
    //   mint.transaction = transaction.id
    //   mint.timestamp = transaction.timestamp
    //   mint.pool = pool.id
    //   mint.token0 = pool.token0
    //   mint.token1 = pool.token1
    //   mint.owner = event.params.owner
    //   mint.sender = event.params.sender
    //   mint.origin = event.transaction.from
    //   mint.amount = event.params.amount
    //   mint.amount0 = amount0
    //   mint.amount1 = amount1
    //   mint.amountUSD = amountUSD
    //   mint.tickLower = BigInt.fromI32(event.params.tickLower)
    //   mint.tickUpper = BigInt.fromI32(event.params.tickUpper)
    //   mint.logIndex = event.logIndex

    //   // tick entities
    //   let lowerTickIdx = event.params.tickLower
    //   let upperTickIdx = event.params.tickUpper

    //   let lowerTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickLower).toString()
    //   let upperTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickUpper).toString()

    //   let lowerTick = Tick.load(lowerTickId)
    //   let upperTick = Tick.load(upperTickId)

    //   if (lowerTick === null) {
    //     lowerTick = createTick(lowerTickId, lowerTickIdx, pool.id, event)
    //   }

    //   if (upperTick === null) {
    //     upperTick = createTick(upperTickId, upperTickIdx, pool.id, event)
    //   }

    //   let amount = event.params.amount
    //   lowerTick.liquidityGross = lowerTick.liquidityGross.plus(amount)
    //   lowerTick.liquidityNet = lowerTick.liquidityNet.plus(amount)
    //   upperTick.liquidityGross = upperTick.liquidityGross.plus(amount)
    //   upperTick.liquidityNet = upperTick.liquidityNet.minus(amount)

    //   // TODO: Update Tick's volume, fees, and liquidity provider count. Computing these on the tick
    //   // level requires reimplementing some of the swapping code from v3-core.

    //   updateUniswapDayData(event)
    //   updatePoolDayData(event)
    //   updatePoolHourData(event)
    //   updateTokenDayData(token0, event)
    //   updateTokenDayData(token1, event)
    //   updateTokenHourData(token0, event)
    //   updateTokenHourData(token1, event)

    // mint.save()

    // // Update inner tick vars and save the ticks
    // updateTickFeeVarsAndSave(lowerTick!, event)
    // updateTickFeeVarsAndSave(upperTick!, event)
})

// Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)
PoolContract_Burn_handlerAsync(async ({ event, context }) => {
    let pool = await getPool_async(event.srcAddress, context.Pool.get)
    let bundle = await getBundle_async(
        event.chainId.toString(),
        context.Bundle.get,
    )
    let factory = await getFactory_async(pool.factory, context.Factory.get)

    const updatedFactory: Factory = {
        ...factory,
        totalValueLockedETH: new Big(factory.totalValueLockedETH)
            .minus(pool.totalValueLockedETH)
            .toString(), // reset tvl aggregates until new amounts calculated
        txCount: factory.txCount + 1, // update globals
        totalValueLockedUSD: new Big(factory.totalValueLockedETH)
            .times(bundle.nativeTokenPriceUSD)
            .toString(), // reset aggregates with new amounts
    }

    await context.Factory.set(updatedFactory)

    let token0 = await getToken_async(pool.token0, context.Token.get)
    let token1 = await getToken_async(pool.token1, context.Token.get)

    let amount0 = convertTokenToDecimal(event.params.amount0, token0?.decimals)
    let amount1 = convertTokenToDecimal(event.params.amount1, token1?.decimals)

    let amountUSD = amount0
        .times(new Big(token0.derivedETH).times(bundle.nativeTokenPriceUSD))
        .plus(
            amount1.times(
                new Big(token1.derivedETH).times(bundle.nativeTokenPriceUSD),
            ),
        )

    // update token0 data
    let updatedToken0: Token = {
        ...token0,
        txCount: BigInt(BigInt(token0.txCount) + ONE_BI),
        totalValueLocked: new Big(token0.totalValueLocked)
            .minus(amount0)
            .toString(),
        totalValueLockedUSD: new Big(token0.totalValueLocked)
            .times(new Big(token0.derivedETH).times(bundle.nativeTokenPriceUSD))
            .toString(),
    }
    context.Token.set(updatedToken0)

    // update token1 data
    let updatedToken1: Token = {
        ...token0,
        txCount: BigInt(BigInt(token0.txCount) + ONE_BI),
        totalValueLocked: new Big(token1.totalValueLocked)
            .minus(amount1)
            .toString(),
        totalValueLockedUSD: new Big(token1.totalValueLocked)
            .times(new Big(token1.derivedETH).times(bundle.nativeTokenPriceUSD))
            .toString(),
    }
    context.Token.set(updatedToken1)

    // Pools liquidity tracks the currently active liquidity given pools current tick.
    // We only want to update it on mint if the new position includes the current tick.
    let poolLiquidity = pool.liquidity

    //todo: continue here

    if (
        pool.tick &&
        BigInt(event.params.tickLower).leq(bigInt(pool.tick)) &&
        bigInt(event.params.tickUpper).gt(bigInt(pool.tick))
    ) {
        liquidity = BigInt(
            bigInt(pool.liquidity).minus(event.params.amount).toString(),
        )
    }

    let poolObject: Pool = {
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
            .times(bundle.nativeTokenPriceUSD)
            .toString(),
    }
    context.Pool.set(poolObject)
})

// PoolContract_Swap_handlerAsync(async ({ event, context }) => {
//     let pool = await getPool_async(event.srcAddress, context.Pool.get)
//     let bundle = await getBundle_async(
//         event.chainId.toString(),
//         context.Bundle.get,
//     )
//     let factory = await getFactory_async(pool.factory, context.Factory.get)

//     let token0 = await getToken_async(pool.token0, context.Token.get)
//     let token1 = await getToken_async(pool.token1, context.Token.get)

//     // amounts - 0/1 are token deltas: can be positive or negative
//     let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
//     let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

//     // need absolute amounts for volume
//     let amount0Abs = amount0
//     if (amount0.lt(ZERO_BD)) {
//         amount0Abs = amount0.times(new Big('-1'))
//     }
//     let amount1Abs = amount1
//     if (amount1.lt(ZERO_BD)) {
//         amount1Abs = amount1.times(new Big('-1'))
//     }

//     let amount0ETH = amount0Abs.times(token0.derivedETH)
//     let amount1ETH = amount1Abs.times(token1.derivedETH)

//     let amount0USD = amount0ETH.times(bundle.nativeTokenPriceUSD)
//     let amount1USD = amount1ETH.times(bundle.nativeTokenPriceUSD)

//     let amountTotalUSDTracked = safeDiv(
//         getTrackedAmountUSD(amount0Abs, token0, amount1Abs, token1, bundle),
//         new Big('2'),
//     )

//     let amountTotalETHTracked = safeDiv(
//         amountTotalUSDTracked,
//         new Big(bundle.nativeTokenPriceUSD),
//     )

//     let amountTotalUSDUntracked = safeDiv(
//         amount0USD.plus(amount1USD),
//         new Big('2'),
//     )

//     let feesETH = amountTotalETHTracked
//         .times(new Big(pool.feeTier.toString()))
//         .div(new Big('1000000'))
//     let feesUSD = amountTotalUSDTracked
//         .times(new Big(pool.feeTier.toString()))
//         .div(new Big('1000000'))

//     let updatedFactory: Factory = {
//         ...factory,
//         txCount: factory.txCount + 1,
//         totalVolumeETH: new Big(factory.totalVolumeETH)
//             .plus(amountTotalETHTracked)
//             .toString(),
//         totalVolumeUSD: new Big(factory.totalVolumeUSD)
//             .plus(amountTotalUSDTracked)
//             .toString(),
//         untrackedVolumeUSD: new Big(factory.untrackedVolumeUSD)
//             .plus(amountTotalUSDUntracked)
//             .toString(),
//         totalFeesETH: new Big(factory.totalFeesETH).plus(feesETH).toString(),
//         totalFeesUSD: new Big(factory.totalFeesUSD).plus(feesUSD).toString(),
//         // reset aggregate tvl before individual pool tvl updates
//         totalValueLockedETH: new Big(factory.totalValueLockedETH)
//             .minus(pool.totalValueLockedETH)
//             .toString(),

//         totalValueLockedUSD: new Big(factory.totalValueLockedETH)
//             .times(bundle.nativeTokenPriceUSD)
//             .toString(),
//     }

//     context.Factory.set(updatedFactory)
// })

// PoolContract_Burn_handler(({ event, context }) => {
//
// })

// PoolContract_Swap_loader(({ event, context }) => {
//     let poolAddress = event.srcAddress
//     context.Pool.load(poolAddress, {
//         loaders: {
//             loadToken0: true,
//             loadToken1: true,
//         },
//     })

//     context.Bundle.load('1')
// })

// PoolContract_Swap_handler(async ({ event, context }) => {
//     let pool = context.Pool.get(event.srcAddress)

//     if (!pool) {
//         // context.log.info("no pool for this mint: " + event.srcAddress);
//         return
//     }
//     const bundle = context.Bundle.get('1')
//     if (!bundle) {
//         return
//     }

//     let token0 = context.Token.get(pool.token0)
//     let token1 = context.Token.get(pool.token1)
//     if (!token0 || !token1) {
//         // context.log.error("no token0 or token1 for this mint: " + event.srcAddress);
//         return
//     }
//     let amount0 = convertTokenToDecimal(event.params.amount0, token0?.decimals)
//     let amount1 = convertTokenToDecimal(event.params.amount1, token1?.decimals)

//     let oldTick = pool.tick!

//     // need absolute amounts for volume
//     let amount0Abs = amount0
//     if (amount0.lt(new Big(ZERO_BD))) {
//         amount0Abs = amount0.times(new Big('-1'))
//     }
//     let amount1Abs = amount1
//     if (amount1.lt(ZERO_BD)) {
//         amount1Abs = amount1.times(new Big('-1'))
//     }

//     let amount0ETH = amount0Abs.times(token0.derivedETH)
//     let amount1ETH = amount1Abs.times(token1.derivedETH)
//     let amount0USD = amount0ETH.times(bundle.nativeTokenPriceUSD)
//     let amount1USD = amount1ETH.times(bundle.nativeTokenPriceUSD)
//     // get amount that should be tracked only - div 2 because cant count both input and output as volume
//     let amountTotalUSDTracked = safeDiv(
//         getTrackedAmountUSD(amount0Abs, token0, amount1Abs, token1, bundle),
//         new Big('2'),
//     )
//     let amountTotalETHTracked = safeDiv(
//         amountTotalUSDTracked,
//         new Big(bundle.nativeTokenPriceUSD),
//     )
//     let amountTotalUSDUntracked = safeDiv(
//         amount0USD.plus(amount1USD),
//         new Big('2'),
//     )

//     let feesETH = amountTotalETHTracked
//         .times(new Big(pool.feeTier.toString()))
//         .div(new Big('1000000'))
//     let feesUSD = amountTotalUSDTracked
//         .times(new Big(pool.feeTier.toString()))
//         .div(new Big('1000000'))

//     // pool volume and rates
//     let prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1)
//     let poolObject: Pool = {
//         ...pool,
//         volumeToken0: new Big(pool.volumeToken0).plus(amount0Abs).toString(),
//         volumeToken1: new Big(pool.volumeToken1).plus(amount1Abs).toString(),
//         volumeUSD: new Big(pool.volumeUSD)
//             .plus(amountTotalUSDTracked)
//             .toString(),
//         untrackedVolumeUSD: new Big(pool.untrackedVolumeUSD)
//             .plus(amountTotalUSDUntracked)
//             .toString(),
//         feesUSD: new Big(pool.feesUSD).plus(feesUSD).toString(),
//         txCount: BigInt(
//             bigInt(pool.txCount.toString()).plus(ONE_BI).toString(),
//         ),

//         // Update the pool with the new active liquidity, price, and tick.
//         liquidity: event.params.liquidity,
//         tick: event.params.tick,
//         sqrtPrice: event.params.sqrtPriceX96,
//         totalValueLockedToken0: new Big(pool.totalValueLockedToken0)
//             .plus(amount0)
//             .toString(),
//         totalValueLockedToken1: new Big(pool.totalValueLockedToken1)
//             .plus(amount1)
//             .toString(),
//         token0Price: prices[0].toString(),
//         token1Price: prices[1].toString(),
//         feeGrowthGlobal0X128: BigInt(
//             (await getFeeGrowthGlobal0X128(pool.id as Hash)).toString(),
//         ),
//         feeGrowthGlobal1X128: BigInt(
//             (await getFeeGrowthGlobal1X128(pool.id as Hash)).toString(),
//         ),
//     }
//     context.log.info('feeGrowth: ' + poolObject.feeGrowthGlobal0X128.toString())

//     context.Pool.set(poolObject)

//     // update token0 data

//     let updatedToken0: Token = {
//         ...token0,
//         volume: new Big(token0.volume).plus(amount0Abs).toString(),
//         totalValueLocked: new Big(token0.totalValueLocked)
//             .plus(amount0)
//             .toString(),
//         volumeUSD: new Big(token0.volumeUSD)
//             .plus(amountTotalUSDTracked)
//             .toString(),
//         untrackedVolumeUSD: new Big(token0.untrackedVolumeUSD)
//             .plus(amountTotalUSDUntracked)
//             .toString(),
//         feesUSD: new Big(token0.feesUSD).plus(feesUSD).toString(),
//         txCount: BigInt(bigInt(token0.txCount).plus(ONE_BI).toString()),
//     }
//     context.Token.set(updatedToken0)

//     // update token1 data
//     let updatedToken1: Token = {
//         ...token0,
//         volume: new Big(token1.volume).plus(amount1Abs).toString(),
//         totalValueLocked: new Big(token1.totalValueLocked)
//             .plus(amount1)
//             .toString(),
//         volumeUSD: new Big(token1.volumeUSD)
//             .plus(amountTotalUSDTracked)
//             .toString(),
//         untrackedVolumeUSD: new Big(token1.untrackedVolumeUSD)
//             .plus(amountTotalUSDUntracked)
//             .toString(),
//         feesUSD: new Big(token1.feesUSD).plus(feesUSD).toString(),
//         txCount: BigInt(bigInt(token1.txCount).plus(ONE_BI).toString()),
//     }
//     context.Token.set(updatedToken1)

//     // update USD pricing
//     let bundleObject = {
//         id: '1',
//         nativeTokenPriceUSD: getnativeTokenPriceInUSD(poolObject),
//     }
//     context.Bundle.set(bundleObject)

//     // TODO: finish making this work
//     // token0.derivedETH = findEthPerToken(token0 as Token)
//     // token1.derivedETH = findEthPerToken(token1 as Token)
// })
