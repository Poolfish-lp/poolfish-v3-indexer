import {
    FactoryContract_PoolCreated_loader,
    FactoryContract_PoolCreated_handlerAsync,
    FactoryContract_OwnerChanged_loader,
    FactoryContract_OwnerChanged_handler,
} from '../generated/src/Handlers.gen'

import {
    FactoryEntity as Factory,
    PoolEntity as Pool,
    TokenEntity as Token,
    BundleEntity as Bundle,
} from '../generated/src/Types.gen'
import { ZERO_BD, ZERO_BI } from './constants'
import { addressToDex } from './utils/addressToDex'

import { getOrCreateToken_async } from './helpers'

import { ethereumSushiswapConfig } from './config'

// PoolCreated(address indexed pool, address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing)
FactoryContract_PoolCreated_loader(({ event, context }) => {
    // used to register dynamic contracts ie. contracts that are registered at runtime
    context.contractRegistration.addPool(event.params.pool)
})

FactoryContract_PoolCreated_handlerAsync(async ({ event, context }) => {
    let factoryAddress = event.srcAddress
    let factory = await context.Factory.get(factoryAddress)

    const dexKey = addressToDex(event.srcAddress)

    if (factory == null) {
        let factoryObject: Factory = {
            id: factoryAddress,
            address: factoryAddress,
            poolCount: 0,
            dexKey: dexKey,
            chainId: event.chainId,
            totalVolumeETH: ZERO_BD,
            totalVolumeUSD: ZERO_BD,
            untrackedVolumeUSD: ZERO_BD,
            totalFeesUSD: ZERO_BD,
            totalFeesETH: ZERO_BD,
            totalValueLockedETH: ZERO_BD,
            totalValueLockedUSD: ZERO_BD,
            totalValueLockedUSDUntracked: ZERO_BD,
            totalValueLockedETHUntracked: ZERO_BD,
            txCount: 0,
            pools: [event.params.pool],
            owner: event.txOrigin ? event.txOrigin?.toString() : 'unknown', // the owner is the deployer initially
        }

        await context.Factory.set(factoryObject)

        let bundleObject: Bundle = {
            id: event.chainId.toString(),
            nativeTokenPriceUSD: ZERO_BD,
        }

        await context.Bundle.set(bundleObject)
    } else {
        let factoryObject: Factory = {
            ...factory,
            poolCount: factory.poolCount + 1,
            pools: [...factory.pools, event.params.pool],
        }

        await context.Factory.set(factoryObject)
    }

    // create tokens
    let token0: Token = await getOrCreateToken_async(
        event,
        event.params.token0,
        context.Token.get,
    )

    let token1: Token = await getOrCreateToken_async(
        event,
        event.params.token1,
        context.Token.get,
    )

    let pool: Pool = {
        id: event.params.pool,
        createdAtTimestamp: BigInt(event.blockTimestamp), // can see this list of available properties here https://docs.envio.dev/docs/event-handlers
        tick: ZERO_BI,
        dexKey: dexKey,
        token0: event.params.token0,
        token1: event.params.token1,
        feeTier: BigInt(event.params.fee),
        createdAtBlockNumber: BigInt(event.blockNumber),
        liquidityProviderCount: ZERO_BI,
        txCount: 0,
        sqrtPrice: ZERO_BI,
        liquidity: ZERO_BI,
        feeGrowthGlobal0X128: ZERO_BI,
        feeGrowthGlobal1X128: ZERO_BI,
        token0Price: ZERO_BD,
        token1Price: ZERO_BD,
        observationIndex: ZERO_BI,
        totalValueLockedToken0: ZERO_BD,
        totalValueLockedToken1: ZERO_BD,
        totalValueLockedUSD: ZERO_BD,
        totalValueLockedETH: ZERO_BD,
        totalValueLockedUSDUntracked: ZERO_BD,
        volumeToken0: ZERO_BD,
        volumeToken1: ZERO_BD,
        volumeUSD: ZERO_BD,
        feesUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        collectedFeesToken0: ZERO_BD,
        collectedFeesToken1: ZERO_BD,
        collectedFeesUSD: ZERO_BD,
        factory: event.srcAddress,
    }

    await context.Pool.set(pool)

    // update white listed pools
    if (
        ethereumSushiswapConfig.whitelistedTokenAddresses.includes(
            token0.id.toLowerCase(),
        )
    ) {
        let newPools = token1.whitelistPools
        newPools.push(pool.id)
        token1 = {
            ...token1,
            whitelistPools: newPools,
        }
    }

    // update white listed pools
    if (
        ethereumSushiswapConfig.whitelistedTokenAddresses.includes(
            token1.id.toLowerCase(),
        )
    ) {
        let newPools = token0.whitelistPools
        newPools.push(pool.id)
        token0 = {
            ...token0,
            whitelistPools: newPools,
        }
    }

    await context.Token.set(token0)

    await context.Token.set(token1)
})

// OwnerChanged(address indexed oldOwner, address indexed newOwner)
FactoryContract_OwnerChanged_loader(({ event, context }) => {
    let factoryAddress = event.srcAddress
    context.Factory.load(factoryAddress)
})

FactoryContract_OwnerChanged_handler(({ event, context }) => {
    let factoryAddress = event.srcAddress
    let factory = context.Factory.get(factoryAddress)

    if (factory) {
        let factoryObject: Factory = {
            ...factory,
            owner: event.params.newOwner,
        }

        context.Factory.set(factoryObject)
    }
})
