/* 
  https://docs.envio.dev/docs/logging
  Helpful doc for debugging can use for example 
  context.log.info("This log was an info")
  context.log.error("This log was error")
  */

import {
  UniPoolContract_Initialize_loader,
  UniPoolContract_Initialize_handler,
} from "./src/Handlers.gen";

import { PoolEntity } from "./src/Types.gen";

// event Initialize(uint160 sqrtPriceX96, int24 tick)
UniPoolContract_Initialize_loader(({ event, context }) => {}); // don't need a loader for this event as no entities will be updated in the handler

UniPoolContract_Initialize_handler(({ event, context }) => {
  let tick = event.params.tick;
  let sqrtPrice = event.params.sqrtPriceX96;

  let poolObject: PoolEntity = {
    id: event.srcAddress,
    createdAtTimestamp: event.blockTimestamp, // can see this list of available properties here https://docs.envio.dev/docs/event-handlers
    sqrtPrice: sqrtPrice,
    tick: tick,
  };

  context.Pool.set(poolObject);
});
