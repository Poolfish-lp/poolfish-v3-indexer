/* eslint-disable prefer-const */
// import { bigDecimalExponated, safeDiv } from './misc'
import { ONE_BD_STR, ZERO_BD_STR, ZERO_BD, ZERO_BI } from '../constants'
import { TickEntity } from '../../generated/src/Types.gen'
import bigInt from 'big-integer'
import { getClient } from './misc'
import poolAbi from '../../abis/pool.json'

export function createTick(
    tickId: string,
    tickIdx: BigInt,
    poolId: string,
    event: any,
): TickEntity {
    const tick: TickEntity = {
        id: tickId,
        tickIdx: BigInt(tickIdx.toString()),
        pool: poolId,
        poolAddress: poolId,
        createdAtTimestamp: event.blockTimestamp,
        createdAtBlockNumber: event.blockNumber,
        liquidityGross: ZERO_BI,
        liquidityNet: ZERO_BI,
        liquidityProviderCount: ZERO_BI,
        price0: ONE_BD_STR,
        price1: ONE_BD_STR,
        volumeToken0: ZERO_BD_STR,
        volumeToken1: ZERO_BD_STR,
        volumeUSD: ZERO_BD_STR,
        feesUSD: ZERO_BD_STR,
        untrackedVolumeUSD: ZERO_BD_STR,
        collectedFeesToken0: ZERO_BD_STR,
        collectedFeesToken1: ZERO_BD_STR,
        collectedFeesUSD: ZERO_BD_STR,
        feeGrowthOutside0X128: ZERO_BI,
        feeGrowthOutside1X128: ZERO_BI,
    }
    return tick
}

export function feeTierToTickSpacing(feeTier: BigInt): BigInt {
    const ft = bigInt(feeTier.toString())
    if (ft.equals(10000)) {
        return BigInt(200)
    }
    //TODO: add pancakeswap feetier here
    if (ft.equals(3000)) {
        return BigInt(60)
    }
    if (ft.equals(500)) {
        return BigInt(10)
    }
    if (ft.equals(100)) {
        return BigInt(1)
    }

    throw Error('Unexpected fee tier')
}

export async function updateTickFeeVarsAndSave(
    context: any,
    tick: TickEntity,
    event: any,
): Promise<void> {
    let poolAddress = event.address
    // not all ticks are initialized so obtaining null is expected behavior
    //TODO uncomment this section
    // const tickResult: any = await getClient().readContract({
    //     address: poolAddress,
    //     abi: poolAbi,
    //     functionName: 'ticks',
    //     args: [tick.tickIdx],
    // })
    // const tickObject: TickEntity = {
    //     ...tick,
    //     feeGrowthOutside0X128: tickResult?.value2,
    //     feeGrowthOutside1X128: tickResult?.value3,
    // }
    // context.Tick.set(tickObject)

    // We aren't using tickdaydata currently
    // let timestamp = BigInt(event.block.timestamp)
    // let dayID = bigInt(timestamp).divide(86400).toJSNumber()
    // let dayStartTimestamp = dayID * 86400
    // let tickDayDataID = tick.id.concat('-').concat(dayID.toString())
    // let tickDayData = TickDayData.load(tickDayDataID)
    // if (tickDayData === null) {
    //     tickDayData = new TickDayData(tickDayDataID)
    //     tickDayData.date = dayStartTimestamp
    //     tickDayData.pool = tick.pool
    //     tickDayData.tick = tick.id
    // }
    // tickDayData.liquidityGross = tick.liquidityGross
    // tickDayData.liquidityNet = tick.liquidityNet
    // tickDayData.volumeToken0 = tick.volumeToken0
    // tickDayData.volumeToken1 = tick.volumeToken0
    // tickDayData.volumeUSD = tick.volumeUSD
    // tickDayData.feesUSD = tick.feesUSD
    // tickDayData.feeGrowthOutside0X128 = tick.feeGrowthOutside0X128
    // tickDayData.feeGrowthOutside1X128 = tick.feeGrowthOutside1X128

    // tickDayData.save()

    // return tickDayData as TickDayData
}

export function loadTickUpdateFeeVarsAndSave(
    context: any,
    tickId: string,
    event: any,
): void {
    let poolAddress = event.address

    //TODO: make this be a get instead of load
    let tick = context.load.Tick(
        poolAddress.toHexString().concat('#').concat(tickId.toString()),
    )
    if (tick !== null) {
        updateTickFeeVarsAndSave(context, tick!, event)
    }
}
