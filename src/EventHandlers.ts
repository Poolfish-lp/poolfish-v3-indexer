/* 
  https://docs.envio.dev/docs/logging
  Helpful doc for debugging can use for example 
  context.log.info("This log was an info")
  context.log.error("This log was error")
  */

import {
  UniV3FactoryContract_OwnerChanged_loader,
  UniV3FactoryContract_OwnerChanged_handler,
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
  };

  context.Factory.set(factoryObject);
});
