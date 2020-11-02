import * as telnet from "../mod.ts";
import { asserts } from "../deps.ts";

Deno.test("subnegotiation", async () => {
  const res = await new Promise<{a: Uint8Array, b: Uint8Array}>((resolve, reject) => {
    const parser: telnet.Parser = new telnet.Parser();
    parser.options.support(201); // GMCP;
    // Build a huge packet
    const packet = telnet.buildGMCP("Core.Hello", { client: "deno_test", version: "0.0.1", randomData: new Array(512).fill(1) });
    // Find mid point
    const packmid = Math.floor(packet.length / 2);
    // Split packet in two, aside from the final SE byte.
    const a = packet.slice(0, packmid);
    const b = packet.slice(packmid, packet.length - 1);
    // The last SE byte
    const c = packet.slice(packet.length - 1);

    // This SHOULD be emitted.
    parser.on("subnegotiation", (option, data) => {
      // Rebuild the packet and return them both
      const npack = telnet.buildTelnetCommand(telnet.Command.SB, option, data);
      resolve({a: packet, b: npack});
    });

    // This should NOT be emitted.
    parser.on("data", (chunk) => {
      resolve({a: packet, b: chunk});
    });

    // Accumulate the 3 buffers into the parser.
    parser.accumulate(a);
    parser.accumulate(b);
    parser.accumulate(c);
  });

  // Deep equals check on the two packets.
  asserts.assertEquals(res.b, res.a);
});