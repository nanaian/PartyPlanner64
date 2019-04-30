import { IEvent, IEventWriteInfo, IEventParseInfo } from "../events";
import { EventActivationType, EventExecutionType, Game, EventParameterType } from "../../types";
import { hashEqual, copyRange } from "../../utils/arrays";
import { addConnection, ISpaceEvent } from "../../boards";
import { prepAsm } from "../prepAsm";
import { assemble } from "mips-assembler";
import { addEventToLibrary } from "../EventLibrary";

// Represents the "event" that takes the player from one chain to another.
// This won't be an actual event when exposed to the user.
export const ChainMerge: IEvent = {
  id: "CHAINMERGE",
  name: "",
  activationType: EventActivationType.WALKOVER,
  executionType: EventExecutionType.DIRECT,
  parameters: [
    { name: "prevSpace", type: EventParameterType.Number, },
    { name: "chain", type: EventParameterType.Number, },
    { name: "spaceIndex", type: EventParameterType.Number, },
  ],
  fakeEvent: true,
  supportedGames: [
    Game.MP1_USA,
    Game.MP2_USA,
  ],
  parse(dataView: DataView, info: IEventParseInfo) {
    const hashes = {
      // Same start and end hashes for MP1, MP2
      START: "d218c758ea3247b6e5ec2ae0c3568a92", // +0x0C
      END: "560c69d6e851f4a22984b74c660e8536", // [0x18/0x24]+0x0C

      EXTRA_CALL_START: "BABAF76D201027AE882BEB58BB38B4EB" // +0x18
    };

    let nextChain, nextSpace;

    // See if this is the the stock, inefficient method.
    if (hashEqual([dataView.buffer, info.offset, 0x0C], hashes.START)) { // First 3 instructions
      if (hashEqual([dataView.buffer, info.offset + 0x18, 0x0C], hashes.END)) { // Last 3 instructions
        // Read the chain we are going to.
        nextChain = dataView.getUint16(info.offset + 0x0E);
        nextChain = nextChain > 1000 ? 0 : nextChain; // R0 will be 0x2821 - just check for "way to big".

        // Read the offset into the chain.
        if (dataView.getUint16(info.offset + 0x14) === 0) // Usually this is an add with R0.
          nextSpace = info.chains[nextChain][0];
        else
          nextSpace = info.chains[nextChain][dataView.getUint16(info.offset + 0x16)];

        // This isn't an event really - write directly to the board links.
        if (!isNaN(nextSpace))
          addConnection(info.curSpace, nextSpace, info.board);

        return true;
      }
    }

    // There is another MP1 variation that sends A0 with something else than -1.
    if (hashEqual([dataView.buffer, info.offset, 0x18], hashes.EXTRA_CALL_START)) {
      if (hashEqual([dataView.buffer, info.offset + 0x24, 12], hashes.END)) { // Last 3 instructions
        // Read the chain we are going to.
        nextChain = dataView.getUint16(info.offset + 0x1A);
        nextChain = nextChain > 1000 ? 0 : nextChain; // R0 will be 0x2821 - just check for "way to big".

        // Read the offset into the chain.
        if (dataView.getUint16(info.offset + 0x20) === 0) // Usually this is an add with R0.
          nextSpace = info.chains[nextChain][0];
        else
          nextSpace = info.chains[nextChain][dataView.getUint16(info.offset + 0x22)];

        // This isn't an event really - write directly to the board links.
        if (typeof nextSpace === "number")
          addConnection(info.curSpace, nextSpace, info.board);

        return true;
      }
    }

    return false;
  },

  // TODO: We can do a O(1) + n/2 style improvement for this event.
  write(dataView: DataView, event: ISpaceEvent, info: IEventWriteInfo, temp: any) {
    const asm = `
      ADDIU SP, SP, -0x18
      SW    RA, 0x10(SP)
      ADDIU A0, R0, -1
      ADDIU A1, R0, ${event.parameterValues!.chain as number}
      JAL   SetNextChainAndSpace
      ADDIU A2, R0, ${event.parameterValues!.spaceIndex || 0}
      LW    RA, 0x10(SP)
      JR    RA
      ADDIU SP, SP, 0x18
    `;

    if (info.gameVersion !== 2) {
      return asm;
    }
    const bytes = assemble(prepAsm(asm, ChainMerge, event, info)) as ArrayBuffer;
    copyRange(dataView, bytes, 0, 0, bytes.byteLength);
    return [info.offset!, bytes.byteLength];
  }
};
addEventToLibrary(ChainMerge);
