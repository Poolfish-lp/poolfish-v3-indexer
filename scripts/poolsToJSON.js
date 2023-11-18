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
          token0 {
            name
            symbol
            totalSupply
            decimals
            id
          }
          token1 {
            name
            symbol
            totalSupply
            decimals
            id
          }
        }
      }
  `,
        subgraph.endpoint
      );
      console.log("uniswapData", response);
      if (response.data.pools) {
        for (let pool of response.data.pools) {
          processedData[pool.id.toLowerCase()] = {
            dexKey: subgraph.key,
            token0: {
              name: pool.token0.name,
              symbol: pool.token0.symbol,
              totalSupply: pool.token0.totalSupply,
              decimals: pool.token0.decimals,
              id: pool.token0.id.toLowerCase(),
            },
            token1: {
              name: pool.token1.name,
              symbol: pool.token1.symbol,
              totalSupply: pool.token1.totalSupply,
              decimals: pool.token1.decimals,
              id: pool.token1.id.toLowerCase(),
            },
          };
        }
      }
      page++;
    } while (response.data.pools && response.data.pools.length > 0);
  }

  const filepath = "./src/utils/poolAddressToInfo.json";
  fs.writeFileSync(filepath, JSON.stringify(processedData, 2, 2));
  console.log("Wrote pools out to ./src/utils/poolAddressToInfo.json");
}

poolsToJSON();
