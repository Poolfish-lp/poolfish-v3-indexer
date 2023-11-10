/* 
  https://docs.envio.dev/docs/logging
  Helpful doc for debugging can use for example 
  context.log.info("This log was an info")
  context.log.error("This log was error")
  */

import {
  UniV3FactoryContract_OwnerChanged_loader,
  UniV3FactoryContract_OwnerChanged_handler,
  UniV3FactoryContract_PoolCreated_loader,
  UniV3FactoryContract_PoolCreated_handler,
} from "../generated/src/Handlers.gen";

import { FactoryEntity } from "../generated/src/Types.gen";

// event OwnerChanged(address indexed oldOwner, address indexed newOwner)
UniV3FactoryContract_OwnerChanged_loader(({ event, context }) => {
  let factoryAddress = event.srcAddress;
  context.Factory.load(factoryAddress);
});

UniV3FactoryContract_OwnerChanged_handler(({ event, context }) => {
  let factoryAddress = event.srcAddress;
  let newFactoryOwner = event.params.newOwner;
  let factory = context.Factory.get(factoryAddress);

  let factoryObject: FactoryEntity = {
    id: factoryAddress,
    owner: newFactoryOwner,
    poolCount: 0n,
  };

  context.Factory.set(factoryObject);
});

// event event PoolCreated(address indexed pool, address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing)
UniV3FactoryContract_PoolCreated_loader(({ event, context }) => {
  let factoryAddress = event.srcAddress;
  context.Factory.load(factoryAddress);
});

UniV3FactoryContract_PoolCreated_handler(({ event, context }) => {
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
