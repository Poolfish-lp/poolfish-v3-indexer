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
    let pool = await getPool_async(
        event.srcAddress.toLowerCase(),
        context.Pool.get,
    )

    let updatedPool: Pool = {
        ...pool,
        tick: event.params.tick,
        sqrtPrice: event.params.sqrtPriceX96,
    }

    context.Pool.set(updatedPool)

    let token0 = await getToken_async(pool.token0, context.Token.get)
    let token1 = await getToken_async(pool.token1, context.Token.get)

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

    let nativeAssetPool = NATIVE_PRICE_POOL.toLowerCase() //todo: make this a function that takes the pool.dexKey && event.chainId

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
    let pool = await getPool_async(
        event.srcAddress.toLowerCase(),
        context.Pool.get,
    )
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
        txCount: BigInt(token1.txCount) + ONE_BI,
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

    let updatedPool: Pool = {
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

    context.Pool.set(updatedPool)

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
    let pool = await getPool_async(
        event.srcAddress.toLowerCase(),
        context.Pool.get,
    )
    let bundle = await getBundle_async(
        event.chainId.toString(),
        context.Bundle.get,
    )
    let factory = await getFactory_async(pool.factory, context.Factory.get)

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

    if (
        pool.tick &&
        BigInt(event.params.tickLower) <= BigInt(pool.tick) &&
        BigInt(event.params.tickUpper) > BigInt(pool.tick)
    ) {
        poolLiquidity = BigInt(pool.liquidity) - BigInt(event.params.amount)
    }

    let updatedPool: Pool = {
        ...pool,
        liquidity: poolLiquidity,
        txCount: pool.txCount + 1,
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
    context.Pool.set(updatedPool)

    const updatedFactory: Factory = {
        ...factory,
        totalValueLockedETH: new Big(factory.totalValueLockedETH)
            .minus(updatedPool.totalValueLockedETH)
            .toString(), // reset tvl aggregates until new amounts calculated
        txCount: factory.txCount + 1, // update globals
        totalValueLockedUSD: new Big(factory.totalValueLockedETH)
            .times(bundle.nativeTokenPriceUSD)
            .toString(), // reset aggregates with new amounts
    }

    await context.Factory.set(updatedFactory)

    // todo: burn tx entity & tick entities & interval entities
    //   let transaction = loadTransaction(event)
    //   let burn = new Burn(transaction.id + '#' + pool.txCount.toString())
    //   burn.transaction = transaction.id
    //   burn.timestamp = transaction.timestamp
    //   burn.pool = pool.id
    //   burn.token0 = pool.token0
    //   burn.token1 = pool.token1
    //   burn.owner = event.params.owner
    //   burn.origin = event.transaction.from
    //   burn.amount = event.params.amount
    //   burn.amount0 = amount0
    //   burn.amount1 = amount1
    //   burn.amountUSD = amountUSD
    //   burn.tickLower = BigInt.fromI32(event.params.tickLower)
    //   burn.tickUpper = BigInt.fromI32(event.params.tickUpper)
    //   burn.logIndex = event.logIndex

    //   // tick entities
    //   let lowerTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickLower).toString()
    //   let upperTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickUpper).toString()
    //   let lowerTick = Tick.load(lowerTickId)
    //   let upperTick = Tick.load(upperTickId)
    //   let amount = event.params.amount
    //   lowerTick.liquidityGross = lowerTick.liquidityGross.minus(amount)
    //   lowerTick.liquidityNet = lowerTick.liquidityNet.minus(amount)
    //   upperTick.liquidityGross = upperTick.liquidityGross.minus(amount)
    //   upperTick.liquidityNet = upperTick.liquidityNet.plus(amount)

    //   updateUniswapDayData(event)
    //   updatePoolDayData(event)
    //   updatePoolHourData(event)
    //   updateTokenDayData(token0 as Token, event)
    //   updateTokenDayData(token1 as Token, event)
    //   updateTokenHourData(token0 as Token, event)
    //   updateTokenHourData(token1 as Token, event)
    //   updateTickFeeVarsAndSave(lowerTick!, event)
    //   updateTickFeeVarsAndSave(upperTick!, event)
})

// todo: debug whats breaking with swap
PoolContract_Swap_handlerAsync(async ({ event, context }) => {
    let pool = await getPool_async(
        event.srcAddress.toLowerCase(),
        context.Pool.get,
    )
    let bundle = await getBundle_async(
        event.chainId.toString(),
        context.Bundle.get,
    )
    let factory = await getFactory_async(pool.factory, context.Factory.get)

    let token0 = await getToken_async(pool.token0, context.Token.get)
    let token1 = await getToken_async(pool.token1, context.Token.get)

    // amounts - 0/1 are token deltas: can be positive or negative
    let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
    let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

    // need absolute amounts for volume
    let amount0Abs = amount0
    if (amount0.lt(ZERO_BD)) {
        amount0Abs = amount0.times(new Big('-1'))
    }
    let amount1Abs = amount1
    if (amount1.lt(ZERO_BD)) {
        amount1Abs = amount1.times(new Big('-1'))
    }

    let amount0ETH = amount0Abs.times(token0.derivedETH)
    let amount1ETH = amount1Abs.times(token1.derivedETH)

    let amount0USD = amount0ETH.times(bundle.nativeTokenPriceUSD)
    let amount1USD = amount1ETH.times(bundle.nativeTokenPriceUSD)

    let amountTotalUSDTracked = safeDiv(
        getTrackedAmountUSD(amount0Abs, token0, amount1Abs, token1, bundle),
        new Big('2'),
    )

    let amountTotalETHTracked = safeDiv(
        amountTotalUSDTracked,
        new Big(bundle.nativeTokenPriceUSD),
    )

    let amountTotalUSDUntracked = safeDiv(
        amount0USD.plus(amount1USD),
        new Big('2'),
    )

    let feesETH = amountTotalETHTracked
        .times(new Big(pool.feeTier.toString()))
        .div(new Big('1000000'))
    let feesUSD = amountTotalUSDTracked
        .times(new Big(pool.feeTier.toString()))
        .div(new Big('1000000'))

    // pool volume and rates
    let prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1)
    let updatedPool: Pool = {
        ...pool,
        volumeToken0: new Big(pool.volumeToken0).plus(amount0Abs).toString(),
        volumeToken1: new Big(pool.volumeToken1).plus(amount1Abs).toString(),
        volumeUSD: new Big(pool.volumeUSD)
            .plus(amountTotalUSDTracked)
            .toString(),
        untrackedVolumeUSD: new Big(pool.untrackedVolumeUSD)
            .plus(amountTotalUSDUntracked)
            .toString(),
        feesUSD: new Big(pool.feesUSD).plus(feesUSD).toString(),
        txCount: pool.txCount + 1,

        // Update the pool with the new active liquidity, price, and tick.
        liquidity: event.params.liquidity,
        tick: event.params.tick,
        sqrtPrice: event.params.sqrtPriceX96,
        totalValueLockedToken0: new Big(pool.totalValueLockedToken0)
            .plus(amount0)
            .toString(),
        totalValueLockedToken1: new Big(pool.totalValueLockedToken1)
            .plus(amount1)
            .toString(),
        token0Price: prices[0].toString(),
        token1Price: prices[1].toString(),
        feeGrowthGlobal0X128: BigInt(
            (await getFeeGrowthGlobal0X128(pool.id as Hash)).toString(),
        ),
        feeGrowthGlobal1X128: BigInt(
            (await getFeeGrowthGlobal1X128(pool.id as Hash)).toString(),
        ),
    }

    context.Pool.set(updatedPool)

    let updatedFactory: Factory = {
        ...factory,
        txCount: factory.txCount + 1,
        totalVolumeETH: new Big(factory.totalVolumeETH)
            .plus(amountTotalETHTracked)
            .toString(),
        totalVolumeUSD: new Big(factory.totalVolumeUSD)
            .plus(amountTotalUSDTracked)
            .toString(),
        untrackedVolumeUSD: new Big(factory.untrackedVolumeUSD)
            .plus(amountTotalUSDUntracked)
            .toString(),
        totalFeesETH: new Big(factory.totalFeesETH).plus(feesETH).toString(),
        totalFeesUSD: new Big(factory.totalFeesUSD).plus(feesUSD).toString(),
        // reset aggregate tvl before individual pool tvl updates
        totalValueLockedETH: new Big(factory.totalValueLockedETH)
            .minus(updatedPool.totalValueLockedETH)
            .toString(),

        totalValueLockedUSD: new Big(factory.totalValueLockedETH)
            .times(bundle.nativeTokenPriceUSD)
            .toString(),
    }

    context.Factory.set(updatedFactory)

    let updatedToken0: Token = {
        ...token0,
        volume: new Big(token0.volume).plus(amount0Abs).toString(),
        totalValueLocked: new Big(token0.totalValueLocked)
            .plus(amount0)
            .toString(),
        volumeUSD: new Big(token0.volumeUSD)
            .plus(amountTotalUSDTracked)
            .toString(),
        untrackedVolumeUSD: new Big(token0.untrackedVolumeUSD)
            .plus(amountTotalUSDUntracked)
            .toString(),
        feesUSD: new Big(token0.feesUSD).plus(feesUSD).toString(),
        txCount: BigInt(token0.txCount) + ONE_BI,
    }
    context.Token.set(updatedToken0)

    // update token1 data
    let updatedToken1: Token = {
        ...token0,
        volume: new Big(token1.volume).plus(amount1Abs).toString(),
        totalValueLocked: new Big(token1.totalValueLocked)
            .plus(amount1)
            .toString(),
        volumeUSD: new Big(token1.volumeUSD)
            .plus(amountTotalUSDTracked)
            .toString(),
        untrackedVolumeUSD: new Big(token1.untrackedVolumeUSD)
            .plus(amountTotalUSDUntracked)
            .toString(),
        feesUSD: new Big(token1.feesUSD).plus(feesUSD).toString(),
        txCount: BigInt(token0.txCount) + ONE_BI,
    }
    context.Token.set(updatedToken1)

    // update USD pricing
    let updatedBundle = {
        id: event.chainId.toString(),
        nativeTokenPriceUSD: getNativeTokenPriceInUSD(updatedPool),
    }
    context.Bundle.set(updatedBundle)

    // todo: swap tx entity & ticks & interval entities

    // create Swap event
    //   let transaction = loadTransaction(event)
    //   let swap = new Swap(transaction.id + '#' + pool.txCount.toString())
    //   swap.transaction = transaction.id
    //   swap.timestamp = transaction.timestamp
    //   swap.pool = pool.id
    //   swap.token0 = pool.token0
    //   swap.token1 = pool.token1
    //   swap.sender = event.params.sender.toLowerCase()
    //   swap.origin = event.transaction.from.toLowerCase()
    //   swap.recipient = event.params.recipient.toLowerCase()
    //   swap.amount0 = amount0
    //   swap.amount1 = amount1
    //   swap.amountUSD = amountTotalUSDTracked
    //   swap.tick = BigInt.fromI32(event.params.tick as i32)
    //   swap.sqrtPriceX96 = event.params.sqrtPriceX96
    //   swap.logIndex = event.logIndex

    //   // update fee growth
    //   let poolContract = PoolABI.bind(event.address.toLowerCase())
    //   let feeGrowthGlobal0X128 = poolContract.feeGrowthGlobal0X128()
    //   let feeGrowthGlobal1X128 = poolContract.feeGrowthGlobal1X128()
    //   pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128 as BigInt
    //   pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128 as BigInt

    //   // interval data
    //   let uniswapDayData = updateUniswapDayData(event)
    //   let poolDayData = updatePoolDayData(event)
    //   let poolHourData = updatePoolHourData(event)
    //   let token0DayData = updateTokenDayData(token0 as Token, event)
    //   let token1DayData = updateTokenDayData(token1 as Token, event)
    //   let token0HourData = updateTokenHourData(token0 as Token, event)
    //   let token1HourData = updateTokenHourData(token1 as Token, event)

    //   // update volume metrics
    //   uniswapDayData.volumeETH = uniswapDayData.volumeETH.plus(amountTotalETHTracked)
    //   uniswapDayData.volumeUSD = uniswapDayData.volumeUSD.plus(amountTotalUSDTracked)
    //   uniswapDayData.feesUSD = uniswapDayData.feesUSD.plus(feesUSD)

    //   poolDayData.volumeUSD = poolDayData.volumeUSD.plus(amountTotalUSDTracked)
    //   poolDayData.volumeToken0 = poolDayData.volumeToken0.plus(amount0Abs)
    //   poolDayData.volumeToken1 = poolDayData.volumeToken1.plus(amount1Abs)
    //   poolDayData.feesUSD = poolDayData.feesUSD.plus(feesUSD)

    //   poolHourData.volumeUSD = poolHourData.volumeUSD.plus(amountTotalUSDTracked)
    //   poolHourData.volumeToken0 = poolHourData.volumeToken0.plus(amount0Abs)
    //   poolHourData.volumeToken1 = poolHourData.volumeToken1.plus(amount1Abs)
    //   poolHourData.feesUSD = poolHourData.feesUSD.plus(feesUSD)

    //   token0DayData.volume = token0DayData.volume.plus(amount0Abs)
    //   token0DayData.volumeUSD = token0DayData.volumeUSD.plus(amountTotalUSDTracked)
    //   token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    //   token0DayData.feesUSD = token0DayData.feesUSD.plus(feesUSD)

    //   token0HourData.volume = token0HourData.volume.plus(amount0Abs)
    //   token0HourData.volumeUSD = token0HourData.volumeUSD.plus(amountTotalUSDTracked)
    //   token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    //   token0HourData.feesUSD = token0HourData.feesUSD.plus(feesUSD)

    //   token1DayData.volume = token1DayData.volume.plus(amount1Abs)
    //   token1DayData.volumeUSD = token1DayData.volumeUSD.plus(amountTotalUSDTracked)
    //   token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    //   token1DayData.feesUSD = token1DayData.feesUSD.plus(feesUSD)

    //   token1HourData.volume = token1HourData.volume.plus(amount1Abs)
    //   token1HourData.volumeUSD = token1HourData.volumeUSD.plus(amountTotalUSDTracked)
    //   token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    //   token1HourData.feesUSD = token1HourData.feesUSD.plus(feesUSD)

    //   swap.save()
    //   token0DayData.save()
    //   token1DayData.save()
    //   uniswapDayData.save()
    //   poolDayData.save()
    //   token0HourData.save()
    //   token1HourData.save()
    //   poolHourData.save()
    //   factory.save()
    //   pool.save()
    //   token0.save()
    //   token1.save()

    //   // Update inner vars of current or crossed ticks
    //   let newTick = pool.tick!
    //   let tickSpacing = feeTierToTickSpacing(pool.feeTier)
    //   let modulo = newTick.mod(tickSpacing)
    //   if (modulo.equals(ZERO_BI)) {
    //     // Current tick is initialized and needs to be updated
    //     loadTickUpdateFeeVarsAndSave(newTick.toI32(), event)
    //   }

    //   let numIters = oldTick
    //     .minus(newTick)
    //     .abs()
    //     .div(tickSpacing)

    //   if (numIters.gt(BigInt.fromI32(100))) {
    //     // In case more than 100 ticks need to be updated ignore the update in
    //     // order to avoid timeouts. From testing this behavior occurs only upon
    //     // pool initialization. This should not be a big issue as the ticks get
    //     // updated later. For early users this error also disappears when calling
    //     // collect
    //   } else if (newTick.gt(oldTick)) {
    //     let firstInitialized = oldTick.plus(tickSpacing.minus(modulo))
    //     for (let i = firstInitialized; i.le(newTick); i = i.plus(tickSpacing)) {
    //       loadTickUpdateFeeVarsAndSave(i.toI32(), event)
    //     }
    //   } else if (newTick.lt(oldTick)) {
    //     let firstInitialized = oldTick.minus(modulo)
    //     for (let i = firstInitialized; i.ge(newTick); i = i.minus(tickSpacing)) {
    //       loadTickUpdateFeeVarsAndSave(i.toI32(), event)
    //     }
    //   }
})
