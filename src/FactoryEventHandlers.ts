import {
    FactoryContract_PoolCreated_loader,
    FactoryContract_PoolCreated_handler,
} from '../generated/src/Handlers.gen'

import {
    FactoryEntity,
    PoolEntity,
    TokenEntity,
} from '../generated/src/Types.gen'
import { ZERO_BD, ZERO_BD_STR, ZERO_BI } from './constants'
import { addressToDex } from './utils/addressToDex'
import { getPoolAddressToInfo } from './utils/getPoolAddressToInfo'
import _ from 'lodash'

// event event PoolCreated(address indexed pool, address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing)
FactoryContract_PoolCreated_loader(({ event, context }) => {
    let factoryAddress = event.srcAddress
    context.Factory.load(factoryAddress)
    // used to register dynamic contracts ie. contracts that are registered at runtime
    context.contractRegistration.addPool(event.params.pool)

    context.Token.load(event.params.token0.toLowerCase(), {})
    context.Token.load(event.params.token1.toLowerCase(), {})
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

        let bundleObject = {
            id: '1',
            ethPriceUSD: ZERO_BD_STR,
        }
        context.Bundle.set(bundleObject)
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

    // check if tokens already exist
    let token0Object: TokenEntity | undefined = context.Token.get(
        event.params.token0.toLowerCase(),
    )
    let token1Object: TokenEntity | undefined = context.Token.get(
        event.params.token1.toLowerCase(),
    )

    if (token0Object == undefined) {
        // create tokens
        token0Object = {
            id: event.params.token0.toLowerCase(),
            symbol: poolInfo.token0.symbol, //fetchTokenSymbol(event.params.token0),
            name: poolInfo.token0.name, //fetchTokenName(event.params.token0),
            totalSupply: BigInt(poolInfo.token0.totalSupply), //fetchTokenTotalSupply(event.params.token0),
            decimals: BigInt(poolInfo.token0.decimals),
            derivedETH: ZERO_BD_STR,
            volume: ZERO_BD_STR,
            volumeUSD: ZERO_BD_STR,
            feesUSD: ZERO_BD_STR,
            untrackedVolumeUSD: ZERO_BD_STR,
            totalValueLocked: ZERO_BD_STR,
            totalValueLockedUSD: ZERO_BD_STR,
            totalValueLockedUSDUntracked: ZERO_BD_STR,
            txCount: ZERO_BI,
            poolCount: ZERO_BI,
            whitelistPools: [],
        }
        context.Token.set(token0Object)
    }

    if (token1Object == undefined) {
        // create tokens
        token1Object = {
            id: event.params.token1.toLowerCase(),
            symbol: poolInfo.token1.symbol, //fetchTokenSymbol(event.params.token0),
            name: poolInfo.token1.name, //fetchTokenName(event.params.token0),
            totalSupply: BigInt(poolInfo.token1.totalSupply), //fetchTokenTotalSupply(event.params.token0),
            decimals: BigInt(poolInfo.token1.decimals),
            derivedETH: ZERO_BD_STR,
            volume: ZERO_BD_STR,
            volumeUSD: ZERO_BD_STR,
            feesUSD: ZERO_BD_STR,
            untrackedVolumeUSD: ZERO_BD_STR,
            totalValueLocked: ZERO_BD_STR,
            totalValueLockedUSD: ZERO_BD_STR,
            totalValueLockedUSDUntracked: ZERO_BD_STR,
            txCount: ZERO_BI,
            poolCount: ZERO_BI,
            whitelistPools: [],
        }
        context.Token.set(token1Object)
    }

    // update white listed pools
    // I think any pools from subgraph are whitelisted?
    // if (WHITELISTED_TOKEN_ADDRESSES.includes(token0.id)) {
    const token1ObjectUpdated: TokenEntity = {
        ...token1Object,
        whitelistPools: _.concat(
            token1Object.whitelistPools,
            event.params.pool,
        ),
    }
    context.Token.set(token1ObjectUpdated)
    // }
    // if (WHITELISTED_TOKEN_ADDRESSES.includes(token1.id)) {
    const token0ObjectUpdated: TokenEntity = {
        ...token0Object,
        whitelistPools: _.concat(
            token0Object.whitelistPools,
            event.params.pool,
        ),
    }
    context.Token.set(token0ObjectUpdated)
    // }

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
        token0Price: ZERO_BD_STR,
        token1Price: ZERO_BD_STR,
        observationIndex: ZERO_BI,
        totalValueLockedToken0: ZERO_BD_STR,
        totalValueLockedToken1: ZERO_BD_STR,
        totalValueLockedUSD: ZERO_BD_STR,
        totalValueLockedETH: ZERO_BD_STR,
        totalValueLockedUSDUntracked: ZERO_BD_STR,
        volumeToken0: ZERO_BD_STR,
        volumeToken1: ZERO_BD_STR,
        volumeUSD: ZERO_BD_STR,
        feesUSD: ZERO_BD_STR,
        untrackedVolumeUSD: ZERO_BD_STR,

        collectedFeesToken0: ZERO_BD_STR,
        collectedFeesToken1: ZERO_BD_STR,
        collectedFeesUSD: ZERO_BD_STR,
    }

    // poolToToken[event.params.pool] = {
    //   token0: token0Object.id,
    //   token1: token1Object.id,
    // };

    context.Pool.set(poolObject)
})
