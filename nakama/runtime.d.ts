// Nakama runtime type definitions (local copy)
// Covers the APIs used in this project

declare namespace nkruntime {
  export interface Context {
    env: { [key: string]: string };
    executionMode: string;
    node: string;
    version: string;
    headers?: { [key: string]: string[] };
    queryParams?: { [key: string]: string[] };
    userId: string;
    username: string;
    vars: { [key: string]: string };
    clientIp: string;
    clientPort: string;
    matchId: string;
    matchNode: string;
    matchLabel: string;
    matchTickRate: number;
  }

  export interface Logger {
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
    debug(msg: string, ...args: any[]): void;
    fields(fields: { [key: string]: string }): Logger;
  }

  export interface Presence {
    userId: string;
    sessionId: string;
    username: string;
    node: string;
    status: string | null;
  }

  export type MatchState = Record<string, any>;

  export interface MatchMessage {
    sender: Presence;
    persistence: boolean;
    status: string;
    opCode: number;
    data: Uint8Array;
    reliable: boolean;
    receiveTimeMs: number;
  }

  export interface MatchDispatcher {
    broadcastMessage(
      opCode: number,
      data: string | Uint8Array | null,
      presences: Presence[] | null,
      sender: Presence | null,
      reliable?: boolean
    ): void;
    matchKick(presences: Presence[]): void;
    matchLabelUpdate(label: string): void;
  }

  export interface MatchmakerResult {
    properties: { [key: string]: string };
    presence: Presence;
    partyId?: string;
  }

  export interface Match {
    matchId: string;
    authoritative: boolean;
    label: string | null;
    size: number;
    tickRate: number;
    handlerName: string;
  }

  export interface LeaderboardRecord {
    leaderboardId: string;
    ownerId: string;
    username: string;
    score: number;
    subscore: number;
    numScore: number;
    metadata: object;
    createTime: number;
    updateTime: number;
    expiryTime: number;
    rank: number;
    maxNumScore: number;
  }

  export interface LeaderboardRecordList {
    records?: LeaderboardRecord[];
    ownerRecords?: LeaderboardRecord[];
    nextCursor?: string;
    prevCursor?: string;
  }

  export interface StorageReadRequest {
    collection: string;
    key: string;
    userId: string;
  }

  export interface StorageWriteRequest {
    collection: string;
    key: string;
    userId: string;
    value: object;
    version?: string;
    permissionRead?: number;
    permissionWrite?: number;
  }

  export interface StorageObject {
    collection: string;
    key: string;
    userId: string;
    value: object;
    version: string;
    permissionRead: number;
    permissionWrite: number;
    createTime: number;
    updateTime: number;
  }

  export interface Nakama {
    matchCreate(module: string, params?: { [key: string]: string }): string;
    matchGet(id: string): Match | null;
    matchList(
      limit: number,
      authoritative: boolean | null,
      label: string | null,
      minSize: number | null,
      maxSize: number | null,
      query: string | null
    ): Match[];
    matchSignal(id: string, data: string): string;

    leaderboardCreate(
      id: string,
      authoritative: boolean,
      sortOrder: string,
      operator: string,
      resetSchedule: string,
      metadata: object | boolean,
      enableRanks?: boolean
    ): void;
    leaderboardRecordWrite(
      id: string,
      ownerId: string,
      username: string,
      score: number,
      subscore: number,
      metadata: object,
      operator?: string
    ): LeaderboardRecord;
    leaderboardRecordsList(
      id: string,
      ownerIds: string[],
      limit: number,
      cursor: string | null,
      expiry: number
    ): LeaderboardRecordList;
    leaderboardRecordDelete(id: string, ownerId: string): void;

    storageRead(keys: StorageReadRequest[]): StorageObject[];
    storageWrite(objects: StorageWriteRequest[]): StorageObject[];
    storageDelete(keys: StorageReadRequest[]): void;

    uuidV4(): string;
    binaryToString(data: Uint8Array): string;
    stringToBinary(str: string): Uint8Array;
  }

  export interface Initializer {
    registerRpc(id: string, func: RpcFunction): void;
    registerMatch(name: string, config: MatchHandler): void;
    registerMatchmakerMatched(func: MatchmakerMatchedFunction): void;
  }

  export type RpcFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    payload: string
  ) => string | void;

  export type MatchmakerMatchedFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    matches: MatchmakerResult[]
  ) => string | void;

  export type InitModule = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    initializer: Initializer
  ) => void;

  export type MatchInitFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    params: { [key: string]: string }
  ) => { state: MatchState; tickRate: number; label: string };

  export type MatchJoinAttemptFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    presence: Presence,
    metadata: { [key: string]: any }
  ) => { state: MatchState; accept: boolean; rejectMessage?: string } | null;

  export type MatchJoinFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    presences: Presence[]
  ) => { state: MatchState } | null;

  export type MatchLeaveFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    presences: Presence[]
  ) => { state: MatchState } | null;

  export type MatchLoopFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    messages: MatchMessage[]
  ) => { state: MatchState } | null;

  export type MatchTerminateFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    graceSeconds: number
  ) => { state: MatchState } | null;

  export type MatchSignalFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    data: string
  ) => { state: MatchState; data?: string } | null;

  export interface MatchHandler {
    matchInit: MatchInitFunction;
    matchJoinAttempt: MatchJoinAttemptFunction;
    matchJoin: MatchJoinFunction;
    matchLeave: MatchLeaveFunction;
    matchLoop: MatchLoopFunction;
    matchTerminate: MatchTerminateFunction;
    matchSignal: MatchSignalFunction;
  }
}
