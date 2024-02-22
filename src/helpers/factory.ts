import { FactoryEntity as Factory } from '../../generated/src/Types.gen'

export const getFactory_async = async (
    id: string,
    loader: (id: string) => Promise<Factory | undefined>,
) => {
    let factory = await loader(id.toLowerCase())

    if (!factory) {
        let errMsg = 'Non existent factory'
        console.log(errMsg)
        throw new Error(errMsg)
    }

    return factory
}
