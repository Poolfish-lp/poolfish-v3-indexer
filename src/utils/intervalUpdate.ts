import { Event } from '../types'

// todo

// export function updatePoolDayData(event: Event): PoolDayData {
//     let timestamp = event.block.timestamp.toI32()
//     let dayID = timestamp / 86400
//     let dayStartTimestamp = dayID * 86400
//     let dayPoolID = event.address
//         .toHexString()
//         .concat('-')
//         .concat(dayID.toString())
//     let pool = Pool.load(event.address.toHexString()) as Pool
//     let poolDayData = PoolDayData.load(dayPoolID)
//     if (poolDayData === null) {
//         poolDayData = new PoolDayData(dayPoolID)
//         poolDayData.date = dayStartTimestamp
//         poolDayData.pool = pool.id
//         // things that dont get initialized always
//         poolDayData.volumeToken0 = ZERO_BD
//         poolDayData.volumeToken1 = ZERO_BD
//         poolDayData.volumeUSD = ZERO_BD
//         poolDayData.feesUSD = ZERO_BD
//         poolDayData.txCount = ZERO_BI
//         poolDayData.feeGrowthGlobal0X128 = ZERO_BI
//         poolDayData.feeGrowthGlobal1X128 = ZERO_BI
//         poolDayData.open = pool.token0Price
//         poolDayData.high = pool.token0Price
//         poolDayData.low = pool.token0Price
//         poolDayData.close = pool.token0Price
//     }

//     if (pool.token0Price.gt(poolDayData.high)) {
//         poolDayData.high = pool.token0Price
//     }
//     if (pool.token0Price.lt(poolDayData.low)) {
//         poolDayData.low = pool.token0Price
//     }

//     poolDayData.liquidity = pool.liquidity
//     poolDayData.sqrtPrice = pool.sqrtPrice
//     poolDayData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128
//     poolDayData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128
//     poolDayData.token0Price = pool.token0Price
//     poolDayData.token1Price = pool.token1Price
//     poolDayData.tick = pool.tick
//     poolDayData.tvlUSD = pool.totalValueLockedUSD
//     poolDayData.txCount = poolDayData.txCount.plus(ONE_BI)
//     poolDayData.save()

//     return poolDayData as PoolDayData
// }

// export function updatePoolHourData(event: ethereum.Event): PoolHourData {
//     let timestamp = event.block.timestamp.toI32()
//     let hourIndex = timestamp / 3600 // get unique hour within unix history
//     let hourStartUnix = hourIndex * 3600 // want the rounded effect
//     let hourPoolID = event.address
//         .toHexString()
//         .concat('-')
//         .concat(hourIndex.toString())
//     let pool = Pool.load(event.address.toHexString()) as Pool
//     let poolHourData = PoolHourData.load(hourPoolID)
//     if (poolHourData === null) {
//         poolHourData = new PoolHourData(hourPoolID)
//         poolHourData.periodStartUnix = hourStartUnix
//         poolHourData.pool = pool.id
//         // things that dont get initialized always
//         poolHourData.volumeToken0 = ZERO_BD
//         poolHourData.volumeToken1 = ZERO_BD
//         poolHourData.volumeUSD = ZERO_BD
//         poolHourData.txCount = ZERO_BI
//         poolHourData.feesUSD = ZERO_BD
//         poolHourData.feeGrowthGlobal0X128 = ZERO_BI
//         poolHourData.feeGrowthGlobal1X128 = ZERO_BI
//         poolHourData.open = pool.token0Price
//         poolHourData.high = pool.token0Price
//         poolHourData.low = pool.token0Price
//         poolHourData.close = pool.token0Price
//     }

//     if (pool.token0Price.gt(poolHourData.high)) {
//         poolHourData.high = pool.token0Price
//     }
//     if (pool.token0Price.lt(poolHourData.low)) {
//         poolHourData.low = pool.token0Price
//     }

//     poolHourData.liquidity = pool.liquidity
//     poolHourData.sqrtPrice = pool.sqrtPrice
//     poolHourData.token0Price = pool.token0Price
//     poolHourData.token1Price = pool.token1Price
//     poolHourData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128
//     poolHourData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128
//     poolHourData.close = pool.token0Price
//     poolHourData.tick = pool.tick
//     poolHourData.tvlUSD = pool.totalValueLockedUSD
//     poolHourData.txCount = poolHourData.txCount.plus(ONE_BI)
//     poolHourData.save()

//     // test
//     return poolHourData as PoolHourData
// }
