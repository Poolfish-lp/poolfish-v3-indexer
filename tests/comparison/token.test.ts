import axios from 'axios'
import { theGraphEndpoint, envioEndpoint, usdcAddress } from '../constants'

describe('Token data comparison tests', () => {
    test('Fetch and compare usdc token data', async () => {
        // Fetch token data from GraphQL endpoint
        const graphqlTokenData = await fetchUSDCTokenDataFromTheGraph()

        // Fetch token data from Envio endpoint
        const envioTokenData = await fetchUSDCTokenDataFromEnvio()

        // Perform comparison
        expect(graphqlTokenData).toEqual(envioTokenData)
    })
    test('Fetch token data from GraphQL endpoint and Envio endpoint and compare', async () => {
        // Fetch token data from GraphQL endpoint
        const graphqlTokenData = await fetch500TokenDataFromTheGraph()

        // Fetch token data from Envio endpoint
        const envioTokenData = await fetch500TokenDataFromEnvio()

        // Perform comparison
        expect(graphqlTokenData).toEqual(envioTokenData)
    })
})

async function fetchUSDCTokenDataFromTheGraph() {
    const theGraphQuery = `
    { token(id: "${usdcAddress}") {
        id
        name
        symbol
        volumeUSD
        decimals
        }
        }`

    try {
        // Make GraphQL query to fetch token data
        const response = await axios.post(theGraphEndpoint, {
            query: theGraphQuery,
        })

        return response.data.data.token
    } catch (error) {
        console.error('Error fetching token data from GraphQL endpoint:', error)
        throw error
    }
}

async function fetchUSDCTokenDataFromEnvio() {
    const envioQuery = `
    query MyQuery {
        Token( where: {id: {_eq: "${usdcAddress}"}}) {
          id
          name
          symbol
          volumeUSD    
          decimals
        }
      }
      `

    try {
        // Make GraphQL query to fetch token data
        const response = await axios.post(envioEndpoint, {
            query: envioQuery,
        })
        return response.data.data.Token
    } catch (error) {
        console.error('Error fetching token data from GraphQL endpoint:', error)
        throw error
    }
}

async function fetch500TokenDataFromTheGraph() {
    const theGraphQuery = `
    { tokens(skip: 0, first: 500, orderBy: volumeUSD, orderDirection: desc) {
        id
        name
        symbol
        volumeUSD
        decimals
        }
        }`

    try {
        // Make GraphQL query to fetch token data
        const response = await axios.post(theGraphEndpoint, {
            query: theGraphQuery,
        })

        return response.data.data.tokens
    } catch (error) {
        console.error('Error fetching token data from GraphQL endpoint:', error)
        throw error
    }
}

async function fetch500TokenDataFromEnvio() {
    const envioQuery = `
    query MyQuery {
        Token(limit: 500) {
          id
          name
          symbol
          volumeUSD    
          decimals
        }
      }
      `

    try {
        // Make GraphQL query to fetch token data
        const response = await axios.post(envioEndpoint, {
            query: envioQuery,
        })
        return response.data.data.Token
    } catch (error) {
        console.error('Error fetching token data from GraphQL endpoint:', error)
        throw error
    }
}
