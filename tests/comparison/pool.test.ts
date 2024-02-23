import axios from 'axios'
import {
    theGraphEndpoint,
    envioEndpoint,
    tetherUsdcPoolAddress,
} from '../constants'

describe('Pool data comparison tests', () => {
    test('Fetch and compare tether/usdc pool data', async () => {
        // Fetch token data from GraphQL endpoint
        const graphqlTokenData = await fetchUSDCTokenDataFromTheGraph()

        // Fetch token data from Envio endpoint
        const envioTokenData = await fetchUSDCTokenDataFromEnvio()

        // Perform comparison
        expect(graphqlTokenData).toEqual(envioTokenData)
    })
})

async function fetchUSDCTokenDataFromTheGraph() {
    const theGraphQuery = `
    { 
        pool (id: "${tetherUsdcPoolAddress}") {
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
        totalValueLockedETH
        totalValueLockedToken0
        totalValueLockedToken1
        }
    }`

    try {
        // Make GraphQL query to fetch token data
        const response = await axios.post(theGraphEndpoint, {
            query: theGraphQuery,
        })

        return response.data.data.pool
    } catch (error) {
        console.error('Error fetching token data from GraphQL endpoint:', error)
        throw error
    }
}

async function fetchUSDCTokenDataFromEnvio() {
    const envioQuery = `
    query MyQuery {
        Pool(where: {id: {_eq: "${tetherUsdcPoolAddress}"}}) {
          id
          token1 {
            id
            name
          }
          token0 {
            id
            name
          }
          feeTier
          tick
          liquidity
          totalValueLockedUSD
          totalValueLockedETH
          totalValueLockedToken0
          totalValueLockedToken1
        }
      }
      `

    try {
        // Make GraphQL query to fetch token data
        const response = await axios.post(envioEndpoint, {
            query: envioQuery,
        })
        return response.data.data.Pool
    } catch (error) {
        console.error('Error fetching token data from GraphQL endpoint:', error)
        throw error
    }
}
