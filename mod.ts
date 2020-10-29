import { EventEmitter } from "https://deno.land/x/deno_events@0.1.1/mod.ts";
import { concat } from "https://deno.land/std@0.63.0/bytes/mod.ts";

function decode(input?: Uint8Array): string {
  return new TextDecoder().decode(input);
}
enum ETelnetEvent {
  Data,
  IAC,
  Negotiation,
  SubNegotiation
}

interface ITelnetEvent {
  eventType: ETelnetEvent;
}
interface ITData extends ITelnetEvent {
  buffer: Uint8Array;
}
interface ITIAC extends ITelnetEvent {
  command: number;
}
interface ITNegotiation extends ITelnetEvent {
  command: number;
  option: number;
}
interface ITSubNegotiation extends ITelnetEvent {
  option: number;
  data: Uint8Array;
}

export enum Command {
  /** Mark the start of a negotiation sequence. */
  IAC = 255,
  /** Confirm  */
  WILL = 251,
  /** Tell the other side that we refuse to use an option. */
  WONT = 252,
  /** Request that the other side begin using an option. */
  DO = 253,
  /**  */
  DONT = 254,
  NOP = 241,
  /** Subnegotiation used for sending out-of-band data. */
  SB = 250,
  /** Marks the end of a subnegotiation sequence. */
  SE = 240,
  IS = 0,
  SEND = 1,
  /** Go Ahead */
  GA = 249,
  EOR = 239,
}
export enum Option {
  /** Whether the other side should interpret data as 8-bit characters instead of standard NVT ASCII.  */
  BINARY_TRANSMISSION = 0,
  /** Whether the other side should continue to echo characters. */
  ECHO = 1,
  RECONNECTION = 2,
  SUPPRESS_GO_AHEAD = 3,
  APPROX_MESSAGE_SIZE_NEGOTIATION = 4,
  STATUS = 5,
  TIMING_MARK = 6,
  REMOTE_CONTROLLED_TRANS_ECHO = 7,
  OUTPUT_LINE_WIDTH = 8,
  OUTPUT_PAGE_SIZE = 9,
  OUTPUT_CR_DISPOSITION = 10,
  OUTPUT_HORIZONTAL_TAB_STOPS = 11,
  OUTPUT_HORIZONTAL_TAB_DISPOSITION = 12,
  OUTPUT_FORMFEED_DISPOSITION = 13,
  OUTPUT_VERTICAL_TAB_STOPS = 14,
  OUTPUT_VERTICAL_TAB_DISPOSITION = 15,
  OUTPUT_LINEFEED_DISPOSITION = 16,
  EXTENDED_ASCII = 17,
  LOGOUT = 18,
  BYTE_MACRO = 19,
  DATA_ENTRY_TERMINAL = 20,
  SUPDUP = 21,
  SUPDUP_OUTPUT = 22,
  SEND_LOCATION = 23,
  TERMINAL_TYPE = 24,
  END_OF_RECORD = 25,
  TACACS_USER_IDENTIFICATION = 26,
  OUTPUT_MARKING = 27,
  TERMINAL_LOCATION_NUMBER = 28,
  TELNET_3270_REGIME = 29,
  X3_PAD = 30,
  /**
     * Whether to negotiate about window size (client).
     * @example
     * [IAC, SB, NAWS, WIDTH[1], WIDTH[0], HEIGHT[1], HEIGHT[0], IAC, SE]
     */
  NEGOTIATE_ABOUT_WINDOW_SIZE = 31,
  TERMINAL_SPEED = 32,
  REMOTE_FLOW_CONTROL = 33,
  LINEMODE = 34,
  X_DISPLAY_LOCATION = 35,
  ENVIRONMENT = 36,
  AUTHENTICATION = 37,
  ENCRYPTION = 38,
  NEW_ENVIRONMENT = 39,
  TN3270E = 40,
  XAUTH = 41,
  CHARSET = 42,
  TELNET_REMOTE_SERIAL_PORT = 43,
  COM_PORT_CONTROL = 44,
  TELNET_SUPPRESS_LOCAL_ECHO = 45,
  TELNET_START_TLS = 46,
  KERMIT = 47,
  SEND_URL = 48,
  FORWARD_X = 49,
  TELOPT_PRAGMA_LOGON = 138,
  TELOPT_SSPI_LOGON = 139,
  TELOPT_PRAGMA_HEARTBEAT = 140,
  /** Generic MUD Communication Protocol option.
     * @example
     * [IAC, SB, GMCP, "Package.SubPackage", "JSON", IAC, SE]
     */
  GMCP = 201,
  EXTENDED_OPTIONS_LIST = 255,
  MCCP2 = 86,
  MCCP3 = 87,
}
export enum OptionState {
  DISABLED,
  WAITING,
  ENABLED,
}
export interface IOptionMatrix {
  [key: number]: OptionState;
}
export class OptionMatrix {
  private _options: IOptionMatrix = {};
  public GetState(option: number): OptionState {
    if (this._options[option] === undefined) {
      this._options[option] = OptionState.DISABLED;
    }
    return this._options[option];
  }
  public HasOption(option: number): boolean {
    return this._options[option] !== undefined &&
      this._options[option] === OptionState.ENABLED;
  }
  public SetState(option: number, state: OptionState): void {
    this._options[option] = state;
  }
}
export function escapeIAC(data: Uint8Array): Uint8Array {
  const temp: number[] = [];
  data.forEach((b) => {
    if (b == 255) temp.push(255);
    temp.push(b);
  });
  return new Uint8Array(temp);
}
export function unescapeIAC(data: Uint8Array): Uint8Array {
  const temp: number[] = [];
  for (let i = 0; i < data.byteLength; i++) {
    if (data[i] == 255 && i + 1 < data.byteLength && data[i + 1] == 255) continue; // Skip double IAC
    temp.push(data[i]);
  }
  return new Uint8Array(temp);
}
export function cleanSubnegotiationData(data: Uint8Array): Uint8Array {
  const temp: number[] = [];
  for (let i = 0; i < data.byteLength; i++) {
    if (data[i] === 255 && i + 1 < data.byteLength && data[i + 1] === 255) {
      i++;
    }
    temp.push(data[i]);
  }
  return new Uint8Array(temp);
}
interface IParserEvents {
  data(chunk: Uint8Array): void;
}
export class TelnetBuildError extends Error {
  constructor(message?: string) {
    super(message);
  }
}
interface IParserEvents {
  data(chunk: Uint8Array): void;
  goahead(): void;
  negotiation(command: number, option: number): void;
  subnegotiation(option: number, data: Uint8Array): void;
  gmcp(namespace: string, data: string | { [key: string]: any }): void;
}
export function WILL(option: Option): Uint8Array {
  return buildTelnetCommand(Command.WILL, option);
}
export function WONT(option: Option): Uint8Array {
  return buildTelnetCommand(Command.WONT, option);
}
export function DO(option: Option): Uint8Array {
  return buildTelnetCommand(Command.DO, option);
}
export function DONT(option: Option): Uint8Array {
  return buildTelnetCommand(Command.DONT, option);
}
export function buildGMCP(namespace: string): Uint8Array;
export function buildGMCP(namespace: string, data: any[]): Uint8Array;
export function buildGMCP(
  namespace: string,
  data: { [key: string]: any },
): Uint8Array;
export function buildGMCP(namespace: string, data: string): Uint8Array;
export function buildGMCP(
  namespace: string,
  data?: any[] | { [key: string]: any } | string,
): Uint8Array {
  let d: string = "";
  if (data !== undefined) {
    if (typeof data === "string") {
      d = data;
    } else {
      d = JSON.stringify(data);
    }
  }
  return buildTelnetCommand(
    Command.SB,
    Option.GMCP,
    new TextEncoder().encode(`${namespace} ${d}`),
  );
}
export function buildTelnetCommand(command: Command.GA): Uint8Array;
export function buildTelnetCommand(
  command: number,
  option: number,
): Uint8Array;
export function buildTelnetCommand(
  command: Command.SB,
  option: number,
  data: Uint8Array,
): Uint8Array;
export function buildTelnetCommand(
  command: number,
  option?: number,
  data?: Uint8Array,
): Uint8Array {
  switch (command) {
    case Command.SB:
      if (option === undefined) {
        throw new TelnetBuildError(
          "Option must be provided for a subnegotiation.",
        );
      }
      if (data === undefined) {
        throw new TelnetBuildError(
          "Data must be provided for a subnegotiation.",
        );
      }
      return new Uint8Array(
        [Command.IAC, Command.SB, option, ...escapeIAC(data), Command.IAC, Command.SE],
      );
    case Command.GA:
      return new Uint8Array([Command.IAC, Command.GA]);
    default:
      if (option === undefined) {
        throw new TelnetBuildError("Option must be provided.");
      }
      return new Uint8Array([Command.IAC, command, option]);
  }
}
export class Parser extends EventEmitter<IParserEvents> {
  private buffer: Uint8Array = new Uint8Array(0);
  public accumulate(data: Uint8Array): void {
    enum EParseState {
      Normal,
      IAC,
      Neg,
      SubNeg,
    }
    if (this.buffer.length === 0) this.buffer = data;
    else this.buffer = concat(this.buffer, data);
    const events: ITelnetEvent[] = [];
    let cmd_begin = 0;
    let state: EParseState = EParseState.Normal;
    for (let index = 0; index < this.buffer.length; index++) {
      const val = this.buffer[index];
      switch (state) {
        case EParseState.Normal:
          if (val == Command.IAC) {
            if (cmd_begin < index) {
              events.push(<ITData>({eventType: ETelnetEvent.Data, buffer: this.buffer.slice(cmd_begin, index)}));
            }
            cmd_begin = index;
            state = EParseState.IAC;
          }
          break;
        case EParseState.IAC:
          switch (val) {
            case Command.IAC:
              state = EParseState.Normal;
              break;
            case Command.GA:
            case Command.EOR:
            case Command.NOP:
              events.push(<ITIAC>({eventType: ETelnetEvent.IAC, command: val}));
              cmd_begin = index + 1;
              state = EParseState.Normal;
              break;
            case Command.SB:
              state = EParseState.SubNeg;
              break;
            default:
              state = EParseState.Neg;
              break;
          }
          break;
        case EParseState.Neg:
          const cmd = this.buffer[cmd_begin + 1];
          const opt = this.buffer[index];
          events.push(<ITNegotiation>({eventType: ETelnetEvent.Negotiation, command: cmd, option: opt }));
          cmd_begin = index + 1;
          state = EParseState.Normal;
          break;
        case EParseState.SubNeg:
          if (val == Command.SE) {
            let opt = this.buffer[cmd_begin + 2];
            events.push(<ITSubNegotiation>({eventType: ETelnetEvent.SubNegotiation, option: opt, data: unescapeIAC(this.buffer.slice(cmd_begin + 3, index - 1)) }));
            if (opt == Option.MCCP2 || opt == Option.MCCP3) {
              events.push(<ITData>({eventType: ETelnetEvent.Data, buffer: this.buffer.slice(index + 1) }));
              cmd_begin = this.buffer.length;
              break;
            } else {
              cmd_begin = index + 1;
              state = EParseState.Normal;
            }
          }
          break;
      }
    }
    if (state == EParseState.SubNeg) {
      this.buffer = this.buffer.slice(cmd_begin);
    } else {
      if (cmd_begin < this.buffer.length) {
        events.push(<ITData>({eventType: ETelnetEvent.Data, buffer: this.buffer.slice(cmd_begin) }));
      }
      this.buffer = new Uint8Array(0);
    }
    events.forEach((ev) => {
      let e;
      switch (ev.eventType) {
        case ETelnetEvent.Data:
          e = ev as ITData;
          this.emit("data", e.buffer);
          break;
        case ETelnetEvent.IAC:
          e = ev as ITIAC;
          this.emit("goahead");
          break;
        case ETelnetEvent.Negotiation:
          e = ev as ITNegotiation;
          this.emit("negotiation", e.command, e.option);
          break;
        case ETelnetEvent.SubNegotiation:
          e = ev as ITSubNegotiation;
          this.emit("subnegotiation", e.option, e.data);
          if (e.option == Option.GMCP) {
            // GMCP data
            const dstr = decode(e.data);
            let offset = dstr.indexOf(" ");
            if (offset === -1) offset = dstr.length;
            const namespace = dstr.substring(0, offset);
            const ostr = offset === dstr.length
              ? ""
              : dstr.substring(offset + 1);
            try {
              const obj = JSON.parse(ostr);
              this.emit("gmcp", namespace, obj);
            } catch {
              this.emit("gmcp", namespace, ostr);
            }
          }
          break;
      }
    });
  }
}
