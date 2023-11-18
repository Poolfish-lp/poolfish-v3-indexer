import {
  FactoryContract_PoolCreated_loader,
  FactoryContract_PoolCreated_handler,
  PoolContract_Initialize_loader,
  PoolContract_Initialize_handler,
  PoolContract_Mint_loader,
  PoolContract_Mint_handler,
} from "../generated/src/Handlers.gen";

import {
  FactoryEntity,
  PoolEntity,
  TokenEntity,
} from "../generated/src/Types.gen";
import { ONE_BI, ZERO_BD, ZERO_BI } from "./constants";
import { addressToDex } from "./utils/addressToDex";
import { getPoolAddressToInfo } from "./utils/getPoolAddressToInfo";
import bigInt from "big-integer";
import { convertTokenToDecimal } from "./utils/misc";
import { poolToToken } from "./utils/globalState";

// event event PoolCreated(address indexed pool, address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing)
FactoryContract_PoolCreated_loader(({ event, context }) => {
  let factoryAddress = event.srcAddress;
  context.Factory.load(factoryAddress);
  // used to register dynamic contracts ie. contracts that are registered at runtime
  context.contractRegistration.addPool(event.params.pool);
});

FactoryContract_PoolCreated_handler(({ event, context }) => {
  let factoryAddress = event.srcAddress;
  let factory = context.Factory.get(factoryAddress);

  const poolInfo = getPoolAddressToInfo(event.params.pool);

  if (!poolInfo) {
    context.log.info("no pool info for " + event.params.pool);
    return;
  }

  const dexKey = poolInfo.dexKey;

  if (factory == null) {
    let factoryObject: FactoryEntity = {
      id: factoryAddress,
      poolCount: 0n,
      dexKey: addressToDex(event.srcAddress),
    };
    context.Factory.set(factoryObject);
  } else {
    let factoryObject: FactoryEntity = {
      ...factory,
      poolCount: factory.poolCount + 1n,
    };

    context.Factory.set(factoryObject);
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
  };
  context.Token.set(token0Object);

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
  };
  context.Token.set(token1Object);

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
  };

  // poolToToken[event.params.pool] = {
  //   token0: token0Object.id,
  //   token1: token1Object.id,
  // };

  context.Pool.set(poolObject);
});

// event Initialize(uint160 sqrtPriceX96, int24 tick)
PoolContract_Initialize_loader(({ event, context }) => {
  let poolAddress = event.srcAddress;
  context.Pool.load(poolAddress, {});
});

PoolContract_Initialize_handler(({ event, context }) => {
  const poolInfo = getPoolAddressToInfo(event.srcAddress);
  if (!poolInfo) {
    return;
  }
  let pool = context.Pool.get(event.srcAddress);

  if (pool) {
    let poolObject: PoolEntity = {
      ...pool,
      tick: event.params.tick,
      sqrtPrice: event.params.sqrtPriceX96,
    };
    context.Pool.set(poolObject);
  } else {
    context.log.info("no pool: " + event.srcAddress);
  }
});

PoolContract_Mint_loader(({ event, context }) => {
  let poolAddress = event.srcAddress;
  const poolInfo = getPoolAddressToInfo(poolAddress);
  if (!poolInfo) {
    return;
  }
  context.Pool.load(poolAddress, {
    loaders: {
      loadToken0: true,
      loadToken1: true,
    },
  });
  context.Token.load(poolInfo.token0.id);
  context.Token.load(poolInfo.token1.id);
});

PoolContract_Mint_handler(({ event, context }) => {
  const poolInfo = getPoolAddressToInfo(event.srcAddress);
  if (!poolInfo) {
    return;
  }

  let pool = context.Pool.get(event.srcAddress);
  // let bundle = Bundle.load("1") as Bundle;

  if (!pool) {
    // context.log.info("no pool for this mint: " + event.srcAddress);
    return;
  }

  let token0 = context.Token.get(pool.token0);
  let token1 = context.Token.get(pool.token1);
  if (!token0 || !token1) {
    // context.log.error("no token0 or token1 for this mint: " + event.srcAddress);
    return;
  }
  context.log.info("got tokens for this mint");
  let amount0 = convertTokenToDecimal(event.params.amount0, token0?.decimals);
  let amount1 = convertTokenToDecimal(event.params.amount1, token1?.decimals);

  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it on mint if the new position includes the current tick.
  let liquidity = pool?.liquidity ?? ZERO_BI;
  if (
    pool.tick !== null &&
    bigInt(event.params.tickLower).leq(bigInt(pool.tick)) &&
    bigInt(event.params.tickUpper).gt(bigInt(pool.tick))
  ) {
    liquidity = pool.liquidity + event.params.amount;
  }

  let poolObject: PoolEntity = {
    ...pool,
    liquidity: liquidity,
    txCount: pool.txCount + ONE_BI,
    totalValueLockedToken0: bigInt(pool.totalValueLockedToken0)
      .plus(amount0)
      .toJSNumber(),
    totalValueLockedToken1: bigInt(pool.totalValueLockedToken1)
      .plus(amount1)
      .toJSNumber(),
    totalValueLockedETH: bigInt(pool.totalValueLockedToken0)
      .times(2000) // derivedETH
      .plus(bigInt(pool.totalValueLockedToken1).times(token1.derivedETH))
      .toJSNumber(),
    // totalValueLockedUSD: bigInt(pool.totalValueLockedETH).times(bundle.ethPriceUSD),
  };
  context.Pool.set(poolObject);
});
