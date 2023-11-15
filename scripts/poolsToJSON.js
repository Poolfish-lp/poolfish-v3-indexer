const { querySubgraph } = require("../src/utils/querySubgraph");
const fs =  require("fs");

async function poolsToJSON() {
  const processedData = {};

  let page = 0;
  let uniswapData = {};
  do {
    uniswapData = await querySubgraph(
      `{
        pools (first: 300, skip: ${
          page * 300
        }, orderBy: totalValueLockedUSD, orderDirection: desc, where: {liquidity_gt: 0, totalValueLockedUSD_gte: 1000, volumeUSD_gte: 10000}) {
          id
        }
      }
  `,
      "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
    );
    console.log("uniswapData", uniswapData)
    if(uniswapData.data.pools) {
      for (let pool of uniswapData.data.pools) {
        processedData[pool.id] = "uniswap";
      }
    }
    page++;
  } while (uniswapData.data.pools && uniswapData.data.pools.length > 0);

  const filepath = "./src/poolAddressToDex.json";
  console.log('data', processedData)
  fs.writeFileSync(filepath, JSON.stringify(processedData, 2, 2));
  console.log('Wrote pools out to ./src/poolAddressToDex.json')
}

poolsToJSON();
