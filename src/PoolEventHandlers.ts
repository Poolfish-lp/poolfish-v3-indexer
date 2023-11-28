import {
    PoolContract_Initialize_loader,
    PoolContract_Initialize_handler,
    PoolContract_Mint_loader,
    PoolContract_Mint_handler,
    PoolContract_Burn_loader,
    PoolContract_Burn_handler,
    PoolContract_Swap_loader,
    PoolContract_Swap_handler,
} from '../generated/src/Handlers.gen'

import { PoolEntity, TickEntity, TokenEntity } from '../generated/src/Types.gen'
import { NATIVE_PRICE_POOL, ONE_BI, ZERO_BD, ZERO_BI } from './constants'
import { getPoolAddressToInfo } from './utils/getPoolAddressToInfo'
import bigInt, { BigInteger } from 'big-integer'
import {
    convertTokenToDecimal,
    getFeeGrowthGlobal0X128,
    getFeeGrowthGlobal1X128,
    safeDiv,
} from './utils/misc'
import Big from 'big.js'
import {
    findEthPerToken,
    getEthPriceInUSD,
    getTrackedAmountUSD,
    sqrtPriceX96ToTokenPrices,
} from './utils/pricing'
import { get } from 'http'
import { Hash } from 'viem'
import {
    createTick,
    feeTierToTickSpacing,
    loadTickUpdateFeeVarsAndSave,
    updateTickFeeVarsAndSave,
} from './utils/tick'

// event Initialize(uint160 sqrtPriceX96, int24 tick)
PoolContract_Initialize_loader(({ event, context }) => {
    let poolAddress = event.srcAddress
    context.Pool.load(poolAddress, {})

    context.Pool.load(NATIVE_PRICE_POOL, {
        loaders: {
            loadToken0: {},
            loadToken1: {},
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
            loadToken0: {},
            loadToken1: {},
        },
    })
    context.Token.load(poolInfo.token0.id, {})
    context.Token.load(poolInfo.token1.id, {})

    context.Bundle.load('1')

    let lowerTickId =
        poolAddress + '#' + BigInt(event.params.tickLower).toString()
    let upperTickId =
        poolAddress + '#' + BigInt(event.params.tickUpper).toString()
    context.Tick.load(lowerTickId, {
        loaders: { loadPool: { loadToken0: {} } },
    })
    context.Tick.load(upperTickId, {
        loaders: { loadPool: { loadToken0: {} } },
    })
})

PoolContract_Mint_handler(({ event, context }) => {
    let poolAddress = event.srcAddress
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

    // tick entities
    let lowerTickIdx = event.params.tickLower
    let upperTickIdx = event.params.tickUpper

    let lowerTickId = poolAddress + '#' + BigInt(lowerTickIdx).toString()
    let upperTickId = poolAddress + '#' + BigInt(upperTickIdx).toString()
    let lowerTick = context.Tick.get(lowerTickId)
    let upperTick = context.Tick.get(upperTickId)
    context.log.info('lowerTick: ' + lowerTick)

    if (!lowerTick) {
        context.log.info('creating tickidx: ' + lowerTickIdx)
        lowerTick = createTick(lowerTickId, lowerTickIdx, pool.id, event)
        context.log.info('created tick: ' + lowerTick.id)
        context.Tick.set(lowerTick)
    }

    if (!upperTick) {
        upperTick = createTick(upperTickId, upperTickIdx, pool.id, event)
        context.log.info('created tick: ' + upperTick.id)
        context.Tick.set(upperTick)
    }

    let amount = event.params.amount
    if (lowerTick?.liquidityGross) {
        const updatedLowerTick: TickEntity = {
            ...lowerTick,
            liquidityGross: BigInt(
                bigInt(lowerTick?.liquidityGross?.toString())
                    .plus(amount)
                    .toString(),
            ),
            liquidityNet: BigInt(
                bigInt(lowerTick?.liquidityNet?.toString())
                    .plus(amount)
                    .toString(),
            ),
        }
        lowerTick = updatedLowerTick
        context.Tick.set(updatedLowerTick)
    }
    if (upperTick?.liquidityGross) {
        const updatedUpperTick: TickEntity = {
            ...upperTick,
            liquidityGross: BigInt(
                bigInt(upperTick?.liquidityGross?.toString())
                    .plus(amount)
                    .toString(),
            ),
            liquidityNet: BigInt(
                bigInt(upperTick?.liquidityNet?.toString())
                    .plus(amount)
                    .toString(),
            ),
        }
        upperTick = updatedUpperTick
        context.Tick.set(updatedUpperTick)
    }

    // Update inner tick vars and save the ticks
    updateTickFeeVarsAndSave(context, lowerTick!, event)
    updateTickFeeVarsAndSave(context, upperTick!, event)
})

PoolContract_Burn_loader(({ event, context }) => {
    let poolAddress = event.srcAddress
    const poolInfo = getPoolAddressToInfo(poolAddress)
    if (!poolInfo) {
        return
    }
    context.Pool.load(poolAddress, {
        loaders: {
            loadToken0: {},
            loadToken1: {},
        },
    })
    context.Token.load(poolInfo.token0.id, {})
    context.Token.load(poolInfo.token1.id, {})

    context.Bundle.load('1')

    let lowerTickId =
        poolAddress + '#' + BigInt(event.params.tickLower).toString()
    let upperTickId =
        poolAddress + '#' + BigInt(event.params.tickUpper).toString()
    context.Tick.load(lowerTickId, {
        loaders: { loadPool: { loadToken0: {} } },
    })
    context.Tick.load(upperTickId, {
        loaders: { loadPool: { loadToken0: {} } },
    })
})

PoolContract_Burn_handler(({ event, context }) => {
    const poolAddress = event.srcAddress
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

    // tick entities
    let lowerTickId =
        poolAddress + '#' + BigInt(event.params.tickLower).toString()
    let upperTickId =
        poolAddress + '#' + BigInt(event.params.tickUpper).toString()
    let lowerTick = context.Tick.get(lowerTickId)
    let upperTick = context.Tick.get(upperTickId)
    let amount = event.params.amount
    if (lowerTick?.liquidityGross) {
        const updatedLowerTick: TickEntity = {
            ...lowerTick,
            liquidityGross: BigInt(
                bigInt(lowerTick?.liquidityGross?.toString())
                    .minus(amount)
                    .toString(),
            ),
            liquidityNet: BigInt(
                bigInt(lowerTick?.liquidityNet?.toString())
                    .minus(amount)
                    .toString(),
            ),
        }
        lowerTick = updatedLowerTick
        context.Tick.set(updatedLowerTick)
    }
    if (upperTick?.liquidityGross) {
        const updatedUpperTick: TickEntity = {
            ...upperTick,
            liquidityGross: BigInt(
                bigInt(upperTick?.liquidityGross?.toString())
                    .minus(amount)
                    .toString(),
            ),
            liquidityNet: BigInt(
                bigInt(upperTick?.liquidityNet?.toString())
                    .plus(amount)
                    .toString(),
            ),
        }
        upperTick = updatedUpperTick
        context.Tick.set(updatedUpperTick)
    }

    // Update inner tick vars and save the ticks
    updateTickFeeVarsAndSave(context, lowerTick!, event)
    updateTickFeeVarsAndSave(context, upperTick!, event)
})

PoolContract_Swap_loader(({ event, context }) => {
    let poolAddress = event.srcAddress
    const poolInfo = getPoolAddressToInfo(poolAddress)
    if (!poolInfo) {
        return // not a pool we care about
    }

    context.Pool.swapPoolLoad(poolAddress, {
        loaders: {
            loadToken0: {
                loadWhitelistPools: { loadToken0: {}, loadToken1: {} },
            },
            loadToken1: {
                loadWhitelistPools: { loadToken0: {}, loadToken1: {} },
            },
        },
    })

    context.Bundle.bundleLoad('1')
})

PoolContract_Swap_handler(async ({ event, context }) => {
    let {
        Pool: { swapPool: pool, getToken0, getToken1 },
        Bundle: { bundle },
        Token: { getWhitelistPools },
    } = context
    if (!pool) {
        // context.log.info("no pool for this mint: " + event.srcAddress);
        return
    }
    if (!bundle) {
        return
    }

    let token0 = getToken0(pool)
    let token1 = getToken1(pool)

    if (!token0 || !token1) {
        // context.log.error("no token0 or token1 for this mint: " + event.srcAddress);
        return
    }
    let amount0 = convertTokenToDecimal(event.params.amount0, token0?.decimals)
    let amount1 = convertTokenToDecimal(event.params.amount1, token1?.decimals)

    let oldTick = pool.tick!

    // need absolute amounts for volume
    let amount0Abs = amount0
    if (amount0.lt(new Big(ZERO_BD))) {
        amount0Abs = amount0.times(new Big('-1'))
    }
    let amount1Abs = amount1
    if (amount1.lt(ZERO_BD)) {
        amount1Abs = amount1.times(new Big('-1'))
    }

    let amount0ETH = amount0Abs.times(token0.derivedETH)
    let amount1ETH = amount1Abs.times(token1.derivedETH)
    let amount0USD = amount0ETH.times(bundle.ethPriceUSD)
    let amount1USD = amount1ETH.times(bundle.ethPriceUSD)
    // get amount that should be tracked only - div 2 because cant count both input and output as volume
    let amountTotalUSDTracked = safeDiv(
        getTrackedAmountUSD(amount0Abs, token0, amount1Abs, token1, bundle),
        new Big('2'),
    )
    let amountTotalETHTracked = safeDiv(
        amountTotalUSDTracked,
        new Big(bundle.ethPriceUSD),
    )
    let amountTotalUSDUntracked = safeDiv(
        amount0USD.plus(amount1USD),
        new Big('2'),
    )

    let feesETH = amountTotalETHTracked
        .times(new Big(pool.feeTier.toString()))
        .div('1000000')
    let feesUSD = amountTotalUSDTracked
        .times(new Big(pool.feeTier.toString()))
        .div('1000000')

    // pool volume and rates
    let prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1)
    let poolObject: PoolEntity = {
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
        txCount: BigInt(
            bigInt(pool.txCount.toString()).plus(ONE_BI).toString(),
        ),

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
    context.log.info('feeGrowth: ' + poolObject.feeGrowthGlobal0X128.toString())

    context.Pool.set(poolObject)

    // update token0 data

    let token0Object: TokenEntity = {
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
        txCount: BigInt(bigInt(token0.txCount).plus(ONE_BI).toString()),
        derivedETH: findEthPerToken(
            token0,
            getWhitelistPools,
            getToken0,
            getToken1,
            bundle,
        ).toString(),
    }
    context.Token.set(token0Object)

    // update token1 data
    let token1Object: TokenEntity = {
        ...token1,
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
        txCount: BigInt(bigInt(token1.txCount).plus(ONE_BI).toString()),
        derivedETH: findEthPerToken(
            token1,
            getWhitelistPools,
            getToken0,
            getToken1,
            bundle,
        ).toString(),
    }
    context.Token.set(token1Object)

    // update USD pricing
    let bundleObject = {
        ...bundle,
        ethPriceUSD: getEthPriceInUSD(poolObject),
    }
    context.Bundle.set(bundleObject)

    // Update inner vars of current or crossed ticks
    let newTick = pool.tick!
    let tickSpacing = feeTierToTickSpacing(pool.feeTier)
    let modulo = bigInt(newTick).mod(tickSpacing.toString())
    if (modulo.equals(ZERO_BI)) {
        // Current tick is initialized and needs to be updated
        //TODO: get this working
        // loadTickUpdateFeeVarsAndSave(context, newTick.toString(), event)
    }

    let numIters = bigInt(oldTick)
        .minus(newTick)
        .abs()
        .divide(tickSpacing.toString())

    if (numIters.gt(BigInt(100))) {
        // In case more than 100 ticks need to be updated ignore the update in
        // order to avoid timeouts. From testing this behavior occurs only upon
        // pool initialization. This should not be a big issue as the ticks get
        // updated later. For early users this error also disappears when calling
        // collect
    } else if (bigInt(newTick).gt(oldTick)) {
        let firstInitialized = bigInt(oldTick).plus(
            bigInt(tickSpacing.toString()).minus(modulo),
        )
        for (
            let i = firstInitialized;
            i.leq(newTick);
            i = i.plus(tickSpacing.toString())
        ) {
            //TODO: get this working
            // loadTickUpdateFeeVarsAndSave(context, i.toString(), event)
        }
    } else if (bigInt(newTick).lt(oldTick)) {
        let firstInitialized = bigInt(oldTick).minus(modulo)
        for (
            let i = firstInitialized;
            i.geq(newTick);
            i = i.minus(tickSpacing.toString())
        ) {
            //TODO: get this working
            // loadTickUpdateFeeVarsAndSave(context, i.toString(), event)
        }
    }
})
