import {
    FactoryContract_PoolCreated_loader,
    FactoryContract_PoolCreated_handler,
} from '../generated/src/Handlers.gen'

import {
    FactoryEntity,
    PoolEntity,
    TokenEntity,
} from '../generated/src/Types.gen'
import { ZERO_BD, ZERO_BI } from './constants'
import { addressToDex } from './utils/addressToDex'
import { getPoolAddressToInfo } from './utils/getPoolAddressToInfo'

// event event PoolCreated(address indexed pool, address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing)
FactoryContract_PoolCreated_loader(({ event, context }) => {
    let factoryAddress = event.srcAddress
    context.Factory.load(factoryAddress)
    // used to register dynamic contracts ie. contracts that are registered at runtime
    context.contractRegistration.addPool(event.params.pool)
})

FactoryContract_PoolCreated_handler(({ event, context }) => {
    let factoryAddress = event.srcAddress
    let factory = context.Factory.get(factoryAddress)

    const poolInfo = getPoolAddressToInfo(event.params.pool)

    if (!poolInfo) {
        context.log.info('no pool info for ' + event.params.pool)
        return
    }

    const dexKey = poolInfo.dexKey

    if (factory == null) {
        let factoryObject: FactoryEntity = {
            id: factoryAddress,
            poolCount: 0n,
            dexKey: addressToDex(event.srcAddress),
        }
        context.Factory.set(factoryObject)
    } else {
        let factoryObject: FactoryEntity = {
            ...factory,
            poolCount: factory.poolCount + 1n,
        }

        context.Factory.set(factoryObject)
    }

    // let decimals = 6n; //fetchTokenDecimals(event.params.token0);
    // bail if we couldn't figure out the decimals
    // if (decimals === null) {
    //   context.log.info("mybug the decimal on token 0 was null");
    //   return;
    // }

    // create tokens
    let token0Object: TokenEntity = {
        id: event.params.token0.toLowerCase(),
        symbol: poolInfo.token0.symbol, //fetchTokenSymbol(event.params.token0),
        name: poolInfo.token0.name, //fetchTokenName(event.params.token0),
        totalSupply: BigInt(poolInfo.token0.totalSupply), //fetchTokenTotalSupply(event.params.token0),
        decimals: BigInt(poolInfo.token0.decimals),
        derivedETH: ZERO_BD,
        volume: ZERO_BD,
        volumeUSD: ZERO_BD,
        feesUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        totalValueLocked: ZERO_BD,
        totalValueLockedUSD: ZERO_BD,
        totalValueLockedUSDUntracked: ZERO_BD,
        txCount: ZERO_BI,
        poolCount: ZERO_BI,
    }
    context.Token.set(token0Object)

    let token1Object: TokenEntity = {
        id: event.params.token1.toLowerCase(),
        symbol: poolInfo.token1.symbol, //fetchTokenSymbol(event.params.token0),
        name: poolInfo.token1.name, //fetchTokenName(event.params.token0),
        totalSupply: BigInt(poolInfo.token1.totalSupply), //fetchTokenTotalSupply(event.params.token0),
        decimals: BigInt(poolInfo.token1.decimals),
        derivedETH: ZERO_BD,
        volume: ZERO_BD,
        volumeUSD: ZERO_BD,
        feesUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        totalValueLocked: ZERO_BD,
        totalValueLockedUSD: ZERO_BD,
        totalValueLockedUSDUntracked: ZERO_BD,
        txCount: ZERO_BI,
        poolCount: ZERO_BI,
    }
    context.Token.set(token1Object)

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

    context.Pool.set(poolObject)
})
