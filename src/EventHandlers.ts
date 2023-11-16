/* 
  https://docs.envio.dev/docs/logging
  Helpful doc for debugging can use for example 
  context.log.info("This log was an info")
  context.log.error("This log was error")
  */

import {
  FactoryContract_PoolCreated_loader,
  FactoryContract_PoolCreated_handler,
  PoolContract_Initialize_loader,
  PoolContract_Initialize_handler,
} from "../generated/src/Handlers.gen";

import { FactoryEntity, PoolEntity } from "../generated/src/Types.gen";
import { ZERO_BD, ZERO_BI } from "./constants";
import { addressToDex } from "./utils/addressToDex";
import { getPoolAddressToDex } from "./utils/getPoolAddressToDex";

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

  const dexKey = getPoolAddressToDex(event.params.pool);
  if (!dexKey) {
    return null;
  }

  let poolObject: PoolEntity = {
    id: event.params.pool,
    createdAtTimestamp: BigInt(event.blockTimestamp), // can see this list of available properties here https://docs.envio.dev/docs/event-handlers
    tick: ZERO_BI,
    dexKey: dexKey,
    //   token0: token0.id,
    // token1: token1.id,
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

  context.Pool.set(poolObject);
});

// event Initialize(uint160 sqrtPriceX96, int24 tick)
PoolContract_Initialize_loader(({ event, context }) => {
  let poolAddress = event.srcAddress;
  context.Pool.load(poolAddress);
});

PoolContract_Initialize_handler(({ event, context }) => {
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
