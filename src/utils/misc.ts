/* eslint-disable prefer-const */
// import { BigInt, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
// import { Transaction } from "../../generated/schema";
import bigInt, { BigInteger } from 'big-integer'
import { ONE_BI, ZERO_BI, ZERO_BD, ONE_BD } from '../constants'
import Big from 'big.js'
import { Hash, createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import poolAbi from '../../abis/pool.json'

export function exponentToBig(decimals: BigInt): Big {
    let bd = ONE_BD
    for (
        let i = bigInt(ZERO_BI);
        bigInt(i).lt(bigInt(decimals.toString()));
        i = bigInt(i).plus(ONE_BI)
    ) {
        bd = bd.times(10)
    }

    return bd
}

// // return 0 if denominator is 0 in division
export function safeDiv(amount0: Big, amount1: Big): Big {
    if (amount1.eq(ZERO_BD)) {
        return ZERO_BD
    } else {
        return amount0.div(amount1)
    }
}

// export function bigDecimalExponated(
//   value: BigDecimal,
//   power: BigInt
// ): BigDecimal {
//   if (power.equals(ZERO_BI)) {
//     return ONE_BD;
//   }
//   let negativePower = power.lt(ZERO_BI);
//   let result = ZERO_BD.plus(value);
//   let powerAbs = power.abs();
//   for (let i = ONE_BI; i.lt(powerAbs); i = i.plus(ONE_BI)) {
//     result = result.times(value);
//   }

//   if (negativePower) {
//     result = safeDiv(ONE_BD, result);
//   }

//   return result;
// }

// export function tokenAmountToDecimal(
//   tokenAmount: BigInt,
//   exchangeDecimals: BigInt
// ): BigDecimal {
//   if (exchangeDecimals == ZERO_BI) {
//     return tokenAmount.toBigDecimal();
//   }
//   return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
// }

// export function priceToDecimal(
//   amount: BigDecimal,
//   exchangeDecimals: BigInt
// ): BigDecimal {
//   if (exchangeDecimals == ZERO_BI) {
//     return amount;
//   }
//   return safeDiv(amount, exponentToBigDecimal(exchangeDecimals));
// }

// export function equalToZero(value: BigDecimal): boolean {
//   const formattedVal = parseFloat(value.toString());
//   const zero = parseFloat(ZERO_BD.toString());
//   if (zero == formattedVal) {
//     return true;
//   }
//   return false;
// }

// export function isNullEthValue(value: string): boolean {
//   return (
//     value ==
//     "0x0000000000000000000000000000000000000000000000000000000000000001"
//   );
// }

// export function bigDecimalExp18(): BigDecimal {
//   return BigDecimal.fromString("1000000000000000000");
// }

export function convertTokenToDecimal(
    tokenAmount: BigInt,
    exchangeDecimals: BigInt,
): Big {
    if (exchangeDecimals == ZERO_BI) {
        return new Big(tokenAmount.toString())
    }
    return new Big(tokenAmount.toString()).div(exponentToBig(exchangeDecimals))
}

// export function convertEthToDecimal(eth: BigInt): BigDecimal {
//   return eth.toBigDecimal().div(exponentToBigDecimal(18));
// }

// export function loadTransaction(event: ethereum.Event): Transaction {
//   let transaction = Transaction.load(event.transaction.hash.toHexString());
//   if (transaction === null) {
//     transaction = new Transaction(event.transaction.hash.toHexString());
//   }
//   transaction.blockNumber = event.block.number;
//   transaction.timestamp = event.block.timestamp;
//   transaction.gasUsed = ZERO_BI; // event.transaction.gasUsed // This requires 'receipt: true' for the events, ignore this to speed up sync time?
//   transaction.gasPrice = event.transaction.gasPrice;
//   transaction.save();
//   return transaction as Transaction;
// }

export function getClient() {
    const transport = http(
        'https://rpc.ankr.com/eth/8d7bb95e5244583f1ca906aa42e9009af099d263ec4baab64f36591637c2f707',
    )
    return createPublicClient({
        chain: mainnet,
        transport: transport,
    })
}

export async function getFeeGrowthGlobal0X128(
    poolAddress: Hash,
): Promise<BigInt> {
    //TODO: probably need to read this from a specific block number
    const data = await getClient().readContract({
        address: poolAddress,
        abi: poolAbi,
        functionName: 'feeGrowthGlobal0X128',
    })
    return data as BigInt
}

export async function getFeeGrowthGlobal1X128(
    poolAddress: Hash,
): Promise<BigInt> {
    const data = await getClient().readContract({
        address: poolAddress,
        abi: poolAbi,
        functionName: 'feeGrowthGlobal1X128',
    })
    return data as BigInt
}
