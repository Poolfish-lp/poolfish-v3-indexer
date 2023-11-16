import poolAddressToDex from "./poolAddressToDex.json";

type JSON = { [key: string]: string };

export function getPoolAddressToDex(srcAddress: string): string | null {
  return (poolAddressToDex as JSON)[srcAddress.toLowerCase()];
}
