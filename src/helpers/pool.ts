import { PoolEntity as Pool } from '../../generated/src/Types.gen'

export const getPool_async = async (
    id: string,
    loader: (id: string) => Promise<Pool | undefined>,
) => {
    let pool = await loader(id)

    if (!pool) {
        let errMsg = 'Non existent pool'
        console.log(errMsg)
        throw new Error(errMsg)
    }

    return pool
}
