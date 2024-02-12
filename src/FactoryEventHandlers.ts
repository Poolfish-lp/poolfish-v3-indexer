import {
    FactoryContract_PoolCreated_loader,
    FactoryContract_PoolCreated_handlerAsync,
} from '../generated/src/Handlers.gen'

import {
    FactoryEntity,
    PoolEntity,
    TokenEntity,
} from '../generated/src/Types.gen'
import { ZERO_BD, ZERO_BI } from './constants'
import { addressToDex } from './utils/addressToDex'

import { getOrCreateToken_async } from './async/token'

// event event PoolCreated(address indexed pool, address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing)
FactoryContract_PoolCreated_loader(async ({ event, context }) => {
    let factoryAddress = event.srcAddress
    await context.Factory.load(factoryAddress)
    // used to register dynamic contracts ie. contracts that are registered at runtime
    await context.contractRegistration.addPool(event.params.pool)
})

FactoryContract_PoolCreated_handlerAsync(async ({ event, context }) => {
    let factoryAddress = event.srcAddress
    let factory = await context.Factory.get(factoryAddress)

    const dexKey = addressToDex(event.srcAddress)

    if (factory == null) {
        let factoryObject: FactoryEntity = {
            id: factoryAddress,
            poolCount: 0n,
            dexKey: dexKey,
        }
        await context.Factory.set(factoryObject)

        let bundleObject = {
            id: '1',
            ethPriceUSD: ZERO_BD,
        }
        await context.Bundle.set(bundleObject)
    } else {
        let factoryObject: FactoryEntity = {
            ...factory,
            poolCount: factory.poolCount + 1n,
        }

        await context.Factory.set(factoryObject)
    }

    // let decimals = 6n; //fetchTokenDecimals(event.params.token0);
    // bail if we couldn't figure out the decimals
    // if (decimals === null) {
    //   await context.log.info("mybug the decimal on token 0 was null");
    //   return;
    // }

    // create tokens
    let token0Object: TokenEntity = await getOrCreateToken_async(
        event,
        event.params.token0,
        context.Token.get,
    )

    await context.Token.set(token0Object)

    let token1Object: TokenEntity = await getOrCreateToken_async(
        event,
        event.params.token1,
        context.Token.get,
    )

    await context.Token.set(token1Object)

    let poolObject: PoolEntity = {
        id: event.params.pool,
        createdAtTimestamp: BigInt(event.blockTimestamp), // can see this list of available properties here https://docs.envio.dev/docs/event-handlers
        tick: ZERO_BI,
        dexKey: dexKey,
        token0: token0Object.id,
        token1: token1Object.id,
        feeTier: BigInt(event.params.fee), //BigInt.fromI32(event.params.fee),
        createdAtBlockNumber: BigInt(event.blockNumber),
        liquidityProviderCount: ZERO_BI,
        txCount: ZERO_BI,
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
    }

    // poolToToken[event.params.pool] = {
    //   token0: token0Object.id,
    //   token1: token1Object.id,
    // };

    await context.Pool.set(poolObject)
})
