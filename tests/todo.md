## Example subgraph queries made by poolfish site

## tokens query

tokens(skip: 0, first: 500, orderBy: volumeUSD, orderDirection: desc) {
id
name
symbol
volumeUSD
decimals
}

## ticks query

ticks(first: 1000, skip: ${
        page * 1000
    }, where: { poolAddress: "${poolAddress}" }, orderBy: tickIdx) {
tickIdx
liquidityNet
price0
price1
}
}

## pools query

pools (first: 300, orderBy: totalValueLockedUSD, orderDirection: desc, where: {liquidity_gt: 0, totalValueLockedUSD_gte: ${totalValueLockedUSD_gte}, volumeUSD_gte: ${volumeUSD_gte}}) {
id
token0 {
id
}
token1 {
id
}
feeTier
liquidity
tick
totalValueLockedUSD
poolDayData(first: 15, skip: 1, orderBy: date, orderDirection: desc) {
date
volumeUSD
open
high
low
close
}
}
}

## pool day data query

poolDayDatas(skip: 1, first: ${numberOfDays}, orderBy: date, orderDirection: desc, where:{pool: "${poolAddress}"}) {
volumeUSD
}
}

## positions query

positions(where: {
pool: "${poolAddress}",
liquidity_gt: 0,
}, first: 1000, skip: ${page \* 1000}) {
id
tickLower {
tickIdx
feeGrowthOutside0X128
feeGrowthOutside1X128
}
tickUpper {
tickIdx
feeGrowthOutside0X128
feeGrowthOutside1X128
}
depositedToken0
depositedToken1
liquidity
collectedFeesToken0
collectedFeesToken1
feeGrowthInside0LastX128
feeGrowthInside1LastX128
transaction {
timestamp
}
}
