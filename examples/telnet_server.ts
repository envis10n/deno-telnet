import * as Telnet from "../mod.ts";

const server = Deno.listen(
  {
    port: Deno.args[0] !== undefined ? Number(Deno.args[0]) : 13337,
    hostname: Deno.args[1] !== undefined ? Deno.args[1] : "127.0.0.1",
    transport: "tcp",
  },
);

console.log("Listening on", server.addr);

for await (const conn of server) {
  console.log("Client connected from:", conn.remoteAddr);
  async function send(data: string): Promise<number> {
    const bytes = new TextEncoder().encode(data + "\r\n");
    await conn.write(bytes);
    return await conn.write(Telnet.buildTelnetCommand(Telnet.Command.GA));
  }
  const parser: Telnet.Parser = new Telnet.Parser();
  parser.on("data", (chunk) => {
    const t = new TextDecoder().decode(chunk);
    console.log("Text:", t);
    send(`echo> ${t}`);
  });
  parser.on("negotiation", (command, option) => {
    console.log("Negotiation:", Telnet.Command[command], Telnet.Option[option]);
  });
  parser.on("subnegotiation", (option, data) => {
    console.log("Subnegotiation:", Telnet.Option[option]);
  });
  parser.on("gmcp", (namespace, data) => {
    console.log("GMCP:", namespace, "|", data);
  });
  conn.write(
    Telnet.buildTelnetCommand(Telnet.Command.WILL, Telnet.Option.GMCP),
  );
  send("Welcome to the Deno Telnet server!");
  for await (const data of Deno.iter(conn)) {
    parser.accumulate(data);
  }
  console.log("Client disconnected.");
}
