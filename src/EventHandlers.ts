/* 
  https://docs.envio.dev/docs/logging
  Helpful doc for debugging can use for example 
  context.log.info("This log was an info")
  context.log.error("This log was error")
  */

import {
  FactoryContract_OwnerChanged_loader,
  FactoryContract_OwnerChanged_handler,
  FactoryContract_PoolCreated_loader,
  FactoryContract_PoolCreated_handler,
  PoolContract_Initialize_loader,
  PoolContract_Initialize_handler,
} from "../generated/src/Handlers.gen";

import { FactoryEntity, PoolEntity } from "../generated/src/Types.gen";
import { addressToDex } from "./utils/addressToDex";
import poolAddressToDex from "./poolAddressToDex.json";

type JSON = { [key: string]: string };

// event OwnerChanged(address indexed oldOwner, address indexed newOwner)
FactoryContract_OwnerChanged_loader(({ event, context }) => {
  let factoryAddress = event.srcAddress;
  context.Factory.load(factoryAddress);
});

FactoryContract_OwnerChanged_handler(({ event, context }) => {
  let factoryAddress = event.srcAddress;
  let newFactoryOwner = event.params.newOwner;
  let factory = context.Factory.get(factoryAddress);

  context.log.info("did get factory address " + addressToDex(event.srcAddress));

  let factoryObject: FactoryEntity = {
    id: factoryAddress,
    owner: newFactoryOwner,
    poolCount: 0n,
    dexKey: addressToDex(event.srcAddress),
  };

  context.Factory.set(factoryObject);
});

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
    context.log.error(
      "Since the ownerChanged event is emitted in the constructor, it should be impossible for this to happen"
    );
  } else {
    let factoryObject: FactoryEntity = {
      ...factory,
      poolCount: factory.poolCount + 1n,
    };

    context.Factory.set(factoryObject);
  }
});

// event Initialize(uint160 sqrtPriceX96, int24 tick)
PoolContract_Initialize_loader(({ event, context }) => {}); // don't need a loader for this event as no entities will be updated in the handler

PoolContract_Initialize_handler(({ event, context }) => {
  let tick = event.params.tick;
  let sqrtPrice = event.params.sqrtPriceX96;
  context.log.info("poolAddressToDex: " + event.srcAddress);

  if (!(poolAddressToDex as JSON)[event.srcAddress]) {
    return null;
  }

  let poolObject: PoolEntity = {
    id: event.srcAddress,
    createdAtTimestamp: event.blockTimestamp, // can see this list of available properties here https://docs.envio.dev/docs/event-handlers
    sqrtPrice: sqrtPrice,
    tick: tick,
    dexKey: (poolAddressToDex as JSON)[event.srcAddress],
  };

  context.Pool.set(poolObject);
});
