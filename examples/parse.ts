import { Parser, Option, Command, buildTelnetCommand } from "../mod.ts";

const parser = new Parser();

parser.on("data", (chunk) => {
  // General "in-band" data.
});

parser.on("goahead", () => {
  // Go Ahead was sent.
});

parser.on("negotiation", (command, option) => {
  // General IAC sequences: WILL, WONT, DO, DONT, etc.
});

parser.on("subnegotiation", (option, data) => {
  // Out-of-band (subnegotiation) of an option.
});

parser.on("gmcp", (namespace, data) => {
  /*
    GMCP subnegotiation data.
    Namespace will be of the format "Package[.SubPackages].Message"
    Data will be a string or Object
    If data is an empty string, then there was no data provided.
  */
});

parser.on("send", (chunk) => {
  // Data to be sent to remote end.
});

parser.accumulate(new Uint8Array([Command.IAC, Command.GA])); // Accumulate a GA.

parser.accumulate(
  buildTelnetCommand(
    Command.SB,
    Option.GMCP,
    new TextEncoder().encode(
      "Core.Hello " +
        JSON.stringify({ client: "deno-telnet", version: "0.1.0" }),
    ),
  ),
); // Accumulate a GMCP subnegotiation.
