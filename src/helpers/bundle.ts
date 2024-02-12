import { BundleEntity as Bundle } from '../../generated/src/Types.gen'

export const getBundle_async = async (
    id: string,
    loader: (id: string) => Promise<Bundle | undefined>,
) => {
    let bundle = await loader(id)

    if (!bundle) {
        let errMsg = 'Non existent bundle'
        console.log(errMsg)
        throw new Error(errMsg)
    }

    return bundle
}
