// import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";
// import { Factory as FactoryContract } from "../../generated-blah/templates/Pool/Factory";

import Big from 'big.js'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

// export const FACTORY_ADDRESS = Address.fromString("{{ v3.factory.address }}");
export const NETWORK = '{{ network }}'

export const ZERO_BI = 0n // .fromI32(0);
export const ONE_BI = 1n // BigInt.fromI32(1);

export const ZERO_BD_STR = '0' // BigDecimal.fromString("0");
export const ONE_BD_STR = '1' // BigDecimal.fromString("0");
export const ZERO_BD = new Big(ZERO_BD_STR) // BigDecimal.fromString("0");
export const ONE_BD = new Big(ONE_BD_STR) //BigDecimal.fromString("1");
// export const BI_18 = BigInt.fromI32(18);

export const WHITELISTED_TOKEN_ADDRESSES: string[] =
    '{{ v3.whitelistedTokenAddresses }}'.split(',')

export const NATIVE_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' //'{{ v3.native.address }}'  native address for mainnet weth

export const STABLE_TOKEN_ADDRESSES: string[] =
    '{{ v3.stableTokenAddresses }}'.split(',')

export const MINIMUM_ETH_LOCKED = 0 //BigDecimal.fromString(
//   "{{ v3.minimumEthLocked }}"
// );

export const NATIVE_PRICE_POOL = '0x763d3b7296e7c9718ad5b058ac2692a19e5b3638' //Address.fromString("{{ v3.nativePricePool }}") //native address for sushi mainnet
// .toHex()
// .toLowerCase();

// export const factoryContract = FactoryContract.bind(FACTORY_ADDRESS);
