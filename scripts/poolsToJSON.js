const { querySubgraph } = require("../src/utils/querySubgraph");
const fs = require("fs");

const dexKeys = {
  uniswap: "uniswap",
  pancakeswap: "pancakeswap",
};

const subgraphs = [
  {
    endpoint: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    key: dexKeys.uniswap,
  },
  {
    endpoint:
      "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-bsc",
    key: dexKeys.uniswap,
  },
  {
    endpoint:
      "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-eth",
    key: dexKeys.pancakeswap,
  },
  {
    endpoint:
      "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
    key: dexKeys.pancakeswap,
  },
];

async function poolsToJSON() {
  const processedData = {};

  for (let subgraph of subgraphs) {
    let page = 0;
    let response = {};
    do {
      response = await querySubgraph(
        `{
        pools (first: 300, skip: ${
          page * 300
        }, orderBy: totalValueLockedUSD, orderDirection: desc, where: {liquidity_gt: 0, totalValueLockedUSD_gte: 1000, volumeUSD_gte: 10000}) {
          id
        }
      }
  `,
        subgraph.endpoint
      );
      console.log("uniswapData", response);
      if (response.data.pools) {
        for (let pool of response.data.pools) {
          processedData[pool.id] = subgraph.key;
        }
      }
      page++;
    } while (response.data.pools && response.data.pools.length > 0);
  }

  const filepath = "./src/poolAddressToDex.json";
  fs.writeFileSync(filepath, JSON.stringify(processedData, 2, 2));
  console.log("Wrote pools out to ./src/poolAddressToDex.json");
}

poolsToJSON();
