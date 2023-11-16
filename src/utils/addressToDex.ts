const mapper: { [key: string]: string } = {
  "0x1F98431c8aD98523631AE4a59f267346ea31F984": "uniswap",
  "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865": "pancakeswap",
  "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7": "uniswap",
  "0x917933899c6a5F8E37F31E19f92CdBFF7e8FF0e2": "uniswap",
  "0xf78031CBCA409F2FB6876BDFDBc1b2df24cF9bEf": "uniswap",
};

export function addressToDex(address: string): string {
  for (let key of Object.keys(mapper)) {
    if (key.toLowerCase() == address.toLowerCase()) {
      return mapper[key];
    }
  }
  return "unknown";
  //   throw new Error("dex not matched on addressToDex");
}
