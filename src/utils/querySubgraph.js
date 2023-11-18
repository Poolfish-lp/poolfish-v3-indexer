const querySubgraph = async (query, subgraphEndpoint) => {
    const data = await fetch(subgraphEndpoint, {
        method: 'post',
        body: JSON.stringify({ query: query }),
    }).then((res) => res.json())
    console.log(data)

    const errors = data?.errors
    if (errors && errors.length > 0) {
        console.error('Subgraph Errors', { errors, query })
        if (
            errors[0].message == 'indexing_error' ||
            errors[0].message == 'Store error: database unavailable'
        ) {
            throw new Error('subgraph_down')
        } else {
            throw new Error(`Subgraph Errors: ${JSON.stringify(errors)}`)
        }
    }

    return data
}

module.exports = { querySubgraph }
