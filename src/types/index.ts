import type { EventLog } from '../../generated/src/Types.gen'

export type Event<Params extends object = {}> = EventLog<Params>

export type Address = string
